"use client";
import { useEffect, useState } from 'react';
import { getUser, getUsersByEmails, updateOrg, subscribePendingInvites, createOrgInvite, deleteOrgInvite } from '@/lib/dal';

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
            const userData = await getUser(org.ownerUid);
            if(userData){
              const enhanced = { ...owner, ...profileToMember({ uid: userData.id, ...userData }) };
              const clone = [...team]; clone[ownerIdx] = enhanced; setTeam(clone);
            }
          } finally { setLoadingOwner(false); }
        }
        return;
      }
      try {
        setLoadingOwner(true);
        const userData = await getUser(org.ownerUid);
        if(userData){
          const ownerMember = { ...profileToMember({ uid: userData.id, ...userData }), role: 'Owner' };
          const newTeam = [ownerMember, ...team];
          setTeam(newTeam);
          if(isOwner){ // persist only if you're the owner viewing (avoid unauthorized writes)
            try { await updateOrg(org.id, { team: newTeam }); } catch {/* ignore */}
          }
        } else {
          // Fallback minimal member
          const fallback = { uid: org.ownerUid, id: org.ownerUid, name: 'Owner', type: 'user', role: 'Owner' };
          const newTeam = [fallback, ...team]; setTeam(newTeam);
          if(isOwner){ try { await updateOrg(org.id, { team: newTeam }); } catch {/* ignore */} }
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
    const unsub = subscribePendingInvites(org.id, (invites) => {
      setPendingInvites(invites);
      setInvitesLoading(false);
    }, ()=> setInvitesLoading(false));
    return ()=> unsub();
  }, [org?.id]);

  const ROLES = ['Member', 'Admin', 'Representative', 'Supporter'];

  async function persist(newTeam:any[]){
    try { await updateOrg(org.id, { team: newTeam }); }
    catch(e:any){ alert(e.message || 'Save failed'); }
  }

  async function changeRole(member: any, newRole: string) {
    const newTeam = team.map(m =>
      (m.uid && m.uid === member.uid) || (m.email && m.email === member.email)
        ? { ...m, role: newRole }
        : m
    );
    setTeam(newTeam);
    await persist(newTeam);
  }

  async function resolveUser(email:string){
    try {
      const byEmail = await getUsersByEmails([email]);
      const found = Object.values(byEmail)[0];
      if(found){ return profileToMember({ uid: found.id, ...found }); }
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
    const invite = {
      orgId: org.orgId,
      orgDbId: org.id,
      orgName: org.name || null,
      email: email.toLowerCase(),
      invitedByUid: org.ownerUid || null,
      createdAt: new Date(),
      status: 'pending',
      role: 'Member'
    };
    await createOrgInvite(token, invite as any);
    return token;
  }

  return (
    <div className='bg-white border border-brand-main/10 rounded-xl p-6 space-y-5 shadow-sm'>
      <h3 className='text-lg font-semibold text-brand-main'>Team</h3>
      {loadingOwner && <div className='text-[11px] text-gray-500'>Resolving owner…</div>}
      <div className='flex flex-col gap-2'>
        {team.map((m:any)=> (
          <div key={m.uid || m.id || m.email} className='flex items-center gap-3 px-4 py-2.5 rounded-lg border border-brand-main/20 bg-brand-main/5'>
            {/* Avatar */}
            {m.photoURL ? (
              <img src={m.photoURL} alt={m.name} className='w-8 h-8 rounded-full object-cover flex-shrink-0' />
            ) : (
              <div className='w-8 h-8 rounded-full bg-brand-main/20 flex items-center justify-center flex-shrink-0'>
                <span className='text-xs font-semibold text-brand-main'>{(m.name || m.email || '?')[0].toUpperCase()}</span>
              </div>
            )}
            {/* Name + email */}
            <div className='flex-1 min-w-0'>
              <div className='text-sm font-medium text-gray-900 truncate'>{m.name || m.email || m.id}</div>
              {m.email && m.name && <div className='text-[11px] text-gray-500 truncate'>{m.email}</div>}
            </div>
            {/* Role */}
            {m.role === 'Owner' ? (
              <span className='text-[10px] font-bold uppercase tracking-wide text-brand-main bg-brand-main/10 px-2 py-0.5 rounded-full'>Owner</span>
            ) : isOwner ? (
              <select
                value={m.role || 'Member'}
                onChange={e => changeRole(m, e.target.value)}
                className='text-xs border border-brand-main/30 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-main'
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            ) : (
              <span className='text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full'>{m.role || 'Member'}</span>
            )}
            {/* Remove */}
            {isOwner && editMode && m.role !== 'Owner' && (
              <button onClick={()=> { const nt = team.filter(x=> x!==m); setTeam(nt); persist(nt); }} className='text-red-400 hover:text-red-600 text-lg leading-none flex-shrink-0' aria-label='Remove'>×</button>
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
                  <button type='button' className='text-red-600' onClick={async()=> { if(!confirm('Cancel invite?')) return; try { await deleteOrgInvite(inv.id); } catch { /* ignore */ } }}>Cancel</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
