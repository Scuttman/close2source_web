"use client";
import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { generateCode } from '../../../src/lib/codes';
import { db } from '../../../src/lib/firebase';
import PageShell from '../../../components/PageShell';
import { logCreditTransaction } from '../../../src/lib/credits';
import { useRouter } from 'next/navigation';

const ORG_CREATE_COST = 50; // credits
const ORG_TYPES = [
  'Religious Organization',
  'NGO',
  'Business',
  'Church',
  'Other'
];

export default function CreateOrganizationPage(){
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [orgType, setOrgType] = useState('');
  const [customType, setCustomType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent){
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if(!user) throw new Error('You must be signed in to create an organization.');
      const userRef = doc(db,'users', user.uid);
      const userSnap = await getDoc(userRef);
      const currentCredits = userSnap.exists()? (userSnap.data().credits ?? 0) : 0;
      if(currentCredits < ORG_CREATE_COST) throw new Error(`Not enough credits (need ${ORG_CREATE_COST}).`);
      await updateDoc(userRef, { credits: currentCredits - ORG_CREATE_COST });
  // Generate prefixed organization code (O + 6 chars)
  const orgId = generateCode('organization');
      const finalType = orgType === 'Other' ? (customType.trim() || 'Other') : orgType;
      if(!finalType) throw new Error('Select an organization type.');
      await addDoc(collection(db,'organizations'), {
        name: name.trim(),
        bio: bio.trim(),
        website: website.trim() || null,
        orgId,
        ownerUid: user.uid,
        createdAt: serverTimestamp(),
        team: [],
        accessSettings: {},
        supporters: [],
        representatives: [],
        orgType: finalType,
      });
      await logCreditTransaction(user.uid, 'spend', ORG_CREATE_COST, `Created organization: ${name}`);
      setSuccess(true);
      setTimeout(()=> router.push(`/org/${orgId}`), 1000);
    } catch(e:any){ setError(e.message || 'Error creating organization'); }
    finally { setLoading(false); }
  }

  return (
    <PageShell title={<span>Create Organization</span>} contentClassName="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-brand-main mb-4">Create Organization</h1>
      <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
        <div>
          <label className="block text-sm font-semibold mb-1">Name</label>
          <input className="w-full border rounded px-3 py-2" value={name} onChange={e=>setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Organization Type</label>
          <div className="flex flex-col gap-2">
            <select value={orgType} onChange={e=> { setOrgType(e.target.value); }} className="w-full border rounded px-3 py-2" required>
              <option value="">Select type...</option>
              {ORG_TYPES.map(t=> <option key={t} value={t}>{t}</option>)}
            </select>
            {orgType === 'Other' && (
              <input
                className="w-full border rounded px-3 py-2"
                placeholder="Custom type"
                value={customType}
                onChange={e=> setCustomType(e.target.value)}
                required
              />
            )}
          </div>
          <p className="text-[11px] text-gray-500 mt-1">Choose the category that best fits. You can specify your own if needed.</p>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Description</label>
          <textarea className="w-full border rounded px-3 py-2 min-h-[100px]" value={bio} onChange={e=>setBio(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Website (optional)</label>
          <input className="w-full border rounded px-3 py-2" value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://example.org" />
        </div>
        <div className="text-xs text-gray-500">Cost: {ORG_CREATE_COST} credits (deducted immediately)</div>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {success && <div className="text-sm text-green-600">Organization created! Redirecting...</div>}
        <button type="submit" disabled={loading} className="px-6 py-3 rounded bg-brand-main text-white font-semibold hover:bg-brand-dark disabled:opacity-60">{loading? 'Creating...' : 'Create Organization'}</button>
      </form>
    </PageShell>
  );
}
