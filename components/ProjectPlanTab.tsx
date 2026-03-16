"use client";
import { useEffect, useState } from 'react';
import { EyeIcon, LightBulbIcon, FlagIcon } from '@heroicons/react/24/outline';
import { doc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

interface ResourceRef { id: string; name: string; url?: string; note?: string; qty: number; unitCost?: number; cost?: number; currency?: string; }
interface Task { id: string; title: string; startDate: string; endDate: string; status: 'todo'|'inprogress'|'done'; resources: ResourceRef[]; assignees: string[]; }
interface FocusArea { id: string; title: string; description: string; deadline: string; ongoing: boolean; tasks: Task[]; }
interface ProjectPlan { vision: string; strategy: string; focusStatement: string; focusAreas: FocusArea[]; }

interface TeamMember { id: string; name: string; role?: string; email?: string; type?: string; photoURL?: string; }

interface Props {
  projectId: string;
  plan: ProjectPlan | undefined;
  isProjectCreator: boolean;
  onUpdated: (plan: ProjectPlan)=> void;
  allowEdit?: boolean;
  projectCurrency?: string; // ISO code
  currencySymbol?: string; // display symbol/prefix
  teamMembers?: TeamMember[];
}

const emptyPlan: ProjectPlan = { vision: '', strategy: '', focusStatement: '', focusAreas: [] };

function normalizePlan(p:any): ProjectPlan {
  if(!p || typeof p !== 'object') return { ...emptyPlan };
  return {
    vision: typeof p.vision === 'string'? p.vision : '',
    strategy: typeof p.strategy === 'string'? p.strategy : '',
    focusStatement: typeof p.focusStatement === 'string'? p.focusStatement : '',
    focusAreas: Array.isArray(p.focusAreas) ? p.focusAreas.filter(Boolean).map((fa:any)=> {
      const migratedTasks = Array.isArray(fa?.tasks)? fa.tasks.filter(Boolean).map((t:any)=> ({
        id: t?.id || randomId(),
        title: typeof t?.title === 'string'? t.title : 'Task',
        startDate: typeof t?.startDate === 'string'? t.startDate.slice(0,10) : '',
        endDate: typeof t?.endDate === 'string'? t.endDate.slice(0,10) : (typeof t?.dueDate === 'string'? t.dueDate.slice(0,10): ''),
        status: (t?.status==='inprogress'||t?.status==='done')? t.status : 'todo',
        resources: Array.isArray(t?.resources)? t.resources.filter(Boolean).map((r:any)=> {
          const qty = (typeof r?.qty === 'number' && r.qty>0)? r.qty : 1;
          const unitCost = typeof r?.unitCost === 'number'? r.unitCost : (typeof r?.cost === 'number'? r.cost : undefined);
          return {
            id: r?.id || randomId(),
            name: typeof r?.name === 'string'? r.name : 'Resource',
            url: typeof r?.url === 'string'? r.url : undefined,
            note: typeof r?.note === 'string'? r.note : undefined,
            qty,
            unitCost,
            cost: (typeof unitCost === 'number')? +(qty * unitCost): undefined,
            currency: typeof r?.currency === 'string'? r.currency : undefined,
          };
        }) : [],
        assignees: Array.isArray(t?.assignees)? t.assignees.filter((a:any)=> typeof a === 'string' && a.trim()) : (typeof t?.owner === 'string' && t.owner? [t.owner] : [])
      })) : [];
      // Migrate old focusArea.resources (previous top-level resources) onto a synthetic task if tasks empty
      if(migratedTasks.length === 0 && Array.isArray(fa?.resources) && fa.resources.length){
        migratedTasks.push({
          id: randomId(),
          title: 'General',
          startDate: '',
          endDate: '',
          status:'todo',
          resources: fa.resources.filter(Boolean).map((r:any)=> {
              const qty = (typeof r?.qty === 'number' && r.qty>0)? r.qty : 1;
              const unitCost = typeof r?.unitCost === 'number'? r.unitCost : (typeof r?.cost === 'number'? r.cost : undefined);
              return {
                id: r?.id || randomId(),
                name: typeof r?.name === 'string'? r.name : 'Resource',
                url: typeof r?.url === 'string'? r.url : undefined,
                note: typeof r?.note === 'string'? r.note : undefined,
                qty,
                unitCost,
                cost: (typeof unitCost === 'number')? +(qty * unitCost): undefined,
                currency: typeof r?.currency === 'string'? r.currency : undefined,
              };
            }),
          assignees: []
        });
      }
      return {
        id: fa?.id || randomId(),
        title: typeof fa?.title === 'string'? fa.title : 'New Focus Area',
        description: typeof fa?.description === 'string'? fa.description : '',
        deadline: typeof fa?.deadline === 'string'? fa.deadline.slice(0,10): '',
        ongoing: !!fa?.ongoing,
        tasks: migratedTasks
      };
    }) : []
  };
}

function randomId(){
  // Prefer crypto.randomUUID if available
  if(typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  return Math.random().toString(36).slice(2,11);
}

// Firestore does not allow fields with value `undefined`.
// Recursively remove any undefined properties from objects/arrays.
function stripUndefined<T>(val: T): T {
  if(Array.isArray(val)) {
    // @ts-ignore
    return val.map(v=> stripUndefined(v)).filter(v=> v !== undefined);
  }
  if(val && typeof val === 'object') {
    const out: any = {};
    Object.entries(val as Record<string, any>).forEach(([k,v])=> {
      if(v === undefined) return; // skip
      const cleaned = stripUndefined(v);
      if(cleaned !== undefined) out[k]= cleaned;
    });
    return out;
  }
  // primitives (including null, string, number, boolean, '') pass through; undefined filtered earlier
  return val;
}

export default function ProjectPlanTab({ projectId, plan, isProjectCreator, onUpdated, allowEdit=false, projectCurrency, currencySymbol, teamMembers }: Props){
  const [draft, setDraft] = useState<ProjectPlan>(()=> normalizePlan(plan));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [planTab, setPlanTab] = useState<'overview'|'areas'|'upcoming'>('overview');
  const [activeFocusAreaId, setActiveFocusAreaId] = useState<string | null>(null);
  const [profileMap, setProfileMap] = useState<Record<string,{ name:string; photoURL?:string }>>({});
  // Assignee selection modal state
  const [assigneePicker, setAssigneePicker] = useState<{ fi:number; ti:number; open:boolean } | null>(null);
  const [assigneeTemp, setAssigneeTemp] = useState<string[]>([]);
  // (objectives removed in new model)
  // If the underlying plan changes (e.g., re-fetched), refresh draft
  useEffect(()=>{ setDraft(normalizePlan(plan)); setDirty(false); },[plan]);
  // Fetch canonical profile (first + last name & photo) for user members
  useEffect(()=> {
    let cancelled = false;
    async function load(){
      const pending: Promise<void>[] = [];
      const next: Record<string,{ name:string; photoURL?:string }> = {};
      (teamMembers||[]).forEach(m=> {
        if(m.type !== 'user') return;
        if(profileMap[m.id]) return;
        if(m.email && m.email.includes('@')) {
          pending.push((async ()=> {
            try {
              const q = query(collection(db,'users'), where('email','==', m.email));
              const snap = await getDocs(q);
              if(!snap.empty){
                const d:any = snap.docs[0].data();
                const first = d.name || d.firstName || '';
                const last = d.surname || d.lastName || '';
                const full = [first,last].filter(Boolean).join(' ') || d.displayName || d.fullName || m.name;
                next[m.id] = { name: full, photoURL: d.photoURL || d.avatar || d.image };
              }
            } catch {/* ignore */}
          })());
        } else if(!m.id.includes('@')) {
          pending.push((async ()=> {
            try {
              const snap = await getDoc(doc(db,'users', m.id));
              if(snap.exists()) {
                const d:any = snap.data();
                const first = d.name || d.firstName || '';
                const last = d.surname || d.lastName || '';
                const full = [first,last].filter(Boolean).join(' ') || d.displayName || d.fullName || m.name;
                next[m.id] = { name: full, photoURL: d.photoURL || d.avatar || d.image };
              }
            } catch {/* ignore */}
          })());
        }
      });
      if(pending.length){
        await Promise.all(pending);
        if(!cancelled && Object.keys(next).length) setProfileMap(p=> ({ ...p, ...next }));
      }
    }
    load();
    return ()=> { cancelled = true; };
  }, [teamMembers, profileMap]);

  function updateDraft(mut: (d: ProjectPlan)=>void){
    setDraft(prev=>{ const c = normalizePlan(prev); mut(c); return normalizePlan(c); });
    setDirty(true); setSaveError('');
  }

  async function save(){
    if(!isProjectCreator || !dirty) return; setSaving(true); setSaveError('');
    try {
      const ref = doc(db,'projects', projectId);
  const sanitized = stripUndefined(draft);
  await updateDoc(ref,{ plan: sanitized });
      onUpdated(draft); setDirty(false);
    } catch(e:any){ setSaveError(e.message || 'Failed to save'); }
    finally { setSaving(false); }
  }

  if(!isProjectCreator && !plan){
    return <div className="text-sm text-gray-500">No plan published yet.</div>;
  }

  const readonly = !isProjectCreator || !allowEdit;

  // Derived collections for upcoming view & cost summary
  const upcomingTasksAll = (draft.focusAreas||[]).flatMap(fa=> fa.tasks.map(t=> ({...t, focusArea: fa})));
  const datedTasks = upcomingTasksAll.filter(t=> t.endDate || t.startDate);
  const today = new Date().toISOString().slice(0,10);
  const orderedUpcoming = datedTasks.sort((a,b)=>{
    const aDate = a.endDate || a.startDate || '';
    const bDate = b.endDate || b.startDate || '';
    return aDate.localeCompare(bDate);
  });
  const overdue = orderedUpcoming.filter(t=> t.endDate && t.endDate < today);
  const upcoming = orderedUpcoming.filter(t=> !t.endDate || t.endDate >= today);
  const mergedUpcoming = [...overdue, ...upcoming].slice(0,50);
  const totalPlannedCost = draft.focusAreas.reduce((sum,fa)=> sum + fa.tasks.reduce((s,t)=> s + t.resources.reduce((rs,r)=> rs + (typeof r.cost==='number'? r.cost : (typeof r.unitCost==='number'? r.unitCost * (r.qty||1):0)),0),0),0);

  return (
    <div className="space-y-8">
      <div className="border-b border-brand-main/10 flex gap-4 text-sm font-medium">
        {['overview','areas','upcoming'].map(tab=> {
          const label = tab==='overview'? 'Overview' : tab==='areas'? 'Focus Areas' : 'Upcoming';
          const active = planTab===tab;
          return <button key={tab} onClick={()=> setPlanTab(tab as any)} className={`relative px-3 py-2 -mb-px ${active? 'text-brand-main':'text-gray-500 hover:text-brand-main'}`}>{label}{active && <span className="absolute left-0 right-0 -bottom-px h-[3px] bg-brand-main rounded-t" />}</button>;
        })}
      </div>
      {planTab === 'overview' && (
        <div className="space-y-8">
          <section>
            <h3 className="text-base font-semibold text-brand-main mb-2 flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-main/10 text-brand-main"><EyeIcon className="h-4 w-4" /></span>
              <span>Vision</span>
            </h3>
            {readonly? <div className="text-sm whitespace-pre-wrap">{draft.vision || <span className="text-gray-400 italic">No vision set.</span>}</div> : (
              <textarea className="w-full border rounded px-3 py-2 text-sm min-h-[100px]" placeholder="In one paragraph, what future are you building?" value={draft.vision} onChange={e=> updateDraft(d=>{ d.vision = e.target.value; })} />
            )}
          </section>
          <section>
            <h3 className="text-base font-semibold text-brand-main mb-2 flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-main/10 text-brand-main"><LightBulbIcon className="h-4 w-4" /></span>
              <span>Strategy</span>
            </h3>
            {readonly? <div className="text-sm whitespace-pre-wrap">{draft.strategy || <span className="text-gray-400 italic">No strategy described.</span>}</div> : (
              <textarea className="w-full border rounded px-3 py-2 text-sm min-h-[100px]" placeholder="Key strategic approach / pillars." value={draft.strategy} onChange={e=> updateDraft(d=>{ d.strategy = e.target.value; })} />
            )}
          </section>
          <section>
            <h3 className="text-base font-semibold text-brand-main mb-2 flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-main/10 text-brand-main"><FlagIcon className="h-4 w-4" /></span>
              <span>Focus Statement</span>
            </h3>
            {readonly? <div className="text-sm whitespace-pre-wrap">{draft.focusStatement || <span className="text-gray-400 italic">No focus statement.</span>}</div> : (
              <textarea className="w-full border rounded px-3 py-2 text-sm min-h-[80px]" placeholder="This cycle we're focusing on..." value={draft.focusStatement} onChange={e=> updateDraft(d=>{ d.focusStatement = e.target.value; })} />
            )}
          </section>
          <div className="text-xs text-gray-600 font-medium">Planned Cost Total: {(currencySymbol||'')}{totalPlannedCost.toFixed(2)}</div>
        </div>
      )}
      {planTab === 'areas' && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-brand-main">Focus Areas</h3>
            {!readonly && <button type="button" className="text-xs px-3 py-1 bg-brand-main text-white rounded" onClick={()=> updateDraft(d=> { d.focusAreas.push({ id: randomId(), title:'New Focus Area', description:'', deadline:'', ongoing:false, tasks:[] }); setActiveFocusAreaId(d.focusAreas[d.focusAreas.length-1].id); })}>Add Focus Area</button>}
          </div>
          {activeFocusAreaId === null && (
            <div className="space-y-4">
              {draft.focusAreas.length===0 && <div className="text-sm text-gray-500 italic">No focus areas yet.</div>}
              <ul className="grid sm:grid-cols-2 gap-4">
                {draft.focusAreas.map((fa,fi)=> {
                  const total = fa.tasks.reduce((sum,t)=> sum + t.resources.reduce((s,r)=> s + (typeof r.cost==='number'? r.cost: (typeof r.unitCost==='number'? r.unitCost * (r.qty||1):0)),0),0);
                  const tasksDone = fa.tasks.filter(t=> t.status==='done').length;
                  const deadlineLabel = fa.ongoing? 'Ongoing' : (fa.deadline || 'No deadline');
                  return (
                    <li key={fa.id} className="border rounded-lg bg-white/70 p-4 hover:shadow cursor-pointer transition" onClick={()=> setActiveFocusAreaId(fa.id)}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-brand-main/10 text-[11px] font-semibold text-brand-main">{fi+1}</span>
                          <h4 className="font-semibold text-sm truncate max-w-[160px]" title={fa.title}>{fa.title}</h4>
                        </div>
                        {!readonly && <button className="text-[11px] text-red-600" onClick={(e)=> { e.stopPropagation(); updateDraft(d=>{ d.focusAreas.splice(fi,1); }); }}>{'Remove'}</button>}
                      </div>
                      <div className="text-[11px] text-gray-600 line-clamp-3 min-h-[2.2rem]">{fa.description || <span className="italic text-gray-400">No description.</span>}</div>
                      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-gray-700">
                        <span className="px-2 py-0.5 rounded bg-gray-100">{fa.tasks.length} task{fa.tasks.length!==1 && 's'}</span>
                        <span className="px-2 py-0.5 rounded bg-gray-100">{tasksDone}/{fa.tasks.length||0} done</span>
                        <span className="px-2 py-0.5 rounded bg-gray-100">{deadlineLabel}</span>
                        <span className="px-2 py-0.5 rounded bg-gray-100">{(currencySymbol||'')}{total.toFixed(2)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {activeFocusAreaId !== null && (()=> {
            const fi = draft.focusAreas.findIndex(f=> f.id===activeFocusAreaId);
            if(fi===-1){ setActiveFocusAreaId(null); return null; }
            const fa = draft.focusAreas[fi];
            return (
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <h4 className="font-semibold text-sm flex items-center gap-2"><span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-brand-main/10 text-[11px] font-semibold text-brand-main">{fi+1}</span>{readonly? fa.title : <input className="border rounded px-2 py-1 text-sm font-semibold" value={fa.title} onChange={e=> updateDraft(d=>{ d.focusAreas[fi].title = e.target.value; })} />}</h4>
                  <div className="flex items-center gap-2">
                    <button type="button" className="text-[11px] px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50" onClick={()=> setActiveFocusAreaId(null)}>Close</button>
                    {!readonly && <button className="text-[11px] px-2 py-1 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100" onClick={()=> updateDraft(d=>{ d.focusAreas.splice(fi,1); setActiveFocusAreaId(null); })}>Remove</button>}
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-2">
                    {readonly? <div className="text-xs whitespace-pre-wrap">{fa.description || <span className="text-gray-400 italic">No description.</span>}</div> : (
                      <textarea className="w-full border rounded px-2 py-1 text-xs min-h-[80px]" placeholder="Describe this focus area" value={fa.description} onChange={e=> updateDraft(d=>{ d.focusAreas[fi].description = e.target.value; })} />
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold uppercase text-brand-main">Deadline</label>
                    {readonly? <div className="text-xs">{fa.ongoing? 'Ongoing' : (fa.deadline || '—')}</div> : (
                      <div className="flex items-center gap-2">
                        <input type="date" disabled={fa.ongoing} className="border rounded px-2 py-1 text-xs" value={fa.deadline} onChange={e=> updateDraft(d=>{ d.focusAreas[fi].deadline = e.target.value; })} />
                        <label className="flex items-center gap-1 text-[11px] text-gray-600">
                          <input type="checkbox" checked={fa.ongoing} onChange={e=> updateDraft(d=>{ d.focusAreas[fi].ongoing = e.target.checked; if(e.target.checked) d.focusAreas[fi].deadline=''; })} />
                          <span>Ongoing</span>
                        </label>
                      </div>
                    )}
                    <div className="text-[10px] text-gray-700 font-medium pt-1">Focus Area Total Cost: {(currencySymbol||'')}{fa.tasks.reduce((sum,t)=> sum + t.resources.reduce((s,r)=> s + (typeof r.cost==='number'? r.cost: (typeof r.unitCost==='number'? r.unitCost * (r.qty||1):0)),0),0).toFixed(2)}</div>
                  </div>
                </div>
                {/* Tasks for active focus area */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold tracking-wide text-brand-main uppercase">Tasks</h5>
                    {!readonly && <button type="button" className="text-[10px] px-2 py-0.5 rounded bg-brand-main/10 text-brand-main" onClick={()=> updateDraft(d=>{ d.focusAreas[fi].tasks.push({ id: randomId(), title:'Task', startDate:'', endDate:'', status:'todo', resources:[], assignees: [] }); })}>Add Task</button>}
                  </div>
                  {fa.tasks.length===0 && <div className="text-[11px] text-gray-400 italic">No tasks.</div>}
                  <ul className="space-y-2">
                    {fa.tasks.map((t,ti)=>(
                      <li key={t.id} className="space-y-3 bg-white/70 p-3 rounded border">
                        {/* Title Row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            {readonly? (
                              <div className="font-semibold text-[13px] leading-snug break-words">{t.title || <span className="italic text-gray-400">Untitled Task</span>}</div>
                            ) : (
                              <input className="w-full border rounded px-2 py-1 text-[13px] font-semibold" value={t.title} placeholder="Task title" onChange={e=> updateDraft(d=>{ d.focusAreas[fi].tasks[ti].title = e.target.value; })} />
                            )}
                          </div>
                          {!readonly && <button type="button" className="text-red-500 text-xs" onClick={()=> updateDraft(d=>{ d.focusAreas[fi].tasks.splice(ti,1); })}>✕</button>}
                        </div>
                        {/* Meta Row */}
                        <div className="grid sm:grid-cols-5 gap-3 text-[10px]">
                          <div className="space-y-1 sm:col-span-2">
                            <label className="block uppercase tracking-wide text-[9px] text-gray-500">Assignees</label>
                            {readonly? (
                              <div className="flex flex-wrap gap-1">{t.assignees.length? t.assignees.map(id=> {
                                const tm = teamMembers?.find(m=> m.id===id);
                                const label = tm? tm.name : id;
                                return <span key={id} className="px-2 py-0.5 rounded bg-gray-100 text-[10px]" title={tm?.role}>{label}</span>;
                              }): <span className="text-gray-400">—</span>}</div>
                            ) : (
                              <div className="space-y-1">
                                <div className="flex flex-wrap gap-1 mb-1">
                                  {t.assignees.map(id=> {
                                    const tm = teamMembers?.find(m=> m.id===id);
                                    const canonical = tm? profileMap[tm.id] : undefined;
                                    const label = canonical?.name || tm?.name || id;
                                    const photo = canonical?.photoURL || tm?.photoURL;
                                    return (
                                      <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-main/10 text-brand-main">
                                        {photo && <img src={photo} alt={label} className="w-4 h-4 rounded-full object-cover" />}
                                        <span>{label}</span>
                                        <button type="button" className="text-[9px]" onClick={()=> updateDraft(d=>{ d.focusAreas[fi].tasks[ti].assignees = d.focusAreas[fi].tasks[ti].assignees.filter(x=> x!==id); })}>✕</button>
                                      </span>
                                    );
                                  })}
                                  <button
                                    type="button"
                                    className="px-2 py-0.5 text-[10px] rounded border border-dashed border-brand-main/40 text-brand-main hover:bg-brand-main/5"
                                    onClick={()=> {
                                      if(!teamMembers || !teamMembers.length){ alert('No team members available. Add team members first.'); return; }
                                      setAssigneeTemp([...t.assignees]);
                                      setAssigneePicker({ fi, ti, open:true });
                                    }}
                                  >Add</button>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="block uppercase tracking-wide text-[9px] text-gray-500">Start</label>
                            {readonly? <div>{t.startDate || '—'}</div> : <input type="date" className="w-full border rounded px-2 py-1" value={t.startDate} onChange={e=> updateDraft(d=>{ d.focusAreas[fi].tasks[ti].startDate = e.target.value; })} />}
                          </div>
                          <div className="space-y-1">
                            <label className="block uppercase tracking-wide text-[9px] text-gray-500">End</label>
                            {readonly? <div>{t.endDate || '—'}</div> : <input type="date" className="w-full border rounded px-2 py-1" value={t.endDate} onChange={e=> updateDraft(d=>{ d.focusAreas[fi].tasks[ti].endDate = e.target.value; })} />}
                          </div>
                          <div className="space-y-1">
                            <label className="block uppercase tracking-wide text-[9px] text-gray-500">Status</label>
                            {readonly? <div className="capitalize">{t.status}</div> : (
                              <select className="w-full border rounded px-2 py-1" value={t.status} onChange={e=> updateDraft(d=>{ d.focusAreas[fi].tasks[ti].status = e.target.value as any; })}>
                                <option value="todo">To Do</option>
                                <option value="inprogress">In Progress</option>
                                <option value="done">Done</option>
                              </select>
                            )}
                          </div>
                        </div>
                        {/* Task Resources */}
                        <div className="pt-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="uppercase tracking-wide text-[10px] font-semibold text-brand-main">Resources</span>
                            {!readonly && <button type="button" className="text-[10px] px-2 py-0.5 rounded bg-brand-main/10 text-brand-main" onClick={()=> updateDraft(d=>{ d.focusAreas[fi].tasks[ti].resources.push({ id: randomId(), name:'Resource', url:'', note:'', qty:1, unitCost: undefined, cost: undefined, currency: projectCurrency }); })}>Add</button>}
                          </div>
                          {t.resources.length===0 && <div className="text-[10px] text-gray-400 italic">No resources.</div>}
                          <ul className="space-y-1">
                            {t.resources.map((r,ri)=>(
                              <li key={r.id} className="bg-white p-2 rounded border space-y-1 text-[10px]">
                                <div className="flex items-start gap-2">
                                  <div className="flex-1">
                                    {readonly? (
                                      <div className="font-medium truncate" title={r.name}>{r.name}</div>
                                    ):(
                                      <input className="w-full border rounded px-2 py-0.5" placeholder="Name" value={r.name} onChange={e=> updateDraft(d=>{ d.focusAreas[fi].tasks[ti].resources[ri].name = e.target.value; })} />
                                    )}
                                  </div>
                                  {!readonly && (
                                    <button type="button" className="text-red-600" onClick={()=> updateDraft(d=>{ d.focusAreas[fi].tasks[ti].resources.splice(ri,1); })}>✕</button>
                                  )}
                                </div>
                                <div className="grid grid-cols-12 gap-2 items-center">
                                  <div className="col-span-2">
                                    <label className="block text-[9px] uppercase tracking-wide text-gray-500">Qty</label>
                                    {readonly? <div>{r.qty}</div> : <input type="number" min="1" className="w-full border rounded px-2 py-0.5" value={r.qty} onChange={e=> updateDraft(d=>{ const res = d.focusAreas[fi].tasks[ti].resources[ri]; const q = parseInt(e.target.value)||1; res.qty = q; if(typeof res.unitCost === 'number') res.cost = +(q * res.unitCost); })} />}
                                  </div>
                                  <div className="col-span-3">
                                    <label className="block text-[9px] uppercase tracking-wide text-gray-500">Unit</label>
                                    {readonly? <div>{typeof r.unitCost==='number'? `${currencySymbol||''}${r.unitCost.toFixed(2)}`:'—'}</div> : (
                                      <div className="flex items-center gap-1">
                                        {currencySymbol && <span>{currencySymbol}</span>}
                                        <input type="number" min="0" step="0.01" className="flex-1 border rounded px-2 py-0.5" value={r.unitCost ?? ''} onChange={e=> updateDraft(d=>{ const res = d.focusAreas[fi].tasks[ti].resources[ri]; const v = e.target.value; res.unitCost = v===''? undefined : Number(v); res.cost = (typeof res.unitCost === 'number')? +(res.qty * res.unitCost): undefined; if(projectCurrency && !res.currency) res.currency = projectCurrency; })} />
                                      </div>
                                    )}
                                  </div>
                                  <div className="col-span-3">
                                    <label className="block text-[9px] uppercase tracking-wide text-gray-500">Total</label>
                                    <div className="font-medium">{typeof r.cost==='number'? `${currencySymbol||''}${r.cost.toFixed(2)}`:'—'}</div>
                                  </div>
                                  <div className="col-span-2">
                                    <label className="block text-[9px] uppercase tracking-wide text-gray-500">Curr.</label>
                                    <div>{r.currency || projectCurrency || '—'}</div>
                                  </div>
                                </div>
                                <div className="grid grid-cols-12 gap-2">
                                  <div className="col-span-5">
                                    <label className="block text-[9px] uppercase tracking-wide text-gray-500">URL</label>
                                    {readonly? <div className="truncate" title={r.url}>{r.url? <a className="underline" href={r.url} target="_blank" rel="noopener noreferrer">Link</a> : '—'}</div> : <input className="w-full border rounded px-2 py-0.5" placeholder="https://" value={r.url||''} onChange={e=> updateDraft(d=>{ d.focusAreas[fi].tasks[ti].resources[ri].url = e.target.value; })} />}
                                  </div>
                                  <div className="col-span-7">
                                    <label className="block text-[9px] uppercase tracking-wide text-gray-500">Note</label>
                                    {readonly? <div className="truncate" title={r.note}>{r.note||'—'}</div> : <input className="w-full border rounded px-2 py-0.5" placeholder="Details / supplier / etc" value={r.note||''} onChange={e=> updateDraft(d=>{ d.focusAreas[fi].tasks[ti].resources[ri].note = e.target.value; })} />}
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                          {t.resources.length>0 && <div className="text-[10px] text-gray-600 mt-1">Task Total: {(currencySymbol||'')}{t.resources.reduce((sum,r)=> sum + (typeof r.cost==='number'? r.cost: (typeof r.unitCost==='number'? r.unitCost * (r.qty||1) : 0)),0).toFixed(2)}</div>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })()}
        </section>
      )}
      {planTab === 'upcoming' && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-brand-main">Upcoming Tasks</h3>
            <div className="text-[11px] text-gray-500">{mergedUpcoming.length} shown</div>
          </div>
          {mergedUpcoming.length===0 && <div className="text-sm text-gray-500 italic">No dated tasks yet.</div>}
          <ul className="space-y-2">
            {mergedUpcoming.map(t=> {
              const overdue = t.endDate && t.endDate < today;
              return (
                <li key={t.id} className={`p-3 rounded border flex flex-col sm:flex-row sm:items-center gap-3 text-xs ${overdue? 'border-red-300 bg-red-50':'border-brand-main/10 bg-white/70'}`}> 
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{t.title}</div>
                    <div className="text-[10px] text-gray-500 truncate">Focus: {t.focusArea.title}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-[10px] text-gray-600">Start: {t.startDate || '—'}</div>
                    <div className={`text-[10px] ${overdue? 'text-red-600 font-semibold':'text-gray-600'}`}>End: {t.endDate || '—'}</div>
                    <div className="text-[10px] capitalize px-2 py-1 rounded bg-gray-100">{t.status}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {isProjectCreator && (
        <div className="flex items-center gap-4">
          <button disabled={!dirty || saving} onClick={save} className="px-4 py-2 rounded bg-brand-main text-white text-sm font-semibold disabled:opacity-50">{saving? 'Saving...' : dirty? 'Save Plan' : 'Saved'}</button>
          {saveError && <div className="text-sm text-red-600">{saveError}</div>}
        </div>
      )}
      {/* Assignee Picker Modal */}
      {assigneePicker?.open && teamMembers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={()=> setAssigneePicker(null)} />
          <div className="relative bg-white w-full max-w-2xl mx-auto rounded-xl shadow-xl border border-brand-main/10 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h4 className="text-sm font-semibold text-brand-main">Select Assignees</h4>
              <button className="text-xs text-gray-500 hover:text-brand-main" onClick={()=> setAssigneePicker(null)}>✕</button>
            </div>
            <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[50vh] overflow-auto pr-1">
              {teamMembers.map(m=> {
                const canonical = profileMap[m.id];
                const display = canonical?.name || m.name;
                const photo = canonical?.photoURL || m.photoURL;
                const active = assigneeTemp.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={()=> setAssigneeTemp(prev=> prev.includes(m.id)? prev.filter(x=> x!==m.id) : [...prev, m.id])}
                    className={`group flex flex-col items-start gap-1 rounded border p-3 text-left transition text-[11px] ${active? 'border-brand-main bg-brand-main/5':'border-gray-200 hover:border-brand-main/60 hover:bg-brand-main/5'}`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      {photo ? (
                        <img src={photo} alt={display} className="w-8 h-8 rounded-full object-cover border border-brand-main/20" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-brand-main/10 flex items-center justify-center text-brand-main font-semibold text-xs">
                          {display.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-[11px] text-brand-dark">{display}</div>
                        {m.role && <div className="text-[10px] text-gray-500 truncate">{m.role}</div>}
                      </div>
                      {active && <span className="text-brand-main text-xs font-bold">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="text-[11px] text-gray-500">{assigneeTemp.length} selected</div>
              <div className="flex items-center gap-2">
                <button type="button" className="text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-50" onClick={()=> setAssigneeTemp([])}>Clear</button>
                <button type="button" className="text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-50" onClick={()=> setAssigneePicker(null)}>Cancel</button>
                <button type="button" className="text-xs px-4 py-1 rounded bg-brand-main text-white font-semibold" onClick={()=> {
                  if(assigneePicker){
                    updateDraft(d=> { d.focusAreas[assigneePicker.fi].tasks[assigneePicker.ti].assignees = [...assigneeTemp]; });
                  }
                  setAssigneePicker(null);
                }}>Apply</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// (obsolete helper removed)
