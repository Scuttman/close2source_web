"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc, updateDoc, runTransaction, deleteDoc, collection, addDoc, getDocs, query, orderBy } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from "../../../src/lib/firebase";
import { improveTextWithAI } from "../../../src/lib/ai";
import { getAuth } from "firebase/auth";
import { logCreditTransaction } from "../../../src/lib/credits";
import MapPreview from "../../../components/MapPreview";
import CreateProjectUpdateModal from "../../../components/CreateProjectUpdateModal";
import PageShell from "../../../components/PageShell";
import { InformationCircleIcon, ArrowPathIcon, CurrencyDollarIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
  const auth = typeof window !== "undefined" ? getAuth() : null;

export default function ProjectDetail() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<any>(null);
  const [desc, setDesc] = useState("");
  const [improving, setImproving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("home");
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [commentInputs, setCommentInputs] = useState<Record<number,string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<number,boolean>>({});
  const [reactionSubmitting, setReactionSubmitting] = useState<Record<string,boolean>>({});
  const [editingIndex, setEditingIndex] = useState<number|null>(null);
  const [editDraftTitle, setEditDraftTitle] = useState("");
  const [editDraftText, setEditDraftText] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  // Location editing state
  const [showLocationEditor, setShowLocationEditor] = useState(false);
  const [locCountry, setLocCountry] = useState("");
  const [locTown, setLocTown] = useState("");
  const [locLat, setLocLat] = useState("");
  const [locLng, setLocLng] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  // Finance state
  const [financeTransactions, setFinanceTransactions] = useState<any[]>([]);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeError, setFinanceError] = useState("");
  const [newTxType, setNewTxType] = useState<'income' | 'expense'>('expense');
  const [newTxCategory, setNewTxCategory] = useState("");
  const [newTxAmount, setNewTxAmount] = useState("");
  const [newTxNote, setNewTxNote] = useState("");
  const [addingTx, setAddingTx] = useState(false);
  const [newTxDate, setNewTxDate] = useState(()=> new Date().toISOString().slice(0,10)); // YYYY-MM-DD
  const [newTxCompany, setNewTxCompany] = useState("");
  const [newTxReceipts, setNewTxReceipts] = useState<FileList|null>(null);
  const [uploadingReceipts, setUploadingReceipts] = useState(false);
  // Currency
  const [projectCurrency, setProjectCurrency] = useState<string>("");
  // Pie chart hover state
  const [hoveredSeg, setHoveredSeg] = useState<string|null>(null);
  const updatesPanelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchProject() {
      setLoading(true);
      setError("");
      try {
        const docRef = doc(db, "projects", projectId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          setError("Project not found.");
          setProject(null);
        } else {
          const raw: any = docSnap.data();
          if(!Array.isArray(raw.updates)) raw.updates = [];
          setProject(raw);
          setDesc(docSnap.data().description || "");
          setProjectCurrency(raw.currency || "");
        }
      } catch (e: any) {
        setError(e.message || "Error loading project.");
      } finally {
        setLoading(false);
      }
    }
    if (projectId) fetchProject();
  }, [projectId]);
  // IMPORTANT: All hooks (useMemo, etc.) must run on every render to preserve order.
  // Moved early returns BELOW hook declarations to fix hook order warning.
  const filteredUpdates = useMemo(() => {
    let arr: any[] = Array.isArray(project?.updates) ? [...project.updates] : [];
    if (searchValue.trim()) {
      const q = searchValue.toLowerCase();
      arr = arr.filter(u => (u.text||'').toLowerCase().includes(q) || (u.title||'').toLowerCase().includes(q));
    }
    if (tagFilter) arr = arr.filter(u => Array.isArray(u.tags) && u.tags.includes(tagFilter));
    return arr;
  }, [project?.updates, searchValue, tagFilter]);

  function SidebarSearchTags({ updates }: any){
    const allTags = useMemo(()=>{
      const s = new Set<string>();
      (updates||[]).forEach((u:any)=> Array.isArray(u.tags) && u.tags.forEach((t:string)=> s.add(t)));
      return Array.from(s).sort();
    },[updates]);
    return (
      <div className="bg-white rounded-xl border border-brand-main/10 p-4 mb-4 shadow-sm">
        <input value={searchValue} onChange={e=>setSearchValue(e.target.value)} placeholder="Search updates..." className="w-full border rounded px-3 py-2 mb-3 text-sm" />
        <div className="mb-2 font-semibold text-brand-main text-xs">Filter by tag</div>
        <div className="flex flex-wrap gap-2">
          {allTags.length === 0 && <span className="text-gray-400 text-xs">No tags</span>}
          {allTags.map(tag => (
            <span key={tag} onClick={()=>setTagFilter(tagFilter===tag? '': tag)} className={`bg-brand-main/10 text-brand-main text-xs px-2 py-1 rounded-full cursor-pointer hover:bg-brand-main/20 ${tagFilter===tag? 'ring-2 ring-brand-main':''}`}>#{tag}</span>
          ))}
        </div>
      </div>
    );
  }

  async function submitComment(i: number) {
    setCommentSubmitting(s=>({...s,[i]:true}));
    try {
      const user = auth?.currentUser; if(!user) throw new Error("Sign in required");
      const ref = doc(db, "projects", projectId);
      const snap = await getDoc(ref); if(!snap.exists()) throw new Error("Project not found");
      const data = snap.data();
      const updates:any[] = Array.isArray(data.updates)? [...data.updates] : [];
      if(!updates[i]) throw new Error("Update missing");
      const newComment = { text: commentInputs[i]||'', author: (user.displayName || user.email || user.uid), createdAt: new Date().toISOString() };
      updates[i].comments = Array.isArray(updates[i].comments)? [...updates[i].comments, newComment] : [newComment];
      await updateDoc(ref,{updates});
      setProject((prev:any)=>({...prev, updates}));
      setCommentInputs(prev=>({...prev,[i]:''}));
    } catch(e) { /* silent */ } finally { setCommentSubmitting(s=>({...s,[i]:false})); }
  }

  // Toggle a per-user reaction (like/pray) stored as arrays of userIds under update.reactionUsers.{type}.
  async function toggleReaction(i: number, type: 'love' | 'pray') {
    const user = auth?.currentUser; if(!user) { alert('Sign in required'); return; }
    const key = `${i}:${type}`;
    setReactionSubmitting(s=>({...s,[key]:true}));
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'projects', projectId);
        const snap = await tx.get(ref);
        if(!snap.exists()) throw new Error('Project not found');
        const data:any = snap.data();
        const updates:any[] = Array.isArray(data.updates)? [...data.updates]: [];
        if(!updates[i]) throw new Error('Update missing');
        const u = { ...updates[i] };
        const reactionUsers = { ...(u.reactionUsers||{}) };
        const arr: string[] = Array.isArray(reactionUsers[type]) ? [...reactionUsers[type]] : [];
        const existing = arr.indexOf(user.uid);
        if(existing >= 0) {
          arr.splice(existing,1);
        } else {
          arr.push(user.uid);
        }
        reactionUsers[type] = arr;
        u.reactionUsers = reactionUsers;
        // Maintain legacy numeric reactions field for backward compatibility
        const legacy = { ...(u.reactions||{}) };
        legacy[type] = arr.length;
        u.reactions = legacy;
        updates[i] = u;
        tx.update(ref,{ updates });
        // Optimistic local update after transaction success
  setProject((prev:any) => ({ ...prev, updates }));
      });
    } catch(e:any){ /* silent for now */ }
    finally { setReactionSubmitting(s=>{ const c={...s}; delete c[key]; return c; }); }
  }

  function beginEdit(i:number, u:any){
    setEditingIndex(i);
    setEditDraftTitle(u.title || "");
    setEditDraftText(u.text || "");
    setEditTags(Array.isArray(u.tags)? [...u.tags]: []);
    setEditTagInput("");
  }
  function cancelEdit(){
    setEditingIndex(null);
    setEditDraftTitle("");
    setEditDraftText("");
    setEditTags([]);
    setEditTagInput("");
  }
  async function saveEdit(i:number){
    const user = auth?.currentUser; if(!user) { alert('Sign in required'); return; }
    setEditSubmitting(true);
    try {
      await runTransaction(db, async (tx)=>{
        const ref = doc(db,'projects',projectId);
        const snap = await tx.get(ref);
        if(!snap.exists()) throw new Error('Project not found');
        const data:any = snap.data();
        const updates:any[] = Array.isArray(data.updates)? [...data.updates]:[];
        if(!updates[i]) throw new Error('Update missing');
        const u = { ...updates[i] };
        if(u.authorUid && u.authorUid !== user.uid) throw new Error('Not author');
        u.title = editDraftTitle.trim();
        u.text = editDraftText.trim();
  u.tags = Array.from(new Set(editTags.map(t=>t.toLowerCase()).filter(Boolean)));
        u.updatedAt = new Date().toISOString();
        updates[i] = u;
        tx.update(ref,{updates});
        setProject((prev:any)=>({...prev, updates}));
      });
      cancelEdit();
    } catch(e:any){ alert(e.message || 'Failed to save'); }
    finally { setEditSubmitting(false); }
  }

  function commitEditTag(){
    const raw = editTagInput.trim().toLowerCase().replace(/^[#]+/, '');
    if(!raw) return;
    setEditTags(prev => prev.includes(raw)? prev : [...prev, raw]);
    setEditTagInput('');
  }
  const onEditTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if(e.key==='Enter' || e.key===','){ e.preventDefault(); commitEditTag(); }
    else if(e.key==='Backspace' && editTagInput==='' && editTags.length){ e.preventDefault(); setEditTags(p=>p.slice(0,-1)); }
  };
  const removeEditTag = (t:string) => { setEditTags(prev=> prev.filter(x=>x!==t)); };

  // Derive map parameters based on available location precision
  function getMapParams(loc: any): { lat: number; lng: number; zoom: number } | null {
    if (!loc) return null;
    const hasCoords = typeof loc.latitude === 'number' && typeof loc.longitude === 'number';
    if (hasCoords) {
      // Highest precision
      return { lat: loc.latitude, lng: loc.longitude, zoom: 13 };
    }
    // Basic fallback coordinate lookup (very small built-in reference); extend as needed
    const countryCenters: Record<string, { lat: number; lng: number; zoom: number }> = {
      kenya: { lat: -0.0236, lng: 37.9062, zoom: 5 },
      uganda: { lat: 1.3733, lng: 32.2903, zoom: 5 },
      tanzania: { lat: -6.3690, lng: 34.8888, zoom: 5 },
      ghana: { lat: 7.9465, lng: -1.0232, zoom: 5 },
      nigeria: { lat: 9.0820, lng: 8.6753, zoom: 5 },
      rwanda: { lat: -1.9403, lng: 29.8739, zoom: 6 },
      ethiopia: { lat: 9.145, lng: 40.4897, zoom: 5 },
      malawi: { lat: -13.2543, lng: 34.3015, zoom: 6 },
      "united kingdom": { lat: 54.8, lng: -4.6, zoom: 5 },
      uk: { lat: 54.8, lng: -4.6, zoom: 5 },
      england: { lat: 52.3555, lng: -1.1743, zoom: 6 },
    };
    const countryKey = (loc.country || '').toLowerCase();
    if (countryKey && countryCenters[countryKey]) {
      const base = countryCenters[countryKey];
      const hasTown = !!loc.town;
      // Rudimentary town centroids for better focus (extend as needed)
      const townKey = (loc.town || '').toLowerCase();
      const townCenters: Record<string, { lat: number; lng: number; zoom: number }> = {
        blantyre: { lat: -15.7861, lng: 35.0058, zoom: 11 },
        chichester: { lat: 50.8367, lng: -0.7792, zoom: 12 },
      };
      if (townKey && townCenters[townKey]) return townCenters[townKey];
      return { lat: base.lat, lng: base.lng, zoom: hasTown ? Math.min(base.zoom + 1, 8) : base.zoom };
    }
    // No usable data
    return null;
  }
  const mapParams = project ? getMapParams(project.location) : null;
  const [geoParams, setGeoParams] = useState<{lat:number; lng:number; zoom:number}|null>(null);
  // Dynamic geocoding fallback (client-side) for countries/towns not in static list
  useEffect(()=>{
    if(!project) return;
    const loc = project.location;
    if(!loc) return;
    if(mapParams) { setGeoParams(null); return; }
    if(!(loc.country || loc.town)) return;
    const q = [loc.town, loc.country].filter(Boolean).join(', ');
    let aborted = false;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}` , { headers: { 'Accept-Language': 'en' } })
      .then(r=>r.json())
      .then(d=>{
        if(aborted) return;
        if(Array.isArray(d) && d[0]){
          const lat = parseFloat(d[0].lat); const lng = parseFloat(d[0].lon);
          if(!isNaN(lat) && !isNaN(lng)) setGeoParams({ lat, lng, zoom: loc.town? 12 : 5 });
        }
      })
      .catch(()=>{});
    return ()=>{aborted = true;};
  },[project?.location, mapParams]);
  // (Early returns moved below finance hooks to preserve hook order.)
  const currentUser = auth?.currentUser;
  const isProjectCreator = !!(currentUser && project?.createdBy && [currentUser.displayName, currentUser.email, currentUser.uid].includes(project.createdBy));
  const tabs: { id: string; label: string; icon: any }[] = [
    { id: 'home', label: 'Overview', icon: InformationCircleIcon },
    { id: 'updates', label: 'Updates', icon: ArrowPathIcon },
    { id: 'finance', label: 'Finance', icon: CurrencyDollarIcon },
    ...(isProjectCreator ? [{ id: 'settings', label: 'Settings', icon: Cog6ToothIcon }] : []),
  ];
  if(activeTab === 'settings' && !isProjectCreator) { setActiveTab('home'); }

  // Load finance transactions only for creator when finance tab active (or project loads)
  useEffect(()=>{
    if(!isProjectCreator) { setFinanceTransactions([]); return; }
    async function loadFinance(){
      setFinanceLoading(true); setFinanceError("");
      try {
        const txRef = collection(db, 'projects', projectId, 'financeTransactions');
        const qRef = query(txRef, orderBy('createdAt','desc'));
        const snap = await getDocs(qRef);
        const rows = snap.docs.map(d=>({ id:d.id, ...d.data() }));
        // Sort by transactionDate (YYYY-MM-DD) descending; fallback to createdAt
        const sorted = rows.sort((a:any,b:any)=>{
          const ad = (a.transactionDate || (a.createdAt? String(a.createdAt).slice(0,10):'')) as string;
          const bd = (b.transactionDate || (b.createdAt? String(b.createdAt).slice(0,10):'')) as string;
          if(bd === ad){
            // tie-breaker createdAt full ISO desc
            return String(b.createdAt||'').localeCompare(String(a.createdAt||''));
          }
            return bd.localeCompare(ad);
        });
        setFinanceTransactions(sorted as any[]);
      } catch(e:any){ setFinanceError(e.message||'Failed to load transactions'); }
      finally { setFinanceLoading(false); }
    }
    loadFinance();
  },[isProjectCreator, projectId, activeTab]);

  // Derive finance summary (for creator from transactions; for others from project.financeSummary)
  const financeSummary = useMemo(()=>{
    if(isProjectCreator){
      const categories: Record<string, { income: number; expense: number; net: number }> = {};
      let incomeTotal = 0; let expenseTotal = 0;
      financeTransactions.forEach(tx=>{
        const type = tx.type === 'income' ? 'income' : 'expense';
        const amt = typeof tx.amount === 'number' ? tx.amount : parseFloat(String(tx.amount||0));
        if(!amt || isNaN(amt)) return;
        const cat = (tx.category || 'uncategorised').toLowerCase();
        if(!categories[cat]) categories[cat] = { income:0, expense:0, net:0 };
        if(type==='income'){ categories[cat].income += amt; incomeTotal += amt; }
        else { categories[cat].expense += amt; expenseTotal += amt; }
      });
      Object.values(categories).forEach(c=>{ c.net = c.income - c.expense; });
      const balance = incomeTotal - expenseTotal;
      return { incomeTotal, expenseTotal, balance, categories };
    } else {
      return project?.financeSummary || { incomeTotal:0, expenseTotal:0, balance:0, categories:{} };
    }
  },[isProjectCreator, financeTransactions, project?.financeSummary]);

  // When creator's summary changes, persist aggregated summary to project doc (debounced simple effect)
  useEffect(()=>{
    if(!isProjectCreator) return;
    const summary = financeSummary;
    let cancelled = false;
    async function persist(){
      try {
        await updateDoc(doc(db,'projects', projectId), { financeSummary: summary });
        if(!cancelled) setProject((prev:any)=> ({ ...prev, financeSummary: summary }));
      } catch { /* silent */ }
    }
    persist();
    return ()=>{cancelled=true};
  },[financeSummary, isProjectCreator, projectId]);

  // Currency helpers (simple prefix display, no conversion)
  const currencySymbol = useMemo(()=>{
    const map: Record<string,string> = {
      USD:'$', EUR:'€', GBP:'£', ZAR:'R', KES:'KSh', UGX:'USh', TZS:'TSh', GHS:'₵', NGN:'₦', MWK:'MK', ETB:'Br', RWF:'FRw', CAD:'$', AUD:'$', NZD:'$', INR:'₹'
    };
    return projectCurrency ? (map[projectCurrency] || projectCurrency) : '';
  },[projectCurrency]);
  const formatMoney = (v:number) => {
    const n = v.toLocaleString(undefined,{ minimumFractionDigits:2, maximumFractionDigits:2 });
    return projectCurrency ? `${currencySymbol}${n}` : n;
  };

  async function addTransaction(){
    setAddingTx(true);
    try {
      const user = auth?.currentUser; if(!user) throw new Error('Sign in required');
      const amount = parseFloat(newTxAmount);
      if(isNaN(amount) || amount <= 0) throw new Error('Amount must be > 0');
      const category = newTxCategory.trim().toLowerCase() || 'uncategorised';
      const txData: any = {
        type: newTxType,
        category,
        amount,
        note: newTxNote.trim() || null,
        company: newTxCompany.trim() || null,
        transactionDate: newTxDate, // yyyy-mm-dd (no time)
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
      };
      // Upload receipts if any (images/pdf)
      if(newTxReceipts && newTxReceipts.length){
        setUploadingReceipts(true);
        const storage = getStorage();
        const uploaded: any[] = [];
        for(let i=0;i<newTxReceipts.length;i++){
          const f = newTxReceipts[i];
          const path = `projects/${projectId}/receipts/${Date.now()}_${i}_${f.name}`;
          const r = storageRef(storage, path);
            await uploadBytes(r, f);
            const url = await getDownloadURL(r);
            uploaded.push({ name: f.name, url, size: f.size, type: f.type });
        }
        txData.receipts = uploaded;
        setUploadingReceipts(false);
      }
      await addDoc(collection(db,'projects', projectId, 'financeTransactions'), txData);
      // Optimistic insert then re-sort by transactionDate desc
      setFinanceTransactions(prev=> {
        const list = [{ id: Math.random().toString(36).slice(2), ...txData }, ...prev];
        return list.sort((a:any,b:any)=>{
          const ad = (a.transactionDate || (a.createdAt? String(a.createdAt).slice(0,10):'')) as string;
          const bd = (b.transactionDate || (b.createdAt? String(b.createdAt).slice(0,10):'')) as string;
          if(bd === ad){
            return String(b.createdAt||'').localeCompare(String(a.createdAt||''));
          }
          return bd.localeCompare(ad);
        });
      });
  setNewTxAmount(''); setNewTxCategory(''); setNewTxNote(''); setNewTxCompany(''); setNewTxReceipts(null); setNewTxDate(new Date().toISOString().slice(0,10));
    } catch(e:any){ alert(e.message || 'Failed to add transaction'); }
    finally { setAddingTx(false); }
  }

  // Handle loading / error / missing project states AFTER all hooks above to keep hook order stable.
  if (loading) return <PageShell title={<span>Loading…</span>}><div className="text-sm text-gray-500">Loading...</div></PageShell>;
  if (error) return <PageShell title={<span>Error</span>}><div className="text-sm text-red-600">{error}</div></PageShell>;
  if (!project) return <PageShell title={<span>Project</span>}><div className="text-sm text-gray-500">Project not found.</div></PageShell>;

  return (
    <PageShell title={<span>{project.name}</span>} contentClassName="p-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left vertical tabs */}
        <nav className="md:w-56 flex md:flex-col md:items-stretch gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 border-b md:border-b-0 md:border-r border-brand-main/10">
          {tabs.map(t=> {
            const Icon = t.icon; const active = activeTab===t.id;
            return (
              <button key={t.id} onClick={()=>setActiveTab(t.id)} className={`flex items-center gap-2 px-3 py-2 rounded md:rounded-none md:border-l-4 text-sm font-medium transition whitespace-nowrap ${active? 'bg-brand-main/10 md:bg-transparent md:border-brand-main text-brand-main':'md:border-transparent text-gray-600 hover:text-brand-main hover:bg-brand-main/5'}`}>
                <Icon className="h-5 w-5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>
        {/* Right panel content */}
        <div className="flex-1 min-w-0">
            {activeTab === "home" && (
              <div className="space-y-6">
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-1">
                    <div className="bg-white rounded-xl border border-brand-main/10 p-5 shadow-sm">
                      <div className="mb-3">
                        <label className="block text-xs font-semibold text-brand-main mb-1">Description</label>
                        <textarea className="w-full border rounded px-3 py-2 text-brand-dark min-h-[80px]" value={desc} onChange={e=>setDesc(e.target.value)} disabled={improving} />
                        <button className="mt-2 px-4 py-2 bg-brand-main text-white rounded hover:bg-brand-dark disabled:opacity-50" disabled={improving} onClick={async()=>{
                          setImproving(true);
                          try {
                            const improved = await improveTextWithAI(desc);
                            setDesc(improved);
                            await updateDoc(doc(db,'projects', projectId), { description: improved });
                            if(auth?.currentUser){
                              const userId = auth.currentUser.uid;
                              const userRef = doc(db,'users', userId);
                              const userSnap = await getDoc(userRef);
                              const currentCredits = userSnap.exists()? userSnap.data().credits ?? 0 : 0;
                              if(currentCredits < 2) throw new Error('Not enough credits');
                              await updateDoc(userRef,{ credits: currentCredits - 2 });
                              await logCreditTransaction(userId,'spend',2,`AI improved project description for ${projectId}`);
                            }
                          } catch(e:any){ alert(e.message || 'Failed to improve description'); }
                          finally { setImproving(false); }
                        }}>{improving? 'Improving...' : 'Improve with AI (-2 Credits)'}</button>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4 text-sm text-brand-dark">
                        <div><span className="font-semibold">Project Code:</span> <span className="font-mono bg-gray-100 px-2 py-1 rounded">{project.projectId}</span></div>
                        <div><span className="font-semibold">Created by:</span> {project.createdBy}</div>
                      </div>
                      {project.location && (
                        <div className="mt-4 text-sm space-y-1">
                          <div><span className="font-semibold">Location:</span> {project.location.town || project.location.country ? `${project.location.town ? project.location.town + ', ' : ''}${project.location.country || ''}` : <em className="text-gray-400">(not set)</em>}</div>
                          {(project.location.latitude || project.location.longitude) && (
                            <div><span className="font-semibold">GPS:</span> {project.location.latitude ?? '?'} , {project.location.longitude ?? '?'}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 w-full lg:w-80">
                    {project.coverPhotoUrl && (
                      <img src={project.coverPhotoUrl} alt={project.name} className="w-full aspect-square object-cover rounded-xl border border-brand-main/20 shadow-sm" />
                    )}
                    {project.location && (project.location.latitude || project.location.longitude) && (
                      <MapPreview lat={project.location.latitude} lng={project.location.longitude} className="w-full" />
                    )}
                  </div>
                </div>
                <div>
                  {(mapParams || geoParams) ? (
                    <div className="bg-white rounded-xl border border-brand-main/10 p-5 shadow-sm inline-block">
                      <h2 className="text-lg font-semibold text-brand-main mb-2">Project Location Map</h2>
                      <MapPreview lat={(mapParams||geoParams)!.lat} lng={(mapParams||geoParams)!.lng} zoom={(mapParams||geoParams)!.zoom} className="w-full max-w-md" />
                      {(!project.location?.latitude && !project.location?.longitude) && (
                        <p className="text-xs text-gray-500 mt-2">Approximate location (no precise GPS pin set{geoParams && !mapParams ? '; geocoded' : ''}).</p>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-brand-main/40 bg-brand-main/5 text-sm text-gray-600 max-w-md space-y-3">
                      <div>
                        <div className="font-semibold text-brand-main mb-1">Location not set</div>
                        {project.location && (project.location.country || project.location.town) ? (
                          <p>A location is partially specified ({project.location.town ? `${project.location.town}, `: ''}{project.location.country || ''}) but we can't show a map yet. Add GPS coordinates or a supported country to enable the map.</p>
                        ) : (
                          <p>Add a country / town and optional GPS coordinates to show a project map.</p>
                        )}
                      </div>
                      {isProjectCreator && !showLocationEditor && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowLocationEditor(true);
                            const existing = project.location || {};
                            setLocCountry(existing.country || "");
                            setLocTown(existing.town || "");
                            setLocLat(existing.latitude != null ? String(existing.latitude) : "");
                            setLocLng(existing.longitude != null ? String(existing.longitude) : "");
                          }}
                          className="px-3 py-2 rounded bg-brand-main text-white font-semibold text-xs hover:bg-brand-dark"
                        >Add Location</button>
                      )}
                      {isProjectCreator && showLocationEditor && (
                        <form
                          onSubmit={async e => {
                            e.preventDefault();
                            setLocationError("");
                            setSavingLocation(true);
                            try {
                              const country = locCountry.trim();
                              const town = locTown.trim();
                              if (!country && !town) throw new Error('Enter at least a country or town');
                              const newLoc: any = { country: country || undefined, town: town || undefined };
                              if (locLat.trim()) {
                                const v = parseFloat(locLat);
                                if (isNaN(v) || v < -90 || v > 90) throw new Error('Latitude must be between -90 and 90');
                                newLoc.latitude = v;
                              }
                              if (locLng.trim()) {
                                const v2 = parseFloat(locLng);
                                if (isNaN(v2) || v2 < -180 || v2 > 180) throw new Error('Longitude must be between -180 and 180');
                                newLoc.longitude = v2;
                              }
                              await updateDoc(doc(db, 'projects', projectId), { location: newLoc });
                              setProject((prev: any) => ({ ...prev, location: newLoc }));
                              setShowLocationEditor(false);
                            } catch (err: any) {
                              setLocationError(err.message || 'Failed to save location');
                            } finally {
                              setSavingLocation(false);
                            }
                          }}
                          className="space-y-3 bg-white/60 p-3 rounded border border-brand-main/20"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] uppercase tracking-wide font-semibold text-brand-main mb-1">Country</label>
                              <input value={locCountry} onChange={e=>setLocCountry(e.target.value)} placeholder="e.g. Malawi" className="w-full border rounded px-2 py-1 text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase tracking-wide font-semibold text-brand-main mb-1">Town</label>
                              <input value={locTown} onChange={e=>setLocTown(e.target.value)} placeholder="e.g. Blantyre" className="w-full border rounded px-2 py-1 text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase tracking-wide font-semibold text-brand-main mb-1">Latitude (optional)</label>
                              <input value={locLat} onChange={e=>setLocLat(e.target.value)} placeholder="-15.7861" className="w-full border rounded px-2 py-1 text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase tracking-wide font-semibold text-brand-main mb-1">Longitude (optional)</label>
                              <input value={locLng} onChange={e=>setLocLng(e.target.value)} placeholder="35.0058" className="w-full border rounded px-2 py-1 text-xs" />
                            </div>
                          </div>
                          {locationError && <div className="text-xs text-red-600">{locationError}</div>}
                          <div className="flex gap-2 pt-1">
                            <button type="submit" disabled={savingLocation} className="px-3 py-1.5 rounded bg-brand-main text-white text-xs font-semibold disabled:opacity-50">{savingLocation? 'Saving...' : 'Save Location'}</button>
                            <button type="button" disabled={savingLocation} onClick={()=> setShowLocationEditor(false)} className="px-3 py-1.5 rounded bg-gray-200 text-gray-700 text-xs font-semibold">Cancel</button>
                          </div>
                          <p className="text-[10px] text-gray-500">Enter coordinates for precise map pin; otherwise country/town gives approximate map.</p>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === "updates" && (
              <div ref={updatesPanelRef} className="flex flex-col lg:flex-row gap-8">
                 <div className="flex-1 min-w-0">
                   <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
                    <h2 className="font-bold text-lg">Updates</h2>
                    <button onClick={()=>setShowUpdateModal(true)} className="inline-flex items-center gap-1 px-3 py-2 rounded bg-brand-main text-white text-sm font-semibold hover:bg-brand-dark">+ New</button>
                  </div>
                  <div className="mb-4 lg:hidden">
                    <SidebarSearchTags updates={project.updates} />
                  </div>
                  {filteredUpdates.length ? (
                    <ul className="space-y-4">
                      {filteredUpdates.map((u:any,i:number)=> {
                        const uid = auth?.currentUser?.uid;
                        const currentAuthorId = uid;
                        const canEdit = !!currentAuthorId && (
                          (u.authorUid && u.authorUid === currentAuthorId) ||
                          (!u.authorUid && u.author && [auth?.currentUser?.displayName, auth?.currentUser?.email, auth?.currentUser?.uid].filter(Boolean).includes(u.author))
                        );
                        const isEditing = editingIndex === i;
                        return (
                          <li key={i} className="bg-white rounded-xl border border-brand-main/10 p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {u.authorPhotoUrl ? <img src={u.authorPhotoUrl} alt="avatar" className="w-8 h-8 rounded-full border object-cover" /> : <div className="w-8 h-8 rounded-full bg-brand-main/20 flex items-center justify-center text-brand-main font-bold">{(u.author||'U')[0]}</div>}
                                <span className="text-sm font-semibold text-brand-main">{u.author || 'Unknown'}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-500">{u.createdAt? new Date(u.createdAt).toLocaleString():''}</span>
                                {canEdit && !isEditing && <button onClick={()=>beginEdit(i,u)} className="text-xs px-2 py-1 rounded border border-brand-main/30 text-brand-main hover:bg-brand-main/10">Edit</button>}
                              </div>
                            </div>
                            {isEditing ? (
                              <div className="space-y-2 mb-3">
                                <input value={editDraftTitle} onChange={e=>setEditDraftTitle(e.target.value)} placeholder="Title (optional)" className="w-full border rounded px-2 py-1 text-sm" />
                                <textarea value={editDraftText} onChange={e=>setEditDraftText(e.target.value)} placeholder="Update text" className="w-full border rounded px-2 py-2 text-sm min-h-[120px]" />
                                <div>
                                  <div className="flex flex-wrap gap-2 mb-2">
                                    {editTags.map(t=> (
                                      <span key={t} className="flex items-center gap-1 bg-orange-200 text-orange-800 px-2 py-1 rounded-full text-[10px] font-semibold">
                                        #{t}
                                        <button type="button" onClick={()=>removeEditTag(t)} className="hover:text-orange-950" aria-label={`Remove tag ${t}`}>×</button>
                                      </span>
                                    ))}
                                    <input
                                      className="flex-1 min-w-[100px] border rounded px-2 py-1 text-xs"
                                      placeholder={editTags.length? 'Add tag' : 'Add tag & Enter'}
                                      value={editTagInput}
                                      onChange={e=>setEditTagInput(e.target.value)}
                                      onKeyDown={onEditTagKeyDown}
                                    />
                                  </div>
                                  {editTags.length===0 && <p className="text-[10px] text-gray-400">Type a tag then press Enter. Tags become chips.</p>}
                                </div>
                                <div className="flex gap-2">
                                  <button disabled={editSubmitting} onClick={()=>saveEdit(i)} className="px-3 py-1 rounded bg-brand-main text-white text-xs font-semibold disabled:opacity-50">{editSubmitting? 'Saving...' : 'Save'}</button>
                                  <button disabled={editSubmitting} onClick={cancelEdit} className="px-3 py-1 rounded bg-gray-200 text-gray-700 text-xs font-semibold">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {u.title && <div className="font-semibold mb-1">{u.title}</div>}
                                {Array.isArray(u.images) && u.images.length>0 && <div className="mb-3"><img src={u.images[0]} alt="update" className="w-full rounded border object-cover" /></div>}
                                <div className="text-sm text-brand-dark whitespace-pre-wrap">{u.text}</div>
                                {Array.isArray(u.documents) && u.documents.length>0 && (
                                  <div className="mt-3 space-y-2">
                                    <div className="text-xs font-semibold text-brand-main">Attachments</div>
                                    <ul className="space-y-1">
                                      {u.documents.map((d:any,di:number)=>{
                                        const ext = (d.name||'').split('.').pop()?.toUpperCase();
                                        return (
                                          <li key={di} className="flex items-center gap-2 text-xs">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded border bg-orange-100 text-orange-700 font-bold text-[10px]">{ext||'DOC'}</span>
                                            <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-brand-main hover:underline truncate max-w-[220px]">{d.name}</a>
                                            <span className="text-gray-400">{(d.size ? Math.round(d.size/1024) : 0)} KB</span>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                )}
                              </>
                            )}
                            {Array.isArray(u.tags) && u.tags.length>0 && !isEditing && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {u.tags.map((t:string,ti:number)=>(<span key={ti} onClick={()=>setTagFilter(tagFilter===t?'':t)} className={`px-2 py-1 rounded-full text-xs cursor-pointer bg-brand-main/10 text-brand-main hover:bg-brand-main/20 ${tagFilter===t?'ring-2 ring-brand-main':''}`}>#{t}</span>))}
                              </div>
                            )}
                            {!isEditing && (
                              <div className="mt-3 flex gap-4 text-sm">
                                {(() => {
                                  const prayUsers: string[] = u.reactionUsers?.pray || [];
                                  const loveUsers: string[] = u.reactionUsers?.love || [];
                                  const prayActive = uid ? prayUsers.includes(uid) : false;
                                  const loveActive = uid ? loveUsers.includes(uid) : false;
                                  const prayCount = (prayUsers.length) || (u.reactions?.pray ?? 0);
                                  const loveCount = (loveUsers.length) || (u.reactions?.love ?? 0);
                                  return (
                                    <>
                                      <button
                                        type="button"
                                        disabled={reactionSubmitting[`${i}:pray`]}
                                        onClick={() => toggleReaction(i,'pray')}
                                        className={`flex items-center gap-1 px-2 py-1 rounded transition border ${prayActive? 'bg-brand-main text-white border-brand-main' : 'text-brand-main border-brand-main/30 hover:bg-brand-main/10'}`}
                                      >
                                        🙏 <span className="text-xs font-semibold">{prayCount}</span>
                                      </button>
                                      <button
                                        type="button"
                                        disabled={reactionSubmitting[`${i}:love`]}
                                        onClick={() => toggleReaction(i,'love')}
                                        className={`flex items-center gap-1 px-2 py-1 rounded transition border ${loveActive? 'bg-pink-500 text-white border-pink-500' : 'text-pink-600 border-pink-400/40 hover:bg-pink-50'}`}
                                      >
                                        ❤️ <span className="text-xs font-semibold">{loveCount}</span>
                                      </button>
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                            {!isEditing && (
                              <div className="mt-4">
                                <div className="text-xs font-semibold text-brand-main mb-2">Comments</div>
                                <ul className="space-y-2 mb-3">
                                  {(u.comments||[]).map((c:any,ci:number)=>(
                                    <li key={ci} className="flex gap-2 items-start">
                                      <div className="w-7 h-7 rounded-full bg-brand-main/20 flex items-center justify-center text-brand-main text-xs font-bold border">{(c.author||'U')[0]}</div>
                                      <div>
                                        <div className="text-xs font-semibold text-brand-main">{c.author||'Unknown'} <span className="text-gray-400 font-normal">{c.createdAt? new Date(c.createdAt).toLocaleString():''}</span></div>
                                        <div className="text-sm text-brand-dark">{c.text}</div>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                                <form onSubmit={e=>{e.preventDefault(); submitComment(i);}} className="flex gap-2">
                                  <input className="flex-1 border rounded px-2 py-1 text-sm" placeholder="Write a comment..." value={commentInputs[i]||''} onChange={e=>setCommentInputs(prev=>({...prev,[i]:e.target.value}))} disabled={commentSubmitting[i]} />
                                  <button disabled={commentSubmitting[i] || !(commentInputs[i]||'').trim()} className="px-3 py-1 rounded bg-brand-main text-white text-xs font-semibold disabled:opacity-50">Post</button>
                                </form>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : <div className="text-gray-400 italic">No updates yet.</div>}
                </div>
                <div className="w-full lg:w-72 lg:ml-4 flex-shrink-0 hidden lg:block">
                  <SidebarSearchTags updates={project.updates} />
                </div>
                {showUpdateModal && <CreateProjectUpdateModal open={showUpdateModal} onClose={()=>setShowUpdateModal(false)} projectDocId={projectId} onPostCreated={(nu:any)=> setProject((prev:any)=>({...prev, updates:[nu, ...(prev?.updates||[])]}))} />}
              </div>
            )}
            {activeTab === "finance" && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm text-brand-dark">
                  <h2 className="text-lg font-semibold text-brand-main mb-2">Finance Overview</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                      <div className="text-[11px] font-semibold uppercase text-green-700">Income</div>
                      <div className="text-base font-bold text-green-800">{formatMoney(financeSummary.incomeTotal)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                      <div className="text-[11px] font-semibold uppercase text-red-700">Spent</div>
                      <div className="text-base font-bold text-red-800">{formatMoney(financeSummary.expenseTotal)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <div className="text-[11px] font-semibold uppercase text-blue-700">Balance</div>
                      <div className="text-base font-bold text-blue-800">{formatMoney(financeSummary.balance)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 col-span-2 sm:col-span-1">
                      <div className="text-[11px] font-semibold uppercase text-amber-700">Expense Categories</div>
                      <div className="text-base font-bold text-amber-800">{Object.values(financeSummary.categories||{}).filter((c:any)=> (c.expense||0) > 0).length}</div>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm text-brand-dark">
                  <h3 className="text-base font-semibold text-brand-main mb-4">Spending Breakdown</h3>
                  {(()=>{
                    const raw = financeSummary.categories || {} as Record<string, any>;
                    const expenseEntries = Object.entries(raw)
                      .map(([k,v]:any)=> ({ category:k, expense: v.expense||0 }))
                      .filter(e=> e.expense > 0);
                    if(!expenseEntries.length) return <div className="text-sm text-gray-500">No spending recorded yet.</div>;
                    const total = expenseEntries.reduce((s,e)=> s+ e.expense, 0) || 1;
                    // Build conic-gradient for pie chart
                    const colors = ['#dc2626','#f97316','#f59e0b','#d97706','#ea580c','#fb7185','#ec4899','#f472b6','#e11d48','#be123c','#fb923c','#fbbf24'];
                    let currentDeg = 0;
                    const segments: {cat:string; from:number; to:number; color:string; amount:number; pct:number}[] = [];
                    expenseEntries.sort((a,b)=> b.expense - a.expense).forEach((e,i)=>{
                      const pct = (e.expense / total);
                      const deg = pct * 360;
                      const seg = { cat: e.category, from: currentDeg, to: currentDeg + deg, color: colors[i % colors.length], amount: e.expense, pct: pct*100 };
                      segments.push(seg);
                      currentDeg += deg;
                    });
                    const gradient = segments.map(s=> `${s.color} ${s.from}deg ${s.to}deg`).join(', ');
                    const legendSegments = [...segments].sort((a,b)=> a.cat.localeCompare(b.cat));
                    return (
                      <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex items-center justify-center">
                          <div className="relative" style={{width:208, height:208}}>
                            <svg
                              width={208}
                              height={208}
                              viewBox="0 0 208 208"
                              role="img"
                              aria-label="Spending pie chart interactive"
                            >
                              {segments.map(seg=>{
                                const start = seg.from; const end = seg.to;
                                const largeArc = (end - start) > 180 ? 1 : 0;
                                const r = 104; const cx = 104; const cy = 104;
                                const toRad = (d:number)=> d * Math.PI/180;
                                const x1 = cx + r * Math.cos(toRad(start));
                                const y1 = cy + r * Math.sin(toRad(start));
                                const x2 = cx + r * Math.cos(toRad(end));
                                const y2 = cy + r * Math.sin(toRad(end));
                                const mid = (start + end)/2;
                                const midRad = toRad(mid);
                                const raise = hoveredSeg === seg.cat ? 6 : 0;
                                const tx = Math.cos(midRad) * raise;
                                const ty = Math.sin(midRad) * raise;
                                const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                                return (
                                  <path
                                    key={seg.cat}
                                    d={d}
                                    fill={seg.color}
                                    stroke="#9ca3af" /* gray-400 */
                                    strokeWidth={0.6}
                                    vectorEffect="non-scaling-stroke"
                                    transform={`translate(${tx} ${ty})`}
                                    className="cursor-pointer transition-transform duration-150"
                                    onMouseEnter={()=> setHoveredSeg(seg.cat)}
                                    onMouseLeave={()=> setHoveredSeg(s=> s===seg.cat? null : s)}
                                  >
                                    <title>{`${seg.cat} ${seg.pct.toFixed(1)}%`}</title>
                                  </path>
                                );
                              })}
                            </svg>
                            {segments.map(seg=>{
                              if(seg.pct < 6) return null;
                              const mid = (seg.from + seg.to)/2;
                              const rad = mid * Math.PI/180;
                              const R = 208/2;
                              const rLabel = R * 0.62;
                              const x = R + rLabel * Math.cos(rad);
                              const y = R + rLabel * Math.sin(rad);
                              return (
                                <span
                                  key={seg.cat}
                                  className="absolute text-[10px] font-semibold text-white drop-shadow-sm pointer-events-none"
                                  style={{ left: x, top: y, transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.25)', padding:'2px 4px', borderRadius:4, opacity: hoveredSeg && hoveredSeg!==seg.cat ? 0.4 : 1 }}
                                >{seg.pct.toFixed(0)}%</span>
                              );
                            })}
                            {hoveredSeg && (()=>{
                              const seg = segments.find(s=> s.cat===hoveredSeg);
                              if(!seg) return null;
                              const mid = (seg.from + seg.to)/2;
                              const rad = mid * Math.PI/180;
                              const R = 208/2;
                              const rLabel = R * 0.85;
                              const x = R + rLabel * Math.cos(rad);
                              const y = R + rLabel * Math.sin(rad);
                              return (
                                <div className="absolute z-10 text-[10px] font-medium bg-white/90 backdrop-blur-sm border border-brand-main/20 rounded px-2 py-1 shadow-sm pointer-events-none" style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}>
                                  <span className="capitalize">{seg.cat}</span>: {seg.pct.toFixed(1)}%
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        <ul className="flex-1 space-y-2 text-xs">
                          {legendSegments.map(s=> (
                            <li key={s.cat} className="flex items-center gap-2">
                              <span className="inline-block w-3 h-3 rounded-sm" style={{background:s.color}} />
                              <span className="capitalize font-medium flex-1 truncate">{s.cat}</span>
                              <span className="tabular-nums text-gray-600">{formatMoney(s.amount)}</span>
                              <span className="w-12 text-right text-gray-400">{s.pct.toFixed(1)}%</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                  <p className="mt-4 text-[10px] text-gray-400">Only expense categories shown. Percentages based on total spending.</p>
                </div>
                {isProjectCreator && (
                  <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm text-brand-dark space-y-6">
                    <div>
                      <h3 className="text-base font-semibold text-brand-main mb-2">Add Transaction</h3>
                      <form onSubmit={e=>{e.preventDefault(); addTransaction();}} className="grid sm:grid-cols-6 gap-3 text-sm items-end">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold uppercase mb-1 text-brand-main">Type</label>
                          <select value={newTxType} onChange={e=> setNewTxType(e.target.value as any)} className="w-full border rounded px-2 py-2">
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold uppercase mb-1 text-brand-main">Date</label>
                          <input type="date" value={newTxDate} onChange={e=>setNewTxDate(e.target.value)} className="w-full border rounded px-2 py-2" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold uppercase mb-1 text-brand-main">Category</label>
                          <input value={newTxCategory} onChange={e=>setNewTxCategory(e.target.value)} placeholder="e.g. materials" className="w-full border rounded px-2 py-2" />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-[11px] font-semibold uppercase mb-1 text-brand-main">Amount</label>
                          <input value={newTxAmount} onChange={e=>setNewTxAmount(e.target.value)} placeholder="0.00" className="w-full border rounded px-2 py-2" />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-semibold uppercase mb-1 text-brand-main">Company / Vendor</label>
                          <input value={newTxCompany} onChange={e=>setNewTxCompany(e.target.value)} placeholder="Who is this with?" className="w-full border rounded px-2 py-2" />
                        </div>
                        <div className="sm:col-span-6">
                          <label className="block text-[11px] font-semibold uppercase mb-1 text-brand-main">Note (optional)</label>
                          <input value={newTxNote} onChange={e=>setNewTxNote(e.target.value)} placeholder="Details" className="w-full border rounded px-2 py-2" />
                        </div>
                        <div className="sm:col-span-6">
                          <label className="block text-[11px] font-semibold uppercase mb-1 text-brand-main">Receipts (optional)</label>
                          <input type="file" multiple onChange={e=> setNewTxReceipts(e.target.files)} accept="image/*,application/pdf" className="w-full text-xs" />
                          {uploadingReceipts && <div className="text-[10px] text-gray-500 mt-1">Uploading...</div>}
                          {newTxReceipts && newTxReceipts.length>0 && <div className="mt-1 flex flex-wrap gap-2">{Array.from(newTxReceipts).map((f,i)=>(<span key={i} className="px-2 py-1 bg-brand-main/10 text-brand-main rounded text-[10px] truncate max-w-[120px]">{f.name}</span>))}</div>}
                        </div>
                        <div className="sm:col-span-6 flex justify-end">
                          <button disabled={addingTx || uploadingReceipts} className="px-4 py-2 rounded bg-brand-main text-white font-semibold text-sm disabled:opacity-50">{addingTx? 'Adding...' : 'Add'}</button>
                        </div>
                      </form>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-brand-main mb-3">All Transactions</h3>
                      {financeLoading && <div className="text-sm text-gray-500">Loading...</div>}
                      {financeError && <div className="text-sm text-red-600">{financeError}</div>}
                      {!financeLoading && !financeTransactions.length && <div className="text-sm text-gray-500">No transactions yet.</div>}
                      <ul className="divide-y divide-gray-200 text-sm">
                        {financeTransactions.map(tx=> (
                          <li key={tx.id} className="py-2 flex flex-col sm:flex-row sm:items-center sm:gap-4">
                            <div className="flex-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${tx.type==='income' ? 'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{tx.type}</span>
                              <span className="capitalize font-medium">{tx.category}</span>
                              {tx.company && <span className="text-gray-700 text-xs italic">{tx.company}</span>}
                              {tx.note && <span className="text-gray-500 truncate max-w-[200px]">{tx.note}</span>}
                              {Array.isArray(tx.receipts) && tx.receipts.length>0 && (
                                <div className="flex flex-wrap gap-1">
                                  {tx.receipts.map((r:any,i:number)=> (
                                    <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-1.5 py-0.5 rounded bg-brand-main/10 text-brand-main text-[10px] hover:bg-brand-main/20">Receipt {i+1}</a>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="font-mono tabular-nums w-28 text-right ${tx.type==='income' ? 'text-green-700':'text-red-700'}">{formatMoney(tx.amount||0)}</div>
                            <div className="w-40 text-xs text-gray-400 sm:text-right">{tx.transactionDate || (tx.createdAt ? new Date(tx.createdAt).toISOString().slice(0,10):'')}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="text-[10px] text-gray-400">Only you (project creator) can see detailed transactions. Others see only aggregated category totals and balance.</p>
                  </div>
                )}
              </div>
            )}
            {isProjectCreator && activeTab === 'settings' && (
              <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm text-brand-dark space-y-8 max-w-xl">
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-brand-main">Project Settings</h2>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                    <select
                      value={projectCurrency}
                      onChange={async e=>{
                        const val = e.target.value;
                        setProjectCurrency(val);
                        try {
                          await updateDoc(doc(db,'projects', projectId), { currency: val });
                          setProject((prev:any)=> ({ ...prev, currency: val }));
                        } catch {}
                      }}
                      className="w-full border rounded px-3 py-2 text-sm"
                    >
                      <option value="">Select currency…</option>
                      {['USD','EUR','GBP','ZAR','KES','UGX','TZS','GHS','NGN','MWK','ETB','RWF','CAD','AUD','NZD','INR'].map(c=> <option key={c} value={c}>{c}</option>)}
                    </select>
                    <p className="text-[10px] text-gray-500 mt-1">Applies as a prefix to displayed amounts (no FX conversion).</p>
                    {projectCurrency && <p className="text-[10px] text-gray-600 mt-1">Symbol: <span className="font-semibold">{currencySymbol}</span></p>}
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-brand-main mb-1">Danger Zone</h2>
                  <p className="text-sm text-gray-600">Deleting a project is permanent. All updates and data stored directly on this project document will be removed. This action cannot be undone.</p>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Type <span className="font-mono text-brand-main">delete</span> to enable the delete button.</label>
                  <input
                    type="text"
                    value={deleteInput}
                    onChange={e=> setDeleteInput(e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="delete"
                    disabled={deleting}
                  />
                  {deleteError && <div className="text-sm text-red-600">{deleteError}</div>}
                  <button
                    disabled={deleteInput.trim().toLowerCase() !== 'delete' || deleting}
                    onClick={async()=>{
                      if(deleteInput.trim().toLowerCase() !== 'delete') return;
                      if(!confirm('Are you absolutely sure you want to delete this project? This cannot be undone.')) return;
                      setDeleting(true); setDeleteError('');
                      try {
                        // Basic authorisation: allow if current user matches creator or has role claim (best-effort; rules currently broad)
                        const user = auth?.currentUser;
                        if(!user) throw new Error('Must be signed in');
                        if(project.createdBy && ![user.displayName, user.email, user.uid].includes(project.createdBy)) {
                          // Allow anyway if user has admin claim
                          const isAdmin = (user as any)?.stsTokenManager || false; // placeholder; real admin check would read custom claims
                          if(!isAdmin) throw new Error('You are not allowed to delete this project');
                        }
                        await deleteDoc(doc(db,'projects', projectId));
                        router.push('/projects');
                      } catch(e:any){ setDeleteError(e.message || 'Failed to delete'); }
                      finally { setDeleting(false); }
                    }}
                    className="px-4 py-2 rounded bg-red-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700"
                  >{deleting? 'Deleting...' : 'Delete Project'}</button>
                </div>
              </div>
            )}
        </div>
      </div>
    </PageShell>
  );
}
