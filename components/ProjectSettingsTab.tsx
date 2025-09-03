"use client";
import { useEffect, useState } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';

interface ProjectSettingsTabProps {
  projectId: string;
  project: any;
  projectCurrency: string;
  setProjectCurrency: (val: string) => void;
  setProject: React.Dispatch<React.SetStateAction<any>>;
  currencySymbol: string;
  allowEdit?: boolean;
}

type AccessLevel = 'public' | 'supporter' | 'representative' | 'owner';
interface TabPermission { view: AccessLevel[]; edit: AccessLevel[]; }
type AccessSettings = Record<string, TabPermission>;
const ROLES: AccessLevel[] = ['public','supporter','representative','owner'];
const ROLE_LABEL: Record<AccessLevel,string> = { public:'Public', supporter:'Supporter', representative:'Representative', owner:'Owner'};
const DEFAULT_ACCESS: AccessSettings = {
  overview: { view: ['public','supporter','representative','owner'], edit: ['owner'] },
  plan: { view: ['supporter','representative','owner'], edit: ['owner','representative'] },
  updates: { view: ['supporter','representative','owner'], edit: ['owner','representative'] },
  finance: { view: ['representative','owner'], edit: ['owner','representative'] },
  team: { view: ['supporter','representative','owner'], edit: ['owner','representative'] }
};

export default function ProjectSettingsTab({
  projectId,
  project,
  projectCurrency,
  setProjectCurrency,
  setProject,
  currencySymbol,
  allowEdit=false,
}: ProjectSettingsTabProps) {
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const router = useRouter();
  const auth = typeof window !== 'undefined' ? getAuth() : null;

  // Permissions state (mirroring IndividualSettingsTab)
  function normalizeAccess(raw:any): AccessSettings {
    if(!raw || typeof raw!=='object' || Array.isArray(raw)) return DEFAULT_ACCESS;
    const rank = ROLES;
    const thresholdToArray = (lvl: string): AccessLevel[] => { const i = rank.indexOf(lvl as any); return i===-1? [...rank]: rank.slice(i) as AccessLevel[]; };
    const out: AccessSettings = { ...DEFAULT_ACCESS };
    Object.entries(raw).forEach(([k,v])=>{
      if(typeof v==='string'){ out[k] = { view: thresholdToArray(v), edit:['owner'] }; }
      else if(v && typeof v==='object' && 'view' in (v as any) && 'edit' in (v as any)){
        const vv = Array.isArray((v as any).view)? (v as any).view.filter((r:any)=> rank.includes(r)): out[k]?.view;
        const ee = Array.isArray((v as any).edit)? (v as any).edit.filter((r:any)=> rank.includes(r)): out[k]?.edit;
        out[k] = { view: vv && vv.length? vv: out[k].view, edit: ee && ee.length? ee: out[k].edit };
      }
    });
    return out;
  }
  const [accessSettings, setAccessSettings] = useState<AccessSettings>(normalizeAccess(project?.accessSettings));
  const [representatives, setRepresentatives] = useState<string[]>(Array.isArray(project?.representatives)? project.representatives: []);
  const [supporters, setSupporters] = useState<string[]>(Array.isArray(project?.supporters)? project.supporters: []);
  const [repInput, setRepInput] = useState('');
  const [supInput, setSupInput] = useState('');
  const [savingPerms, setSavingPerms] = useState(false);
  const [savedAt, setSavedAt] = useState<number|undefined>(undefined);
  const [allowRepSettings, setAllowRepSettings] = useState<boolean>(!!project?.settingsAllowRepresentative);

  useEffect(()=>{ setAccessSettings(normalizeAccess(project?.accessSettings)); },[project?.accessSettings]);

  function toggleView(tab:string, role:AccessLevel){
    if(!allowEdit) return;
    setAccessSettings(s=> {
      const cur = s[tab];
      const has = cur.view.includes(role);
      let newView: AccessLevel[];
      let newEdit = [...cur.edit];
      if(has){
        // Removing view: also remove from edit if present
        newView = cur.view.filter(r=> r!==role);
        if(newEdit.includes(role)) newEdit = newEdit.filter(r=> r!==role);
      } else {
        // Adding view
        newView = [...cur.view, role].sort((a,b)=> ROLES.indexOf(a)-ROLES.indexOf(b));
      }
      return { ...s, [tab]: { ...cur, view: newView, edit: newEdit } };
    });
  }
  function toggleEdit(tab:string, role:AccessLevel){
    if(!allowEdit || role==='public') return;
    setAccessSettings(s=> {
      const cur = s[tab];
      const has = cur.edit.includes(role);
      let newEdit: AccessLevel[];
      let newView = [...cur.view];
      if(has){
        // Removing edit: leave view intact
        newEdit = cur.edit.filter(r=> r!==role);
      } else {
        // Adding edit: ensure view includes role
        if(!newView.includes(role)) newView = [...newView, role].sort((a,b)=> ROLES.indexOf(a)-ROLES.indexOf(b));
        newEdit = [...cur.edit, role].sort((a,b)=> ROLES.indexOf(a)-ROLES.indexOf(b));
      }
      return { ...s, [tab]: { ...cur, view: newView, edit: newEdit } };
    });
  }
  function sanitizeAccess(inSet:AccessSettings): AccessSettings { const copy:AccessSettings = {} as any; Object.entries(inSet).forEach(([k,v])=>{ const view = Array.from(new Set(v.view)).filter(r=>ROLES.includes(r)); const edit = Array.from(new Set(v.edit)).filter(r=>ROLES.includes(r) && view.includes(r)); copy[k] = { view, edit }; }); return copy; }
  async function savePermissions(){
    if(!allowEdit) return;
    setSavingPerms(true);
    try {
      const clean = sanitizeAccess(accessSettings);
      await updateDoc(doc(db,'projects',projectId), { accessSettings: clean, representatives, supporters, settingsAllowRepresentative: allowRepSettings });
      setProject((p:any)=> ({ ...p, accessSettings: clean, representatives, supporters, settingsAllowRepresentative: allowRepSettings }));
      setSavedAt(Date.now());
    } catch(e){ /* ignore */ }
    finally { setSavingPerms(false); }
  }
  function addRep(){ const val = repInput.trim(); if(!val) return; if(!representatives.includes(val)) setRepresentatives(r=>[...r,val]); setRepInput(''); }
  function removeRep(v:string){ setRepresentatives(r=> r.filter(x=> x!==v)); }
  function addSup(){ const val = supInput.trim(); if(!val) return; if(!supporters.includes(val)) setSupporters(r=>[...r,val]); setSupInput(''); }
  function removeSup(v:string){ setSupporters(r=> supporters.filter(x=> x!==v)); }

  return (
    <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm text-brand-dark space-y-10 max-w-4xl">
      <div className="space-y-4 max-w-xl">
        <h2 className="text-lg font-semibold text-brand-main">Project Settings</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
          <select
            value={projectCurrency}
            onChange={async e => {
              const val = e.target.value;
              setProjectCurrency(val);
              try {
                await updateDoc(doc(db, 'projects', projectId), { currency: val });
                setProject((prev: any) => ({ ...prev, currency: val }));
              } catch { /* silent */ }
            }}
            disabled={!allowEdit}
            className="w-full border rounded px-3 py-2 text-sm disabled:opacity-60"
          >
            <option value="">Select currency…</option>
            {['USD','EUR','GBP','ZAR','KES','UGX','TZS','GHS','NGN','MWK','ETB','RWF','CAD','AUD','NZD','INR'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <p className="text-[10px] text-gray-500 mt-1">Applies as a prefix to displayed amounts (no FX conversion).</p>
          {projectCurrency && <p className="text-[10px] text-gray-600 mt-1">Symbol: <span className="font-semibold">{currencySymbol}</span></p>}
        </div>
      {/* Permissions Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-brand-main">Permissions</h3>
          <label className="flex items-center gap-2 text-xs font-medium">
            <input type="checkbox" disabled={!allowEdit} checked={allowRepSettings} onChange={e=> setAllowRepSettings(e.target.checked)} />
            Allow Representatives to access Settings
          </label>
        </div>
        <div className="space-y-4">
          {Object.keys(DEFAULT_ACCESS).map(tab=> (
            <div key={tab} className="border rounded px-3 py-3">
              <div className="font-medium text-sm mb-2 capitalize">{tab}</div>
              <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                <div className="flex-1">
                  <div className="text-[11px] font-semibold mb-1 text-brand-main">View</div>
                  <div className="flex flex-wrap gap-3">
                    {ROLES.map(r=> (
                      <label key={r} className="flex items-center gap-1 text-[11px]">
                        <input type="checkbox" disabled={!allowEdit} checked={accessSettings[tab].view.includes(r)} onChange={()=>toggleView(tab,r)} /> {ROLE_LABEL[r]}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-[11px] font-semibold mb-1 text-brand-main">Edit</div>
                  <div className="flex flex-wrap gap-3">
                    {ROLES.map(r=> (
                      <label key={r} className="flex items-center gap-1 text-[11px] opacity-90">
                        <input type="checkbox" disabled={!allowEdit || r==='public'} checked={accessSettings[tab].edit.includes(r)} onChange={()=>toggleEdit(tab,r)} /> {ROLE_LABEL[r]}
                      </label>
                    ))}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">Edit roles must also have view access.</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h4 className="font-semibold text-brand-main text-sm mb-2">Representatives</h4>
            <div className="flex gap-2 mb-2">
              <input value={repInput} onChange={e=>setRepInput(e.target.value)} placeholder="User UID or email" className="flex-1 border rounded px-2 py-1 text-sm" disabled={!allowEdit} />
              <button type="button" onClick={addRep} disabled={!allowEdit} className="px-3 py-1 text-xs rounded bg-brand-main text-white disabled:opacity-50">Add</button>
            </div>
            {representatives.length? (
              <ul className="space-y-1 text-xs">
                {representatives.map(r=> (
                  <li key={r} className="flex items-center gap-2 bg-brand-main/5 rounded px-2 py-1">
                    <span className="truncate flex-1">{r}</span>
                    {allowEdit && <button type="button" onClick={()=>removeRep(r)} className="text-red-600 hover:underline">remove</button>}
                  </li>
                ))}
              </ul>
            ) : <div className="text-xs text-gray-400">No representatives.</div>}
          </div>
          <div>
            <h4 className="font-semibold text-brand-main text-sm mb-2">Supporters</h4>
            <div className="flex gap-2 mb-2">
              <input value={supInput} onChange={e=>setSupInput(e.target.value)} placeholder="User UID or email" className="flex-1 border rounded px-2 py-1 text-sm" disabled={!allowEdit} />
              <button type="button" onClick={addSup} disabled={!allowEdit} className="px-3 py-1 text-xs rounded bg-brand-main text-white disabled:opacity-50">Add</button>
            </div>
            {supporters.length? (
              <ul className="space-y-1 text-xs">
                {supporters.map(r=> (
                  <li key={r} className="flex items-center gap-2 bg-brand-main/5 rounded px-2 py-1">
                    <span className="truncate flex-1">{r}</span>
                    {allowEdit && <button type="button" onClick={()=>removeSup(r)} className="text-red-600 hover:underline">remove</button>}
                  </li>
                ))}
              </ul>
            ) : <div className="text-xs text-gray-400">No supporters.</div>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" onClick={savePermissions} disabled={!allowEdit || savingPerms} className="px-4 py-2 rounded bg-brand-main text-white text-sm font-semibold disabled:opacity-50">{savingPerms? 'Saving...':'Save Permissions'}</button>
          {savedAt && <span className="text-xs text-gray-500">Saved {new Date(savedAt).toLocaleTimeString()}</span>}
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed">Roles cascade upward. Public edits are never allowed. Representatives/supporters lists are raw identifiers (UID or email) that your auth rules can interpret.</p>
      </div>
      <div className="pt-2">
        <h2 className="text-lg font-semibold text-brand-main mb-1">Danger Zone</h2>
        <p className="text-sm text-gray-600">Deleting a project is permanent. All updates and data stored directly on this project document will be removed. This action cannot be undone.</p>
      </div>
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Type <span className="font-mono text-brand-main">delete</span> to enable the delete button.</label>
        <input
          type="text"
          value={deleteInput}
          onChange={e => setDeleteInput(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="delete"
          disabled={deleting}
        />
  {deleteError && <div className="text-sm text-red-600">{deleteError}</div>}
  <button
          disabled={deleteInput.trim().toLowerCase() !== 'delete' || deleting}
          onClick={async () => {
            if (deleteInput.trim().toLowerCase() !== 'delete') return;
            if (!confirm('Are you absolutely sure you want to delete this project? This cannot be undone.')) return;
            setDeleting(true); setDeleteError('');
            try {
              const user = auth?.currentUser;
              if (!user) throw new Error('Must be signed in');
              if (project.createdBy && ![user.displayName, user.email, user.uid].includes(project.createdBy)) {
                const isAdmin = (user as any)?.stsTokenManager || false; // placeholder admin check
                if (!isAdmin) throw new Error('You are not allowed to delete this project');
              }
              await deleteDoc(doc(db, 'projects', projectId));
              router.push('/projects');
            } catch (e: any) { setDeleteError(e.message || 'Failed to delete'); }
            finally { setDeleting(false); }
          }}
          className="px-4 py-2 rounded bg-red-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700"
  >{deleting ? 'Deleting...' : 'Delete Project'}</button>
      </div>
    </div>
    </div>
  );
}
