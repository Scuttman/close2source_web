# Organization Membership Scalability Fix

## Problem

When users joined organizations via sharing code + PIN, they became team members but the organizations didn't appear in their list because `getUserOrgs()` only queried for organizations where the user was the owner (`ownerUid == uid`).

The initial fix fetched ALL organizations and filtered client-side for team membership, which doesn't scale.

## Solution

Implemented a `memberUids: string[]` field on organizations that contains all member UIDs (owner + team members) to enable efficient Firestore `array-contains` queries.

---

## Changes Made

### 1. Schema Update

**File:** `src/lib/dal/types.ts`

Added `memberUids?: string[]` field to `OrgDoc` interface:

```typescript
export interface OrgDoc {
  // ... existing fields ...
  memberUids?: string[];   // array of all member UIDs (for efficient querying)
  // ... rest of fields ...
}
```

### 2. Efficient Queries

**File:** `src/lib/dal/organizations.ts`

#### `getUserOrgs(uid)`
Updated to use two efficient queries instead of scanning all orgs:
- Query 1: `where('ownerUid', '==', uid)` - owned organizations
- Query 2: `where('memberUids', 'array-contains', uid)` - member organizations
- Merges and deduplicates results

#### `subscribeUserOrgs(uid, onData)`
Updated to maintain two separate subscriptions for real-time updates:
- Subscription 1: Organizations where user is owner
- Subscription 2: Organizations where user is in memberUids
- Merges results and updates cache

### 3. Team Modification Functions

All functions that modify the `team` array now also maintain `memberUids`:

#### `joinOrgByPin()` - `src/lib/dal/transactions.ts`
```typescript
// Adds user to both team array and memberUids array
tx.update(orgRef, { 
  team: updatedTeam,
  memberUids: updatedMemberUids 
});
```

#### `acceptInviteToken()` - `src/lib/dal/transactions.ts`
```typescript
// When accepting invite, updates both team and memberUids
tx.update(orgRef, { 
  team: newTeam,
  memberUids: newMemberUids 
});
```

#### `deleteUserAccount()` - `src/lib/dal/transactions.ts`
```typescript
// Removes user from both team and memberUids when deleting account
batch.update(orgRef, { 
  team: updatedTeam,
  memberUids: updatedMemberUids 
});
```

#### Invite trigger - `functions/src/index.ts`
```typescript
// Cloud Function that adds member via invite also updates memberUids
tx.update(orgRef, { 
  team: [...team, member],
  memberUids: updatedMemberUids
});
```

#### `OrgTeamTab` component - `components/OrgTeamTab.tsx`
```typescript
// Helper function to compute memberUids from team
function extractMemberUids(teamArray: any[]): string[] {
  const uids = new Set<string>();
  if (org.ownerUid) uids.add(org.ownerUid);
  teamArray.forEach(member => {
    if (member.uid) uids.add(member.uid);
  });
  return Array.from(uids);
}

// Updated persist() to include memberUids
async function persist(newTeam:any[]){
  const memberUids = extractMemberUids(newTeam);
  await updateOrg(org.id, { team: newTeam, memberUids }); 
}
```

---

## Migration Script

**File:** `scripts/migrate-org-member-uids.ts`

A one-time migration script that:
1. Fetches all organizations
2. Extracts UIDs from `team` array and adds `ownerUid`
3. Creates `memberUids` array with all unique member UIDs
4. Updates organizations in batches (500 per batch)
5. Skips organizations that already have correct `memberUids`

### Running the Migration

See `scripts/README.md` for detailed instructions:

```bash
# Install dependencies
npm install -D tsx firebase-admin

# Set up Firebase credentials
export FIREBASE_SERVICE_ACCOUNT_PATH="./firebase-service-account.json"

# Run migration
npx tsx scripts/migrate-org-member-uids.ts
```

---

## Performance Comparison

### Before (Unscalable)
```typescript
// Fetched ALL organizations (entire collection scan)
const allOrgsSnap = await getDocs(collection(db(), 'organizations'));

// Filtered client-side
const memberOrgs = allOrgsSnap.docs.filter(d => {
  const team = d.data().team || [];
  return team.some(m => m.uid === uid);
});
```
- **Complexity:** O(n) where n = total organizations
- **Reads:** n Firestore document reads
- **Cost:** Scales linearly with total organizations (very expensive)

### After (Scalable)
```typescript
// Query 1: owned organizations
const ownedSnap = await getDocs(
  query(collection(db(), 'organizations'), where('ownerUid', '==', uid))
);

// Query 2: member organizations
const memberSnap = await getDocs(
  query(collection(db(), 'organizations'), where('memberUids', 'array-contains', uid))
);
```
- **Complexity:** O(k) where k = user's organizations
- **Reads:** k Firestore document reads (only user's orgs)
- **Cost:** Scales with user's membership count (very efficient)

### Example Cost Calculation

For a user who is a member of 5 organizations in a system with 10,000 total organizations:

- **Before:** 10,000 document reads per query
- **After:** ~5 document reads per query
- **Savings:** 99.95% reduction in reads

---

## Maintenance Checklist

Whenever you add/remove team members, ensure `memberUids` is updated:

- ✅ `joinOrgByPin()` - Join via sharing code + PIN
- ✅ `acceptInviteToken()` - Accept invite token
- ✅ `deleteUserAccount()` - Remove from all orgs
- ✅ Invite Cloud Function trigger
- ✅ `OrgTeamTab` - UI team management

### Future Additions

If you add new ways to modify team membership, remember to:
1. Extract/compute UIDs from the team array
2. Update both `team` and `memberUids` in the same transaction/batch
3. Include owner UID in the memberUids set

---

## Testing the Fix

1. **Run the migration script** to populate `memberUids` for existing orgs
2. **Test joining an organization:**
   - Create a second user account
   - Get an organization's sharing code and PIN
   - Join the organization as the second user
   - Verify the organization appears in the profile's organization list
3. **Verify owner still sees their orgs:**
   - Log in as the organization owner
   - Check that owned organizations still appear
4. **Check real-time updates:**
   - Have the profile page open
   - Join a new organization
   - Verify it appears without refreshing (via subscription)

---

## Rollback Plan

If issues arise, you can temporarily revert to the old behavior:

1. Keep the `memberUids` field (it won't hurt)
2. Revert `getUserOrgs()` and `subscribeUserOrgs()` to the previous client-side filtering approach
3. This gives you time to debug the new implementation

---

## Future Optimizations

Consider these additional improvements:

1. **Add Firestore index** for `memberUids` array-contains queries if query performance becomes an issue
2. **Add `teamEmails` array** for email-based lookups (some team members may not have uid yet)
3. **Composite index** on `(ownerUid, memberUids)` if queries become more complex
4. **Caching strategy** for user's organization list in sessionStorage

---

## Summary

✅ Fixed scalability issue with organization membership queries
✅ Uses efficient Firestore queries instead of full collection scans
✅ Maintains `memberUids` array automatically in all team modification functions
✅ Provided migration script with detailed documentation
✅ All existing functionality preserved with zero breaking changes
✅ Organizations now appear correctly for both owners and members
