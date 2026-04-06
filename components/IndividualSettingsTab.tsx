"use client";
import React, { useEffect, useState } from 'react';
import { updateIndividual, fieldDelete, getProfileViewStats } from '@/lib/dal';

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
  const [accessPin, setAccessPin] = useState<string>(individual?.accessPin || '');
  const [showPinInput, setShowPinInput] = useState<boolean>(!!individual?.accessPin);
  const [noIndex, setNoIndex] = useState<boolean>(!!individual?.noIndex);
  const [viewStats, setViewStats] = useState<{ id: string; timestamp: unknown; referrer: string; referrerDomain: string }[]>([]);
  const [viewStatsLoading, setViewStatsLoading] = useState(false);

  useEffect(()=>{ setSettings(normalize(individual?.accessSettings)); },[individual?.accessSettings]);

  useEffect(() => {
    if (!individual?.id || !isOwner) return;
    setViewStatsLoading(true);
    getProfileViewStats(individual.id, 100)
      .then(setViewStats)
      .catch(() => {})
      .finally(() => setViewStatsLoading(false));
  }, [individual?.id, isOwner]);

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
      const clean = sanitizeForSave(settings);
      const pinValue = showPinInput && accessPin.trim() ? accessPin.trim() : null;
      
      const updateData: any = { 
        accessSettings: clean, 
        representatives, 
        supporters, 
        settingsAllowRepresentative: allowRepSettings,
        noIndex,
      };
      
      // Only include PIN fields when there's a PIN, or explicitly delete them
      if (pinValue) {
        updateData.accessPin = pinValue;
        updateData.authorizedViewers = individual?.authorizedViewers || [];
      } else {
        updateData.accessPin = fieldDelete();
        updateData.authorizedViewers = fieldDelete();
      }
      
      await updateIndividual(individual.id, updateData as any);
      
      const localUpdate: any = { 
        accessSettings: clean, 
        representatives, 
        supporters, 
        settingsAllowRepresentative: allowRepSettings,
        noIndex,
      };
      
      if (pinValue) {
        localUpdate.accessPin = pinValue;
        localUpdate.authorizedViewers = individual?.authorizedViewers || [];
      } else {
        localUpdate.accessPin = undefined;
        localUpdate.authorizedViewers = undefined;
      }
      
      onUpdate(localUpdate);
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
      
      {/* PIN Protection */}
      <div className="border-t border-gray-100 pt-6">
        <h3 className="font-semibold text-brand-main mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          PIN Protection
        </h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 text-sm">
            <input 
              type="checkbox" 
              checked={showPinInput} 
              onChange={e => {
                setShowPinInput(e.target.checked);
                if (!e.target.checked) setAccessPin('');
              }}
              className="text-red-600 focus:ring-red-500"
            />
            <span className="font-medium">Require PIN to view this profile</span>
          </label>
          
          {showPinInput && (
            <div className="ml-6 space-y-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Access PIN (4-6 digits)</label>
                <input
                  type="text"
                  value={accessPin}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setAccessPin(val);
                  }}
                  placeholder="e.g., 1234"
                  maxLength={6}
                  className="w-40 px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-red-500 focus:outline-none"
                />
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs text-red-800 leading-relaxed">
                  <strong>🔒 Secure Profile:</strong> Visitors will need to enter this PIN to view your profile. 
                  Once a logged-in user enters the correct PIN, they won't need to enter it again.
                </p>
              </div>
              {individual?.authorizedViewers && individual.authorizedViewers.length > 0 && (
                <div className="text-xs text-gray-500">
                  {individual.authorizedViewers.length} authorized viewer{individual.authorizedViewers.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Search Engine Visibility */}
      <div className="border-t border-gray-100 pt-6">
        <h3 className="font-semibold text-brand-main mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search Engine Visibility
        </h3>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={noIndex} onChange={e => setNoIndex(e.target.checked)} />
          <span className="font-medium">Hide this profile from search engines (Google, Bing, etc.)</span>
        </label>
        {noIndex && (
          <p className="ml-6 mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            ⚠️ Search engines will be instructed not to index this profile. It will still be accessible via direct link.
          </p>
        )}
      </div>

      {/* Profile View Analytics */}
      <div className="border-t border-gray-100 pt-6">
        <h3 className="font-semibold text-brand-main mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Profile Views
        </h3>
        {viewStatsLoading ? (
          <p className="text-xs text-gray-400">Loading analytics…</p>
        ) : (
          <>
            <p className="text-3xl font-bold text-gray-900">{viewStats.length}</p>
            <p className="text-xs text-gray-500 mb-4">Total recorded views (last 100)</p>
            {viewStats.length > 0 && (() => {
              const breakdown = viewStats.reduce((acc: Record<string, number>, v) => {
                const domain = v.referrerDomain || 'direct';
                acc[domain] = (acc[domain] || 0) + 1;
                return acc;
              }, {});
              const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]).slice(0, 8);
              return (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Traffic sources</p>
                  {sorted.map(([domain, count]) => (
                    <div key={domain} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5 text-xs">
                      <span className="text-gray-700">{domain === 'direct' ? '🔗 Direct / unknown' : domain}</span>
                      <span className="font-semibold text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
            {viewStats.length === 0 && (
              <p className="text-xs text-gray-400">No views recorded yet.</p>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded bg-brand-main text-white text-sm font-semibold disabled:opacity-50">{saving? 'Saving...':'Save Settings'}</button>
        {savedAt && <span className="text-xs text-gray-500">Saved {new Date(savedAt).toLocaleTimeString()}</span>}
      </div>
      <p className="text-[11px] text-gray-400 leading-relaxed">Roles are cumulative in responsibility, but you can explicitly choose which roles can view or edit each tab. Public edits are never allowed.</p>
    </div>
  );
}
