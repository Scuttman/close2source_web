/**
 * dal/organizations.ts
 *
 * All Firestore operations for the `organizations/{id}` collection.
 *
 * Caching strategy
 *  - `getOrg(docId)` / `getOrgByCode(orgId)` → cache by both doc ID and
 *    short code, TTL 2 min.
 *  - `subscribeOrgProjects` → real-time; no caching (list may grow).
 *  - Writes → invalidate the affected doc entry.
 */

import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { app } from '../firebase';
import { cache, DalCache } from './cache';
import type { OrgDoc, ProjectDoc } from './types';

const db = () => getFirestore(app);

// ─── Cache key helpers ───────────────────────────────────────────────────────

const orgDocKey  = (id: string)     => `organizations/${id}`;
const orgCodeKey = (code: string)   => `org_code/${code.toUpperCase()}`;   // → docId

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Subscribe to a single organization document for real-time updates.
 * Each snapshot updates the doc cache so one-off `getOrg` calls elsewhere
 * in the same tab get a fresh value.
 */
export function subscribeOrg(
  docId: string,
  onData: (org: (OrgDoc & { id: string }) | null) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db(), 'organizations', docId),
    (snap) => {
      if (!snap.exists()) { onData(null); return; }
      const data = { id: snap.id, ...(snap.data() as OrgDoc) };
      cache.set(orgDocKey(data.id), data, DalCache.TTL.ORG_DOC);
      if (data.orgId) cache.set(orgCodeKey(data.orgId), data, DalCache.TTL.CODE_LOOKUP);
      onData(data);
    },
    (err) => onError?.(err as Error),
  );
}

/** Fetch an org by its Firestore document ID. Cached (TTL 2 min). */
export async function getOrg(docId: string): Promise<(OrgDoc & { id: string }) | null> {
  const key = orgDocKey(docId);
  const hit = cache.get<OrgDoc & { id: string }>(key);
  if (hit) return hit;

  const snap = await getDoc(doc(db(), 'organizations', docId));
  if (!snap.exists()) return null;

  const data = { id: snap.id, ...(snap.data() as OrgDoc) };
  cache.set(key, data, DalCache.TTL.ORG_DOC);
  // Also cache the code → docId mapping
  if (data.orgId) cache.set(orgCodeKey(data.orgId), data, DalCache.TTL.CODE_LOOKUP);
  return data;
}

/**
 * Fetch an org by its human-readable short code (e.g. "OABC123" or "AAC").
 * Also checks previousCodes array for backwards compatibility.
 *
 * The code→docId mapping is cached (TTL 5 min) so repeated code-search
 * lookups (home page, project registration) only hit Firestore once per
 * browser session.
 */
export async function getOrgByCode(orgId: string): Promise<(OrgDoc & { id: string }) | null> {
  const codeKey = orgCodeKey(orgId);
  const hit = cache.get<OrgDoc & { id: string }>(codeKey);
  if (hit) return hit;

  const upperCode = orgId.toUpperCase();
  
  // First try current orgId
  let snap = await getDocs(
    query(collection(db(), 'organizations'), where('orgId', '==', upperCode)),
  );
  
  // If not found, try previousCodes array
  if (snap.empty) {
    snap = await getDocs(
      query(collection(db(), 'organizations'), where('previousCodes', 'array-contains', upperCode)),
    );
  }
  
  if (snap.empty) return null;

  const data = { id: snap.docs[0].id, ...(snap.docs[0].data() as OrgDoc) };
  cache.set(orgDocKey(data.id), data, DalCache.TTL.ORG_DOC);
  cache.set(codeKey, data, DalCache.TTL.CODE_LOOKUP);
  return data;
}

/** 
 * Fetch all organizations where the user is either the owner OR a team member.
 * Not cached (list can grow). 
 * 
 * Uses efficient Firestore queries via the memberUids array:
 * - Query 1: ownerUid == uid (organizations owned by user)
 * - Query 2: memberUids array-contains uid (organizations where user is a member)
 */
export async function getUserOrgs(uid: string): Promise<(OrgDoc & { id: string })[]> {
  // Query 1: Organizations where user is the owner
  const ownedSnap = await getDocs(
    query(collection(db(), 'organizations'), where('ownerUid', '==', uid)),
  );
  
  // Query 2: Organizations where user is in memberUids array
  const memberSnap = await getDocs(
    query(collection(db(), 'organizations'), where('memberUids', 'array-contains', uid)),
  );
  
  // Merge results and deduplicate by document ID
  const orgMap = new Map<string, OrgDoc & { id: string }>();
  
  ownedSnap.docs.forEach(d => {
    orgMap.set(d.id, { id: d.id, ...(d.data() as OrgDoc) });
  });
  
  memberSnap.docs.forEach(d => {
    if (!orgMap.has(d.id)) {
      orgMap.set(d.id, { id: d.id, ...(d.data() as OrgDoc) });
    }
  });
  
  return Array.from(orgMap.values());
}

/**
 * Subscribe to the orgs list for a user (both owned and team membership).
 * Each snapshot repopulates the per-org doc cache entries so that 
 * getOrg/getOrgByCode calls hit cache.
 * 
 * Note: Firestore doesn't support OR queries across different fields directly,
 * so we maintain two separate subscriptions and merge the results.
 */
export function subscribeUserOrgs(
  uid: string,
  onData: (orgs: (OrgDoc & { id: string })[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const orgMap = new Map<string, OrgDoc & { id: string }>();
  let ownedReady = false;
  let memberReady = false;

  const emitMerged = () => {
    if (ownedReady && memberReady) {
      const merged = Array.from(orgMap.values());
      merged.forEach(org => {
        cache.set(orgDocKey(org.id), org, DalCache.TTL.ORG_DOC);
        if (org.orgId) cache.set(orgCodeKey(org.orgId), org, DalCache.TTL.CODE_LOOKUP);
      });
      onData(merged);
    }
  };

  // Subscription 1: Organizations where user is owner
  const unsubOwned = onSnapshot(
    query(collection(db(), 'organizations'), where('ownerUid', '==', uid)),
    (snap) => {
      snap.docs.forEach(d => {
        orgMap.set(d.id, { id: d.id, ...(d.data() as OrgDoc) });
      });
      ownedReady = true;
      emitMerged();
    },
    err => onError?.(err as Error)
  );

  // Subscription 2: Organizations where user is in memberUids
  const unsubMember = onSnapshot(
    query(collection(db(), 'organizations'), where('memberUids', 'array-contains', uid)),
    (snap) => {
      snap.docs.forEach(d => {
        if (!orgMap.has(d.id)) {
          orgMap.set(d.id, { id: d.id, ...(d.data() as OrgDoc) });
        }
      });
      memberReady = true;
      emitMerged();
    },
    err => onError?.(err as Error)
  );

  // Return combined unsubscribe function
  return () => {
    unsubOwned();
    unsubMember();
  };
}

/**
 * Subscribe to all projects belonging to an org.
 * Includes a sessionStorage cache seed so the first render is instant
 * (same pattern already used in OrgProjectsTab).
 */
export function subscribeOrgProjects(
  orgId: string,
  onData: (projects: (ProjectDoc & { id: string })[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(collection(db(), 'projects'), where('organizationId', '==', orgId));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as ProjectDoc) }));
    onData(rows);
  }, err => onError?.(err as Error));
}

/** One-off fetch of all projects belonging to an org (by organizationId field). */
export async function getOrgProjects(orgId: string): Promise<(ProjectDoc & { id: string })[]> {
  const q = query(collection(db(), 'projects'), where('organizationId', '==', orgId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as ProjectDoc) }));
}

/**
 * Fetch all organizations (full scan).
 *
 * ⚠️  EXPENSIVE — reads every organization document.
 * Only use where unavoidable (e.g. membership analysis during account
 * deletion).  For most features, use the scoped helpers above.
 */
export async function getAllOrgs(): Promise<(OrgDoc & { id: string })[]> {
  const snap = await getDocs(collection(db(), 'organizations'));
  const orgs = snap.docs.map(d => ({ id: d.id, ...(d.data() as OrgDoc) }));
  // Populate doc cache while we have all the data
  orgs.forEach(org => {
    cache.set(orgDocKey(org.id), org, DalCache.TTL.ORG_DOC);
    if (org.orgId) cache.set(orgCodeKey(org.orgId), org, DalCache.TTL.CODE_LOOKUP);
  });
  return orgs;
}

// ─── Write ───────────────────────────────────────────────────────────────────

/** Partially update an org document. Invalidates cache. */
export async function updateOrg(docId: string, patch: Partial<OrgDoc>): Promise<void> {
  await updateDoc(doc(db(), 'organizations', docId), patch as Record<string, unknown>);
  cache.invalidate(orgDocKey(docId));
  // Invalidate by code too (patch could change orgId, though unlikely)
  cache.invalidatePrefix('org_code/');
}

/**
 * Create a new organization using a Firestore transaction.
 * Returns the new document ID.
 */
export async function createOrg(
  data: Omit<OrgDoc, 'createdAt'> & { createdBy?: string },
): Promise<string> {
  const firestore = db();
  const newRef = doc(collection(firestore, 'organizations'));
  await runTransaction(firestore, async (tx) => {
    tx.set(newRef, { ...data, createdAt: serverTimestamp() });
  });
  return newRef.id;
}

/** Delete an org document and invalidate cache. */
export async function deleteOrg(docId: string): Promise<void> {
  await deleteDoc(doc(db(), 'organizations', docId));
  cache.invalidate(orgDocKey(docId));
  cache.invalidatePrefix('org_code/');
}

// ─── Organization Code Management ────────────────────────────────────────────

/**
 * Check if a custom organization code is available.
 * Returns { available: true } if the code can be used.
 * Returns { available: false, reason: string } if the code is taken or invalid.
 * 
 * Rules:
 * - Code must be 2-10 uppercase letters/numbers
 * - Cannot conflict with existing orgId or previousCodes
 * - Should not start with reserved prefixes unless intentional (O, P, I, S)
 */
export async function checkOrgCodeAvailability(
  code: string,
  currentOrgId?: string
): Promise<{ available: boolean; reason?: string }> {
  const trimmed = code.trim().toUpperCase();
  
  // Validate format: 2-10 alphanumeric characters
  if (!/^[A-Z0-9]{2,10}$/.test(trimmed)) {
    return {
      available: false,
      reason: 'Code must be 2-10 uppercase letters or numbers (e.g., AAC, OXFAM)'
    };
  }
  
  // Check if it's the same as current code (allow keeping current)
  if (currentOrgId && trimmed === currentOrgId.toUpperCase()) {
    return { available: true };
  }
  
  // Check if code is already in use as current orgId
  const existingByCode = await getDocs(
    query(collection(db(), 'organizations'), where('orgId', '==', trimmed))
  );
  if (!existingByCode.empty) {
    return { available: false, reason: 'This code is already in use by another organization' };
  }
  
  // Check if code exists in any previousCodes array
  const existingInPrevious = await getDocs(
    query(collection(db(), 'organizations'), where('previousCodes', 'array-contains', trimmed))
  );
  if (!existingInPrevious.empty) {
    return { available: false, reason: 'This code was previously used by another organization' };
  }
  
  return { available: true };
}

/**
 * Update an organization's code, maintaining backwards compatibility.
 * The old code is stored in previousCodes array so old links continue to work.
 * 
 * @param docId - Firestore document ID of the organization
 * @param newCode - The new organization code (will be uppercased)
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function updateOrgCode(
  docId: string,
  newCode: string
): Promise<{ success: boolean; error?: string }> {
  const trimmed = newCode.trim().toUpperCase();
  
  // Get current org data
  const org = await getOrg(docId);
  if (!org) {
    return { success: false, error: 'Organization not found' };
  }
  
  // Check availability
  const availability = await checkOrgCodeAvailability(trimmed, org.orgId);
  if (!availability.available) {
    return { success: false, error: availability.reason };
  }
  
  // If code hasn't changed, nothing to do
  if (org.orgId.toUpperCase() === trimmed) {
    return { success: true };
  }
  
  // Update using transaction to ensure atomicity
  const firestore = db();
  const orgRef = doc(firestore, 'organizations', docId);
  
  try {
    const oldCode = org.orgId;
    
    // Update organization code
    await runTransaction(firestore, async (tx) => {
      const latest = await tx.get(orgRef);
      if (!latest.exists()) {
        throw new Error('Organization not found');
      }
      
      const currentData = latest.data() as OrgDoc;
      const currentCode = currentData.orgId;
      const previousCodes = currentData.previousCodes || [];
      
      // Add current code to previousCodes if not already there
      const updatedPreviousCodes = previousCodes.includes(currentCode)
        ? previousCodes
        : [...previousCodes, currentCode];
      
      tx.update(orgRef, {
        orgId: trimmed,
        previousCodes: updatedPreviousCodes
      });
    });
    
    // Update all associated showcases to use the new code
    // This ensures showcases remain accessible after org code change
    const showcasesQuery = query(
      collection(firestore, 'showcases'),
      where('orgId', '==', oldCode)
    );
    const showcasesSnap = await getDocs(showcasesQuery);
    
    if (!showcasesSnap.empty) {
      const batch = writeBatch(firestore);
      
      showcasesSnap.docs.forEach((showcaseDoc) => {
        const showcaseData = showcaseDoc.data();
        const updates: any = { orgId: trimmed };
        
        // Also update orgId in locationEntries if this is a location-based showcase
        if (showcaseData.locationEntries && Array.isArray(showcaseData.locationEntries)) {
          updates.locationEntries = showcaseData.locationEntries.map((entry: any) => ({
            ...entry,
            orgId: entry.orgId === oldCode ? trimmed : entry.orgId
          }));
        }
        
        batch.update(showcaseDoc.ref, updates);
      });
      
      await batch.commit();
    }
    
    // Update all projects that reference this organization
    // This ensures projects continue to appear in the org's project list
    const projectsQuery = query(
      collection(firestore, 'projects'),
      where('organizationId', '==', oldCode)
    );
    const projectsSnap = await getDocs(projectsQuery);
    
    if (!projectsSnap.empty) {
      const batch = writeBatch(firestore);
      
      projectsSnap.docs.forEach((projectDoc) => {
        const projectData = projectDoc.data();
        const updates: any = { organizationId: trimmed };
        
        // Also update partners array if this org appears as a partner
        if (projectData.partners && Array.isArray(projectData.partners)) {
          const updatedPartners = projectData.partners.map((partner: any) => ({
            ...partner,
            orgId: partner.orgId === oldCode ? trimmed : partner.orgId
          }));
          
          // Only update if there was a change
          if (JSON.stringify(updatedPartners) !== JSON.stringify(projectData.partners)) {
            updates.partners = updatedPartners;
          }
        }
        
        batch.update(projectDoc.ref, updates);
      });
      
      await batch.commit();
    }
    
    // Also need to check all OTHER projects where this org might appear as a partner
    // (projects not owned by this org but that list this org as a partner)
    const allProjectsSnap = await getDocs(collection(firestore, 'projects'));
    const projectsWithThisAsPartner: any[] = [];
    
    allProjectsSnap.docs.forEach((projectDoc) => {
      const data = projectDoc.data();
      if (data.partners && Array.isArray(data.partners)) {
        const hasThisOrg = data.partners.some((p: any) => p.orgId === oldCode);
        if (hasThisOrg && data.organizationId !== oldCode) {
          // This project has our org as a partner but is NOT owned by our org
          projectsWithThisAsPartner.push(projectDoc);
        }
      }
    });
    
    if (projectsWithThisAsPartner.length > 0) {
      const batch = writeBatch(firestore);
      
      projectsWithThisAsPartner.forEach((projectDoc) => {
        const data = projectDoc.data();
        const updatedPartners = data.partners.map((partner: any) => ({
          ...partner,
          orgId: partner.orgId === oldCode ? trimmed : partner.orgId
        }));
        
        batch.update(projectDoc.ref, { partners: updatedPartners });
      });
      
      await batch.commit();
    }
    
    // Invalidate all caches for this org, showcases, and projects
    cache.invalidate(orgDocKey(docId));
    cache.invalidatePrefix('org_code/');
    cache.invalidatePrefix('showcase_code/');
    cache.invalidatePrefix('showcases/');
    cache.invalidatePrefix('projects/');
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update organization code' };
  }
}
