"use client";
import { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

interface Milestone { id: string; title: string; targetDate: string; done: boolean; }
interface ActionItem { id: string; title: string; owner: string; dueDate: string; status: 'todo' | 'inprogress' | 'done'; }
interface ProjectPlan { aims: string; objectives: string[]; milestones: Milestone[]; actions: ActionItem[]; }

interface Props {
  projectId: string;
  plan: ProjectPlan | undefined;
  isProjectCreator: boolean;
  onUpdated: (plan: ProjectPlan)=> void;
  allowEdit?: boolean;
}

const emptyPlan: ProjectPlan = { aims: '', objectives: [], milestones: [], actions: [] };

function normalizePlan(p: any): ProjectPlan {
  if(!p || typeof p !== 'object') return { ...emptyPlan };
  return {
    aims: typeof p.aims === 'string' ? p.aims : '',
    objectives: Array.isArray(p.objectives) ? [...p.objectives].map(String) : [],
    milestones: Array.isArray(p.milestones) ? p.milestones.filter(Boolean).map((m:any)=> ({
      id: m?.id || randomId(),
      title: typeof m?.title === 'string'? m.title : 'Untitled',
      targetDate: typeof m?.targetDate === 'string' ? m.targetDate.slice(0,10) : new Date().toISOString().slice(0,10),
      done: !!m?.done,
    })) : [],
    actions: Array.isArray(p.actions) ? p.actions.filter(Boolean).map((a:any)=> ({
      id: a?.id || randomId(),
      title: typeof a?.title === 'string'? a.title : 'Untitled',
      owner: typeof a?.owner === 'string' ? a.owner : '',
      dueDate: typeof a?.dueDate === 'string' ? a.dueDate.slice(0,10) : '',
      status: (a?.status === 'inprogress' || a?.status === 'done') ? a.status : 'todo'
    })) : [],
  };
}

function randomId(){
  // Prefer crypto.randomUUID if available
  if(typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  return Math.random().toString(36).slice(2,11);
}

export default function ProjectPlanTab({ projectId, plan, isProjectCreator, onUpdated, allowEdit=false }: Props){
  const [draft, setDraft] = useState<ProjectPlan>(()=> normalizePlan(plan));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [dirty, setDirty] = useState(false);
  // If the underlying plan changes (e.g., re-fetched), refresh draft
  useEffect(()=>{ setDraft(normalizePlan(plan)); setDirty(false); },[plan]);

  function updateDraft(mut: (d: ProjectPlan)=>void){
    setDraft(prev=>{ const c = normalizePlan(prev); mut(c); return normalizePlan(c); });
    setDirty(true); setSaveError('');
  }

  async function save(){
    if(!isProjectCreator || !dirty) return; setSaving(true); setSaveError('');
    try {
      const ref = doc(db,'projects', projectId);
      await updateDoc(ref,{ plan: draft });
      onUpdated(draft); setDirty(false);
    } catch(e:any){ setSaveError(e.message || 'Failed to save'); }
    finally { setSaving(false); }
  }

  if(!isProjectCreator && !plan){
    return <div className="text-sm text-gray-500">No plan published yet.</div>;
  }

  const readonly = !isProjectCreator || !allowEdit;

  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-brand-main">Aims</h3>
        </div>
        {readonly ? (
          <div className="prose max-w-none text-sm whitespace-pre-wrap">{(draft.aims||'').trim() || <span className="text-gray-400 italic">No aims defined.</span>}</div>
        ):(
          <textarea className="w-full border rounded px-3 py-2 text-sm min-h-[120px]" placeholder="Overall aims / mission for this project" value={draft.aims} onChange={e=>updateDraft(d=>{d.aims = e.target.value;})} />
        )}
      </section>
      <section>
        <h3 className="text-base font-semibold text-brand-main mb-2">Objectives</h3>
        {readonly && draft.objectives.length === 0 && <div className="text-sm text-gray-500 italic">No objectives.</div>}
        {!readonly && (
          <div className="flex gap-2 mb-3">
            <input className="flex-1 border rounded px-3 py-2 text-sm" placeholder="Add objective" onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); const val=(e.target as HTMLInputElement).value.trim(); if(val){ updateDraft(d=>{ d.objectives.push(val); }); (e.target as HTMLInputElement).value=''; } } }} />
            <button type="button" className="px-3 py-2 bg-brand-main text-white text-sm rounded" onClick={()=>{ const input = (document.activeElement as HTMLInputElement); if(input && input.placeholder==='Add objective'){ const val=input.value.trim(); if(val){ updateDraft(d=>{ d.objectives.push(val); }); input.value=''; } } }}>Add</button>
          </div>
        )}
        <ul className="space-y-2">
          {draft.objectives.map((o,i)=>(
            <li key={i} className="flex items-start gap-2 group">
              <div className="flex-1 text-sm">{readonly? o : (
                <input className="w-full border rounded px-2 py-1 text-sm" value={o} onChange={e=> updateDraft(d=>{ d.objectives[i]=e.target.value; })} />
              )}</div>
              {!readonly && (
                <button className="opacity-0 group-hover:opacity-100 text-xs text-red-600" onClick={()=> updateDraft(d=>{ d.objectives.splice(i,1); })}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-brand-main">Milestones</h3>
          {!readonly && <button type="button" className="text-xs px-2 py-1 bg-brand-main text-white rounded" onClick={()=> updateDraft(d=>{ d.milestones.push({ id: randomId(), title:'New milestone', targetDate:new Date().toISOString().slice(0,10), done:false }); })}>Add</button>}
        </div>
        {draft.milestones.length === 0 && <div className="text-sm text-gray-500 italic">No milestones.</div>}
        <ul className="space-y-3">
          {draft.milestones.map((m,i)=>(
            <li key={m.id} className="p-3 border rounded-lg bg-white/50 shadow-sm space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {readonly? (
                  <div className="flex-1 font-medium text-sm">{m.title}</div>
                ):(
                  <input className="flex-1 border rounded px-2 py-1 text-sm" value={m.title} onChange={e=> updateDraft(d=>{ d.milestones[i].title = e.target.value; })} />
                )}
                <div className="flex items-center gap-2 text-xs">
                  <label className="flex items-center gap-1 text-gray-600">
                    <span>Date</span>
                    {readonly? (
                      <span className="font-mono">{m.targetDate}</span>
                    ):(
                      <input type="date" className="border rounded px-2 py-1" value={m.targetDate} onChange={e=> updateDraft(d=>{ d.milestones[i].targetDate = e.target.value; })} />
                    )}
                  </label>
                  <label className="flex items-center gap-1 text-gray-600">
                    <input type="checkbox" disabled={readonly} checked={m.done} onChange={e=> updateDraft(d=>{ d.milestones[i].done = e.target.checked; })} />
                    <span>Done</span>
                  </label>
                  {!readonly && <button type="button" className="text-red-600" onClick={()=> updateDraft(d=>{ d.milestones.splice(i,1); })}>✕</button>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-brand-main">Actions</h3>
          {!readonly && <button type="button" className="text-xs px-2 py-1 bg-brand-main text-white rounded" onClick={()=> updateDraft(d=>{ d.actions.push({ id: randomId(), title:'New action', owner:'', dueDate:'', status:'todo' }); })}>Add</button>}
        </div>
        {draft.actions.length === 0 && <div className="text-sm text-gray-500 italic">No actions.</div>}
        <ul className="space-y-3">
          {draft.actions.map((a,i)=>(
            <li key={a.id} className="p-3 border rounded-lg bg-white/50 shadow-sm space-y-2">
              <div className="grid sm:grid-cols-5 gap-2 text-sm items-center">
                {readonly? <div className="sm:col-span-2 font-medium">{a.title}</div> : <input className="sm:col-span-2 border rounded px-2 py-1" value={a.title} onChange={e=> updateDraft(d=>{ d.actions[i].title = e.target.value; })} />}
                {readonly? <div className="text-xs text-gray-600">{a.owner||'—'}</div> : <input className="border rounded px-2 py-1 text-xs" placeholder="Owner" value={a.owner} onChange={e=> updateDraft(d=>{ d.actions[i].owner = e.target.value; })} />}
                {readonly? <div className="text-xs text-gray-600">{a.dueDate||'—'}</div> : <input type="date" className="border rounded px-2 py-1 text-xs" value={a.dueDate} onChange={e=> updateDraft(d=>{ d.actions[i].dueDate = e.target.value; })} />}
                {readonly? <div className="text-xs capitalize">{a.status}</div> : (
                  <select className="border rounded px-2 py-1 text-xs" value={a.status} onChange={e=> updateDraft(d=>{ d.actions[i].status = e.target.value as any; })}>
                    <option value="todo">To Do</option>
                    <option value="inprogress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                )}
                {!readonly && <button type="button" className="text-xs text-red-600" onClick={()=> updateDraft(d=>{ d.actions.splice(i,1); })}>Remove</button>}
              </div>
            </li>
          ))}
        </ul>
      </section>
      {isProjectCreator && (
        <div className="flex items-center gap-4">
          <button disabled={!dirty || saving} onClick={save} className="px-4 py-2 rounded bg-brand-main text-white text-sm font-semibold disabled:opacity-50">{saving? 'Saving...' : dirty? 'Save Plan' : 'Saved'}</button>
          {saveError && <div className="text-sm text-red-600">{saveError}</div>}
        </div>
      )}
    </div>
  );
}
