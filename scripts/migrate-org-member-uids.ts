/**
 * Migration Script: Populate memberUids field for all organizations
 * 
 * This script adds the memberUids array to all existing organizations by
 * extracting UIDs from the team array. This enables efficient Firestore
 * queries for user organization membership.
 * 
 * Run with: npx tsx scripts/migrate-org-member-uids.ts
 * 
 * Prerequisites:
 * - Install tsx: npm install -D tsx
 * - Set FIREBASE_CONFIG env var or ensure firebase config is available
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
if (getApps().length === 0) {
  // Try to use service account from environment variable or file
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  
  if (serviceAccountPath) {
    const serviceAccount = require(serviceAccountPath);
    initializeApp({
      credential: cert(serviceAccount)
    });
  } else {
    // Fallback to default credentials (works in Cloud Functions, Cloud Run, etc.)
    initializeApp();
  }
}

const db = getFirestore();

interface OrgData {
  team?: Array<{
    uid?: string;
    email?: string;
    name?: string;
    role?: string;
    type?: string;
  }>;
  memberUids?: string[];
  ownerUid?: string;
}

async function migrateOrganizations() {
  console.log('🚀 Starting organization memberUids migration...\n');
  
  try {
    // Fetch all organizations
    const orgsSnapshot = await db.collection('organizations').get();
    console.log(`📊 Found ${orgsSnapshot.size} organizations to process\n`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Use batched writes for efficiency (max 500 per batch)
    const BATCH_SIZE = 500;
    let batch = db.batch();
    let batchCount = 0;
    
    for (const doc of orgsSnapshot.docs) {
      const orgData = doc.data() as OrgData;
      const orgId = orgData.ownerUid || 'unknown';
      
      // Extract unique UIDs from team array
      const team = Array.isArray(orgData.team) ? orgData.team : [];
      const memberUids = new Set<string>();
      
      // Add owner UID (if exists)
      if (orgData.ownerUid) {
        memberUids.add(orgData.ownerUid);
      }
      
      // Add all team member UIDs
      team.forEach(member => {
        if (member.uid) {
          memberUids.add(member.uid);
        }
      });
      
      const memberUidsArray = Array.from(memberUids);
      
      // Check if memberUids already exists and matches
      const existingMemberUids = Array.isArray(orgData.memberUids) ? orgData.memberUids : [];
      const needsUpdate = 
        existingMemberUids.length !== memberUidsArray.length ||
        !memberUidsArray.every(uid => existingMemberUids.includes(uid));
      
      if (needsUpdate) {
        batch.update(doc.ref, { memberUids: memberUidsArray });
        batchCount++;
        updatedCount++;
        
        console.log(`✅ Queued: ${doc.id} (${memberUidsArray.length} members)`);
        
        // Commit batch if it reaches the limit
        if (batchCount >= BATCH_SIZE) {
          await batch.commit();
          console.log(`\n💾 Committed batch of ${batchCount} updates\n`);
          batch = db.batch();
          batchCount = 0;
        }
      } else {
        skippedCount++;
        console.log(`⏭️  Skipped: ${doc.id} (already up to date)`);
      }
    }
    
    // Commit any remaining updates
    if (batchCount > 0) {
      await batch.commit();
      console.log(`\n💾 Committed final batch of ${batchCount} updates\n`);
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Updated:  ${updatedCount} organizations`);
    console.log(`⏭️  Skipped:  ${skippedCount} organizations (already migrated)`);
    console.log(`❌ Errors:   ${errorCount} organizations`);
    console.log(`📊 Total:    ${orgsSnapshot.size} organizations`);
    console.log('='.repeat(60) + '\n');
    
    console.log('✨ Migration completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
migrateOrganizations()
  .then(() => {
    console.log('\n👋 Done! You can now safely use the efficient memberUids queries.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
