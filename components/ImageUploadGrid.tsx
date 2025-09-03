"use client";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../src/lib/firebase';

export interface ImageUploadEntry {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading'|'done'|'error';
  url?: string;
  error?: string;
}

interface Props {
  disabled?: boolean;
  maxFiles?: number;
  maxWidth?: number; // resize target
  onChange?: (entries: ImageUploadEntry[]) => void;
  pathBuilder: (file: File, entryId: string) => string; // return storage path
  resetKey?: any; // change to clear all
  className?: string;
  addButtonClassName?: string;
  squareSize?: number; // px
}

export default function ImageUploadGrid({
  disabled=false,
  maxFiles=12,
  maxWidth=200,
  onChange,
  pathBuilder,
  resetKey,
  className='flex flex-wrap gap-2',
  addButtonClassName='w-20 h-20 border-2 border-dashed rounded flex items-center justify-center text-gray-400 hover:border-brand-main hover:text-brand-main text-2xl font-light',
  squareSize=80
}: Props) {
  const [entries, setEntries] = useState<ImageUploadEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState<string|null>(null);
  const [showError, setShowError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement|null>(null);

  useEffect(()=>{ setEntries([]); },[resetKey]);
  useEffect(()=>{ onChange?.(entries); },[entries,onChange]);

  function uuid(){ return crypto.randomUUID? crypto.randomUUID(): Math.random().toString(36).slice(2); }

  async function resizeImage(file: File, maxW: number): Promise<File> {
    return new Promise<File>((resolve) => {
      if(!/^image\//.test(file.type)) return resolve(file);
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        try {
          const scale = img.width > maxW ? (maxW / img.width) : 1;
          if(scale >= 1){ URL.revokeObjectURL(url); return resolve(file); }
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          if(!ctx){ URL.revokeObjectURL(url); return resolve(file); }
          ctx.drawImage(img,0,0,canvas.width,canvas.height);
          const type = file.type==='image/png'? 'image/png':'image/jpeg';
          canvas.toBlob(blob=> {
            URL.revokeObjectURL(url);
            if(blob){
              resolve(new File([blob], file.name, { type }));
            } else resolve(file);
          }, type, 0.85);
        } catch { URL.revokeObjectURL(url); resolve(file); }
      };
      img.onerror = ()=> { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  const handleSelect = useCallback(async (files: FileList | null) => {
    if(disabled || !files) return;
    const existing = entries.length;
    const list = Array.from(files).slice(0, Math.max(0, maxFiles - existing));
    for(const file of list){
      const id = uuid();
      const entry: ImageUploadEntry = { id, fileName: file.name, progress:0, status:'uploading' };
      setEntries(prev=>[...prev, entry]);
      let resized: File = file;
      try { resized = await resizeImage(file, maxWidth); } catch { /* ignore */ }
      const path = pathBuilder(resized, id);
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, resized);
      task.on('state_changed', (snap)=>{
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setEntries(prev=> prev.map(e=> e.id===id? { ...e, progress:pct }: e));
      }, (err)=>{
        const msg = err?.message || 'Upload failed';
        setEntries(prev=> prev.map(e=> e.id===id? { ...e, status:'error', error: msg }: e));
        setErrorMsg(msg); setShowError(true);
      }, async ()=>{
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          setEntries(prev=> prev.map(e=> e.id===id? { ...e, url, status:'done', progress:100 }: e));
        } catch(e:any){
          const msg = e?.message || 'Failed to get URL';
          setEntries(prev=> prev.map(e=> e.id===id? { ...e, status:'error', error: msg }: e));
          setErrorMsg(msg); setShowError(true);
        }
      });
    }
    if(fileInputRef.current) fileInputRef.current.value = '';
  },[disabled, entries.length, maxFiles, maxWidth, pathBuilder]);

  return (
    <div className="space-y-2">
      {showError && errorMsg && (
        <div className="fixed top-4 right-4 z-50 max-w-sm bg-white border border-red-300 shadow-lg rounded-lg p-4 text-sm text-red-700">
          <div className="font-semibold mb-1 flex items-start gap-2">
            <span>Image Upload Error</span>
            <button onClick={()=>setShowError(false)} className="ml-auto text-red-500 hover:text-red-700" aria-label="Close error popup">×</button>
          </div>
          <pre className="whitespace-pre-wrap text-xs bg-red-50 p-2 rounded max-h-40 overflow-auto mb-2">{errorMsg}</pre>
          <div className="flex gap-2 justify-end">
            <button onClick={()=>{ if(errorMsg){ navigator.clipboard?.writeText(errorMsg).catch(()=>{});} }} className="px-2 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-700">Copy</button>
            <button onClick={()=>setShowError(false)} className="px-2 py-1 rounded border border-red-300 text-red-600 text-xs hover:bg-red-50">Dismiss</button>
          </div>
        </div>
      )}
      <div className={className}>
        {entries.map(e=> (
          <div key={e.id} style={{ width:squareSize, height:squareSize }} className="relative border rounded bg-white overflow-hidden flex items-center justify-center text-[10px]">
            {e.status==='uploading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70">
                <div className="w-10 h-10 rounded-full border-2 border-brand-main border-t-transparent animate-spin mb-1" />
                <span className="text-[10px] font-semibold text-brand-main">{e.progress}%</span>
              </div>
            )}
            {e.status==='error' && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-50 text-red-600 text-[10px] p-1 text-center">Err</div>
            )}
            {e.url && e.status==='done' && (
              <img src={e.url} alt={e.fileName} className="object-cover w-full h-full" />
            )}
            {!e.url && e.status!=='uploading' && e.status!=='error' && (
              <span className="text-gray-400">...</span>
            )}
          </div>
        ))}
        {!disabled && entries.length < maxFiles && (
          <button type="button" disabled={disabled} onClick={()=>fileInputRef.current?.click()} className={addButtonClassName} title="Add images">+</button>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={e=>handleSelect(e.target.files)} />
    </div>
  );
}
