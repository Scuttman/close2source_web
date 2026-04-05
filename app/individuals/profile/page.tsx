
"use client";

import { Suspense } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getIndividualByCode, updateIndividual, subscribeIndividual, fieldDelete } from '@/lib/dal';
import { getAuth } from "firebase/auth";
import { MapPinIcon, BuildingOfficeIcon, UserGroupIcon, SparklesIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import CreatePostModal from "../../../components/CreatePostModal";
import IndividualAIReviewModal from "../../../components/IndividualAIReviewModal";
import { generateIndividualPDF } from '../../../src/lib/pdfGenerator';
import PageShell from "../../../components/PageShell";
import ProfileLoadingShell from "../../../components/ProfileLoadingShell";
import IndividualOverviewTab from "../../../components/IndividualOverviewTab";
import IndividualAboutTab from "../../../components/IndividualAboutTab";
import IndividualUpdatesTab from "../../../components/IndividualUpdatesTab";
import IndividualPrayerTab from "../../../components/IndividualPrayerTab";
import IndividualFinanceTab from "../../../components/IndividualFinanceTab";
import ProfilePinGate from "../../../components/ProfilePinGate";
import IndividualNewslettersSection from "../../../components/IndividualNewslettersSection";
import IndividualSettingsTab from "../../../components/IndividualSettingsTab";
import IndividualProjectsSection from "../../../components/IndividualProjectsSection";

function ProfilePageInner() {
  const searchParams = useSearchParams();
  const code = searchParams.get("id") || "";
  const [individual, setIndividual] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPostModal, setShowPostModal] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  // const [role, setRole] = useState<'owner'|'representative'|'supporter'|'public'>('public'); // TODO: tab permissions
  const [userUid, setUserUid] = useState<string|undefined>(undefined);
  const [editMode, setEditMode] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<number,string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<number,boolean>>({});
  const [searchValue, setSearchValue] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [showAIReview, setShowAIReview] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false); // For PIN gate

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
        const result = await getIndividualByCode(code);
        if(!result){ if(!cancelled){ setError("No individual found for this code."); setIndividual(null);} return; }
        const raw: any = { ...result };
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
        if(Object.keys(patch).length){ await updateIndividual(raw.id, patch as any).catch(()=>{}); }
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
          updateIndividual(raw.id, { profilePosts: posts, updates: fieldDelete(), prayerRequests: fieldDelete(), fundingNeeds: fieldDelete(), feed: fieldDelete() } as any).catch(()=>{});
        }
        setIndividual(raw);
        const auth = getAuth();
        const u = auth.currentUser;
        const ownerId = raw.ownerId || raw.ownerUID || raw.owner || raw.userId;
        setIsOwner(!!u && !!ownerId && u.uid===ownerId);
        
        // Check PIN authorization
        const requiresPin = !!raw.accessPin;
        const userIsOwner = !!u && !!ownerId && u.uid===ownerId;
        const userIsAuthorized = u && Array.isArray(raw.authorizedViewers) && raw.authorizedViewers.includes(u.uid);
        setIsAuthorized(!requiresPin || userIsOwner || userIsAuthorized);
        
        // if(u) setRole(computeRole(u, raw)); // TODO: tab permissions
        // Start real-time listener on the doc
        unsub = subscribeIndividual(raw.id, (liveData) => {
          if(!liveData) return;
          const live: any = { ...liveData };
          
          // Check PIN authorization on live updates
          const authNow = getAuth();
          const uNow = authNow.currentUser;
          const liveOwnerId = live.ownerId || live.ownerUID || live.owner || live.userId;
          const requiresPin = !!live.accessPin;
          const userIsOwner = !!uNow && !!liveOwnerId && uNow.uid===liveOwnerId;
          const userIsAuthorized = uNow && Array.isArray(live.authorizedViewers) && live.authorizedViewers.includes(uNow.uid);
          setIsAuthorized(!requiresPin || userIsOwner || userIsAuthorized);
          
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
            updateIndividual(raw.id, { profilePosts: posts, updates: fieldDelete(), prayerRequests: fieldDelete(), fundingNeeds: fieldDelete(), feed: fieldDelete() } as any).catch(()=>{});
          }
          setIndividual((prev:any) => ({ ...prev, ...live }));
          // Reuse authNow and uNow from above
          if(uNow){
            // setRole(computeRole(uNow, live)); // TODO: tab permissions
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
        
        // Re-check PIN authorization when auth state changes
        const requiresPin = !!individual.accessPin;
        const userIsOwner = !!u && !!ownerId && u.uid===ownerId;
        const userIsAuthorized = u && Array.isArray(individual.authorizedViewers) && individual.authorizedViewers.includes(u.uid);
        setIsAuthorized(!requiresPin || userIsOwner || userIsAuthorized);
        
        // if(u){ setRole(computeRole(u, individual)); } else { setRole('public'); } // TODO: tab permissions
      }
    });
    return ()=>unsub();
  }, [individual]);

  async function claimOwnership(){
    if(!individual) return;
    const auth = getAuth();
    const u = auth.currentUser; if(!u) return;
    try {
      await updateIndividual(individual.id, { ownerId: u.uid } as any);
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
  const updates:any[] = Array.isArray(individual.updates)? [...individual.updates] : [];
  if(!updates[i]) throw new Error("Update missing");
      const newComment = { text: commentInputs[i]||'', author: (user.displayName || user.email || user.uid), createdAt: new Date().toISOString() };
      updates[i].comments = Array.isArray(updates[i].comments)? [...updates[i].comments, newComment] : [newComment];
      await updateIndividual(individual.id, { updates } as any);
  // optimistic local update (snapshot listener will reconcile if needed)
  setIndividual((prev:any)=> prev? ({...prev, updates}): prev);
      setCommentInputs(prev=>({...prev,[i]:''}));
    } catch(e) { /* silent */ } finally { setCommentSubmitting(s=>({...s,[i]:false})); }
  }

  /* TODO: re-enable tab permissions
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
    if(role==='owner') return editMode;
    return true;
  };

  const settingsAllowedForRep = !!individual?.settingsAllowRepresentative;
  */

  const profileCode = individual?.individualId || individual?.code || code || '';
  
  // PIN Gate Check
  if (!loading && individual && individual.accessPin && !isAuthorized) {
    return (
      <ProfilePinGate
        individualId={individual.id}
        correctPin={individual.accessPin}
        currentUserUid={userUid || null}
        onSuccess={() => setIsAuthorized(true)}
      />
    );
  }
  
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
        <>
          <button
            onClick={() => {
              generateIndividualPDF({
                name: individual.name,
                individualId: individual.individualId || individual.code || code,
                bio: individual.bio,
                serviceLocation: individual.serviceLocation,
                organization: individual.organization,
                vision: individual.vision,
                story: individual.story,
                ministryDescription: individual.ministryDescription,
                focusAreas: individual.focusAreas,
                isFamily: individual.isFamily,
                yearsInService: individual.yearsInService
              });
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold border transition bg-white/10 text-white border-white/30 hover:bg-white/20"
            title="Download PDF"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
          <button
            onClick={() => setShowAIReview(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold border transition bg-white/10 text-white border-white/30 hover:bg-white/20"
            title="AI Review"
          >
            <SparklesIcon className="w-4 h-4" />
            <span>AI Review</span>
          </button>
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
        </>
      )}
    </div>
  );

  return (
    <PageShell
      title={<span>{individual?.name || 'Profile'}</span>}
      contentClassName="p-6"
      headerRight={headerRight}
    >
      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] select-none">
          <div className="w-full max-w-2xl animate-pulse mb-8 px-4">
            <div className="h-36 bg-gray-200 rounded-xl mb-4"></div>
            <div className="flex gap-4 items-start">
              <div className="w-16 h-16 bg-gray-300 rounded-lg shrink-0"></div>
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-5 bg-gray-200 rounded-full w-2/3"></div>
                <div className="h-4 bg-gray-100 rounded-full w-1/2"></div>
              </div>
            </div>
          </div>
          <div className="relative mb-4">
            <div className="w-12 h-12 rounded-full border-4 border-gray-200"></div>
            <div className="w-12 h-12 rounded-full border-4 border-t-orange-500 border-r-transparent border-b-transparent border-l-transparent animate-spin absolute inset-0"></div>
          </div>
          <p className="text-sm text-gray-400 tracking-wide">Loading&hellip;</p>
        </div>
      )}
      {error && <div className="text-red-600 text-sm mb-3">{error}</div>}
      {!loading && !error && !individual && <div className="text-gray-500">Not found.</div>}
      {!loading && individual && (
        <div className="space-y-0">

          {/* Hero Header */}
          <div className="relative w-[calc(100%+3rem)] md:w-[calc(100%+4rem)] -ml-6 md:-ml-8" style={{ marginTop: '-2rem' }}>
            {/* Background */}
            <div className="absolute inset-0 bg-gray-900 overflow-hidden">
              {individual.coverPhotoUrl ? (
                <>
                  <img
                    src={individual.coverPhotoUrl}
                    alt={individual.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20"></div>
                </>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-orange-900 via-orange-700 to-amber-900 opacity-90"></div>
              )}
            </div>

            {/* Profile Photo – top right */}
            {individual.photoURL && (
              <div className="absolute top-10 right-[2.7rem] z-20">
                <img
                  src={individual.photoURL}
                  alt={individual.name}
                  className="h-24 w-24 object-cover rounded-full border-4 border-white shadow-2xl"
                />
              </div>
            )}

            {/* Individual Code – bottom right */}
            {profileCode && (
              <div className="absolute bottom-10 right-[2.7rem] z-20">
                <div className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                  <span className="text-2xl font-mono font-bold text-white">{profileCode}</span>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="relative py-12 md:py-20 px-8">
              <div className="max-w-4xl">
                {/* Type label */}
                <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                  {individual.isFamily
                    ? <UserGroupIcon className="w-4 h-4 text-white" />
                    : <BuildingOfficeIcon className="w-4 h-4 text-white" />}
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">
                    {individual.isFamily ? 'Family' : 'Individual'} Profile
                  </span>
                </div>

                {/* Name */}
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
                  {individual.name}
                </h1>

                {/* Info badges */}
                <div className="flex flex-wrap items-center gap-3 text-white/90">
                  {individual.serviceLocation && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                      <MapPinIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">{individual.serviceLocation}</span>
                    </div>
                  )}
                  {individual.organization && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                      <BuildingOfficeIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">{individual.organization}</span>
                    </div>
                  )}
                  {individual.yearsInService && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
                      <span className="text-sm font-medium">{individual.yearsInService} years in service</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Black border line */}
          <div className="w-[calc(100%+3rem)] md:w-[calc(100%+4rem)] -ml-6 md:-ml-8 h-[2px] bg-black"></div>

          {/* Sections */}
          <div className="space-y-8 pt-8">
            {/* canViewTab/canEditTab disabled – TODO: re-enable with permissions */}
            <IndividualOverviewTab individual={individual} canEdit={isOwner && editMode} />
            <IndividualAboutTab individual={individual} canEdit={isOwner && editMode} />
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
            <IndividualPrayerTab
              individual={individual}
              onUpdate={(next)=> setIndividual((prev:any)=>({...prev, prayerRequests: next, feed: (()=>{ const updates = prev?.updates||[]; const feedParts=[...updates.map((u:any)=>({type:'update', ...u})), ...next.map((p:any)=>({type:'prayer', ...p}))]; feedParts.sort((a,b)=> new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime()); return feedParts; })()}))}
              onUpdatesChange={(updates)=> setIndividual((prev:any)=>({...prev, updates, feed: (()=>{ const prayers = prev?.prayerRequests||[]; const feedParts=[...updates.map((u:any)=>({type:'update', ...u})), ...prayers.map((p:any)=>({type:'prayer', ...p}))]; feedParts.sort((a,b)=> new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime()); return feedParts; })()}))}
              readOnly={!(isOwner && editMode)}
            />
            <IndividualFinanceTab
              individual={individual}
              onUpdate={({ fundingNeeds, givingLinks })=> setIndividual((prev:any)=>({
                ...prev,
                fundingNeeds,
                givingLinks
              }))}
              readOnly={!(isOwner && editMode)}
            />
            {individual.ownerUid && (
              <IndividualProjectsSection
                ownerUid={individual.ownerUid}
                isOwner={isOwner}
                currentUser={userUid ? { uid: userUid } : null}
              />
            )}
            
            <IndividualNewslettersSection
              individual={individual}
              canEdit={isOwner}
            />

            {isOwner && (
              <IndividualSettingsTab
                individual={individual}
                isOwner={isOwner}
                onUpdate={(partial)=> setIndividual((prev:any)=>({...prev, ...partial}))}
              />
            )}
          </div>

        </div>
      )}
      
      {showAIReview && individual && (
        <IndividualAIReviewModal
          isOpen={showAIReview}
          onClose={() => setShowAIReview(false)}
          individualId={individual.id}
          currentData={{
            name: individual.name,
            bio: individual.bio,
            story: individual.story,
            vision: individual.vision,
            serviceLocation: individual.serviceLocation,
            organization: individual.organization,
            ministryDescription: individual.ministryDescription,
            focusAreas: individual.focusAreas,
            isFamily: individual.isFamily,
            yearsInService: individual.yearsInService,
          }}
          onUpdate={(updatedData) => {
            setIndividual((prev: any) => ({ ...prev, ...updatedData }));
          }}
        />
      )}
    </PageShell>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-main" />
      </div>
    }>
      <ProfilePageInner />
    </Suspense>
  );
}
