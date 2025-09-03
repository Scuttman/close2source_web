"use client";
import React, { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

export type AccessLevel = 'public' | 'supporter' | 'representative' | 'owner';
const ROLES: AccessLevel[] = ['public','supporter','representative','owner'];
const ROLE_LABEL: Record<AccessLevel,string> = { public:'Public', supporter:'Supporter', representative:'Representative', owner:'Owner'};

interface Props {
  individual: any;
  onUpdate: (partial: any)=>void;
  isOwner: boolean;
}

interface TabPermission { view: AccessLevel[]; edit: AccessLevel[]; }
type AccessSettings = Record<string, TabPermission>;

const DEFAULT_SETTINGS: AccessSettings = {
  overview: { view: ['public','supporter','representative','owner'], edit: ['owner'] },
  about: { view: ['public','supporter','representative','owner'], edit: ['owner'] },
  updates: { view: ['supporter','representative','owner'], edit: ['owner','representative'] },
  prayer: { view: ['supporter','representative','owner'], edit: ['owner'] },
  finance: { view: ['representative','owner'], edit: ['owner','representative'] }
};

export default function IndividualSettingsTab({ individual, onUpdate, isOwner }: Props){
  function normalize(raw: any): AccessSettings {
    if(!raw || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_SETTINGS;
    const rank: AccessLevel[] = ['public','supporter','representative','owner'];
    const thresholdToArray = (lvl: string): AccessLevel[] => {
      const i = rank.indexOf(lvl as AccessLevel); if(i===-1) return [...rank]; return rank.slice(i) as AccessLevel[];
    };
    const out: AccessSettings = { ...DEFAULT_SETTINGS };
    Object.entries(raw).forEach(([k,v])=>{
      if(typeof v === 'string') {
        out[k] = { view: thresholdToArray(v), edit: ['owner'] };
      } else if(v && typeof v==='object' && 'view' in v && 'edit' in v) {
        const vv = Array.isArray((v as any).view)? (v as any).view.filter((r:any)=> rank.includes(r)) : out[k]?.view;
        const ee = Array.isArray((v as any).edit)? (v as any).edit.filter((r:any)=> rank.includes(r)) : out[k]?.edit;
        out[k] = { view: vv && vv.length? vv: out[k].view, edit: ee && ee.length? ee: out[k].edit };
      }
    });
    return out;
  }

  const existing: AccessSettings = normalize(individual?.accessSettings);
  const [settings, setSettings] = useState<AccessSettings>(existing);
  const [representatives, setRepresentatives] = useState<string[]>(Array.isArray(individual?.representatives)? individual.representatives: []);
  const [supporters, setSupporters] = useState<string[]>(Array.isArray(individual?.supporters)? individual.supporters: []);
  const [repInput, setRepInput] = useState('');
  const [supInput, setSupInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number|undefined>(undefined);
  const [allowRepSettings, setAllowRepSettings] = useState<boolean>(!!individual?.settingsAllowRepresentative);

  useEffect(()=>{ setSettings(normalize(individual?.accessSettings)); },[individual?.accessSettings]);

  function toggleView(tab: string, role: AccessLevel){
    setSettings(s=> ({
      ...s,
      [tab]: {
        ...s[tab],
        view: s[tab].view.includes(role)? s[tab].view.filter(r=>r!==role): [...s[tab].view, role].sort((a,b)=> ROLES.indexOf(a)-ROLES.indexOf(b))
      }
    }));
  }
  function toggleEdit(tab: string, role: AccessLevel){
    if(role==='public') return; // never allow public edits
    setSettings(s=> ({
      ...s,
      [tab]: {
        ...s[tab],
        edit: s[tab].edit.includes(role)? s[tab].edit.filter(r=>r!==role): [...s[tab].edit, role].sort((a,b)=> ROLES.indexOf(a)-ROLES.indexOf(b))
      }
    }));
  }
  function sanitizeForSave(inSet: AccessSettings): AccessSettings {
    const copy: AccessSettings = {} as any;
    Object.entries(inSet).forEach(([k,v])=>{
      const view = Array.from(new Set(v.view)).filter(r=>ROLES.includes(r));
      const edit = Array.from(new Set(v.edit)).filter(r=>ROLES.includes(r) && view.includes(r));
      copy[k] = { view, edit };
    });
    return copy;
  }

  async function save(){
    if(!isOwner) return;
    setSaving(true);
    try {
      const ref = doc(db, 'individuals', individual.id);
      const clean = sanitizeForSave(settings);
      await updateDoc(ref, { accessSettings: clean, representatives, supporters, settingsAllowRepresentative: allowRepSettings });
      onUpdate({ accessSettings: clean, representatives, supporters, settingsAllowRepresentative: allowRepSettings });
      setSavedAt(Date.now());
    } catch(e){ /* ignore */ }
    finally { setSaving(false); }
  }

  function addRep(){ const val = repInput.trim(); if(!val) return; if(!representatives.includes(val)) setRepresentatives(r=>[...r,val]); setRepInput(''); }
  function removeRep(v:string){ setRepresentatives(r=> r.filter(x=>x!==v)); }
  function addSup(){ const val = supInput.trim(); if(!val) return; if(!supporters.includes(val)) setSupporters(r=>[...r,val]); setSupInput(''); }
  function removeSup(v:string){ setSupporters(r=> supporters.filter(x=>x!==v)); }

  if(!isOwner){
    return <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm text-sm text-gray-600">Only the owner can manage settings.</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm space-y-8">
      <div>
        <h3 className="font-semibold text-brand-main mb-2">Settings Visibility</h3>
        <div className="flex items-center gap-3 mb-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={allowRepSettings} onChange={e=>setAllowRepSettings(e.target.checked)} />
            Allow Representatives to access Settings
          </label>
        </div>
        <h3 className="font-semibold text-brand-main mb-4">Tab Permissions (View & Edit)</h3>
        <div className="space-y-4">
          {Object.keys(DEFAULT_SETTINGS).map(tab=> (
            <div key={tab} className="border rounded px-3 py-3">
              <div className="font-medium text-sm mb-2 capitalize">{tab}</div>
              <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                <div className="flex-1">
                  <div className="text-[11px] font-semibold mb-1 text-brand-main">View</div>
                  <div className="flex flex-wrap gap-3">
                    {ROLES.map(r=> (
                      <label key={r} className="flex items-center gap-1 text-[11px]">
                        <input type="checkbox" checked={settings[tab].view.includes(r)} onChange={()=>toggleView(tab,r)} /> {ROLE_LABEL[r]}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-[11px] font-semibold mb-1 text-brand-main">Edit</div>
                  <div className="flex flex-wrap gap-3">
                    {ROLES.map(r=> (
                      <label key={r} className="flex items-center gap-1 text-[11px] opacity-90">
                        <input type="checkbox" disabled={r==='public'} checked={settings[tab].edit.includes(r)} onChange={()=>toggleEdit(tab,r)} /> {ROLE_LABEL[r]}
                      </label>
                    ))}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">Edit roles must also have view access.</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h4 className="font-semibold text-brand-main text-sm mb-2">Representatives</h4>
          <div className="flex gap-2 mb-2">
            <input value={repInput} onChange={e=>setRepInput(e.target.value)} placeholder="User UID or email" className="flex-1 border rounded px-2 py-1 text-sm" />
            <button onClick={addRep} className="px-3 py-1 text-xs rounded bg-brand-main text-white">Add</button>
          </div>
          {representatives.length? (
            <ul className="space-y-1 text-xs">
              {representatives.map(r=> (
                <li key={r} className="flex items-center gap-2 bg-brand-main/5 rounded px-2 py-1">
                  <span className="truncate flex-1">{r}</span>
                  <button onClick={()=>removeRep(r)} className="text-red-600 hover:underline">remove</button>
                </li>
              ))}
            </ul>
          ) : <div className="text-xs text-gray-400">No representatives.</div>}
        </div>
        <div>
          <h4 className="font-semibold text-brand-main text-sm mb-2">Supporters</h4>
          <div className="flex gap-2 mb-2">
            <input value={supInput} onChange={e=>setSupInput(e.target.value)} placeholder="User UID or email" className="flex-1 border rounded px-2 py-1 text-sm" />
            <button onClick={addSup} className="px-3 py-1 text-xs rounded bg-brand-main text-white">Add</button>
          </div>
          {supporters.length? (
            <ul className="space-y-1 text-xs">
              {supporters.map(r=> (
                <li key={r} className="flex items-center gap-2 bg-brand-main/5 rounded px-2 py-1">
                  <span className="truncate flex-1">{r}</span>
                  <button onClick={()=>removeSup(r)} className="text-red-600 hover:underline">remove</button>
                </li>
              ))}
            </ul>
          ) : <div className="text-xs text-gray-400">No supporters.</div>}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded bg-brand-main text-white text-sm font-semibold disabled:opacity-50">{saving? 'Saving...':'Save Settings'}</button>
        {savedAt && <span className="text-xs text-gray-500">Saved {new Date(savedAt).toLocaleTimeString()}</span>}
      </div>
      <p className="text-[11px] text-gray-400 leading-relaxed">Roles are cumulative in responsibility, but you can explicitly choose which roles can view or edit each tab. Public edits are never allowed.</p>
    </div>
  );
}
