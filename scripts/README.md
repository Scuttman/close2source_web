# Migration Scripts

This directory contains one-time migration scripts for database schema updates.

## Organization memberUids Migration

### Purpose
Adds a `memberUids: string[]` field to all organization documents to enable efficient Firestore queries for user organization membership.

**Why this is needed:**
- Previously, `getUserOrgs()` only returned organizations where the user was the owner
- When users joined organizations via sharing code + PIN, they became team members but the orgs didn't appear in their list
- Firestore doesn't support efficient queries on nested object properties within arrays
- The new `memberUids` array allows us to use `array-contains` queries for fast lookups

### Setup

1. **Install dependencies:**
   ```bash
   npm install -D tsx firebase-admin
   ```

2. **Set up Firebase Admin credentials:**

   **Option A: Service Account Key (Local Development)**
   - Download your Firebase service account key from Firebase Console
   - Save it securely (e.g., `./firebase-service-account.json`)
   - Set the environment variable:
     ```bash
     export FIREBASE_SERVICE_ACCOUNT_PATH="./firebase-service-account.json"
     ```

   **Option B: Application Default Credentials (Production)**
   - If running in Cloud Functions, Cloud Run, or with gcloud CLI authenticated
   - No additional setup needed - uses default credentials

### Running the Migration

```bash
# From the project root:
npx tsx scripts/migrate-org-member-uids.ts
```

### What it does

1. Fetches all organizations from Firestore
2. For each organization:
   - Extracts unique UIDs from the `team` array
   - Adds the `ownerUid` to the set
   - Creates a `memberUids: string[]` field with all unique UIDs
3. Updates organizations in batches (500 per batch for efficiency)
4. Skips organizations that already have correct `memberUids`
5. Provides detailed progress logging and summary

### Output Example

```
🚀 Starting organization memberUids migration...

📊 Found 42 organizations to process

✅ Queued: abc123xyz (5 members)
✅ Queued: def456uvw (3 members)
⏭️  Skipped: ghi789rst (already up to date)
...

💾 Committed batch of 41 updates

============================================================
📈 Migration Summary:
============================================================
✅ Updated:  41 organizations
⏭️  Skipped:  1 organizations (already migrated)
❌ Errors:   0 organizations
📊 Total:    42 organizations
============================================================

✨ Migration completed successfully!
```

### Safety Features

- **Idempotent:** Safe to run multiple times - skips already-migrated orgs
- **Batched writes:** Efficient for large datasets (500 per batch)
- **No data loss:** Only adds the new field, never removes existing data
- **Read-only on existing fields:** Doesn't modify `team` array or other fields
- **Validation:** Checks if update is needed before queuing

### After Migration

Once the migration is complete, the app will:
- Show all organizations where the user is owner OR member
- Use efficient `array-contains` queries instead of full collection scans
- Automatically maintain `memberUids` when new members join via PIN

### Rollback

If you need to remove the `memberUids` field:

```javascript
// Use Firebase Console or run a script:
const orgs = await db.collection('organizations').get();
const batch = db.batch();
orgs.docs.forEach(doc => {
  batch.update(doc.ref, { memberUids: admin.firestore.FieldValue.delete() });
});
await batch.commit();
```

### Maintenance

After the migration, `memberUids` is automatically maintained by:
- `joinOrgByPin()` - adds member UID when joining
- Team management functions should also update this field when:
  - Adding members manually
  - Removing members
  - Updating team roles

**TODO:** Update any team removal functions to also update `memberUids`.
