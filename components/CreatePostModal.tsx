"use client";

import { useState } from "react";
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from "firebase/storage";
import { getAuth } from "firebase/auth";
// Correct relative path to firebase utilities (components and src are siblings)
import { storage, db } from "../src/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

// Helper for resumable upload with progress
function uploadBytesResumableWithProgress(storageRef: any, file: File, onProgress: (percent: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on('state_changed',
      (snapshot) => {
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress(percent);
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(storageRef);
        resolve(url);
      }
    );
  });
}

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  individualId: string; // external code id
  individualDocId: string; // Firestore doc id
  existingUpdates?: any[];
  existingFeed?: any[];
  existingProfilePosts?: any[];
  onPostCreated: (newUpdate: any) => void;
}

export default function CreatePostModal({ open, onClose, individualId, individualDocId, existingUpdates = [], existingFeed = [], existingProfilePosts = [], onPostCreated }: CreatePostModalProps) {
  const [postText, setPostText] = useState("");
  const [postTitle, setPostTitle] = useState("");
  const [postTags, setPostTags] = useState<string>("");
  const [postImages, setPostImages] = useState<File[]>([]);
  const [imageUploadProgress, setImageUploadProgress] = useState<number[]>([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md relative">
        <button className="absolute top-2 right-2 text-xl text-gray-400 hover:text-brand-main" onClick={() => { onClose(); setPostText(""); setPostImages([]); setErrorMsg(""); }}>&times;</button>
        <h3 className="text-lg font-bold mb-4">Create Update</h3>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setErrorMsg("");
            setUploading(true);
            try {
              const auth = getAuth();
              const user = auth.currentUser;
              if (!user) throw new Error("You must be signed in to post an update.");
              if (!postText && postImages.length === 0) throw new Error("Please add text or at least one image.");
              let imageUrls: string[] = [];
              let authorPhotoUrl = user.photoURL || null;
              if (postImages.length > 0) {
                // Only upload the first image for now
                const file = postImages[0];
                const storageRef = ref(storage, `individuals/updates/${user.uid}_${Date.now()}_0`);
                await uploadBytes(storageRef, file);
                const url = await getDownloadURL(storageRef);
                imageUrls.push(url);
              }
              // Add to updates array in Firestore
              if(!individualDocId) throw new Error("Missing profile document id.");
              const docRef = doc(db, "individuals", individualDocId);
              const prevUpdates = Array.isArray(existingUpdates) ? existingUpdates : [];
              const newUpdate = {
                id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
                text: postText,
                title: postTitle,
                images: imageUrls,
                createdAt: new Date().toISOString(),
                author: user.displayName || user.email || user.uid,
                authorPhotoUrl,
                tags: postTags.split(",").map(t => t.trim()).filter(Boolean),
                reactions: { pray: 0, love: 0 },
                comments: [],
              };
              const updatedUpdates = [newUpdate, ...prevUpdates];
              const feedEntry = { type: 'update', ...newUpdate };
              const updatedFeed = [feedEntry, ...existingFeed];
              const newProfilePost = { type:'update', showInUpdatesFeed:true, ...newUpdate };
              const updatedProfilePosts = [newProfilePost, ...(Array.isArray(existingProfilePosts)? existingProfilePosts: [])];
              onPostCreated(newUpdate);
              // Sanitize undefined values
              const sanitize = (v:any):any => Array.isArray(v)? v.map(sanitize): (v && typeof v==='object'? Object.fromEntries(Object.entries(v).filter(([_,val])=> val!==undefined).map(([k,val])=> [k,sanitize(val)])): v);
              await updateDoc(docRef, { updates: updatedUpdates.map(sanitize), feed: updatedFeed.map(sanitize), profilePosts: updatedProfilePosts.map(sanitize) });
              onClose();
              setPostText("");
              setPostTitle("");
              setPostTags("");
              setPostImages([]);
            } catch (err: any) {
              setErrorMsg(err.message || "Failed to post update.");
            } finally {
              setUploading(false);
            }
          }}
        >
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
          <input
            className="w-full border rounded px-3 py-2 mb-3"
            placeholder="Tags (comma separated)"
            value={postTags}
            onChange={e => setPostTags(e.target.value)}
            disabled={uploading}
          />
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
          {/* Show previews */}
          {postImages.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {postImages.map((file, idx) => (
                <div key={idx} className="relative">
                  <img
                    src={URL.createObjectURL(file)}
                    alt="preview"
                    className="rounded border object-cover"
                    style={{ width: '100%', maxWidth: 500, maxHeight: 180 }}
                  />
                </div>
              ))}
            </div>
          )}
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
