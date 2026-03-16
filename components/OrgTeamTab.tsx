"use client";
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, updateDoc, doc, setDoc, onSnapshot, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

interface OrgTeamTabProps {
  org: any; // organization doc (expects id, ownerUid, team[])
  isOwner: boolean;
  editMode: boolean;
}

// Normalizes a user profile into a team member shape
function profileToMember(d: any){
  return {
    uid: d.uid,
    email: d.email || null,
    name: [d.name, d.surname].filter(Boolean).join(' ') || d.name || d.surname || d.email || 'User',
    photoURL: d.photoURL || null,
    type: 'user'
  };
}

export default function OrgTeamTab({ org, isOwner, editMode }: OrgTeamTabProps){
  const baseTeam = Array.isArray(org.team)? org.team : [];
  const [team, setTeam] = useState<any[]>(baseTeam);
  const [adding, setAdding] = useState(false);
  const [memberInput, setMemberInput] = useState('');
  const [addError, setAddError] = useState('');
  const [addHint, setAddHint] = useState('');
  const [loadingOwner, setLoadingOwner] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);

  // Ensure owner is present (first position) with resolved profile name
  useEffect(()=> {
    setTeam(Array.isArray(org.team)? org.team : []);
  }, [org.team]);

  useEffect(()=> {
    async function ensureOwner(){
      if(!org?.ownerUid) return;
      // Already present?
      const exists = team.some(m=> m.uid === org.ownerUid || m.id === org.ownerUid);
      if(exists){
        // Attempt enhancement if missing surname/name
        const ownerIdx = team.findIndex(m=> m.uid === org.ownerUid || m.id === org.ownerUid);
        const owner = team[ownerIdx];
        if(owner && !owner.name){
          try {
            setLoadingOwner(true);
            const snap = await getDocs(query(collection(db,'users'), where('__name__','==', org.ownerUid)));
            if(!snap.empty){
              const d = snap.docs[0];
              const data = d.data();
              const enhanced = { ...owner, ...profileToMember({ uid: d.id, ...data }) };
              const clone = [...team]; clone[ownerIdx] = enhanced; setTeam(clone);
            }
          } finally { setLoadingOwner(false); }
        }
        return;
      }
      try {
        setLoadingOwner(true);
        const snap = await getDocs(query(collection(db,'users'), where('__name__','==', org.ownerUid)));
        if(!snap.empty){
          const d = snap.docs[0];
          const data = d.data();
          const ownerMember = { ...profileToMember({ uid: d.id, ...data }), role: 'Owner' };
          const newTeam = [ownerMember, ...team];
          setTeam(newTeam);
          if(isOwner){ // persist only if you're the owner viewing (avoid unauthorized writes)
            try { await updateDoc(doc(db,'organizations', org.id), { team: newTeam }); } catch {/* ignore */}
          }
        } else {
          // Fallback minimal member
          const fallback = { uid: org.ownerUid, id: org.ownerUid, name: 'Owner', type: 'user', role: 'Owner' };
          const newTeam = [fallback, ...team]; setTeam(newTeam);
          if(isOwner){ try { await updateDoc(doc(db,'organizations', org.id), { team: newTeam }); } catch {/* ignore */} }
        }
      } finally { setLoadingOwner(false); }
    }
    ensureOwner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org.ownerUid]);

  // Subscribe to pending invites
  useEffect(()=> {
    if(!org?.id) return;
    setInvitesLoading(true);
    const qy = query(collection(db,'orgInvites'), where('orgDbId','==', org.id), where('status','==','pending'));
    const unsub = onSnapshot(qy, snap=> {
      setPendingInvites(snap.docs.map(d=> ({ id: d.id, ...d.data() })));
      setInvitesLoading(false);
    }, ()=> setInvitesLoading(false));
    return ()=> unsub();
  }, [org?.id]);

  async function persist(newTeam:any[]){
    try { await updateDoc(doc(db,'organizations', org.id), { team: newTeam }); }
    catch(e:any){ alert(e.message || 'Save failed'); }
  }

  async function resolveUser(email:string){
    try {
      const qy = query(collection(db,'users'), where('email','==', email));
      const snap = await getDocs(qy);
      if(!snap.empty){ const d = snap.docs[0]; const data = d.data(); return profileToMember({ uid: d.id, ...data }); }
    } catch {/* ignore */}
    return null;
  }

  function genToken(len=40){
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let out=''; for(let i=0;i<len;i++) out+=chars[Math.floor(Math.random()*chars.length)];
    return out;
  }

  async function createInvite(email:string){
    const token = genToken();
    const refDoc = doc(collection(db,'orgInvites'), token);
    const invite = {
      orgId: org.orgId,
      orgDbId: org.id,
      orgName: org.name || null,
      email: email.toLowerCase(),
      invitedByUid: org.ownerUid || null,
      createdAt: serverTimestamp(),
      status: 'pending',
      role: 'Member'
    };
    await setDoc(refDoc, invite);
    return token;
  }

  return (
    <div className='bg-white border border-brand-main/10 rounded-xl p-6 space-y-5 shadow-sm'>
      <h3 className='text-lg font-semibold text-brand-main'>Team</h3>
      {loadingOwner && <div className='text-[11px] text-gray-500'>Resolving owner…</div>}
      <div className='flex flex-wrap gap-3'>
        {team.map((m:any)=> (
          <div key={m.uid || m.id || m.email} className='px-3 py-2 rounded border border-brand-main/20 bg-brand-main/5 text-xs flex items-center gap-2'>
            <span>{m.name || m.email || m.id}</span>
            {m.role === 'Owner' && <span className='text-[9px] font-semibold text-brand-main'>Owner</span>}
            {isOwner && editMode && m.role !== 'Owner' && (
              <button onClick={()=> { const nt = team.filter(x=> x!==m); setTeam(nt); persist(nt); }} className='text-red-500 hover:text-red-700' aria-label='Remove'>×</button>
            )}
          </div>
        ))}
        {!team.length && <div className='text-xs text-gray-500'>No team members yet.</div>}
      </div>
      {isOwner && editMode && (
        <form onSubmit={async e=> { e.preventDefault(); setAddError(''); setAddHint(''); const val = memberInput.trim(); if(!val) return; setAdding(true); try {
          if(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)) {
            const resolved = await resolveUser(val.toLowerCase());
            if(resolved){
              const exists = team.some(t=> (t.uid && resolved.uid && t.uid===resolved.uid) || (t.email && resolved.email && t.email===resolved.email));
              if(!exists){
                const mt = [...team, resolved]; setTeam(mt); persist(mt); setAddHint('User linked.');
              } else { setAddHint('Already on team.'); }
            } else {
              const existingInvite = pendingInvites.find(i=> i.email === val.toLowerCase());
              if(existingInvite){ setAddHint('Invite already pending.'); }
              else {
                const token = await createInvite(val.toLowerCase());
                const link = typeof window!=='undefined'? `${window.location.origin}/org/invite/${token}` : `/org/invite/${token}`;
                setAddHint(`Invite created. Share link: ${link}`);
              }
            }
          } else {
            let newMember:any = { id: val, name: val, type: 'external' };
            const mt = [...team, newMember]; setTeam(mt); persist(mt); setAddHint('Added as external member.');
          }
          setMemberInput('');
        } catch(e:any){ setAddError(e.message || 'Add failed'); } finally { setAdding(false); } }} className='flex flex-col gap-2 w-full max-w-md'>
          <div className='flex gap-2'>
            <input value={memberInput} onChange={e=> { setMemberInput(e.target.value); setAddError(''); setAddHint(''); }} placeholder='Email or name' className='border rounded px-3 py-2 text-sm flex-1' />
            <button className='px-4 py-2 rounded bg-brand-main text-white text-sm font-semibold hover:bg-brand-dark disabled:opacity-50' disabled={adding}>{adding? 'Adding...' : 'Add'}</button>
          </div>
          {addError && <div className='text-[11px] text-red-600'>{addError}</div>}
          {addHint && <div className='text-[11px] text-green-600 whitespace-pre-wrap break-all'>{addHint}</div>}
          <div className='text-[10px] text-gray-500'>Enter an email to invite/link a user, or a name to add an external member.</div>
        </form>
      )}
      {isOwner && (
        <div className='pt-4 border-t border-brand-main/10 space-y-2'>
          <h4 className='text-sm font-semibold text-brand-main'>Pending Invites</h4>
          {invitesLoading && <div className='text-[11px] text-gray-500'>Loading invites…</div>}
          {!invitesLoading && !pendingInvites.length && <div className='text-[11px] text-gray-500'>No pending invites.</div>}
          {!invitesLoading && pendingInvites.length>0 && (
            <ul className='space-y-1'>
              {pendingInvites.map(inv=> (
                <li key={inv.id} className='flex items-center gap-2 text-[11px] bg-brand-main/5 px-2 py-1 rounded border border-brand-main/10'>
                  <span className='flex-1 truncate'>{inv.email}</span>
                  <button type='button' className='text-brand-main underline' onClick={()=> { if(typeof window!=='undefined') navigator.clipboard.writeText(`${window.location.origin}/org/invite/${inv.id}`); }}>Copy Link</button>
                  <button type='button' className='text-red-600' onClick={async()=> { if(!confirm('Cancel invite?')) return; try { await deleteDoc(doc(db,'orgInvites', inv.id)); } catch { /* ignore */ } }}>Cancel</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
