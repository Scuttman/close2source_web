
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, doc, getDocs, query, updateDoc, where, onSnapshot, deleteField } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { UserCircleIcon, InformationCircleIcon, ArrowPathIcon, HeartIcon, CurrencyDollarIcon, PencilSquareIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import CreatePostModal from "../../../components/CreatePostModal";
import PageShell from "../../../components/PageShell";
import { db } from "../../../src/lib/firebase";
import IndividualOverviewTab from "../../../components/IndividualOverviewTab";
import IndividualAboutTab from "../../../components/IndividualAboutTab";
import IndividualUpdatesTab from "../../../components/IndividualUpdatesTab";
import IndividualPrayerTab from "../../../components/IndividualPrayerTab";
import IndividualFinanceTab from "../../../components/IndividualFinanceTab";
import IndividualSettingsTab from "../../../components/IndividualSettingsTab";

function SidebarSearchTags({ updates, searchValue, setSearchValue, tagFilter, setTagFilter }: any) {
  const allTags = useMemo(() => {
    const s = new Set<string>();
    (updates || []).forEach((u: any) => Array.isArray(u?.tags) && u.tags.forEach((t: string) => s.add(t)));
    return Array.from(s).sort();
  }, [updates]);
  return (
    <div className="bg-white rounded-xl border border-brand-main/10 p-4 mb-4 shadow-sm">
      <input value={searchValue} onChange={e=>setSearchValue(e.target.value)} placeholder="Search posts..." className="w-full border rounded px-3 py-2 mb-3 text-sm" />
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

export default function ProfilePage() {
  const searchParams = useSearchParams();
  const code = searchParams.get("id") || "";
  const [individual, setIndividual] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("updates");
  const [showPostModal, setShowPostModal] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [role, setRole] = useState<'owner'|'representative'|'supporter'|'public'>('public');
  const [userUid, setUserUid] = useState<string|undefined>(undefined);
  const [editMode, setEditMode] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<number,string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<number,boolean>>({});
  const [searchValue, setSearchValue] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const updatesPanelRef = useRef<HTMLDivElement>(null);

  // Build unified feed from legacy arrays (idempotent)
  function buildUnifiedFeed(raw: any){
    const updates = Array.isArray(raw?.updates)? raw.updates: [];
    const prayers = Array.isArray(raw?.prayerRequests)? raw.prayerRequests: [];
    const feedParts: any[] = [];
    updates.forEach((u:any)=> feedParts.push({ type:'update', ...u }));
    prayers.forEach((p:any)=> feedParts.push({ type:'prayer', ...p }));
    feedParts.sort((a,b)=> new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime());
    return feedParts;
  }

  const filteredUpdates = useMemo(() => {
    // Primary source: unified profilePosts with showInUpdatesFeed flag
    const profilePosts = Array.isArray(individual?.profilePosts) ? individual.profilePosts : [];
    let arr: any[] = profilePosts.length ? profilePosts.filter((p:any)=> p.showInUpdatesFeed) : [];
    if(!arr.length){
      // Fallback legacy: feed or updates
      const feed = Array.isArray(individual?.feed) ? individual.feed : [];
      const feedUpdates = feed.filter((f:any)=> f.type==='update');
      arr = feedUpdates.length ? [...feedUpdates] : (Array.isArray(individual?.updates) ? [...individual.updates] : []);
    }
    if (searchValue.trim()) {
      const q = searchValue.toLowerCase();
      arr = arr.filter(u => (u.text||'').toLowerCase().includes(q) || (u.title||'').toLowerCase().includes(q));
    }
    if (tagFilter) arr = arr.filter(u => Array.isArray(u.tags) && u.tags.includes(tagFilter));
    return arr;
  }, [individual?.profilePosts, individual?.feed, individual?.updates, searchValue, tagFilter]);

  useEffect(() => {
    let cancelled = false;
    let unsub: (()=>void)|null = null;
    async function loadOnceAndListen(){
      if(!code) return;
      setLoading(true); setError("");
      try {
        const qRef = query(collection(db, "individuals"), where("individualId", "==", code));
        const snap = await getDocs(qRef);
        if(snap.empty){ if(!cancelled){ setError("No individual found for this code."); setIndividual(null);} return; }
        const d = snap.docs[0];
        const raw: any = { id: d.id, ...d.data() };
        const patch: any = {};
        if(!Array.isArray(raw.updates)){ raw.updates=[]; patch.updates=[]; }
        if(!Array.isArray(raw.prayerRequests)){ raw.prayerRequests=[]; patch.prayerRequests=[]; }
        if(Array.isArray(raw.prayerRequests) && raw.prayerRequests.some((p:any)=> typeof p === 'string')) {
          const transformed = raw.prayerRequests.map((p:any)=> typeof p === 'string' ? {
            id: (typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2)),
            text: p,
            createdAt: new Date().toISOString(),
            author: raw.ownerId || 'Unknown',
            answers: [],
            responses: []
          } : p);
          raw.prayerRequests = transformed;
          patch.prayerRequests = transformed;
        }
        if(!Array.isArray(raw.financeSummary)){ raw.financeSummary=[]; patch.financeSummary=[]; }
        if(Object.keys(patch).length){ await updateDoc(doc(db, "individuals", raw.id), patch).catch(()=>{}); }
        if(cancelled) return;
        // Set initial
        // Build unified profilePosts if missing
        if(!Array.isArray(raw.profilePosts)) {
          const updates = Array.isArray(raw.updates)? raw.updates: [];
          const prayers = Array.isArray(raw.prayerRequests)? raw.prayerRequests: [];
          const funding = Array.isArray(raw.fundingNeeds)? raw.fundingNeeds: [];
          const updateIds = new Set(updates.map((u:any)=> u.id));
          const posts: any[] = [];
          updates.forEach((u:any)=> posts.push({ type:'update', showInUpdatesFeed:true, ...u }));
          prayers.forEach((p:any)=> {
            // If there was a cross-posted update with same id, don't duplicate; prefer prayer representation
            if(updateIds.has(p.id)) {
              posts.push({ type:'prayer', showInUpdatesFeed:true, ...p });
            } else {
              posts.push({ type:'prayer', showInUpdatesFeed:false, ...p });
            }
          });
          funding.forEach((f:any)=> posts.push({ type:'funding', showInUpdatesFeed:false, ...f }));
          posts.sort((a,b)=> new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime());
          raw.profilePosts = posts;
          // Delete legacy arrays after migration
          updateDoc(doc(db, "individuals", raw.id), { profilePosts: posts, updates: deleteField(), prayerRequests: deleteField(), fundingNeeds: deleteField(), feed: deleteField() }).catch(()=>{});
        }
        setIndividual(raw);
        const auth = getAuth();
        const u = auth.currentUser;
        const ownerId = raw.ownerId || raw.ownerUID || raw.owner || raw.userId;
        setIsOwner(!!u && !!ownerId && u.uid===ownerId);
        if(u) setRole(computeRole(u, raw));
        // Start real-time listener on the doc
        const ref = doc(db, "individuals", raw.id);
        unsub = onSnapshot(ref, (snap)=>{
          if(!snap.exists()) return;
          const live: any = { id: snap.id, ...snap.data() };
          // Ensure profilePosts exists (one-time migration for newly viewed docs)
          if(!Array.isArray(live.profilePosts)) {
            const updates = Array.isArray(live.updates)? live.updates: [];
            const prayers = Array.isArray(live.prayerRequests)? live.prayerRequests: [];
            const funding = Array.isArray(live.fundingNeeds)? live.fundingNeeds: [];
            const updateIds = new Set(updates.map((u:any)=> u.id));
            const posts: any[] = [];
            updates.forEach((u:any)=> posts.push({ type:'update', showInUpdatesFeed:true, ...u }));
            prayers.forEach((p:any)=> {
              if(updateIds.has(p.id)) posts.push({ type:'prayer', showInUpdatesFeed:true, ...p });
              else posts.push({ type:'prayer', showInUpdatesFeed:false, ...p });
            });
            funding.forEach((f:any)=> posts.push({ type:'funding', showInUpdatesFeed:false, ...f }));
            posts.sort((a,b)=> new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime());
            live.profilePosts = posts;
            updateDoc(ref, { profilePosts: posts, updates: deleteField(), prayerRequests: deleteField(), fundingNeeds: deleteField(), feed: deleteField() }).catch(()=>{});
          }
          setIndividual((prev:any) => ({ ...prev, ...live }));
          const authNow = getAuth();
          const uNow = authNow.currentUser;
          if(uNow){
            setRole(computeRole(uNow, live));
            const liveOwnerId = live.ownerId || live.ownerUID || live.owner || live.userId;
            setIsOwner(!!liveOwnerId && uNow.uid===liveOwnerId);
          }
        });
      } catch(e:any){ if(!cancelled) setError(e.message || 'Failed to load profile'); }
      finally { if(!cancelled) setLoading(false); }
    }
    loadOnceAndListen();
    return ()=>{ cancelled=true; if(unsub) unsub(); };
  }, [code]);

  // Listen to auth state so header button updates when user signs in/out
  useEffect(()=>{
    const auth = getAuth();
    const unsub = auth.onAuthStateChanged(u=>{
      setUserUid(u?.uid);
      if(individual){
        const ownerId = individual.ownerId || individual.ownerUID || individual.owner || individual.userId;
        if(ownerId){
          setIsOwner(!!u && u.uid===ownerId);
        } else {
          // no owner set yet
          setIsOwner(false);
        }
        if(u){ setRole(computeRole(u, individual)); } else { setRole('public'); }
      }
    });
    return ()=>unsub();
  }, [individual]);

  async function claimOwnership(){
    if(!individual) return;
    const auth = getAuth();
    const u = auth.currentUser; if(!u) return;
    try {
      await updateDoc(doc(db, "individuals", individual.id), { ownerId: u.uid });
      setIndividual((prev:any)=> prev? {...prev, ownerId: u.uid }: prev);
      setIsOwner(true);
    } catch(e) { /* silent */ }
  }

  async function submitComment(i: number) {
    setCommentSubmitting(s=>({...s,[i]:true}));
    try {
      const auth = getAuth();
      const user = auth.currentUser; if(!user) throw new Error("Sign in required");
  if(!individual) throw new Error("Profile not loaded");
  const ref = doc(db, "individuals", individual.id);
  const updates:any[] = Array.isArray(individual.updates)? [...individual.updates] : [];
  if(!updates[i]) throw new Error("Update missing");
      const newComment = { text: commentInputs[i]||'', author: (user.displayName || user.email || user.uid), createdAt: new Date().toISOString() };
      updates[i].comments = Array.isArray(updates[i].comments)? [...updates[i].comments, newComment] : [newComment];
      await updateDoc(ref,{updates});
  // optimistic local update (snapshot listener will reconcile if needed)
  setIndividual((prev:any)=> prev? ({...prev, updates}): prev);
      setCommentInputs(prev=>({...prev,[i]:''}));
    } catch(e) { /* silent */ } finally { setCommentSubmitting(s=>({...s,[i]:false})); }
  }

  function computeRole(u: any, ind: any): 'owner'|'representative'|'supporter'|'public' {
    if(!u) return 'public';
    const uid = u.uid;
    const ownerId = ind?.ownerId || ind?.ownerUID || ind?.owner || ind?.userId;
    if(ownerId && uid===ownerId) return 'owner';
    if(Array.isArray(ind?.representatives) && ind.representatives.includes(uid)) return 'representative';
    if(Array.isArray(ind?.supporters) && ind.supporters.includes(uid)) return 'supporter';
    return 'public';
  }

  // New multi-role access settings normalization
  type AccessLevel = 'public'|'supporter'|'representative'|'owner';
  interface TabPermission { view: AccessLevel[]; edit: AccessLevel[]; }
  type AccessSettings = Record<string, TabPermission>;
  const ROLE_ORDER: AccessLevel[] = ['public','supporter','representative','owner'];
  const thresholdToArray = (lvl: string): AccessLevel[] => {
    const idx = ROLE_ORDER.indexOf(lvl as AccessLevel);
    if(idx===-1) return [...ROLE_ORDER];
    return ROLE_ORDER.slice(idx) as AccessLevel[];
  };
  const defaultSettings: AccessSettings = {
    overview: { view: ['public','supporter','representative','owner'], edit: ['owner'] },
    about: { view: ['public','supporter','representative','owner'], edit: ['owner'] },
    updates: { view: ['supporter','representative','owner'], edit: ['owner','representative'] },
    prayer: { view: ['supporter','representative','owner'], edit: ['owner'] },
    finance: { view: ['representative','owner'], edit: ['owner','representative'] }
  };
  function normalizeAccessSettings(raw: any): AccessSettings {
    if(!raw || typeof raw !== 'object') return defaultSettings;
    const out: AccessSettings = { ...defaultSettings };
    Object.entries(raw).forEach(([k,v])=>{
      if(typeof v === 'string') { // legacy threshold
        out[k] = { view: thresholdToArray(v), edit: ['owner'] };
      } else if(v && typeof v === 'object' && Array.isArray((v as any).view) && Array.isArray((v as any).edit)) {
        const view = (v as any).view.filter((r: any)=> ROLE_ORDER.includes(r));
        const edit = (v as any).edit.filter((r: any)=> ROLE_ORDER.includes(r) && view.includes(r));
        out[k] = { view: view.length? view: out[k]?.view || defaultSettings.overview.view, edit: edit.length? edit: out[k]?.edit || ['owner'] };
      }
    });
    return out;
  }
  const accessSettings: AccessSettings = useMemo(()=> normalizeAccessSettings(individual?.accessSettings), [individual?.accessSettings]);

  const canViewTab = (tab: string): boolean => {
    const perm = accessSettings[tab];
    if(!perm) return false;
    return perm.view.includes(role as AccessLevel);
  };
  const canEditTab = (tab: string): boolean => {
    const perm = accessSettings[tab];
    if(!perm) return false;
    if(!perm.edit.includes(role as AccessLevel)) return false;
    // Owners still use edit toggle; others with edit permission can edit immediately
    if(role==='owner') return editMode;
    return true;
  };

  const settingsAllowedForRep = !!individual?.settingsAllowRepresentative; // separate flag for settings tab
  const allTabs: { id: string; label: string; icon: any; show: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: UserCircleIcon, show: canViewTab('overview') },
    { id: 'about', label: 'About', icon: InformationCircleIcon, show: canViewTab('about') },
    { id: 'updates', label: 'Updates', icon: ArrowPathIcon, show: canViewTab('updates') },
    { id: 'prayer', label: 'Prayer', icon: HeartIcon, show: canViewTab('prayer') },
    { id: 'finance', label: 'Finance', icon: CurrencyDollarIcon, show: canViewTab('finance') },
    { id: 'settings', label: 'Settings', icon: Cog6ToothIcon, show: role==='owner' || (role==='representative' && settingsAllowedForRep) }
  ];
  const tabs = allTabs.filter(t=> t.show);

  const profileCode = individual?.individualId || individual?.code || code || '';
  const headerRight = (
    <div className="flex items-center gap-3">
      {profileCode && (
        <span className="inline-block text-xs font-mono bg-white/10 text-white px-2 py-1 rounded border border-white/20 tracking-wide md:text-sm md:scale-110 origin-left">
          {profileCode}
        </span>
      )}
      {(!isOwner && userUid && individual && !(individual.ownerId || individual.ownerUID || individual.owner || individual.userId)) && (
        <button
          onClick={claimOwnership}
          className="px-3 py-2 rounded-md text-xs font-semibold border border-white/30 bg-white/10 text-white hover:bg-white/20 transition"
        >Claim</button>
      )}
      {isOwner && (
        <button
          type="button"
          onClick={()=> setEditMode(m=>!m)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold border transition ${editMode? 'bg-brand-main text-white border-brand-main shadow-inner':'bg-white/10 text-white border-white/30 hover:bg-white/20'}`}
          aria-pressed={editMode}
          aria-label="Toggle edit mode"
        >
          <span>Edit</span>
          <span className={`inline-flex items-center h-4 w-8 rounded-full transition ${editMode? 'bg-brand-accent/80':'bg-white/30'}`}>
            <span className={`h-4 w-4 rounded-full bg-white shadow transform transition ${editMode? 'translate-x-4':'translate-x-0'}`}></span>
          </span>
        </button>
      )}
    </div>
  );

  return (
    <PageShell
      title={<span>{individual?.name || 'Profile'}</span>}
      contentClassName="p-6"
      headerRight={headerRight}
    >
      {loading && <div className="text-gray-500 text-sm">Loading...</div>}
      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
      {!loading && !error && !individual && <div className="text-gray-500">Not found.</div>}
      {!loading && individual && (
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left vertical tab nav */}
          <nav className="md:w-56 flex md:flex-col md:items-stretch gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 border-b md:border-b-0 md:border-r border-brand-main/10">
            {tabs.map(t => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={()=>setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded md:rounded-none md:border-l-4 text-sm font-medium transition whitespace-nowrap ${active? 'bg-brand-main/10 md:bg-transparent md:border-brand-main text-brand-main':'md:border-transparent text-gray-600 hover:text-brand-main hover:bg-brand-main/5'}`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>
          {/* Right content */}
          <div className="flex-1 min-w-0">
            {activeTab==='overview' && (
              <IndividualOverviewTab individual={individual} />
            )}
            {activeTab==='about' && (
              <IndividualAboutTab individual={individual} />
            )}
            {activeTab==='updates' && (
              <IndividualUpdatesTab
                individual={individual}
                filteredUpdates={filteredUpdates}
                searchValue={searchValue}
                setSearchValue={setSearchValue}
                tagFilter={tagFilter}
                setTagFilter={setTagFilter}
                showPostModal={showPostModal}
                setShowPostModal={setShowPostModal}
                submitComment={submitComment}
                commentInputs={commentInputs}
                setCommentInputs={setCommentInputs}
                commentSubmitting={commentSubmitting}
                code={code}
                onPostCreated={(nu:any)=> setIndividual((prev:any)=> prev? ({...prev, updates:[nu, ...(prev.updates||[])], feed: [{type:'update', ...nu}, ...(prev.feed||[])] }): prev)}
              />
            )}
            {activeTab==='prayer' && (
              <IndividualPrayerTab
                individual={individual}
                onUpdate={(next)=> setIndividual((prev:any)=>({...prev, prayerRequests: next, feed: (()=>{ const updates = prev?.updates||[]; const feedParts=[...updates.map((u:any)=>({type:'update', ...u})), ...next.map((p:any)=>({type:'prayer', ...p}))]; feedParts.sort((a,b)=> new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime()); return feedParts; })()}))}
                onUpdatesChange={(updates)=> setIndividual((prev:any)=>({...prev, updates, feed: (()=>{ const prayers = prev?.prayerRequests||[]; const feedParts=[...updates.map((u:any)=>({type:'update', ...u})), ...prayers.map((p:any)=>({type:'prayer', ...p}))]; feedParts.sort((a,b)=> new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime()); return feedParts; })()}))}
                readOnly={!canEditTab('prayer')}
              />
            )}
            {activeTab==='finance' && (
              <IndividualFinanceTab
                individual={individual}
                onUpdate={({ fundingNeeds, givingLinks })=> setIndividual((prev:any)=>({
                  ...prev,
                  fundingNeeds,
                  givingLinks
                }))}
                readOnly={!canEditTab('finance')}
              />
            )}
            {activeTab==='settings' && (
              <IndividualSettingsTab
                individual={individual}
                isOwner={isOwner}
                onUpdate={(partial)=> setIndividual((prev:any)=>({...prev, ...partial}))}
              />
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
