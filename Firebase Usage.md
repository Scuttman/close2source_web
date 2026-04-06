# Firebase Usage Guide

This document outlines the Firebase/Firestore patterns used in the Close2Source application. These patterns provide efficient data access, caching, and real-time updates while maintaining code maintainability.

## Architecture Overview

### Data Access Layer (DAL)

All Firestore operations go through a centralized DAL (`src/lib/dal/`) that provides:
- **Type safety** - TypeScript interfaces for all document types
- **Caching** - Two-tier cache (memory + sessionStorage)
- **Consistency** - Single source of truth for data operations
- **Abstraction** - Business logic doesn't interact with Firestore directly

```
src/lib/dal/
├── index.ts           # Public API exports
├── types.ts           # TypeScript interfaces
├── cache.ts           # Caching layer
├── users.ts           # User operations
├── organizations.ts   # Organization operations
├── projects.ts        # Project operations
├── individuals.ts     # Individual operations
├── showcases.ts       # Showcase operations
└── transactions.ts    # Firestore transactions
```

## Core Patterns

### 1. Document Lookup by ID

**Pattern**: Fetch a document by its Firestore document ID with caching.

```typescript
export async function getOrg(docId: string): Promise<(OrgDoc & { id: string }) | null> {
  const key = orgDocKey(docId);
  const hit = cache.get<OrgDoc & { id: string }>(key);
  if (hit) return hit;

  const snap = await getDoc(doc(db(), 'organizations', docId));
  if (!snap.exists()) return null;

  const data = { id: snap.id, ...(snap.data() as OrgDoc) };
  cache.set(key, data, DalCache.TTL.ORG_DOC);
  if (data.orgId) cache.set(orgCodeKey(data.orgId), data, DalCache.TTL.CODE_LOOKUP);
  return data;
}
```

**Key points**:
- Check cache first for fast responses
- Store both by doc ID and human-readable code
- Include document ID in returned data
- Use appropriate TTL based on data volatility

### 2. Code-Based Lookup

**Pattern**: Find documents by human-readable codes (e.g., "OABC123", "AAC").

```typescript
export async function getOrgByCode(orgId: string): Promise<(OrgDoc & { id: string }) | null> {
  const codeKey = orgCodeKey(orgId);
  const hit = cache.get<OrgDoc & { id: string }>(codeKey);
  if (hit) return hit;

  const upperCode = orgId.toUpperCase();
  
  // First try current orgId
  let snap = await getDocs(
    query(collection(db(), 'organizations'), where('orgId', '==', upperCode)),
  );
  
  // If not found, try previousCodes array for backwards compatibility
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
```

**Key points**:
- Support both current and historical codes (backwards compatibility)
- Use uppercase for consistency
- Cache by both code and document ID
- Longer TTL for code lookups (they rarely change)

### 3. Real-Time Subscriptions

**Pattern**: Subscribe to live updates and populate cache for other reads.

```typescript
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
      
      // Populate cache so one-off reads hit cache
      cache.set(orgDocKey(data.id), data, DalCache.TTL.ORG_DOC);
      if (data.orgId) cache.set(orgCodeKey(data.orgId), data, DalCache.TTL.CODE_LOOKUP);
      
      onData(data);
    },
    (err) => onError?.(err as Error),
  );
}
```

**Usage in React**:
```typescript
useEffect(() => {
  const unsub = subscribeOrg(orgId, (data) => {
    setOrg(data);
  });
  return () => unsub();
}, [orgId]);
```

**Key points**:
- Return unsubscribe function for cleanup
- Populate cache during real-time updates
- Handle missing documents gracefully
- Optional error callback

### 4. Collection Queries with Caching

**Pattern**: Query collections and cache individual results.

```typescript
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
```

**With sessionStorage caching**:
```typescript
useEffect(() => {
  const cacheKey = `org_projects_${org.orgId}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try { setProjects(JSON.parse(cached)); } catch {}
  }
  
  const unsub = subscribeOrgProjects(org.orgId, (rows) => {
    setProjects(rows);
    sessionStorage.setItem(cacheKey, JSON.stringify(rows));
  });
  return () => unsub();
}, [org.orgId]);
```

### 5. Atomic Updates with Transactions

**Pattern**: Ensure atomic operations across documents.

```typescript
export async function updateOrgCode(
  docId: string,
  newCode: string
): Promise<{ success: boolean; error?: string }> {
  const firestore = db();
  const orgRef = doc(firestore, 'organizations', docId);
  
  try {
    const oldCode = org.orgId;
    
    // Update organization code atomically
    await runTransaction(firestore, async (tx) => {
      const latest = await tx.get(orgRef);
      if (!latest.exists()) {
        throw new Error('Organization not found');
      }
      
      const currentData = latest.data() as OrgDoc;
      const previousCodes = currentData.previousCodes || [];
      
      tx.update(orgRef, {
        orgId: trimmed,
        previousCodes: [...previousCodes, currentData.orgId]
      });
    });
    
    // Batch update related documents
    const batch = writeBatch(firestore);
    // ... add updates to batch
    await batch.commit();
    
    // Clear caches
    cache.invalidatePrefix('org_code/');
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
```

**Key points**:
- Use transactions for atomic reads + writes
- Use batches for multiple independent writes
- Invalidate relevant caches after writes
- Return structured results with error handling

### 6. Code Availability Checking

**Pattern**: Validate uniqueness before creation.

```typescript
export async function checkOrgCodeAvailability(
  code: string,
  currentOrgId?: string
): Promise<{ available: boolean; reason?: string }> {
  const trimmed = code.trim().toUpperCase();
  
  // Validate format
  if (trimmed.length < 2 || trimmed.length > 10) {
    return { available: false, reason: 'Code must be 2-10 characters' };
  }
  if (!/^[A-Z0-9]+$/.test(trimmed)) {
    return { available: false, reason: 'Code must be alphanumeric only' };
  }
  
  // Allow if it's the current code
  if (currentOrgId && trimmed === currentOrgId.toUpperCase()) {
    return { available: true };
  }
  
  // Check conflicts in current codes
  const existingByCode = await getDocs(
    query(collection(db(), 'organizations'), where('orgId', '==', trimmed))
  );
  if (!existingByCode.empty) {
    return { available: false, reason: 'This code is already in use' };
  }
  
  // Check conflicts in historical codes
  const existingInPrevious = await getDocs(
    query(collection(db(), 'organizations'), where('previousCodes', 'array-contains', trimmed))
  );
  if (!existingInPrevious.empty) {
    return { available: false, reason: 'This code was previously used' };
  }
  
  return { available: true };
}
```

## Caching Strategy

### Two-Tier Cache

**Tier 1: In-Memory Map**
- Zero-latency access
- Cleared on page navigation/reload
- First priority for reads

**Tier 2: sessionStorage**
- Survives React re-renders
- Cleared when tab closes
- Fallback when memory cache misses

### Cache Key Conventions

```typescript
const orgDocKey  = (id: string)     => `organizations/${id}`;
const orgCodeKey = (code: string)   => `org_code/${code.toUpperCase()}`;
const projectDocKey = (id: string)  => `projects/${id}`;
const projectCodeKey = (code: string) => `project_code/${code.toUpperCase()}`;
```

### TTL Guidelines

```typescript
static TTL = {
  USER_DOC:    60_000,   // 1 min  - credits/consent change frequently
  ORG_DOC:     120_000,  // 2 min  - org data changes less often
  PROJECT_DOC: 120_000,  // 2 min
  CODE_LOOKUP: 300_000,  // 5 min  - codes rarely change
  CONFIG:      600_000,  // 10 min - pricing config very stable
};
```

### Cache Invalidation

**After writes**:
```typescript
await updateOrg(orgId, { name: 'New Name' });
cache.invalidate(orgDocKey(orgId));
cache.invalidatePrefix('org_code/');
```

**Prefix invalidation** clears all keys starting with prefix:
```typescript
cache.invalidatePrefix('organizations/'); // All org docs
cache.invalidatePrefix('org_code/');      // All org code lookups
```

## Collection Structure

### Core Collections

```
users/{uid}
  activityLog/{logId}
  creditTransactions/{txId}

organizations/{orgId}
  (no subcollections)

projects/{projectId}
  financeTransactions/{txId}

individuals/{individualId}
  (no subcollections)

showcases/{showcaseId}
  (no subcollections)

orgInvites/{token}
  (no subcollections)

moderationQueue/{itemId}
  (no subcollections)
```

### Document Fields

**Organizations** (`OrgDoc`):
```typescript
{
  orgId: string;              // Short code: "OABC123" or custom "AAC"
  previousCodes?: string[];   // Historical codes for backwards compatibility
  name: string;
  ownerUid: string;
  bio?: string;
  logoUrl?: string;
  team?: OrgTeamMember[];
  memberUids?: string[];      // For efficient querying
  joinPin?: string;           // 4-digit PIN for member joins
  locations?: OrgLocation[];
  partners?: string[];        // Array of project IDs
  accessSettings?: Record<string, { view: string[]; edit: string[] }>;
  publicVisible?: boolean;
  hideFromSearch?: boolean;
  // ... styling fields
}
```

**Projects** (`ProjectDoc`):
```typescript
{
  projectId: string;          // Short code: "PABC123"
  name: string;
  description?: string;
  createdBy: string;          // uid
  organizationId?: string;    // Org code (for queries)
  originatingOrganizationDbId?: string; // Firestore doc ID
  status: 'draft' | 'pending_review' | 'live' | 'rejected';
  visibility: 'public' | 'private';
  location?: ProjectLocation;
  team?: ProjectTeamMember[];
  partners?: { orgId: string; orgName?: string; joinedAt?: string }[];
  budgetPhases?: BudgetPhase[];
  accessPin?: string;         // Optional PIN protection
  authorizedViewers?: string[]; // UIDs with PIN access
  // ... other fields
}
```

**Showcases** (`ShowcaseDoc`):
```typescript
{
  showcaseId: string;         // Short code: "SABCDEF"
  title: string;
  description?: string;
  ownerUid: string;
  orgId?: string;             // Parent org code
  type?: 'projects' | 'locations';
  projectDocIds: string[];    // For project showcases
  locationEntries?: Array<{   // For location showcases
    orgId: string;
    orgDbId: string;
    locationId: string;
  }>;
}
```

## Security Rules Patterns

### Self-Join with Code + PIN

```javascript
// Allow user to add themselves to team array via code + PIN
match /organizations/{orgId} {
  allow update: if request.auth != null
    && resource.data.joinPin == request.resource.data.joinPin
    && request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['team', 'memberUids'])
    && (resource.data.team == null 
        || request.resource.data.team.size() == resource.data.team.size() + 1)
    && (resource.data.memberUids == null 
        || request.resource.data.memberUids.size() == 1
        || request.resource.data.memberUids.size() == resource.data.memberUids.size() + 1);
}
```

**Key points**:
- Verify PIN hasn't changed
- Only allow team/memberUids updates
- Allow array growth by exactly 1
- Handle null arrays for backwards compatibility

### Access Control Based on Roles

```javascript
match /projects/{projectId} {
  function hasRole(roles) {
    let team = resource.data.team;
    return team != null 
      && team.toSet().hasAny([{uid: request.auth.uid}])
      && roles.hasAny(['owner', 'admin']); // Check role in your logic
  }
  
  allow read: if resource.data.visibility == 'public'
    || request.auth.uid == resource.data.createdBy
    || hasRole(['owner', 'admin', 'member']);
}
```

## Best Practices

### 1. Always Include Document ID

```typescript
// ✅ Good - ID included for client use
const data = { id: snap.id, ...(snap.data() as OrgDoc) };

// ❌ Bad - ID lost, can't do subsequent operations
const data = snap.data() as OrgDoc;
```

### 2. Batch Related Updates

```typescript
// ✅ Good - atomic update
const batch = writeBatch(db());
showcases.forEach(doc => batch.update(doc.ref, { orgId: newCode }));
await batch.commit();

// ❌ Bad - multiple round-trips, not atomic
for (const doc of showcases) {
  await updateDoc(doc.ref, { orgId: newCode });
}
```

### 3. Maintain Referential Integrity

When updating codes, update all references:
```typescript
// Update org code
await updateOrgCode(orgId, newCode);

// Update all projects with this orgId
const projects = await getDocs(
  query(collection(db(), 'projects'), where('organizationId', '==', oldCode))
);
// ... batch update

// Update all showcases
const showcases = await getDocs(
  query(collection(db(), 'showcases'), where('orgId', '==', oldCode))
);
// ... batch update
```

### 4. Support Backwards Compatibility

Store historical codes for seamless transitions:
```typescript
interface OrgDoc {
  orgId: string;           // Current code
  previousCodes?: string[]; // Historical codes
}

// Lookups check both
export async function getOrgByCode(code: string) {
  // Try current code
  let snap = await getDocs(
    query(collection(db(), 'organizations'), where('orgId', '==', code))
  );
  
  // Fall back to historical codes
  if (snap.empty) {
    snap = await getDocs(
      query(collection(db(), 'organizations'), where('previousCodes', 'array-contains', code))
    );
  }
  // ...
}
```

### 5. Invalidate Caches After Writes

```typescript
await updateOrg(orgId, { name: 'New Name' });

// Invalidate related caches
cache.invalidate(orgDocKey(orgId));
cache.invalidatePrefix('org_code/');
```

### 6. Type Safety Throughout

```typescript
// Define interfaces
interface OrgDoc {
  orgId: string;
  name: string;
  // ...
}

// Type all operations
export async function getOrg(docId: string): Promise<(OrgDoc & { id: string }) | null> {
  // ...
}

// Use in components
const org: (OrgDoc & { id: string }) | null = await getOrg(orgId);
```

### 7. Handle Edge Cases

```typescript
// Check for null/undefined arrays
if (!resource.data.memberUids == null 
    || request.resource.data.memberUids.size() == 1) {
  // Allow first member
}

// Handle missing documents
if (!snap.exists()) return null;

// Guard against empty queries
if (snap.empty) return null;
```

## Error Handling

### Structured Error Returns

```typescript
export async function updateOrgCode(
  docId: string,
  newCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // ... perform update
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' };
  }
}
```

### Availability Checks

```typescript
const availability = await checkOrgCodeAvailability(code);
if (!availability.available) {
  alert(availability.reason);
  return;
}
// Proceed with update
```

## Testing Patterns

### Mock Firestore Responses

```typescript
// Mock document
const mockDoc = {
  id: 'org123',
  exists: () => true,
  data: () => ({ orgId: 'OABC123', name: 'Test Org' })
};

// Mock getDoc
jest.mock('firebase/firestore', () => ({
  getDoc: jest.fn().mockResolvedValue(mockDoc)
}));
```

### Test Cache Behavior

```typescript
test('getOrg uses cache on second call', async () => {
  const result1 = await getOrg('org123');
  const result2 = await getOrg('org123');
  
  expect(getDoc).toHaveBeenCalledTimes(1); // Only called once
  expect(result1).toEqual(result2);
});
```

## Migration Patterns

### Adding New Fields

```typescript
// Make fields optional in interface
interface OrgDoc {
  orgId: string;
  previousCodes?: string[]; // New field
}

// Handle missing fields in code
const previousCodes = org.previousCodes || [];
```

### Backfilling Data

```typescript
// Script to add memberUids to existing orgs
const orgs = await getDocs(collection(db(), 'organizations'));
const batch = writeBatch(db());

orgs.docs.forEach(doc => {
  const data = doc.data();
  if (!data.memberUids && data.team) {
    const memberUids = data.team.map(m => m.uid).filter(Boolean);
    batch.update(doc.ref, { memberUids });
  }
});

await batch.commit();
```

## Performance Optimization

### 1. Use Compound Queries

```typescript
// ✅ Good - single query
const q = query(
  collection(db(), 'projects'),
  where('organizationId', '==', orgId),
  where('status', '==', 'live')
);
```

### 2. Limit Result Sets

```typescript
// Add limit for paginated results
const q = query(
  collection(db(), 'projects'),
  where('organizationId', '==', orgId),
  orderBy('createdAt', 'desc'),
  limit(20)
);
```

### 3. Selective Field Updates

```typescript
// ✅ Good - only update changed fields
await updateDoc(docRef, { name: newName });

// ❌ Bad - updates all fields
await setDoc(docRef, entireDocument);
```

### 4. Denormalize for Reads

Store commonly-accessed data redundantly:
```typescript
{
  organizationId: 'OABC123',           // For queries
  originatingOrganizationDbId: 'abc',  // For direct lookup
  organizationName: 'Org Name'         // Avoid extra read
}
```

## Summary

This Firebase/Firestore architecture provides:
- ✅ Type-safe data operations
- ✅ Efficient caching with automatic invalidation
- ✅ Real-time updates where needed
- ✅ Backwards compatibility for code changes
- ✅ Atomic transactions and batch updates
- ✅ Referential integrity across collections
- ✅ Flexible access control patterns

Use these patterns as a foundation for building scalable, maintainable Firebase applications.
