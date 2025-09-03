"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import ImageUploadGrid, { ImageUploadEntry } from './ImageUploadGrid';
import { storage } from '../src/lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, runTransaction, updateDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';

interface Props {
  project: any;
  setProject: React.Dispatch<React.SetStateAction<any>>;
  projectId: string;
  currentUser: any;
  allowEdit?: boolean;
}

export default function ProjectUpdatesTab({ project, setProject, projectId, currentUser, allowEdit=false }: Props){
  const [searchValue, setSearchValue] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  // commentInputs keyed by pattern: `${updateIndex}:root` for new top-level, `${updateIndex}:c:${commentId}` for replies, `${updateIndex}:edit:${commentId}` for editing
  const [commentInputs, setCommentInputs] = useState<Record<string,string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string,boolean>>({});
  const [replyingTo, setReplyingTo] = useState<{ updateIndex:number; commentId:string }|null>(null);
  const [editingComment, setEditingComment] = useState<{ updateIndex:number; commentId:string; parentId?:string }|null>(null);
  const [reactionSubmitting, setReactionSubmitting] = useState<Record<string,boolean>>({});
  const [editingIndex, setEditingIndex] = useState<number|null>(null);
  const [editDraftTitle, setEditDraftTitle] = useState("");
  const [editDraftText, setEditDraftText] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const updatesPanelRef = useRef<HTMLDivElement>(null);

  // Lightbox state
  const [lightboxImages, setLightboxImages] = useState<string[]|null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  function openLightbox(imgs:string[], index:number){
    if(!Array.isArray(imgs) || !imgs.length) return;
    setLightboxImages(imgs);
    setLightboxIndex(Math.max(0, Math.min(index, imgs.length-1)));
  }
  function closeLightbox(){ setLightboxImages(null); setLightboxIndex(0); }
  function stepLightbox(delta:number){ if(!lightboxImages) return; setLightboxIndex(i=> (i+delta+lightboxImages.length)%lightboxImages.length); }

  useEffect(()=>{
    if(!lightboxImages) return; 
    function handler(e:KeyboardEvent){
      if(e.key==='Escape'){ e.preventDefault(); closeLightbox(); }
      else if(e.key==='ArrowRight'){ e.preventDefault(); stepLightbox(1); }
      else if(e.key==='ArrowLeft'){ e.preventDefault(); stepLightbox(-1); }
    }
    window.addEventListener('keydown', handler);
    return ()=> window.removeEventListener('keydown', handler);
  },[lightboxImages]);

  // Lazy image (minimal version)
  const LazyImg: React.FC<{ src:string; alt:string; fill?:boolean; className?:string; onClick?:()=>void; immediate?:boolean }> = ({ src, alt, fill=false, className='', onClick, immediate=false }) => {
    const refDiv = useRef<HTMLDivElement|null>(null);
    const [visible, setVisible] = useState(immediate);
    useEffect(()=>{
      if(visible) return; // already visible or immediate
      const el = refDiv.current; if(!el) return;
      const obs = new IntersectionObserver((entries)=>{
        entries.forEach(en=>{ if(en.isIntersecting){ setVisible(true); obs.disconnect(); } });
      }, { rootMargin: '200px', threshold: 0.01 });
      obs.observe(el);
      return ()=> obs.disconnect();
    },[visible]);
    const baseClass = (className + (onClick? ' cursor-pointer':'')).trim();
    return (
      <div
        ref={refDiv}
        onClick={onClick}
        className={fill? (`w-full h-full ${baseClass}`).trim() : baseClass}
        style={{ position: fill? 'relative': undefined }}
      >
        {visible ? (
          <Image
            src={src}
            alt={alt}
            fill={fill || undefined}
            width={fill? undefined: 800}
            height={fill? undefined: 600}
            className={fill? 'object-cover w-full h-full':'object-cover w-full h-full'}
            sizes="(max-width:768px) 100vw, 50vw"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full relative overflow-hidden rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
        )}
      </div>
    );
  };

  function renderImages(images:any[]){
    const valid = (images||[]) 
      .map((v:any)=> typeof v==='string'? v.trim(): (v && typeof v==='object' && typeof v.url==='string'? v.url.trim(): ''))
      .filter(u=> u && /^(https?:)?\/\//.test(u));
    if(!valid.length) return null;
    const count = valid.length;
    if(count===1){
      return (
        <div className="mb-3 relative" onClick={()=>openLightbox(valid,0)}>
          <LazyImg src={valid[0]} alt="update image" className="w-full h-auto rounded border overflow-hidden" />
        </div>
      );
    }
    if(count===2){
      return (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {valid.map((src,idx)=>(
            <div key={idx} className="relative h-48 rounded overflow-hidden bg-gray-100" onClick={()=>openLightbox(valid,idx)}>
              <LazyImg src={src} alt={`update image ${idx+1}`} fill />
            </div>
          ))}
        </div>
      );
    }
    if(count===3){
      return (
        <div className="mb-3 grid grid-cols-3 gap-2 h-56">
          <div className="col-span-2 row-span-2 relative rounded overflow-hidden" onClick={()=>openLightbox(valid,0)}>
            <LazyImg src={valid[0]} alt="update image 1" fill />
          </div>
          <div className="col-span-1 relative rounded overflow-hidden" onClick={()=>openLightbox(valid,1)}>
            <LazyImg src={valid[1]} alt="update image 2" fill />
          </div>
          <div className="col-span-1 relative rounded overflow-hidden" onClick={()=>openLightbox(valid,2)}>
            <LazyImg src={valid[2]} alt="update image 3" fill />
          </div>
        </div>
      );
    }
    if(count===4){
      return (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {valid.map((src,idx)=>(
            <div key={idx} className="relative aspect-video rounded overflow-hidden" onClick={()=>openLightbox(valid,idx)}>
              <LazyImg src={src} alt={`update image ${idx+1}`} fill />
            </div>
          ))}
        </div>
      );
    }
    if(count===5){
      return (
        <div className="mb-3 grid grid-cols-3 gap-2 h-60">
          <div className="col-span-2 row-span-2 relative rounded overflow-hidden" onClick={()=>openLightbox(valid,0)}>
            <LazyImg src={valid[0]} alt="update image 1" fill />
          </div>
          {valid.slice(1).map((src,idx)=>(
            <div key={idx+1} className="relative rounded overflow-hidden h-28" onClick={()=>openLightbox(valid,idx+1)}>
              <LazyImg src={src} alt={`update image ${idx+2}`} fill />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="mb-3 grid grid-cols-3 gap-2 h-60">
        <div className="col-span-2 row-span-2 relative rounded overflow-hidden" onClick={()=>openLightbox(valid,0)}>
          <LazyImg src={valid[0]} alt="update image 1" fill />
        </div>
        {valid.slice(1,5).map((src,idx)=>(
          <div key={idx+1} className="relative rounded overflow-hidden h-28" onClick={()=>openLightbox(valid,idx+1)}>
            <LazyImg src={src} alt={`update image ${idx+2}`} fill />
            {idx===3 && (valid.length-5)>0 && (
              <button onClick={(e)=>{e.stopPropagation(); openLightbox(valid,0);}} className="absolute inset-0 bg-black/50 text-white text-xl font-semibold flex items-center justify-center">+{valid.length-5}</button>
            )}
          </div>
        ))}
      </div>
    );
  }

  const Slideshow: React.FC<{ images:any[] }>= ({ images }) => {
    // Sanitize to string URLs (handles objects with .url like individual tab)
    const imgs = (images||[])
      .map((v:any)=> typeof v==='string'? v.trim(): (v && typeof v==='object' && typeof v.url==='string'? v.url.trim(): ''))
      .filter(u=> u && /^(https?:)?\/\//.test(u));
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    useEffect(()=>{ if(paused || imgs.length<=1) return; const id = setInterval(()=> setIndex(i=> (i+1)%imgs.length), 3000); return ()=> clearInterval(id); },[paused, imgs.length]);
    useEffect(()=>{ if(index>=imgs.length) setIndex(0); },[imgs.length,index]);
    if(!imgs.length) return null;
    return (
      <div className="mb-3 group relative rounded-xl overflow-hidden border bg-black/5" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)}>
        <div className="relative w-full aspect-video bg-gray-100">
          {imgs.map((src,i)=>(
            <div key={i} className={`absolute inset-0 transition-opacity duration-700 ${i===index? 'opacity-100':'opacity-0'} flex items-center justify-center bg-black/5`}>
              <LazyImg src={src} alt={'slide '+(i+1)} fill immediate={i===0} />
            </div>
          ))}
          <button type="button" aria-label="Open image in lightbox" onClick={(e)=>{e.stopPropagation(); openLightbox(imgs,index);}} className="absolute top-2 right-2 bg-black/45 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition">&#128269;</button>
          <button type="button" aria-label="Previous" onClick={(e)=>{e.stopPropagation(); setIndex(i=> (i-1+imgs.length)%imgs.length);}} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition">‹</button>
          <button type="button" aria-label="Next" onClick={(e)=>{e.stopPropagation(); setIndex(i=> (i+1)%imgs.length);}} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition">›</button>
          <button type="button" aria-label={paused? 'Play slideshow':'Pause slideshow'} onClick={(e)=>{e.stopPropagation(); setPaused(p=>!p);}} className="absolute bottom-2 right-2 bg-black/40 hover:bg-black/60 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition">{paused? 'Play':'Pause'}</button>
          <div className="absolute bottom-2 left-2 flex gap-1">
            {imgs.map((_,i)=>(
              <button key={i} aria-label={`Go to slide ${i+1}`} onClick={(e)=>{e.stopPropagation(); setIndex(i);}} className={`w-2 h-2 rounded-full ${i===index? 'bg-white':'bg-white/40 hover:bg-white/70'}`} />
            ))}
          </div>
        </div>
      </div>
    );
  };

  const filteredUpdates = useMemo(()=>{
    let arr:any[] = Array.isArray(project?.updates)? project.updates : [];
    if(searchValue.trim()){
      const q = searchValue.toLowerCase();
      arr = arr.filter(u=> (u.text||'').toLowerCase().includes(q) || (u.title||'').toLowerCase().includes(q));
    }
    if(tagFilter) arr = arr.filter(u=> Array.isArray(u.tags) && u.tags.includes(tagFilter));
    return arr;
  },[project?.updates, searchValue, tagFilter]);

  function ensureArray(v:any){ return Array.isArray(v)? v: []; }

  function randomId(){
    if(typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID();
    return Math.random().toString(36).slice(2,11);
  }

  // Ensure each update has a unique updateId to prevent React key collisions.
  useEffect(()=>{
    if(!Array.isArray(project?.updates) || !projectId) return;
    const seen = new Set<string>();
    let changed = false;
    const normalized = project.updates.map((u:any)=>{
      let id = u.updateId;
      if(!id || seen.has(id)) { id = `${Date.now()}_${Math.random().toString(36).slice(2,8)}`; changed = true; return { ...u, updateId: id }; }
      seen.add(id); return u;
    });
    if(changed){
      // Persist once; rely on real-time listener to refresh local state.
      updateDoc(doc(db,'projects',projectId), { updates: normalized }).catch(()=>{});
    }
  },[project?.updates, projectId]);

  async function submitComment(updateIndex:number, parentCommentId?:string){
    const key = parentCommentId? `${updateIndex}:c:${parentCommentId}` : `${updateIndex}:root`;
    setCommentSubmitting(s=> ({ ...s, [key]: true }));
    try {
      const user = currentUser; if(!user) throw new Error('Sign in required');
      const ref = doc(db,'projects',projectId);
      await runTransaction(db, async(tx)=>{
        const snap = await tx.get(ref); if(!snap.exists()) throw new Error('Project not found');
        const data:any = snap.data();
        const updates:any[] = ensureArray(data.updates).map(u=> ({ ...u }));
        const update = updates[updateIndex]; if(!update) throw new Error('Update missing');
        update.comments = ensureArray(update.comments);
        const normalize = (arr:any[] = []): any[] => arr.map(c=> ({ id: c.id || randomId(), authorUid: c.authorUid, author: c.author, text: c.text, createdAt: c.createdAt, updatedAt: c.updatedAt, replies: Array.isArray(c.replies)? normalize(c.replies): [] }));
        update.comments = normalize(update.comments);
        const text = (commentInputs[key]||'').trim(); if(!text) throw new Error('Empty');
        const newComment = { id: randomId(), text, author: user.displayName || user.email || user.uid, authorUid: user.uid, createdAt: new Date().toISOString(), replies: [] as any[] };
        if(parentCommentId){
          const stack:any[] = [...update.comments]; let parent:any = null;
          while(stack.length){ const node = stack.pop(); if(node.id === parentCommentId){ parent=node; break; } if(Array.isArray(node.replies)) stack.push(...node.replies); }
          if(!parent) throw new Error('Parent missing');
          parent.replies.push(newComment);
        } else {
          update.comments.push(newComment);
        }
        updates[updateIndex] = update; tx.update(ref,{ updates });
      });
      setCommentInputs(p=> ({ ...p, [key]: '' }));
      if(parentCommentId) setReplyingTo(null);
    } catch(e:any){ /* silent */ } finally { setCommentSubmitting(s=> ({ ...s, [key]: false })); }
  }

  async function saveEditedComment(){
    if(!editingComment) return; const { updateIndex, commentId, parentId } = editingComment;
    const key = `${updateIndex}:edit:${commentId}`; setCommentSubmitting(s=> ({ ...s, [key]: true }));
    try {
      const user = currentUser; if(!user) throw new Error('Sign in required');
      const ref = doc(db,'projects',projectId);
      await runTransaction(db, async(tx)=>{
        const snap = await tx.get(ref); if(!snap.exists()) throw new Error('Project not found');
        const data:any = snap.data();
        const updates:any[] = ensureArray(data.updates).map(u=> ({ ...u }));
        const update = updates[updateIndex]; if(!update) throw new Error('Update missing');
        update.comments = ensureArray(update.comments);
        const normalize = (arr:any[] = []): any[] => arr.map(c=> ({ id: c.id || randomId(), authorUid: c.authorUid, author: c.author, text: c.text, createdAt: c.createdAt, updatedAt: c.updatedAt, replies: Array.isArray(c.replies)? normalize(c.replies): [] }));
        update.comments = normalize(update.comments);
        const newText = (commentInputs[key]||'').trim(); if(!newText) throw new Error('Empty');
        // recursive search
        let target:any = null; const stack:any[] = [...update.comments];
        while(stack.length){ const n = stack.pop(); if(n.id===commentId){ target=n; break; } if(Array.isArray(n.replies)) stack.push(...n.replies); }
        if(!target) throw new Error('Comment missing');
        if(target.authorUid && target.authorUid !== user.uid) throw new Error('Not author');
        target.text = newText; target.updatedAt = new Date().toISOString();
        updates[updateIndex] = update; tx.update(ref,{ updates });
      });
      setEditingComment(null); setCommentInputs(p=> ({ ...p, [key]: '' }));
    } catch(e:any){ /* silent */ } finally { setCommentSubmitting(s=> ({ ...s, [key]: false })); }
  }

  async function deleteComment(updateIndex:number, commentId:string, parentId?:string){
    if(!confirm('Delete this comment?')) return; const user = currentUser; if(!user) return;
    const ref = doc(db,'projects',projectId);
    try {
      await runTransaction(db, async(tx)=>{
        const snap = await tx.get(ref); if(!snap.exists()) throw new Error('Project not found');
        const data:any = snap.data();
        const updates:any[] = ensureArray(data.updates).map(u=> ({ ...u }));
        const update = updates[updateIndex]; if(!update) throw new Error('Update missing');
        update.comments = ensureArray(update.comments);
        const normalize = (arr:any[] = []): any[] => arr.map(c=> ({ id: c.id || randomId(), authorUid: c.authorUid, author: c.author, text: c.text, createdAt: c.createdAt, updatedAt: c.updatedAt, replies: Array.isArray(c.replies)? normalize(c.replies): [] }));
        update.comments = normalize(update.comments);
        const identity = new Set([user.uid, user.displayName, user.email].filter(Boolean));
        const canDelete = (c:any)=> c.authorUid? c.authorUid===user.uid : identity.has(c.author);
        if(parentId){
          let parent:any = null; const stack:any[] = [...update.comments];
          while(stack.length){ const node = stack.pop(); if(node.id===parentId){ parent=node; break; } if(Array.isArray(node.replies)) stack.push(...node.replies); }
          if(!parent) throw new Error('Parent missing');
          parent.replies = parent.replies.filter((r:any)=>{ if(r.id===commentId){ if(!canDelete(r)) throw new Error('Not allowed'); return false; } return true; });
        } else {
          const beforeLen = update.comments.length;
          update.comments = update.comments.filter((c:any)=> { if(c.id===commentId){ if(!canDelete(c)) throw new Error('Not allowed'); return false; } return true; });
          if(beforeLen === update.comments.length){
            // try nested
            const walk = (list:any[]) => {
              list.forEach((n:any)=>{
                if(Array.isArray(n.replies) && n.replies.length){
                  n.replies = n.replies.filter((r:any)=> { if(r.id===commentId){ if(!canDelete(r)) throw new Error('Not allowed'); return false; } return true; });
                  walk(n.replies);
                }
              });
            };
            walk(update.comments);
          }
        }
        updates[updateIndex] = update; tx.update(ref,{ updates });
      });
    } catch(e:any){ /* silent */ }
  }

  async function toggleReaction(i: number, type: 'like' | 'love' | 'pray') {
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
  updates[i] = u; tx.update(ref,{ updates });
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
          <h2 className="text-base font-semibold text-brand-main">Updates</h2>
          {allowEdit && (
            <button onClick={()=>setShowComposer(s=>!s)} className="inline-flex items-center gap-1 px-3 py-2 rounded bg-brand-main text-white text-sm font-semibold hover:bg-brand-dark">{showComposer? 'Close':' + New'}</button>
          )}
        </div>
        <div className="mb-4 lg:hidden">
          <SidebarSearchTags />
        </div>
        {/* Mobile inline composer */}
        {showComposer && allowEdit && (
          <div className="mb-6 lg:hidden">
            <InlineProjectComposer projectId={projectId} currentUser={currentUser} onPosted={()=> setShowComposer(false)} />
          </div>
        )}
        {filteredUpdates.length ? (
          <div className="flex flex-col">
          <ul className="space-y-4">
            {filteredUpdates.map((u:any,i:number)=> {
              const originalIndex = Array.isArray(project?.updates) ? project.updates.indexOf(u) : -1;
              if(originalIndex === -1) return null; // safety
              const currentAuthorId = uid;
              const canEdit = !!currentAuthorId && (
                (u.authorUid && u.authorUid === currentAuthorId) ||
                (!u.authorUid && u.author && [currentUser?.displayName, currentUser?.email, currentUser?.uid].filter(Boolean).includes(u.author))
              );
              const isEditing = editingIndex === originalIndex;
              return (
                <li key={u.updateId || originalIndex} className="bg-white rounded-xl border border-brand-main/10 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {u.authorPhotoUrl ? <img src={u.authorPhotoUrl} alt="avatar" className="w-8 h-8 rounded-full border object-cover" /> : <div className="w-8 h-8 rounded-full bg-brand-main/20 flex items-center justify-center text-brand-main font-bold">{(u.author||'U')[0]}</div>}
                      <span className="text-sm font-semibold text-brand-main">{u.author || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{u.createdAt? new Date(u.createdAt).toLocaleString():''}</span>
                      {allowEdit && canEdit && !isEditing && <button onClick={()=>beginEdit(originalIndex,u)} className="text-xs px-2 py-1 rounded border border-brand-main/30 text-brand-main hover:bg-brand-main/10">Edit</button>}
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
                      {Array.isArray(u.images) && u.images.length>0 && (
                        u.slideshow ? <Slideshow images={u.images} /> : renderImages(u.images)
                      )}
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
                        const likeUsers: string[] = u.reactionUsers?.like || [];
                        const loveUsers: string[] = u.reactionUsers?.love || [];
                        const prayUsers: string[] = u.reactionUsers?.pray || [];
                        const likeActive = uid ? likeUsers.includes(uid) : false;
                        const loveActive = uid ? loveUsers.includes(uid) : false;
                        const prayActive = uid ? prayUsers.includes(uid) : false;
                        const likeCount = (likeUsers.length) || (u.reactions?.like ?? 0);
                        const loveCount = (loveUsers.length) || (u.reactions?.love ?? 0);
                        const prayCount = (prayUsers.length) || (u.reactions?.pray ?? 0);
                        return (
                          <>
                            <button
                              type="button"
                              disabled={reactionSubmitting[`${originalIndex}:like`]}
                              onClick={() => toggleReaction(originalIndex,'like')}
                              className={`flex items-center gap-1 px-2 py-1 rounded transition border ${likeActive? 'bg-blue-600 text-white border-blue-600' : 'text-blue-600 border-blue-400/40 hover:bg-blue-50'}`}
                            >
                              👍 <span className="text-xs font-semibold">{likeCount}</span>
                            </button>
                            <button
                              type="button"
                              disabled={reactionSubmitting[`${originalIndex}:love`]}
                              onClick={() => toggleReaction(originalIndex,'love')}
                              className={`flex items-center gap-1 px-2 py-1 rounded transition border ${loveActive? 'bg-pink-500 text-white border-pink-500' : 'text-pink-600 border-pink-400/40 hover:bg-pink-50'}`}
                            >
                              ❤️ <span className="text-xs font-semibold">{loveCount}</span>
                            </button>
                            <button
                              type="button"
                              disabled={reactionSubmitting[`${originalIndex}:pray`]}
                              onClick={() => toggleReaction(originalIndex,'pray')}
                              className={`flex items-center gap-1 px-2 py-1 rounded transition border ${prayActive? 'bg-brand-main text-white border-brand-main' : 'text-brand-main border-brand-main/30 hover:bg-brand-main/10'}`}
                            >
                              🙏 <span className="text-xs font-semibold">{prayCount}</span>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  {!isEditing && (
                    <div className="mt-4">
                      <div className="text-xs font-semibold text-brand-main mb-2">Comments</div>
                      {(!u.comments || u.comments.length===0) && <div className="text-xs text-gray-400 mb-2 italic">No comments yet.</div>}
                      {u.comments && u.comments.length>0 && (
                        <ul className="space-y-3 mb-3">
                          {(u.comments||[]).map((c:any,ci:number)=>{
                            const canEditC = currentUser && (c.authorUid? c.authorUid===currentUser.uid : [currentUser.displayName, currentUser.email, currentUser.uid].filter(Boolean).includes(c.author));
                            const cEditKey = `${originalIndex}:edit:${c.id||ci}`;
                            const isEditingTop = editingComment && editingComment.commentId === (c.id||ci) && !editingComment.parentId && editingComment.updateIndex===originalIndex;
                            return (
                              <li key={c.id||ci} className="flex gap-2 items-start">
                                <div className="w-7 h-7 rounded-full bg-brand-main/20 flex items-center justify-center text-brand-main text-xs font-bold border">{(c.author||'U')[0]}</div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div className="text-xs font-semibold text-brand-main">{c.author||'Unknown'} <span className="text-gray-400 font-normal">{c.createdAt? new Date(c.createdAt).toLocaleString():''}{c.updatedAt && ' (edited)'}</span></div>
                                    <div className="flex gap-1 ml-auto">
                                      {currentUser && <button type="button" onClick={()=> setReplyingTo({ updateIndex:originalIndex, commentId: c.id || ci })} className="text-[10px] px-2 py-0.5 rounded bg-brand-main/10 text-brand-main hover:bg-brand-main/20">Reply</button>}
                                      {canEditC && !isEditingTop && <button type="button" onClick={()=> { setEditingComment({ updateIndex:originalIndex, commentId: c.id || ci }); setCommentInputs(p=>({...p,[cEditKey]: c.text || ''})); }} className="text-[10px] px-2 py-0.5 rounded bg-gray-200 text-gray-600 hover:bg-gray-300">Edit</button>}
                                      {canEditC && <button type="button" onClick={()=> deleteComment(originalIndex, c.id||ci)} className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100">Del</button>}
                                    </div>
                                  </div>
                                  {!isEditingTop && <div className="text-sm text-brand-dark whitespace-pre-wrap">{c.text}</div>}
                                  {isEditingTop && (
                                    <div className="mt-2 space-y-2">
                                      <textarea value={commentInputs[cEditKey]||''} onChange={e=> setCommentInputs(p=>({...p,[cEditKey]: e.target.value}))} className="w-full border rounded px-2 py-1 text-sm min-h-[60px]" />
                                      <div className="flex gap-2">
                                        <button type="button" disabled={commentSubmitting[cEditKey]} onClick={saveEditedComment} className="px-3 py-1 rounded bg-brand-main text-white text-xs font-semibold disabled:opacity-50">Save</button>
                                        <button type="button" onClick={()=> { setEditingComment(null); }} className="px-3 py-1 rounded bg-gray-200 text-gray-700 text-xs font-semibold">Cancel</button>
                                      </div>
                                    </div>
                                  )}
                                  {/* Replies */}
              {Array.isArray(c.replies) && c.replies.length>0 && (
                                    <ul className="mt-3 space-y-3 pl-5 border-l border-brand-main/10">
                                      {c.replies.map((r:any,ri:number)=>{
                                        const canEditR = currentUser && (r.authorUid? r.authorUid===currentUser.uid : [currentUser.displayName, currentUser.email, currentUser.uid].filter(Boolean).includes(r.author));
                const rEditKey = `${originalIndex}:edit:${r.id||ri}`;
                const isEditingR = editingComment && editingComment.commentId === (r.id||ri) && editingComment.parentId === (c.id||ci) && editingComment.updateIndex===originalIndex;
                                        return (
                                          <li key={r.id||ri} className="flex gap-2 items-start">
                                            <div className="w-6 h-6 rounded-full bg-brand-main/10 flex items-center justify-center text-brand-main text-[10px] font-bold border">{(r.author||'U')[0]}</div>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2">
                                                <div className="text-[11px] font-semibold text-brand-main">{r.author||'Unknown'} <span className="text-gray-400 font-normal">{r.createdAt? new Date(r.createdAt).toLocaleString():''}{r.updatedAt && ' (edited)'}</span></div>
                                                <div className="flex gap-1 ml-auto">
                  {currentUser && !isEditingR && <button type="button" onClick={()=> setReplyingTo({ updateIndex:originalIndex, commentId: r.id||ri })} className="text-[9px] px-2 py-0.5 rounded bg-brand-main/10 text-brand-main hover:bg-brand-main/20">Reply</button>}
                  {canEditR && !isEditingR && <button type="button" onClick={()=> { setEditingComment({ updateIndex:originalIndex, commentId: r.id||ri, parentId: c.id||ci }); setCommentInputs(p=>({...p,[rEditKey]: r.text || ''})); }} className="text-[10px] px-2 py-0.5 rounded bg-gray-200 text-gray-600 hover:bg-gray-300">Edit</button>}
                  {canEditR && <button type="button" onClick={()=> deleteComment(originalIndex, r.id||ri, c.id||ci)} className="text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-600 hover:bg-red-100">Del</button>}
                                                </div>
                                              </div>
                                              {!isEditingR && <div className="text-xs text-brand-dark whitespace-pre-wrap">{r.text}</div>}
                                              {isEditingR && (
                                                <div className="mt-2 space-y-2">
                                                  <textarea value={commentInputs[rEditKey]||''} onChange={e=> setCommentInputs(p=>({...p,[rEditKey]: e.target.value}))} className="w-full border rounded px-2 py-1 text-xs min-h-[50px]" />
                                                  <div className="flex gap-2">
                                                    <button type="button" disabled={commentSubmitting[rEditKey]} onClick={saveEditedComment} className="px-3 py-1 rounded bg-brand-main text-white text-[10px] font-semibold disabled:opacity-50">Save</button>
                                                    <button type="button" onClick={()=> { setEditingComment(null); }} className="px-3 py-1 rounded bg-gray-200 text-gray-700 text-[10px] font-semibold">Cancel</button>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                  {/* Reply form */}
                                  {replyingTo && replyingTo.updateIndex===originalIndex && replyingTo.commentId === (c.id||ci) && currentUser && (
                                    <form onSubmit={e=>{ e.preventDefault(); submitComment(originalIndex, c.id||ci); }} className="mt-3 flex gap-2">
                                      <input className="flex-1 border rounded px-2 py-1 text-xs" placeholder="Reply..." value={commentInputs[`${originalIndex}:c:${c.id||ci}`]||''} onChange={e=> setCommentInputs(p=>({...p,[`${originalIndex}:c:${c.id||ci}`]: e.target.value}))} />
                                      <button disabled={commentSubmitting[`${originalIndex}:c:${c.id||ci}`] || !(commentInputs[`${originalIndex}:c:${c.id||ci}`]||'').trim()} className="px-3 py-1 rounded bg-brand-main text-white text-[10px] font-semibold disabled:opacity-50">Post</button>
                                      <button type="button" onClick={()=> setReplyingTo(null)} className="px-3 py-1 rounded bg-gray-200 text-gray-600 text-[10px] font-semibold">Cancel</button>
                                    </form>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {currentUser && (
                        <form onSubmit={e=>{e.preventDefault(); submitComment(originalIndex);}} className="flex gap-2">
                          <input className="flex-1 border rounded px-2 py-1 text-sm" placeholder="Write a comment..." value={commentInputs[`${originalIndex}:root`]||''} onChange={e=>setCommentInputs(prev=>({...prev,[`${originalIndex}:root`]:e.target.value}))} disabled={commentSubmitting[`${originalIndex}:root`]} />
                          <button disabled={commentSubmitting[`${originalIndex}:root`] || !(commentInputs[`${originalIndex}:root`]||'').trim()} className="px-3 py-1 rounded bg-brand-main text-white text-xs font-semibold disabled:opacity-50">Post</button>
                        </form>
                      )}
                      {!currentUser && <div className="text-[11px] text-gray-500">Sign in to comment.</div>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          </div>
        ) : <div className="text-gray-400 italic">No updates yet.</div>}
      </div>
      <div className="w-full lg:w-72 lg:ml-4 flex-shrink-0 hidden lg:block">
        {showComposer && allowEdit && (
          <div className="mb-6"><InlineProjectComposer projectId={projectId} currentUser={currentUser} onPosted={()=> setShowComposer(false)} /></div>
        )}
        <SidebarSearchTags />
      </div>
  {/* Removed modal usage; inline composer replaces it */}
  {/* Lightbox portal */}
  {lightboxImages && typeof document!=='undefined' ? createPortal(
    <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col" aria-modal="true" role="dialog">
      <div className="flex justify-between items-center p-3 sm:p-4 text-white text-xs sm:text-sm">
        <div className="font-medium tracking-wide">{lightboxIndex+1} / {lightboxImages.length}</div>
        <div className="flex gap-2 sm:gap-3">
          <button onClick={()=>stepLightbox(-1)} className="px-2 sm:px-3 py-1 rounded bg-white/20 hover:bg-white/30">Prev</button>
          <button onClick={()=>stepLightbox(1)} className="px-2 sm:px-3 py-1 rounded bg-white/20 hover:bg-white/30">Next</button>
          <button onClick={closeLightbox} className="px-2 sm:px-3 py-1 rounded bg-white/20 hover:bg-white/30">Close</button>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-2 sm:px-6 pb-4" onClick={closeLightbox}>
        <Image src={lightboxImages[lightboxIndex]} alt={'image '+(lightboxIndex+1)} width={1600} height={1200} className="max-h-full max-w-full w-auto h-auto rounded shadow-2xl object-contain" />
      </div>
      <div className="flex gap-1 sm:gap-2 overflow-x-auto px-2 sm:px-4 pb-4 bg-black/60">
        {lightboxImages.map((img,i)=>(
          <button key={i} onClick={(e)=>{e.stopPropagation(); setLightboxIndex(i);}} className={`h-14 w-16 sm:h-16 sm:w-20 flex-shrink-0 rounded overflow-hidden border ${i===lightboxIndex? 'ring-2 ring-white':''}`}>
            <Image src={img} alt={'thumb '+(i+1)} width={160} height={120} className="object-cover w-full h-full" />
          </button>
        ))}
      </div>
    </div>, document.body): null}
    </div>
  );
}

// Inline composer for project updates
function InlineProjectComposer({ projectId, currentUser, onPosted }: { projectId:string; currentUser:any; onPosted:()=>void }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [imageEntries, setImageEntries] = useState<ImageUploadEntry[]>([]);
  const [resetImagesKey, setResetImagesKey] = useState(0);
  const [posting, setPosting] = useState(false);
  const [slideshow, setSlideshow] = useState(false);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  function addTag(){
    const raw = tagInput.trim().toLowerCase().replace(/^[#]+/, '').replace(/[\s,]+$/,'');
    if(!raw) return; if(tags.includes(raw)) { setTagInput(''); return; }
    setTags(prev=> [...prev, raw]); setTagInput('');
  }
  function removeTag(t:string){ setTags(prev=> prev.filter(x=> x!==t)); }

  async function submit(e:React.FormEvent){
    e.preventDefault();
    if(!currentUser || posting) return;
    const doneImages = imageEntries.filter(e=> e.status==='done' && e.url).map(e=> e.url as string);
    if(!text.trim() && doneImages.length===0 && docFiles.length===0) return; // nothing to post
    setPosting(true); setErrorMsg('');
    try {
      // Upload docs first
      const documentEntries:any[] = [];
      for(let i=0;i<docFiles.length;i++){
        const f = docFiles[i];
        const cleanName = f.name.replace(/[^A-Za-z0-9_.-]/g,'_');
        const refDoc = storageRef(storage, `projects/updates/${projectId}/docs/${Date.now()}_${i}_${cleanName}`);
        await uploadBytes(refDoc, f);
        const url = await getDownloadURL(refDoc);
        documentEntries.push({ name: f.name, url, contentType: f.type, size: f.size });
      }
      // Derive imagePaths
      const imagePaths = imageEntries.filter(e=> e.status==='done' && e.url).map(e=>{
        try { if(!e.url) return ''; const u = new URL(e.url); const idx = u.pathname.indexOf('/o/'); if(idx>=0){ return decodeURIComponent(u.pathname.slice(idx+3)); } } catch{} return ''; }).filter(Boolean);
      const newUpdate = {
        updateId: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
        title: title.trim()||undefined,
        text: text.trim(),
        images: doneImages,
        slideshow: slideshow && doneImages.length>1 ? true: false,
        createdAt: new Date().toISOString(),
        author: currentUser.displayName || currentUser.email || currentUser.uid,
        authorPhotoUrl: currentUser.photoURL || null,
        authorUid: currentUser.uid,
        tags,
        documents: documentEntries,
        reactions: { pray:0, love:0 },
        comments: [],
        imagePaths
      };
      const refProject = doc(db,'projects',projectId);
      await runTransaction(db, async(tx)=>{
        const snap = await tx.get(refProject); if(!snap.exists()) throw new Error('Project not found');
        const data:any = snap.data();
        const prev:any[] = Array.isArray(data.updates)? data.updates: [];
        tx.update(refProject, { updates: [newUpdate, ...prev] });
      });
      // Reset
      setTitle(''); setText(''); setTags([]); setTagInput(''); setImageEntries([]); setResetImagesKey(k=>k+1); setSlideshow(false); setDocFiles([]); onPosted();
    } catch(err:any){ setErrorMsg(err.message || 'Failed to post'); }
    finally { setPosting(false); }
  }

  const canPost = !!currentUser && !posting && (text.trim() || imageEntries.some(e=> e.status==='done' && e.url) || docFiles.length>0);
  const doneImageCount = imageEntries.filter(e=> e.status==='done' && e.url).length;
  return (
    <form onSubmit={submit} className="bg-white border border-brand-main/20 rounded-xl p-4 shadow-sm flex flex-col gap-3">
      <div className="text-sm font-semibold text-brand-main">Create Update</div>
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title (optional)" className="border rounded px-2 py-1 text-sm" disabled={posting || !currentUser} />
      <textarea value={text} onChange={e=>setText(e.target.value)} placeholder={currentUser? 'What\'s new?':'Sign in to post'} className="border rounded px-2 py-2 text-sm h-24 resize-none" disabled={posting || !currentUser} />
      <div>
        <input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter' || e.key===',' || e.key==='Tab'){ e.preventDefault(); addTag(); } else if(e.key==='Backspace' && tagInput==='' && tags.length){ e.preventDefault(); setTags(t=>t.slice(0,-1)); } }} placeholder={currentUser? 'Add tag & Enter':'Sign in to add tags'} className="border rounded px-2 py-1 text-xs w-full" disabled={posting || !currentUser} />
        {tags.length>0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map(t=> (
              <span key={t} className="inline-flex items-center gap-1 bg-brand-main/10 text-brand-main text-[11px] font-medium px-2 py-1 rounded-full">#{t}<button type="button" onClick={()=>removeTag(t)} className="ml-1 text-brand-main/70 hover:text-brand-main" aria-label={`Remove tag ${t}`}>×</button></span>
            ))}
          </div>
        )}
      </div>
      <ImageUploadGrid
        disabled={posting || !currentUser}
        maxFiles={8}
        maxWidth={500}
        resetKey={resetImagesKey}
        onChange={setImageEntries}
        pathBuilder={(file, entryId)=> `projects/${projectId}/updates/${currentUser?.uid || 'anon'}/${Date.now()}_${entryId}_${file.name}`}
        addButtonClassName="w-24 h-24 border-2 border-dashed rounded flex items-center justify-center text-gray-400 hover:border-brand-main hover:text-brand-main text-3xl font-light"
        squareSize={96}
      />
      <div className="flex items-center gap-2 text-xs select-none">
        <input id="proj-slideshow" type="checkbox" className="w-4 h-4" checked={slideshow} disabled={posting || !currentUser || doneImageCount<2} onChange={e=> setSlideshow(e.target.checked)} />
        <label htmlFor="proj-slideshow" className={doneImageCount<2? 'text-gray-400':'text-brand-main cursor-pointer'}>Slideshow (2+ images)</label>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1">Attachments (PDF, Word, Excel, PPT)</label>
        <input type="file" multiple disabled={posting || !currentUser} accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={e=>{ const files = Array.from(e.target.files || []); if(!files.length) return; setDocFiles(prev=> [...prev, ...files]); }} />
        {docFiles.length>0 && (
          <ul className="mt-2 space-y-1 text-[11px] max-h-32 overflow-auto pr-1">
            {docFiles.map((f,i)=>(
              <li key={i} className="flex items-center justify-between gap-2 bg-gray-50 border rounded px-2 py-1">
                <span className="truncate">{f.name}</span>
                <button type="button" className="text-red-600 hover:underline" onClick={()=> setDocFiles(prev=> prev.filter((_,idx)=> idx!==i))}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {errorMsg && <div className="text-red-600 text-xs">{errorMsg}</div>}
      <div className="flex gap-2 mt-2">
        <button type="submit" disabled={!canPost} className="flex-1 px-3 py-1.5 rounded bg-brand-main text-white text-sm font-semibold disabled:opacity-50">{posting? 'Posting...':'Post'}</button>
        <button type="button" disabled={posting} onClick={()=> { setTitle(''); setText(''); setTags([]); setTagInput(''); setImageEntries([]); setResetImagesKey(k=>k+1); setSlideshow(false); setDocFiles([]); onPosted(); }} className="px-3 py-1.5 rounded border text-sm">Cancel</button>
      </div>
      <div className="text-[10px] text-gray-400 -mt-1">Images auto-resized to max width 500px.</div>
    </form>
  );
}
