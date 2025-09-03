"use client";

import React, { useState, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../src/lib/firebase";
import ImageUploadGrid, { ImageUploadEntry } from "./ImageUploadGrid";

interface PrayerRequest {
  id: string;
  title: string;
  text: string;
  createdAt: string;
  author: string;
  comments: { id: string; text: string; createdAt: string; author: string }[];
  responses: { id: string; type: "pray" | "amen"; user: string; createdAt: string }[];
  images?: string[];
  commentStatus?: "on" | "freeze" | "off";
  showInUpdatesFeed?: boolean; // new: whether to surface this prayer in Updates (defaults false)
}

interface Props {
  individual: any;
  onUpdate?: (next: PrayerRequest[]) => void; // updates prayerRequests
  onUpdatesChange?: (updates: any[]) => void; // notify parent of updates array change when cross-posting
  readOnly?: boolean; // user lacks edit permissions for prayer tab
}

export default function IndividualPrayerTab({ individual, onUpdate, onUpdatesChange, readOnly = false }: Props) {
  const auth = getAuth();
  const user = auth.currentUser;

  // New prayer request state
  const [submitting, setSubmitting] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newRequest, setNewRequest] = useState("");
  const [alsoPostUpdate, setAlsoPostUpdate] = useState(false);
  const [images, setImages] = useState<ImageUploadEntry[]>([]);
  const requestIdRef = useRef<string>(crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

  // Comment input state (per prayer)
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentSubmitting, setCommentSubmitting] = useState<Record<string, boolean>>({});

  // Prayer editing
  const [editingPrayerId, setEditingPrayerId] = useState<string | null>(null);
  const [editPrayerTitle, setEditPrayerTitle] = useState("");
  const [editPrayerText, setEditPrayerText] = useState("");
  const [savingPrayer, setSavingPrayer] = useState(false);
  const [editingPrayerShowInUpdates, setEditingPrayerShowInUpdates] = useState(false);

  // Comment editing
  const [editingComment, setEditingComment] = useState<{ prayerId: string; commentId: string } | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  // Normalize existing data (support legacy `answers` -> `comments`)
  // Source data: prefer legacy prayerRequests array; fallback to profilePosts (type=prayer)
  const legacyPrayerArr = Array.isArray(individual.prayerRequests) ? individual.prayerRequests : [];
  const profilePrayerArr = Array.isArray(individual.profilePosts) ? individual.profilePosts.filter((p:any)=> p.type==='prayer') : [];
  const rawPrayer = legacyPrayerArr.length ? legacyPrayerArr : profilePrayerArr;
  const requests: PrayerRequest[] = rawPrayer.map((r: any) => ({
    id: r.id,
    title: r?.title || (typeof r?.text === "string" ? (r.text.split("\n")[0].slice(0, 80) || "Prayer Request") : "Prayer Request"),
    text: r.text,
    createdAt: r.createdAt,
    author: r.author,
    comments: Array.isArray(r.comments) ? r.comments : (Array.isArray(r.answers) ? r.answers : []),
    responses: Array.isArray(r.responses) ? r.responses : [],
    images: r.images,
    commentStatus: r.commentStatus || "on",
    showInUpdatesFeed: r.showInUpdatesFeed === true, // default false
  }));

  function buildProfilePosts(updatedPrayer: PrayerRequest[], existingUpdates: any[], existingFunding: any[], existingProfilePosts?: any[]) {
    // Start from existing profilePosts if provided to retain any future attributes
    let posts: any[] = Array.isArray(existingProfilePosts)? [...existingProfilePosts]: [];
    // Remove prior prayer/update copies to rebuild from source-of-truth arrays
    posts = posts.filter(p=> p.type!=='prayer' && p.type!=='update');
    const updateIds = new Set(existingUpdates.map((u:any)=> u.id));
    existingUpdates.forEach(u=> posts.push({ type:'update', showInUpdatesFeed:true, ...u }));
    updatedPrayer.forEach(p=> {
      const crossPosted = updateIds.has(p.id);
      const showFlag = p.showInUpdatesFeed !== undefined ? p.showInUpdatesFeed : crossPosted;
      posts.push({ type:'prayer', showInUpdatesFeed: showFlag, ...p });
    });
    existingFunding.forEach(f=> posts.push({ type:'funding', showInUpdatesFeed:false, ...f }));
    posts.sort((a,b)=> new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime());
    return posts;
  }

  // Recursively remove undefined values (Firestore rejects undefined fields)
  function sanitize(value: any): any {
    if(Array.isArray(value)) return value.map(sanitize);
    if(value && typeof value === 'object') {
      const out: any = {};
      Object.entries(value).forEach(([k,v])=> {
        if(v === undefined) return; // skip undefined
        out[k] = sanitize(v);
      });
      return out;
    }
    return value;
  }

  async function persist(updated: PrayerRequest[]) {
    try {
      const updatesArr = Array.isArray(individual.updates)? individual.updates: [];
      const fundingNeeds = Array.isArray(individual.fundingNeeds)? individual.fundingNeeds: [];
      const profilePosts = buildProfilePosts(updated, updatesArr, fundingNeeds, individual.profilePosts);
      const sanitizedRequests = updated.map(r=> sanitize(r));
      const sanitizedProfilePosts = profilePosts.map(p=> sanitize(p));
      await updateDoc(doc(db, "individuals", individual.id), { prayerRequests: sanitizedRequests, profilePosts: sanitizedProfilePosts });
    } catch {}
  }

  const pathBuilder = (file: File) => `individuals/${individual.id}/prayer/${requestIdRef.current}/${Date.now()}_${file.name}`;

  async function addRequest() {
    if (readOnly) return;
    if (!newRequest.trim()) return;
    setSubmitting(true);
    try {
      const completedImages = images.filter(i => i.status === "done" && i.url).map(i => i.url!) || [];
      const req: PrayerRequest = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
        title: (newTitle.trim() || newRequest.split("\n")[0] || "Prayer Request").slice(0, 80),
        text: newRequest.trim(),
        createdAt: new Date().toISOString(),
        author: user?.displayName || user?.email || user?.uid || "Unknown",
        comments: [],
        responses: [],
        images: completedImages.length ? completedImages : undefined,
        commentStatus: "on",
        showInUpdatesFeed: alsoPostUpdate ? true : false,
      };
      const nextRequests = [req, ...requests];
      if (alsoPostUpdate) {
        const updateItem = {
          id: req.id,
          title: req.title,
          text: req.text,
          createdAt: req.createdAt,
          author: req.author,
          images: req.images && req.images.length ? [req.images[0]] : undefined,
          tags: ["prayer"],
          comments: [],
          reactions: {},
        };
        const currentUpdates = Array.isArray(individual.updates) ? [...individual.updates] : [];
        const newUpdates = [updateItem, ...currentUpdates];
        try {
          const fundingNeeds = Array.isArray(individual.fundingNeeds)? individual.fundingNeeds: [];
          const profilePosts = buildProfilePosts(nextRequests, newUpdates, fundingNeeds, individual.profilePosts);
          const sanitizedRequests = nextRequests.map(r=> sanitize(r));
          const sanitizedUpdates = newUpdates.map(u=> sanitize(u));
          const sanitizedProfilePosts = profilePosts.map(p=> sanitize(p));
          await updateDoc(doc(db, "individuals", individual.id), { prayerRequests: sanitizedRequests, updates: sanitizedUpdates, profilePosts: sanitizedProfilePosts });
          onUpdate?.(nextRequests);
          onUpdatesChange?.(newUpdates);
        } catch (err) {
          // Fallback: persist prayer requests only, then try adding update separately
          console.error('[PrayerTab] Combined prayer+update write failed, fallback path.', err);
          try {
            await persist(nextRequests);
            onUpdate?.(nextRequests);
          } catch(e2){ /* already logged inside persist */ }
          // Best-effort secondary attempt: append update alone
          try {
            const standaloneUpdates = [updateItem, ...currentUpdates];
            const fundingNeeds = Array.isArray(individual.fundingNeeds)? individual.fundingNeeds: [];
            const profilePosts = buildProfilePosts(nextRequests, standaloneUpdates, fundingNeeds, individual.profilePosts);
            const sanitizedUpdates = standaloneUpdates.map(u=> sanitize(u));
            const sanitizedProfilePosts = profilePosts.map(p=> sanitize(p));
            await updateDoc(doc(db, "individuals", individual.id), { updates: sanitizedUpdates, profilePosts: sanitizedProfilePosts });
            onUpdatesChange?.(standaloneUpdates);
          } catch(e3){
            console.error('[PrayerTab] Secondary updates-only write failed.', e3);
          }
        }
      } else {
        onUpdate?.(nextRequests);
        await persist(nextRequests);
      }
      setNewRequest("");
      setNewTitle("");
      setImages([]);
      setAlsoPostUpdate(false);
      requestIdRef.current = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    } finally {
      setSubmitting(false);
    }
  }

  async function react(prayerId: string, type: "pray" | "amen") {
    if (!user) return;
    const uid = user.uid;
    const updated = requests.map(r => {
      if (r.id !== prayerId) return r;
      const filtered = r.responses.filter(res => !(res.user === uid && res.type === type));
      const already = r.responses.some(res => res.user === uid && res.type === type);
      const nextResponses = already ? filtered : [...filtered, { id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2), type, user: uid, createdAt: new Date().toISOString() }];
      return { ...r, responses: nextResponses };
    });
    onUpdate?.(updated);
    await persist(updated);
  }

  function beginEditPrayer(r: PrayerRequest) {
    if (readOnly) return;
    setEditingPrayerId(r.id);
    setEditPrayerTitle(r.title);
    setEditPrayerText(r.text);
    setEditingPrayerShowInUpdates(r.showInUpdatesFeed === true);
  }
  function cancelEditPrayer() {
    setEditingPrayerId(null);
    setEditPrayerTitle("");
    setEditPrayerText("");
    setEditingPrayerShowInUpdates(false);
  }
  async function savePrayer() {
    if (!editingPrayerId) return;
    if (!editPrayerText.trim()) return;
    setSavingPrayer(true);
    try {
  const updated = requests.map(r => (r.id === editingPrayerId ? { ...r, title: (editPrayerTitle.trim() || editPrayerText.split("\n")[0] || "Prayer Request").slice(0, 80), text: editPrayerText.trim(), showInUpdatesFeed: editingPrayerShowInUpdates } : r));
      onUpdate?.(updated);
      await persist(updated);
      cancelEditPrayer();
    } finally {
      setSavingPrayer(false);
    }
  }
  async function deletePrayer(id: string) {
    if (readOnly) return;
    const updated = requests.filter(r => r.id !== id);
    onUpdate?.(updated);
    await persist(updated);
    if (editingPrayerId === id) cancelEditPrayer();
  }

  function setPrayerCommentStatus(id: string, status: "on" | "freeze" | "off") {
    if (readOnly) return;
    const updated: PrayerRequest[] = requests.map(r => {
      if (r.id !== id) return r;
      if (status === "off") return { ...r, commentStatus: "off" as const, comments: [] };
      return { ...r, commentStatus: status };
    });
    onUpdate?.(updated);
    persist(updated);
  }

  // Comment editing helpers
  function beginEditComment(prayerId: string, comment: { id: string; text: string }) {
    if (readOnly) return;
    setEditingComment({ prayerId, commentId: comment.id });
    setEditCommentText(comment.text);
  }
  function cancelEditComment() {
    setEditingComment(null);
    setEditCommentText("");
  }
  async function saveComment() {
    if (!editingComment) return;
    if (!editCommentText.trim()) return;
    setSavingComment(true);
    try {
      const updated = requests.map(r => (r.id === editingComment.prayerId ? { ...r, comments: r.comments.map(c => (c.id === editingComment.commentId ? { ...c, text: editCommentText.trim() } : c)) } : r));
      onUpdate?.(updated);
      await persist(updated);
      cancelEditComment();
    } finally {
      setSavingComment(false);
    }
  }
  async function deleteComment(prayerId: string, commentId: string) {
    if (readOnly) return;
    const updated = requests.map(r => (r.id === prayerId ? { ...r, comments: r.comments.filter(c => c.id !== commentId) } : r));
    onUpdate?.(updated);
    await persist(updated);
    if (editingComment && editingComment.commentId === commentId) cancelEditComment();
  }
  async function addComment(prayerId: string) {
    if (readOnly) return;
    const txt = commentInputs[prayerId]?.trim();
    if (!txt) return;
    setCommentSubmitting(s => ({ ...s, [prayerId]: true }));
    try {
      const updated = requests.map(r => (r.id === prayerId ? { ...r, comments: [...r.comments, { id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2), text: txt, createdAt: new Date().toISOString(), author: user?.displayName || user?.email || user?.uid || "Unknown" }] } : r));
      onUpdate?.(updated);
      await persist(updated);
      setCommentInputs(p => ({ ...p, [prayerId]: "" }));
    } finally {
      setCommentSubmitting(s => ({ ...s, [prayerId]: false }));
    }
  }

  return (
    <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm">
      <h2 className="font-bold mb-4">Prayer / Requests</h2>
      {!readOnly && (
        <div className="mb-6">
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder={user ? "Prayer request title" : "Sign in to add a prayer request"}
            disabled={submitting || !user}
            className="w-full border rounded px-3 py-2 text-sm mb-2"
          />
          <textarea
            value={newRequest}
            onChange={e => setNewRequest(e.target.value)}
            placeholder={user ? "Share a prayer request..." : "Sign in to add a prayer request"}
            disabled={submitting || !user}
            className="w-full border rounded px-3 py-2 text-sm mb-2 resize-none h-24"
          />
          <div className="mb-3">
            <ImageUploadGrid
              disabled={!user || submitting}
              onChange={setImages}
              pathBuilder={pathBuilder}
              resetKey={requestIdRef.current}
              maxFiles={6}
              maxWidth={200}
              squareSize={80}
            />
            <p className="text-[10px] text-gray-400 mt-1">Optional images (max 6, resized to 200px width).</p>
          </div>
            <label className="flex items-center gap-2 text-xs mb-3 text-brand-dark">
              <input type="checkbox" checked={alsoPostUpdate} onChange={e => setAlsoPostUpdate(e.target.checked)} disabled={submitting} />
              Also post this to Updates tab (adds first image only & tag 'prayer')
            </label>
          <button
            onClick={addRequest}
            disabled={!user || submitting || !newRequest.trim() || images.some(i => i.status === "uploading")}
            className="px-4 py-2 rounded bg-brand-main text-white text-sm font-semibold disabled:opacity-50"
          >{images.some(i => i.status === "uploading") ? "Uploading image..." : "Add Request"}</button>
        </div>
      )}
      {requests.length ? (
        <ul className="space-y-4">
          {requests.map(r => {
            const prayCount = r.responses.filter(res => res.type === "pray").length;
            const amenCount = r.responses.filter(res => res.type === "amen").length;
            const userPrayed = !!(user && r.responses.some(res => res.type === "pray" && res.user === user.uid));
            const userAmen = !!(user && r.responses.some(res => res.type === "amen" && res.user === user.uid));
            const frozen = r.commentStatus === "freeze";
            return (
              <li key={r.id} className="border border-brand-main/10 rounded-lg p-4 bg-brand-main/5">
                <div className="flex flex-col gap-2">
                  <div className="text-xs text-gray-500">{new Date(r.createdAt).toLocaleString()} • {r.author || "Unknown"}</div>
                  {!readOnly && (
                    <div className="flex gap-2 text-[11px] items-center flex-wrap">
                      {editingPrayerId === r.id ? (
                        <>
                          <button onClick={savePrayer} disabled={savingPrayer || !editPrayerText.trim()} className="px-2 py-0.5 rounded bg-brand-main text-white disabled:opacity-50">{savingPrayer ? "Saving..." : "Save"}</button>
                          <button onClick={cancelEditPrayer} disabled={savingPrayer} className="px-2 py-0.5 rounded border border-gray-300 text-gray-600">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => beginEditPrayer(r)} className="px-2 py-0.5 rounded border border-brand-main/40 text-brand-main hover:bg-brand-main/10">Edit</button>
                          <button onClick={() => deletePrayer(r.id)} className="px-2 py-0.5 rounded border border-red-300 text-red-600 hover:bg-red-50">Delete</button>
                        </>
                      )}
                      <select
                        value={r.commentStatus || "on"}
                        onChange={e => setPrayerCommentStatus(r.id, e.target.value as any)}
                        className="ml-auto border rounded px-1 py-0.5 text-[10px] bg-white"
                      >
                        <option value="on">Comments: On</option>
                        <option value="freeze">Comments: Freeze</option>
                        <option value="off">Comments: Off</option>
                      </select>
                    </div>
                  )}
                  {Array.isArray(r.images) && r.images.length === 1 ? (
                    <div className="flex items-start gap-4">
                      <a href={r.images[0]} target="_blank" rel="noopener noreferrer" className="block w-32 h-32 rounded overflow-hidden border bg-white flex-shrink-0">
                        <img src={r.images[0]} alt={r.title} className="object-cover w-full h-full" />
                      </a>
                      <div className="flex-1 min-w-0">
                        {editingPrayerId === r.id ? (
                          <>
                            <input value={editPrayerTitle} onChange={e => setEditPrayerTitle(e.target.value)} className="w-full border rounded px-2 py-1 text-xs mb-2" placeholder="Title" />
                            <textarea value={editPrayerText} onChange={e => setEditPrayerText(e.target.value)} className="w-full border rounded px-2 py-2 text-xs mb-2 h-24 resize-none" />
                            <label className="flex items-center gap-2 text-[11px] text-brand-main mb-2">
                              <input type="checkbox" checked={editingPrayerShowInUpdates} onChange={e=> setEditingPrayerShowInUpdates(e.target.checked)} /> Show this request in Updates feed
                            </label>
                          </>
                        ) : (
                          <>
                            <div className="font-semibold text-brand-main text-sm mb-1 break-words">{r.title}</div>
                            <div className="text-sm text-brand-dark whitespace-pre-wrap mb-1">{r.text}</div>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {editingPrayerId === r.id ? (
                        <>
                          <input value={editPrayerTitle} onChange={e => setEditPrayerTitle(e.target.value)} className="w-full border rounded px-2 py-1 text-xs mb-2" placeholder="Title" />
                          <textarea value={editPrayerText} onChange={e => setEditPrayerText(e.target.value)} className="w-full border rounded px-2 py-2 text-xs mb-2 h-24 resize-none" />
                          <label className="flex items-center gap-2 text-[11px] text-brand-main mb-2">
                            <input type="checkbox" checked={editingPrayerShowInUpdates} onChange={e=> setEditingPrayerShowInUpdates(e.target.checked)} /> Show this request in Updates feed
                          </label>
                        </>
                      ) : (
                        <>
                          <div className="font-semibold text-brand-main text-sm mb-1 break-words">{r.title}</div>
                          <div className="text-sm text-brand-dark whitespace-pre-wrap mb-1">{r.text}</div>
                        </>
                      )}
                      {Array.isArray(r.images) && r.images.length > 1 && (
                        <div className="flex flex-wrap gap-2 mb-1">
                          {r.images.map((img: string, i: number) => (
                            <a key={i} href={img} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded overflow-hidden border bg-white">
                              <img src={img} alt={`prayer image ${i + 1}`} className="object-cover w-full h-full" />
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => react(r.id, "pray")} disabled={!user} className={`text-xs px-2 py-1 rounded border ${userPrayed ? "bg-brand-main text-white border-brand-main" : "border-brand-main/30 text-brand-main " + (user ? "hover:bg-brand-main/10" : "opacity-50 cursor-not-allowed")}`}>🙏 Pray ({prayCount})</button>
                    <button onClick={() => react(r.id, "amen")} disabled={!user} className={`text-xs px-2 py-1 rounded border ${userAmen ? "bg-brand-dark text-white border-brand-dark" : "border-brand-main/30 text-brand-main " + (user ? "hover:bg-brand-main/10" : "opacity-50 cursor-not-allowed")}`}>🙌 Amen ({amenCount})</button>
                  </div>
                  {/* Comments Section */}
                  <div className="bg-white/60 rounded border border-brand-main/10 p-3 mb-2">
                    <div className="text-xs font-semibold text-brand-main mb-2">Comments</div>
                    {r.commentStatus === "off" ? (
                      <div className="text-[10px] text-red-600 font-medium">Comments disabled.</div>
                    ) : (
                      <>
                        {r.comments.length ? (
                          <ul className="space-y-2 mb-3">
                            {r.comments.map(c => {
                              const isEditing = editingComment && editingComment.commentId === c.id && editingComment.prayerId === r.id;
                              return (
                                <li key={c.id} className="text-xs bg-brand-main/10 rounded px-2 py-1 flex flex-col gap-1">
                                  <div className="flex justify-between gap-2">
                                    <span className="flex-1 whitespace-pre-wrap">
                                      {isEditing ? (
                                        <input value={editCommentText} onChange={e => setEditCommentText(e.target.value)} className="w-full border rounded px-1 py-0.5 text-[11px]" />
                                      ) : (
                                        c.text
                                      )}
                                    </span>
                                    <span className="text-[10px] text-gray-500 self-start whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  {!readOnly && (
                                    <div className="flex gap-2 text-[10px]">
                                      {isEditing ? (
                                        <>
                                          <button onClick={saveComment} disabled={savingComment || !editCommentText.trim()} className="px-1.5 py-0.5 rounded bg-brand-main text-white disabled:opacity-50">Save</button>
                                          <button onClick={cancelEditComment} disabled={savingComment} className="px-1.5 py-0.5 rounded border border-gray-300">Cancel</button>
                                        </>
                                      ) : (
                                        <>
                                          <button onClick={() => beginEditComment(r.id, c)} disabled={r.commentStatus !== "on"} className="px-1.5 py-0.5 rounded border border-brand-main/40 text-brand-main disabled:opacity-40">Edit</button>
                                          <button onClick={() => deleteComment(r.id, c.id)} disabled={frozen} className="px-1.5 py-0.5 rounded border border-red-300 text-red-600 disabled:opacity-40">Delete</button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <div className="text-gray-400 text-xs italic mb-2">No comments yet.</div>
                        )}
                        {frozen && r.comments.length > 0 && (
                          <div className="text-[10px] text-gray-500 font-medium mb-1">Comments frozen.</div>
                        )}
                        {!readOnly && r.commentStatus === "on" && (
                          <form onSubmit={e => { e.preventDefault(); addComment(r.id); }} className="flex gap-2">
                            <input
                              value={commentInputs[r.id] || ""}
                              onChange={e => setCommentInputs(p => ({ ...p, [r.id]: e.target.value }))}
                              placeholder={user ? "Post a comment..." : "Sign in to comment"}
                              disabled={!user || commentSubmitting[r.id]}
                              className="flex-1 border rounded px-2 py-1 text-xs"
                            />
                            <button
                              disabled={!user || commentSubmitting[r.id] || !(commentInputs[r.id] || "").trim()}
                              className="px-3 py-1 rounded bg-brand-main text-white text-xs font-semibold disabled:opacity-50"
                            >Post</button>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="text-gray-400 italic">No prayer requests yet.</div>
      )}
    </div>
  );
}
