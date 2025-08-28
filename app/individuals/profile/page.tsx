
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { UserCircleIcon, InformationCircleIcon, ArrowPathIcon, HeartIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import CreatePostModal from "../../../components/CreatePostModal";
import PageShell from "../../../components/PageShell";
import { db } from "../../../src/lib/firebase";

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
  const [commentInputs, setCommentInputs] = useState<Record<number,string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<number,boolean>>({});
  const [searchValue, setSearchValue] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const updatesPanelRef = useRef<HTMLDivElement>(null);

  const filteredUpdates = useMemo(() => {
    let arr: any[] = Array.isArray(individual?.updates) ? [...individual.updates] : [];
    if (searchValue.trim()) {
      const q = searchValue.toLowerCase();
      arr = arr.filter(u => (u.text||'').toLowerCase().includes(q) || (u.title||'').toLowerCase().includes(q));
    }
    if (tagFilter) arr = arr.filter(u => Array.isArray(u.tags) && u.tags.includes(tagFilter));
    return arr;
  }, [individual?.updates, searchValue, tagFilter]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if(!code) return;
      setLoading(true); setError("");
      try {
        const qRef = query(collection(db, "individuals"), where("individualId", "==", code));
        const snap = await getDocs(qRef);
        if (snap.empty) { if(!cancelled){ setError("No individual found for this code."); setIndividual(null);} return; }
        const raw: any = { id: snap.docs[0].id, ...snap.docs[0].data() };
        const patch: any = {};
        if(!Array.isArray(raw.updates)){ raw.updates=[]; patch.updates=[]; }
        if(!Array.isArray(raw.prayerRequests)){ raw.prayerRequests=[]; patch.prayerRequests=[]; }
        if(!Array.isArray(raw.financeSummary)){ raw.financeSummary=[]; patch.financeSummary=[]; }
        if(Object.keys(patch).length){ await updateDoc(doc(db, "individuals", raw.id), patch).catch(()=>{}); }
        if(!cancelled) setIndividual(raw);
      } catch(e:any) { if(!cancelled) setError(e.message || "Failed to load profile"); }
      finally { if(!cancelled) setLoading(false); }
    }
    load();
    return ()=>{cancelled=true};
  }, [code]);

  async function submitComment(i: number) {
    setCommentSubmitting(s=>({...s,[i]:true}));
    try {
      const auth = getAuth();
      const user = auth.currentUser; if(!user) throw new Error("Sign in required");
      const qRef = query(collection(db, "individuals"), where("individualId", "==", code));
      const snap = await getDocs(qRef); if(snap.empty) throw new Error("Profile not found");
      const ref = doc(db, "individuals", snap.docs[0].id);
      const data = snap.docs[0].data();
      const updates:any[] = Array.isArray(data.updates)? [...data.updates] : [];
      if(!updates[i]) throw new Error("Update missing");
      const newComment = { text: commentInputs[i]||'', author: (user.displayName || user.email || user.uid), createdAt: new Date().toISOString() };
      updates[i].comments = Array.isArray(updates[i].comments)? [...updates[i].comments, newComment] : [newComment];
      await updateDoc(ref,{updates});
  setIndividual((prev:any)=>({...prev, updates}));
      setCommentInputs(prev=>({...prev,[i]:''}));
    } catch(e) { /* silent */ } finally { setCommentSubmitting(s=>({...s,[i]:false})); }
  }

  const tabs: { id: string; label: string; icon: any }[] = [
    { id: 'hero', label: 'Hero', icon: UserCircleIcon },
    { id: 'about', label: 'About', icon: InformationCircleIcon },
    { id: 'updates', label: 'Updates', icon: ArrowPathIcon },
    { id: 'prayer', label: 'Prayer', icon: HeartIcon },
    { id: 'finance', label: 'Finance', icon: CurrencyDollarIcon },
  ];

  return (
    <PageShell title={<span>{individual?.name || 'Profile'}</span>} contentClassName="p-6">
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
            {activeTab==='hero' && (
              <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm text-brand-dark">Identity and key info will appear here.</div>
            )}
            {activeTab==='about' && (
              <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm text-brand-dark">Story/About content will appear here.</div>
            )}
            {activeTab==='updates' && (
              <div ref={updatesPanelRef} className="flex flex-col lg:flex-row gap-8">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-lg">Updates</h2>
                    <button onClick={()=>setShowPostModal(true)} className="inline-flex items-center gap-1 px-3 py-2 rounded bg-brand-main text-white text-sm font-semibold hover:bg-brand-dark">
                      + New
                    </button>
                  </div>
                  <div className="mb-4 lg:hidden">
                    <SidebarSearchTags updates={individual.updates} searchValue={searchValue} setSearchValue={setSearchValue} tagFilter={tagFilter} setTagFilter={setTagFilter} />
                  </div>
                  {filteredUpdates.length ? (
                    <ul className="space-y-4">
                      {filteredUpdates.map((u:any,i:number)=>(
                        <li key={i} className="bg-white rounded-xl border border-brand-main/10 p-4 shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {u.authorPhotoUrl ? <img src={u.authorPhotoUrl} alt="avatar" className="w-8 h-8 rounded-full border object-cover" /> : <div className="w-8 h-8 rounded-full bg-brand-main/20 flex items-center justify-center text-brand-main font-bold">{(u.author||'U')[0]}</div>}
                              <span className="text-sm font-semibold text-brand-main">{u.author || 'Unknown'}</span>
                            </div>
                            <span className="text-xs text-gray-500">{u.createdAt? new Date(u.createdAt).toLocaleString():''}</span>
                          </div>
                          {u.title && <div className="font-semibold mb-1">{u.title}</div>}
                          {Array.isArray(u.images) && u.images.length>0 && <div className="mb-3"><img src={u.images[0]} alt="update" className="w-full rounded border object-cover" /></div>}
                          <div className="text-sm text-brand-dark whitespace-pre-wrap">{u.text}</div>
                          {Array.isArray(u.tags) && u.tags.length>0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {u.tags.map((t:string,ti:number)=>(<span key={ti} onClick={()=>setTagFilter(tagFilter===t?'':t)} className={`px-2 py-1 rounded-full text-xs cursor-pointer bg-brand-main/10 text-brand-main hover:bg-brand-main/20 ${tagFilter===t?'ring-2 ring-brand-main':''}`}>#{t}</span>))}
                            </div>
                          )}
                          <div className="mt-3 flex gap-4 text-sm">
                            <button className="text-brand-main hover:text-brand-dark flex items-center gap-1">🙏 {u.reactions?.pray ?? 0}</button>
                            <button className="text-brand-main hover:text-brand-dark flex items-center gap-1">❤️ {u.reactions?.love ?? 0}</button>
                          </div>
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
                        </li>
                      ))}
                    </ul>
                  ) : <div className="text-gray-400 italic">No updates yet.</div>}
                </div>
                <div className="w-full lg:w-72 lg:ml-4 flex-shrink-0 hidden lg:block">
                  <SidebarSearchTags updates={individual.updates} searchValue={searchValue} setSearchValue={setSearchValue} tagFilter={tagFilter} setTagFilter={setTagFilter} />
                </div>
                {showPostModal && <CreatePostModal open={showPostModal} onClose={()=>setShowPostModal(false)} individualId={code} onPostCreated={(nu:any)=> setIndividual((prev:any)=>({...prev, updates:[nu, ...(prev?.updates||[])]}))} />}
              </div>
            )}
            {activeTab==='prayer' && (
              <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm">
                <h2 className="font-bold mb-4">Prayer / Requests</h2>
                {Array.isArray(individual.prayerRequests) && individual.prayerRequests.length ? (
                  <ul className="space-y-2">{individual.prayerRequests.map((p:any,i:number)=>(<li key={i} className="bg-brand-main/5 rounded p-3 border border-brand-main/10 text-sm">{p}</li>))}</ul>
                ) : <div className="text-gray-400 italic">No prayer requests yet.</div>}
              </div>
            )}
            {activeTab==='finance' && (
              <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm">
                <h2 className="font-bold mb-4">Finance Summary</h2>
                {Array.isArray(individual.financeSummary) && individual.financeSummary.length ? (
                  <ul className="space-y-2">{individual.financeSummary.map((f:any,i:number)=>(<li key={i} className="bg-brand-main/5 rounded p-3 border border-brand-main/10 text-sm">{f}</li>))}</ul>
                ) : <div className="text-gray-400 italic">No finance summary yet.</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
