"use client";
import { useState, useCallback } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { storage, db } from "../src/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

interface CreateProjectUpdateModalProps {
  open: boolean;
  onClose: () => void;
  projectDocId: string; // Firestore document id (route param)
  onPostCreated?: (newUpdate: any) => void; // optional (real-time listener may handle)
}

export default function CreateProjectUpdateModal({ open, onClose, projectDocId, onPostCreated }: CreateProjectUpdateModalProps) {
  const [postText, setPostText] = useState("");
  const [postTitle, setPostTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [postImages, setPostImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [slideshow, setSlideshow] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setUploading(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("You must be signed in to post an update.");
      if (!postText && postImages.length === 0) throw new Error("Please add text or at least one image.");
  let imageUrls: string[] = [];
  const documentEntries: any[] = [];
      if (postImages.length > 0) {
        for(let i=0;i<postImages.length;i++){
          const f = postImages[i];
          const storageRef = ref(storage, `projects/updates/${projectDocId}/${user.uid}_${Date.now()}_${i}`);
          await uploadBytes(storageRef, f);
          const url = await getDownloadURL(storageRef);
          imageUrls.push(url);
        }
      }
      if (docFiles.length > 0) {
        // Upload each doc sequentially (small volumes expected)
        for (let i = 0; i < docFiles.length; i++) {
          const f = docFiles[i];
          const cleanName = f.name.replace(/[^A-Za-z0-9_.-]/g, '_');
          const docRef = ref(storage, `projects/updates/${projectDocId}/docs/${Date.now()}_${i}_${cleanName}`);
          await uploadBytes(docRef, f);
          const url = await getDownloadURL(docRef);
          documentEntries.push({
            name: f.name,
            url,
            contentType: f.type,
            size: f.size,
          });
        }
      }
      const projectRef = doc(db, "projects", projectDocId);
      const snap = await getDoc(projectRef);
      if (!snap.exists()) throw new Error("Project not found.");
      const prevUpdates: any[] = Array.isArray(snap.data().updates) ? snap.data().updates : [];
      const newUpdate = {
  updateId: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
        text: postText,
        title: postTitle,
        images: imageUrls,
        slideshow: slideshow && imageUrls.length>1 ? true : false,
        createdAt: new Date().toISOString(),
        author: user.displayName || user.email || user.uid,
        authorPhotoUrl: user.photoURL || null,
  authorUid: user.uid,
        tags: tags,
        documents: documentEntries,
        reactions: { pray: 0, love: 0 },
        comments: [],
      };
  await updateDoc(projectRef, { updates: [newUpdate, ...prevUpdates] });
  if(onPostCreated) onPostCreated(newUpdate);
  onClose();
  setPostText(""); setPostTitle(""); setTags([]); setTagInput(""); setPostImages([]); setDocFiles([]); setSlideshow(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to post update.");
    } finally {
      setUploading(false);
    }
  }

  const commitTag = useCallback(() => {
    const raw = tagInput.trim().toLowerCase().replace(/^[#]+/, "");
    if (!raw) return;
    if (!tags.includes(raw)) setTags(prev => [...prev, raw]);
    setTagInput("");
  }, [tagInput, tags]);

  function onTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' ) {
      e.preventDefault();
      commitTag();
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length) {
      // quick backspace to remove last
      e.preventDefault();
      setTags(prev => prev.slice(0, -1));
    }
  }

  function removeTag(t: string) { setTags(prev => prev.filter(x => x !== t)); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md relative">
        <button className="absolute top-2 right-2 text-xl text-gray-400 hover:text-brand-main" onClick={() => { onClose(); }}>&times;</button>
        <h3 className="text-lg font-bold mb-4">Create Project Update</h3>
        <form onSubmit={handleSubmit}>
          <input
            className="w-full border rounded px-3 py-2 mb-3"
            placeholder="Title (optional)"
            value={postTitle}
            onChange={e => setPostTitle(e.target.value)}
            disabled={uploading}
          />
          <textarea
            className="w-full border rounded px-3 py-2 mb-3"
            placeholder="What's new?"
            value={postText}
            onChange={e => setPostText(e.target.value)}
            rows={3}
            disabled={uploading}
          />
          <div className="mb-3">
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map(t => (
                <span key={t} className="flex items-center gap-1 bg-orange-200 text-orange-800 px-2 py-1 rounded-full text-xs font-semibold">
                  #{t}
                  <button type="button" className="hover:text-orange-950" onClick={()=>removeTag(t)} aria-label={`Remove tag ${t}`}>×</button>
                </span>
              ))}
              <input
                className="flex-1 min-w-[120px] border rounded px-2 py-1 text-sm"
                placeholder={tags.length?"Add tag":"Add a tag and press Enter"}
                value={tagInput}
                disabled={uploading}
                onChange={e=>setTagInput(e.target.value)}
                onKeyDown={onTagKeyDown}
              />
            </div>
            {tags.length === 0 && <p className="text-xs text-gray-400">Type a tag then press Enter. Tags appear below.</p>}
          </div>
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              onChange={e => {
                const files = Array.from(e.target.files || []);
                if (!files.length) return;
                setPostImages(prev => [...prev, ...files]);
              }}
            />
            {postImages.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {postImages.map((file, idx) => (
                  <div key={idx} className="relative w-28 h-20 rounded overflow-hidden border bg-gray-100">
                    <img
                      src={URL.createObjectURL(file)}
                      alt="preview"
                      className="object-cover w-full h-full"
                    />
                    <button type="button" onClick={()=> setPostImages(prev=> prev.filter((_,i)=> i!==idx))} className="absolute top-1 right-1 bg-black/50 text-white rounded text-[10px] px-1">×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs">
              <input id="slideshowMode" type="checkbox" disabled={uploading || postImages.length<2} checked={slideshow} onChange={e=> setSlideshow(e.target.checked)} />
              <label htmlFor="slideshowMode" className={postImages.length<2? 'text-gray-400':'text-brand-main cursor-pointer'}>Slideshow (requires 2+ images)</label>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-semibold mb-1">Attach documents (PDF, Word, Excel, PPT)</label>
            <input
              type="file"
              multiple
              disabled={uploading}
              accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              onChange={e => {
                const files = Array.from(e.target.files || []);
                if(!files.length) return;
                setDocFiles(prev => [...prev, ...files]);
              }}
            />
            {docFiles.length>0 && (
              <ul className="mt-2 space-y-1 text-xs max-h-32 overflow-auto pr-1">
                {docFiles.map((f,i)=>(
                  <li key={i} className="flex items-center justify-between gap-2 bg-gray-50 border rounded px-2 py-1">
                    <span className="truncate">{f.name}</span>
                    <button type="button" className="text-red-600 hover:underline" onClick={()=> setDocFiles(prev=> prev.filter((_,idx)=> idx!==i))}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {errorMsg && <div className="text-red-600 text-sm mt-2">{errorMsg}</div>}
          <button
            type="submit"
            className="mt-4 w-full py-2 px-4 rounded bg-brand-main text-white font-semibold hover:bg-brand-dark transition disabled:opacity-60"
            disabled={uploading}
          >
            {uploading ? "Posting..." : "Post Update"}
          </button>
        </form>
      </div>
    </div>
  );
}
