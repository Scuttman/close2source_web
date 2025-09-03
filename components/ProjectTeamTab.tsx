"use client";
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

interface ProjectTeamTabProps {
  project: any;
  projectId: string;
  isProjectCreator: boolean;
  allowEdit?: boolean;
  setProject: (updater: any)=> void;
}

interface TeamMemberEntry {
  id: string;
  type: 'user' | 'external';
  name: string;
  email?: string;
  role?: string;
  photoURL?: string; // optional profile image if available
  image?: string; // alternative keys for robustness
  avatar?: string;
}

interface TeamMemberMetrics {
  key: string; // uid or name
  name: string;
  uid?: string;
  updates: number;
  comments: number;
  reactions: number; // reactions made
  firstAt?: string;
  lastAt?: string;
  total: number; // aggregate score for sorting
}

function randomId(){
  if(typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  return Math.random().toString(36).slice(2,11);
}

export default function ProjectTeamTab({ project, projectId, isProjectCreator, allowEdit, setProject }: ProjectTeamTabProps) {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'email'|'external'>('email');
  const [email, setEmail] = useState('');
  const [extName, setExtName] = useState('');
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string| null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const router = useRouter();
  const [profileMap, setProfileMap] = useState<Record<string, { name?: string; photoURL?: string }>>({});

  const updates: any[] = Array.isArray(project?.updates) ? project.updates : [];
  const metrics = useMemo<TeamMemberMetrics[]>(()=> {
    const map = new Map<string, TeamMemberMetrics>();
    const addContribution = (key: string, name: string, uid: string | undefined, dateStr: string | undefined, type: 'update' | 'comment' | 'reaction') => {
      if(!key) return;
      if(!map.has(key)) map.set(key,{ key, name: name || uid || 'Unknown', uid, updates:0, comments:0, reactions:0, firstAt: dateStr, lastAt: dateStr, total:0 });
      const m = map.get(key)!;
      if(type==='update') m.updates++; else if(type==='comment') m.comments++; else if(type==='reaction') m.reactions++;
      if(dateStr){
        if(!m.firstAt || dateStr < m.firstAt) m.firstAt = dateStr;
        if(!m.lastAt || dateStr > m.lastAt) m.lastAt = dateStr;
      }
    };
    updates.forEach(u=> {
      const createdAt = u.createdAt || u.updatedAt;
      const key = u.authorUid || u.author || '';
      addContribution(key, u.author, u.authorUid, createdAt, 'update');
      (u.comments||[]).forEach((c:any)=> addContribution(c.authorUid||c.author||'', c.author, c.authorUid, c.createdAt, 'comment'));
      const reactionUsers = u.reactionUsers || {};
      Object.keys(reactionUsers).forEach(rt=> (reactionUsers[rt]||[]).forEach((uid:string)=> addContribution(uid, uid, uid, createdAt, 'reaction')));
    });
    if(project?.createdBy){
      const creatorKey = project.createdBy;
      if(!map.has(creatorKey)) map.set(creatorKey, { key: creatorKey, name: project.createdBy, updates:0, comments:0, reactions:0, firstAt: undefined, lastAt: undefined, total:0 });
    }
    return Array.from(map.values()).map(m=> ({ ...m, total: m.updates*4 + m.comments*2 + m.reactions })).sort((a,b)=> b.total - a.total || (b.lastAt||'').localeCompare(a.lastAt||''));
  },[updates, project?.createdBy]);

  const team: TeamMemberEntry[] = Array.isArray(project?.team)? project.team : [];

  async function persistTeam(updated: TeamMemberEntry[]) {
    setSaving(true); setError('');
    // Deep strip undefined (Firestore disallows undefined values)
    function stripUndefined(val:any): any {
      if(Array.isArray(val)) return val.map(stripUndefined);
      if(val && typeof val === 'object') {
        const out: any = {};
        Object.keys(val).forEach(k=> {
          const v = (val as any)[k];
          if(typeof v === 'undefined') return; // skip
          out[k] = stripUndefined(v);
        });
        return out;
      }
      return val;
    }
    const cleaned = stripUndefined(updated);
    try { await updateDoc(doc(db,'projects', projectId), { team: cleaned }); setProject((p:any)=> ({ ...p, team: cleaned })); }
    catch(e:any){ setError(e.message || 'Failed to save team'); }
    finally { setSaving(false); }
  }

  function addMember(){
    if(!isProjectCreator || !allowEdit) return;
    if(mode==='email'){
      if(!email.trim()) { setError('Email required'); return; }
      const em = email.trim().toLowerCase();
      if(team.some(m=> m.email?.toLowerCase()===em)) { setError('Email already added'); return; }
      const nameGuess = em.split('@')[0];
      persistTeam([...team, { id: em, type:'user', email: em, name: nameGuess, role: role.trim()||'' }]);
      setEmail(''); setRole('');
    } else {
      if(!extName.trim()) { setError('Name required'); return; }
      persistTeam([...team, { id: randomId(), type:'external', name: extName.trim(), role: role.trim()||'' }]);
      setExtName(''); setRole('');
    }
  }

  function removeMember(id:string){
    if(!isProjectCreator || !allowEdit) return;
    persistTeam(team.filter(m=> m.id!==id));
  }

  function startEdit(member: TeamMemberEntry){
    if(!allowEdit) return;
    setEditingId(member.id);
    setEditName(member.name || '');
    setEditRole(member.role || '');
  }

  function cancelEdit(){
    setEditingId(null); setEditName(''); setEditRole('');
  }

  function saveEdit(member: TeamMemberEntry){
    if(!editingId) return;
    const updated = team.map(m=> {
      if(m.id!==member.id) return m;
      // For external: allow name & role change; for user: only role here (profile edit externalized)
      if(member.type==='external') return { ...m, name: editName.trim() || m.name, role: editRole.trim() };
      return { ...m, role: editRole.trim() };
    });
    persistTeam(updated);
    cancelEdit();
  }

  const memberFiltered = team.filter(m=> !search || m.name.toLowerCase().includes(search.toLowerCase()) || (m.email||'').toLowerCase().includes(search.toLowerCase()));
  const metricsFiltered = metrics.filter(m=> !search || m.name.toLowerCase().includes(search.toLowerCase()) || (m.uid||'').toLowerCase().includes(search.toLowerCase()));

  // Ensure project owner always appears in team; auto-insert if absent
  useEffect(()=> {
    const owner = project?.createdBy;
    if(!owner) return;
    const hasOwner = team.some(m=> m.id === owner || (m.email && m.email === owner));
    if(!hasOwner) {
      // Derive a display name; fallback to owner string
      let name = owner;
      if(owner.includes('@')) name = owner.split('@')[0];
      const ownerEntry: TeamMemberEntry = { id: owner, type: 'user', name, email: owner.includes('@')? owner: undefined, role: 'Owner' };
      // Persist silently (no need to block UI with saving state flash)
      persistTeam([...team, ownerEntry]);
    }
  // Intentionally exclude persistTeam from deps to avoid infinite loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.createdBy, projectId, team.length]);

  // Fetch canonical user profile info (name/photo) for user-type members
  useEffect(()=> {
    let cancelled = false;
    async function loadProfiles(){
      const tasks: Promise<void>[] = [];
      const nextMap: Record<string,{name?:string; photoURL?:string}> = {};
      team.forEach(m=> {
        if(m.type !== 'user') return;
        // skip if already loaded
        if(profileMap[m.id]) return;
        // Strategy: if member has email -> query by email; else if id seems like uid (no @) -> direct doc
        if(m.email && m.email.includes('@')) {
          tasks.push((async ()=> {
            try {
              const q = query(collection(db,'users'), where('email','==', m.email));
              const snap = await getDocs(q);
              if(!snap.empty){
                const d:any = snap.docs[0].data();
                const first = d.name || d.firstName || d.givenName || '';
                const last = d.surname || d.lastName || d.familyName || '';
                const combined = [first, last].filter(Boolean).join(' ') || d.displayName || d.fullName || m.name;
                nextMap[m.id] = { name: combined, photoURL: d.photoURL || d.avatar || d.image || '' };
              }
            } catch { /* ignore */ }
          })());
        } else if(!m.id.includes('@')) {
          tasks.push((async ()=> {
            try {
              const userDoc = await getDoc(doc(db,'users', m.id));
              if(userDoc.exists()) {
                const d:any = userDoc.data();
                const first = d.name || d.firstName || d.givenName || '';
                const last = d.surname || d.lastName || d.familyName || '';
                const combined = [first, last].filter(Boolean).join(' ') || d.displayName || d.fullName || m.name;
                nextMap[m.id] = { name: combined, photoURL: d.photoURL || d.avatar || d.image || '' };
              }
            } catch { /* ignore */ }
          })());
        }
      });
      if(tasks.length){
        await Promise.all(tasks);
        if(!cancelled && Object.keys(nextMap).length) setProfileMap(p=> ({ ...p, ...nextMap }));
      }
    }
    loadProfiles();
    return ()=> { cancelled = true; };
  }, [team, profileMap]);

  return (
    <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm text-brand-dark space-y-8">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h2 className="text-lg font-semibold text-brand-main">Team</h2>
          <input value={search} onChange={e=> setSearch(e.target.value)} placeholder="Search team..." className="w-full md:w-64 border rounded px-3 py-2 text-sm" />
        </div>
        {isProjectCreator && allowEdit && (
          <div className="border rounded-lg p-4 bg-brand-main/5 space-y-3">
            <div className="flex items-center gap-4 text-xs font-medium">
              <label className="flex items-center gap-1"><input type="radio" value="email" checked={mode==='email'} onChange={()=> setMode('email')} /><span>Platform User (email)</span></label>
              <label className="flex items-center gap-1"><input type="radio" value="external" checked={mode==='external'} onChange={()=> setMode('external')} /><span>External Contributor</span></label>
            </div>
            {mode==='email'? (
              <div className="grid md:grid-cols-3 gap-3">
                <div className="space-y-1"><label className="block text-[11px] uppercase tracking-wide text-brand-main">Email</label><input className="w-full border rounded px-2 py-1 text-sm" value={email} onChange={e=> setEmail(e.target.value)} placeholder="user@example.com" /></div>
                <div className="space-y-1"><label className="block text-[11px] uppercase tracking-wide text-brand-main">Role</label><input className="w-full border rounded px-2 py-1 text-sm" value={role} onChange={e=> setRole(e.target.value)} placeholder="Designer" /></div>
                <div className="flex items-end"><button type="button" onClick={addMember} disabled={saving} className="px-4 py-2 text-sm font-semibold rounded bg-brand-main text-white disabled:opacity-50">{saving? 'Adding...' : 'Add Member'}</button></div>
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-3">
                <div className="space-y-1"><label className="block text-[11px] uppercase tracking-wide text-brand-main">Name</label><input className="w-full border rounded px-2 py-1 text-sm" value={extName} onChange={e=> setExtName(e.target.value)} placeholder="Full name" /></div>
                <div className="space-y-1"><label className="block text-[11px] uppercase tracking-wide text-brand-main">Role</label><input className="w-full border rounded px-2 py-1 text-sm" value={role} onChange={e=> setRole(e.target.value)} placeholder="Volunteer" /></div>
                <div className="flex items-end"><button type="button" onClick={addMember} disabled={saving} className="px-4 py-2 text-sm font-semibold rounded bg-brand-main text-white disabled:opacity-50">{saving? 'Adding...' : 'Add Member'}</button></div>
              </div>
            )}
            {error && <div className="text-xs text-red-600">{error}</div>}
            <p className="text-[10px] text-gray-500 leading-snug">Platform users (email) may later link to real accounts; external contributors exist only in this project for task assignment.</p>
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-brand-main mb-2">Members ({team.length})</h3>
          {team.length===0 && <div className="text-sm text-gray-500 italic">No team members yet.</div>}
          {team.length>0 && (
            <ul className="divide-y border rounded bg-white/80">
              {memberFiltered.map(m=> {
                const isEditing = editingId === m.id;
                const canonical = profileMap[m.id];
                const avatar = canonical?.photoURL || m.photoURL || m.image || m.avatar;
                const displayName = canonical?.name || m.name || (m.email ? m.email.split('@')[0] : m.id);
                return (
                  <li key={m.id} className="p-3 flex items-center gap-4 text-sm">
                    {avatar ? (
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-brand-main/20 bg-gray-100 flex items-center justify-center">
                        <img src={avatar} alt={displayName} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-brand-main/10 flex items-center justify-center text-brand-main font-bold text-xs">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      {isEditing && m.type==='external' ? (
                        <input className="w-full border rounded px-2 py-1 text-xs" value={editName} onChange={e=> setEditName(e.target.value)} />
                      ) : (
                        <div className="font-medium truncate">{displayName}</div>
                      )}
                      <div className="flex flex-wrap gap-2 items-center text-[11px] text-gray-500">
                        {isEditing ? (
                          <input className="border rounded px-2 py-0.5 text-[11px]" value={editRole} onChange={e=> setEditRole(e.target.value)} placeholder="Role" />
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-brand-main/5 text-brand-main/80 border border-brand-main/10 cursor-pointer" onClick={()=> allowEdit && startEdit(m)}>
                            {m.role || 'Set role'}
                          </span>
                        )}
                        <span className="uppercase tracking-wide text-gray-400">{m.type}</span>
                        {m.email && <span className="text-gray-400">{m.email}</span>}
                      </div>
                    </div>
                    {isProjectCreator && allowEdit && (
                      <div className="flex items-center gap-3">
                        {isEditing ? (
                          <>
                            <button type="button" onClick={()=> saveEdit(m)} className="text-[11px] text-brand-main font-semibold hover:underline disabled:opacity-50" disabled={saving}>{saving? 'Saving':'Save'}</button>
                            <button type="button" onClick={cancelEdit} className="text-[11px] text-gray-500 hover:underline">Cancel</button>
                          </>
                        ) : (
                          <>
                            {m.type==='user' && (
                              <button
                                type="button"
                                onClick={()=> {
                                  const ret = encodeURIComponent(`/projects/${projectId}?tab=team`);
                                  router.push(`/profile?return=${ret}`);
                                }}
                                className="text-[11px] text-brand-main hover:underline"
                              >Edit Profile</button>
                            )}
                            <button type="button" onClick={()=> startEdit(m)} className="text-[11px] text-gray-600 hover:underline">Edit</button>
                            <button type="button" onClick={()=> removeMember(m.id)} className="text-[11px] text-red-600 hover:underline">Remove</button>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <div className="pt-2 border-t border-brand-main/10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 mt-6">
          <h2 className="text-lg font-semibold text-brand-main">Team Engagement</h2>
          <span className="text-[11px] text-gray-500">Derived from project updates</span>
        </div>
        {metricsFiltered.length === 0 ? (
          <div className="text-sm text-gray-500 italic">No team activity yet.</div>
        ) : (
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2 font-semibold">Member</th>
                  <th className="px-4 py-2 font-semibold text-center">Updates</th>
                  <th className="px-4 py-2 font-semibold text-center">Comments</th>
                  <th className="px-4 py-2 font-semibold text-center">Reactions</th>
                  <th className="px-4 py-2 font-semibold hidden sm:table-cell">First</th>
                  <th className="px-4 py-2 font-semibold hidden sm:table-cell">Last</th>
                  <th className="px-4 py-2 font-semibold text-center">Score</th>
                </tr>
              </thead>
              <tbody>
                {metricsFiltered.map(m=> (
                  <tr key={m.key} className="border-t border-gray-100 hover:bg-brand-main/5">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-brand-main/20 flex items-center justify-center text-brand-main font-bold text-xs">{(m.name||'U')[0]}</div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-brand-main text-sm">{m.name || 'Unknown'}</span>
                          {m.uid && <span className="text-[10px] text-gray-400">{m.uid}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center font-semibold text-brand-dark">{m.updates}</td>
                    <td className="px-4 py-2 text-center font-semibold text-brand-dark">{m.comments}</td>
                    <td className="px-4 py-2 text-center font-semibold text-brand-dark">{m.reactions}</td>
                    <td className="px-4 py-2 hidden sm:table-cell text-xs text-gray-500">{m.firstAt ? new Date(m.firstAt).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2 hidden sm:table-cell text-xs text-gray-500">{m.lastAt ? new Date(m.lastAt).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-2 text-center font-semibold text-brand-main">{m.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-[11px] text-gray-500 leading-snug">Score weights: update ×4, comment ×2, reaction ×1. Historical deletions not reflected.</p>
      </div>
    </div>
  );
}
