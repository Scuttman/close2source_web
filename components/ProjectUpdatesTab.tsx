"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc, runTransaction, updateDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';
import CreateProjectUpdateModal from './CreateProjectUpdateModal';

interface Props {
  project: any;
  setProject: React.Dispatch<React.SetStateAction<any>>;
  projectId: string;
  currentUser: any;
}

export default function ProjectUpdatesTab({ project, setProject, projectId, currentUser }: Props){
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
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const updatesPanelRef = useRef<HTMLDivElement>(null);

  const filteredUpdates = useMemo(()=>{
    let arr: any[] = Array.isArray(project?.updates) ? [...project.updates] : [];
    if (searchValue.trim()) {
      const q = searchValue.toLowerCase();
      arr = arr.filter(u => (u.text||'').toLowerCase().includes(q) || (u.title||'').toLowerCase().includes(q));
    }
    if (tagFilter) arr = arr.filter(u => Array.isArray(u.tags) && u.tags.includes(tagFilter));
    return arr;
  },[project?.updates, searchValue, tagFilter]);

  async function submitComment(i: number) {
    setCommentSubmitting(s=>({...s,[i]:true}));
    try {
      const user = currentUser; if(!user) throw new Error("Sign in required");
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

  async function toggleReaction(i: number, type: 'love' | 'pray') {
    const user = currentUser; if(!user) { alert('Sign in required'); return; }
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
        if(existing >= 0) { arr.splice(existing,1); } else { arr.push(user.uid); }
        reactionUsers[type] = arr;
        u.reactionUsers = reactionUsers;
        const legacy = { ...(u.reactions||{}) };
        legacy[type] = arr.length;
        u.reactions = legacy;
        updates[i] = u;
        tx.update(ref,{ updates });
        setProject((prev:any) => ({ ...prev, updates }));
      });
    } catch(e:any){ /* silent */ }
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
    const user = currentUser; if(!user) { alert('Sign in required'); return; }
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

  function SidebarSearchTags(){
    const allTags = useMemo(()=>{
      const s = new Set<string>();
      (project?.updates||[]).forEach((u:any)=> Array.isArray(u.tags) && u.tags.forEach((t:string)=> s.add(t)));
      return Array.from(s).sort();
    },[project?.updates]);
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

  const uid = currentUser?.uid;

  return (
    <div ref={updatesPanelRef} className="flex flex-col lg:flex-row gap-8">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
          <h2 className="font-bold text-lg">Updates</h2>
          <button onClick={()=>setShowUpdateModal(true)} className="inline-flex items-center gap-1 px-3 py-2 rounded bg-brand-main text-white text-sm font-semibold hover:bg-brand-dark">+ New</button>
        </div>
        <div className="mb-4 lg:hidden">
          <SidebarSearchTags />
        </div>
        {filteredUpdates.length ? (
          <ul className="space-y-4">
            {filteredUpdates.map((u:any,i:number)=> {
              const currentAuthorId = uid;
              const canEdit = !!currentAuthorId && (
                (u.authorUid && u.authorUid === currentAuthorId) ||
                (!u.authorUid && u.author && [currentUser?.displayName, currentUser?.email, currentUser?.uid].filter(Boolean).includes(u.author))
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
        <SidebarSearchTags />
      </div>
      {showUpdateModal && <CreateProjectUpdateModal open={showUpdateModal} onClose={()=>setShowUpdateModal(false)} projectDocId={projectId} onPostCreated={(nu:any)=> setProject((prev:any)=>({...prev, updates:[nu, ...(prev?.updates||[])]}))} />}
    </div>
  );
}
