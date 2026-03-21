"use client";
import { useState, useEffect } from 'react';
import { updateOrg, subscribeOrgProjects } from '@/lib/dal';
import { storage } from '../src/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

interface OrgEnhancedOverviewProps {
  org: any;
  isOwner: boolean;
  editMode: boolean;
  onOrgUpdate: (patch: any) => void;
  logoUploading: boolean;
  setLogoUploading: (b:boolean)=>void;
  logoError: string;
  setLogoError: (s:string)=>void;
}

export default function OrgEnhancedOverview({ org, isOwner, editMode, onOrgUpdate, logoUploading, setLogoUploading, logoError, setLogoError }: OrgEnhancedOverviewProps){
  const [aboutDraft, setAboutDraft] = useState(org.bio || '');
  const [savingAbout, setSavingAbout] = useState(false);
  const [taglineDraft, setTaglineDraft] = useState<string>(org.tagline || '');
  const [savingTagline, setSavingTagline] = useState(false);
  const [logoProgress, setLogoProgress] = useState<number|null>(null);
  const [showcaseProjects, setShowcaseProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  // Subscribe to showcased projects for this org
  useEffect(()=> {
    if(!org?.orgId){ setShowcaseProjects([]); return; }
    setProjectsLoading(true);
    const unsub = subscribeOrgProjects(org.orgId, (rows) => {
      const filtered = rows.filter((p: any) =>
        p.showOnOrganizationOverview === true &&
        (p.status ?? 'live') === 'live' && (p.visibility ?? 'public') === 'public'
      );
      filtered.sort((a:any,b:any)=> ((b.createdAt as any)?.seconds||0) - ((a.createdAt as any)?.seconds||0));
      setShowcaseProjects(filtered.slice(0,12)); setProjectsLoading(false);
    }, ()=> setProjectsLoading(false));
    return ()=> unsub();
  }, [org?.orgId]);
  // Background image controls moved to Settings tab
  useEffect(()=> { setTaglineDraft(org.tagline || ''); }, [org.tagline]);
  // Keep about draft in sync with live doc unless user is actively editing (naive: always overwrite when doc changes and not currently saving)
  useEffect(()=> {
    if(!savingAbout){
      setAboutDraft(org.bio || '');
    }
  }, [org.bio, savingAbout]);
  const website = org.website;
  async function saveTagline(){
    if(!isOwner) return;
    const trimmed = taglineDraft.trim();
    setSavingTagline(true);
    try {
      await updateOrg(org.id, { tagline: trimmed });
      onOrgUpdate({ tagline: trimmed });
    } catch {/* ignore */}
    finally { setSavingTagline(false); }
  }

  // Resize & compress image to max width 200px (maintain aspect) – fallback keeps original if processing fails
  async function processLogoFile(file: File): Promise<{ blob: Blob; ext: string }>{
    // Skip processing for SVG (can't raster reliably while preserving vector semantics)
    if(file.type === 'image/svg+xml') return { blob: file, ext: 'svg' };
    const dataUrl: string = await new Promise((resolve, reject)=> { const fr = new FileReader(); fr.onerror=()=> reject(new Error('Read error')); fr.onload=()=> resolve(fr.result as string); fr.readAsDataURL(file); });
    const img: HTMLImageElement = await new Promise((resolve, reject)=> { const im = new Image(); im.onload=()=> resolve(im); im.onerror=()=> reject(new Error('Image load failed')); im.src = dataUrl; });
    const maxWidth = 200;
    let targetW = img.naturalWidth;
    let targetH = img.naturalHeight;
    if(targetW > maxWidth){
      const scale = maxWidth / targetW; targetW = maxWidth; targetH = Math.round(targetH * scale);
    }
    // If already within limit just return original unless size is huge (>400KB)
    if(img.naturalWidth <= maxWidth && file.size <= 400*1024){
      return { blob: file, ext: (file.name.split('.').pop() || 'png').toLowerCase() };
    }
    const canvas = document.createElement('canvas'); canvas.width = targetW; canvas.height = targetH; const ctx = canvas.getContext('2d'); if(!ctx){ return { blob: file, ext: (file.name.split('.').pop() || 'png').toLowerCase() }; }
    ctx.drawImage(img, 0, 0, targetW, targetH);
    // Try progressive quality reduction to stay under 400KB
    const qualities = [0.9, 0.8, 0.7, 0.6, 0.5];
    for(const q of qualities){
      const blob: Blob = await new Promise(res=> canvas.toBlob(b=> res(b as Blob), 'image/png', q));
      if(blob.size <= 400*1024 || q === qualities[qualities.length-1]) return { blob, ext: 'png' };
    }
    // Fallback (should not reach)
    return { blob: file, ext: (file.name.split('.').pop() || 'png').toLowerCase() };
  }
  return (
    <div className="space-y-8">
      <style>{`.org-accent-btn{background:var(--org-accent,#FF6A1A);color:var(--org-accent-text,#fff);border:1px solid var(--org-accent,#FF6A1A);}
      .org-accent-btn:hover:not(:disabled){background:var(--org-accent-hover,var(--org-accent,#FF6A1A));}
      `}</style>
      <section className="bg-white border border-brand-main/10 rounded-xl p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="relative">
            <label className={`group block w-20 h-20 rounded border ${org.logoUrl? 'border-brand-main/20 bg-white':'border-dashed border-brand-main/30 bg-brand-main/5'} overflow-hidden cursor-pointer hover:border-brand-main/60 transition`}>
              {org.logoUrl ? (
                <img src={org.logoUrl} alt={`${org.name} logo`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-gray-400">
                  {isOwner && editMode ? <><span>Add</span><span>Logo</span></> : (org.name? (org.name[0] || '').toUpperCase(): '—')}
                </div>
              )}
              {(isOwner && editMode) && (
                <>
                  <input
                    type='file'
                    className='hidden'
                    accept='image/png,image/jpeg,image/webp,image/svg+xml'
                    onChange={async e=> {
                      const file = e.target.files?.[0]; if(!file) return; setLogoError(''); setLogoUploading(true); setLogoProgress(0);
                      try {
                        const { blob, ext } = await processLogoFile(file);
                        if(blob.size > 400*1024) throw new Error('Optimisation failed (still >400KB)');
                        const r = ref(storage, `organizations/${org.id}/logo.${ext}`);
                        // Use resumable upload for progress
                        const task = uploadBytesResumable(r, blob, { contentType: blob.type || file.type });
                        const prevLogoUrl = org.logoUrl as string | undefined;
                        task.on('state_changed', snap=> {
                          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
                          setLogoProgress(pct);
                        }, err=> {
                          setLogoError(err?.message || 'Upload failed');
                          setLogoUploading(false); setLogoProgress(null);
                        }, async ()=> {
                          try {
                            const url = await getDownloadURL(task.snapshot.ref);
                            // Attempt deletion of previous logo if different path (e.g. extension change)
                            if(prevLogoUrl && prevLogoUrl !== url){
                              try {
                                const match = prevLogoUrl.match(/\/o\/([^?]+)/); // encoded full path
                                if(match){
                                  const encodedPath = decodeURIComponent(match[1]);
                                  const clean = encodedPath.replace(/%2F/g,'/');
                                  const objectPath = clean.includes('organizations/') ? clean.substring(clean.indexOf('organizations/')) : clean;
                                  // Only delete if objectPath differs from new path
                                  const newPath = `organizations/${org.id}/logo.${ext}`;
                                  if(objectPath !== newPath){
                                    await deleteObject(ref(storage, objectPath));
                                  }
                                }
                              } catch {/* ignore deletion errors */}
                            }
                            await updateOrg(org.id, { logoUrl: url });
                            onOrgUpdate({ logoUrl: url });
                          } catch(err:any){ setLogoError(err.message || 'Upload failed'); }
                          finally { setLogoUploading(false); setLogoProgress(null); }
                        });
                      } catch(err:any){ setLogoError(err.message || 'Upload failed'); setLogoUploading(false); setLogoProgress(null); }
                      finally { if(e.target) e.target.value=''; }
                    }}
                  />
                  {/* Hover prompt (hidden while uploading) */}
                  {!logoUploading && (
                    <div className='absolute inset-0 bg-black/0 group-hover:bg-black/25 flex items-center justify-center text-[10px] font-semibold text-white opacity-0 group-hover:opacity-100 transition'>
                      {org.logoUrl? 'Change' : 'Upload'}
                    </div>
                  )}
                  {logoUploading && (
                    <div className='absolute inset-0 flex flex-col items-center justify-center bg-black/40'>
                      <div className='w-10 h-10 rounded-full border-2 border-white/60 border-t-transparent animate-spin mb-1' />
                      <span className='text-[11px] font-semibold text-white'>{logoProgress!==null? `${logoProgress}%` : '...'}</span>
                    </div>
                  )}
                  {org.logoUrl && !logoUploading && (
                    <button
                      type='button'
                      onClick={async ev=> {
                        ev.preventDefault(); ev.stopPropagation(); if(!confirm('Remove logo?')) return; setLogoUploading(true); setLogoError('');
                        try {
                          try {
                            const match = org.logoUrl.match(/\/o\/([^?]+)/);
                            if(match){
                              const encodedPath = decodeURIComponent(match[1]);
                              const clean = encodedPath.replace(/%2F/g,'/');
                              const objectPath = clean.includes('organizations/') ? clean.substring(clean.indexOf('organizations/')) : clean;
                              await deleteObject(ref(storage, objectPath));
                            }
                          } catch {/* ignore */}
                          await updateOrg(org.id, { logoUrl: null });
                          onOrgUpdate({ logoUrl: null });
                        } catch(err:any){ setLogoError(err.message || 'Remove failed'); }
                        finally { setLogoUploading(false); }
                      }}
                      className='absolute -top-2 -right-2 bg-red-600 text-white w-6 h-6 rounded-full shadow flex items-center justify-center text-xs hover:bg-red-700'
                      aria-label='Remove logo'
                    >×</button>
                  )}
                </>
              )}
            </label>
            {logoError && <div className='mt-1 text-[10px] text-red-600 max-w-[120px]'>{logoError}</div>}
            {logoUploading && logoProgress!==null && <div className='mt-1 text-[10px] text-gray-500'>Uploading {logoProgress}%</div>}
            {(isOwner && editMode) && <div className='mt-1 text-[9px] text-gray-400 max-w-[140px]'>Max width 200px auto-resized • ≤400KB</div>}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-1" style={{ color:'var(--org-widget-title-color, var(--org-accent, #FF6A1A))' }}>{org.name}</h2>
            <div className="mb-2">
              {isOwner && editMode ? (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <input
                    value={taglineDraft}
                    maxLength={140}
                    onChange={e=> setTaglineDraft(e.target.value)}
                    placeholder="Add a concise tagline (max 140 chars)"
                    className="flex-1 border rounded px-3 py-1 text-sm"
                  />
                  <button
                    type="button"
                    disabled={savingTagline}
                    onClick={saveTagline}
                    className="px-3 py-1.5 rounded text-xs font-semibold disabled:opacity-50 org-accent-btn transition"
                  >{savingTagline? 'Saving…':'Save Tagline'}</button>
                </div>
              ) : (
                org.tagline ? <p className="text-sm text-brand-dark/80 italic leading-snug">{org.tagline}</p> : <p className="text-xs text-gray-400 italic">No tagline yet.</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {website && <a href={/^https?:/i.test(website)? website: `https://${website}`} target="_blank" rel="noopener noreferrer" className="text-sm underline break-all" style={{ color:'var(--org-accent,#FF6A1A)' }}>{website}</a>}
              {(!editMode || !isOwner) && org.orgType && (
                <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold tracking-wide" style={{ background:'var(--org-accent,#FF6A1A)', color:'var(--org-accent-text,#fff)' }}>{org.orgType}</span>
              )}
              {editMode && isOwner && (
                <OrgTypeEditor current={org.orgType} orgDbId={org.id} />
              )}
            </div>
          </div>
          {/* Removed separate right-side upload controls in favor of clickable logo area */}
        </div>
      </section>

  {/* Background image customization moved to Settings tab */}

      <section className="bg-white border border-brand-main/10 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-2" style={{ color:'var(--org-widget-title-color, var(--org-accent, #FF6A1A))' }}>About</h3>
        {isOwner && editMode ? (
          <div>
            <textarea className="w-full border rounded px-3 py-2 min-h-[140px]" value={aboutDraft} onChange={e=> setAboutDraft(e.target.value)} />
            <button disabled={savingAbout} onClick={async()=> { setSavingAbout(true); try { await updateOrg(org.id, { bio: aboutDraft }); onOrgUpdate({ bio: aboutDraft }); } catch(e:any){} finally { setSavingAbout(false); } }} className="mt-2 px-4 py-2 rounded text-xs font-semibold org-accent-btn disabled:opacity-50 transition">{savingAbout? 'Saving...' : 'Save'}</button>
          </div>
        ) : (
          <p className="text-sm text-brand-dark whitespace-pre-line">{org.bio || '—'}</p>
        )}
      </section>

      <section className="bg-white border border-brand-main/10 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold mb-3" style={{ color:'var(--org-widget-title-color, var(--org-accent, #FF6A1A))' }}>Showcased Projects</h3>
        {projectsLoading && <div className="text-[11px] text-gray-500">Loading…</div>}
        {!projectsLoading && !showcaseProjects.length && (
          <div className="text-[11px] text-gray-400">No projects showcased yet.{isOwner && ' Enable visibility in a project\'s settings to feature it here.'}</div>
        )}
        {!projectsLoading && showcaseProjects.length>0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {showcaseProjects.map(p=> {
              const isDraft = (p.status ?? 'live') === 'draft';
              const isLive = (p.status ?? 'live') === 'live';
              const isPrivate = (p.visibility ?? 'public') === 'private';
              const isPublic = (p.visibility ?? 'public') === 'public';
              const budget = p.totalBudget ? `${p.currency || '$'}${p.totalBudget.toLocaleString()}` : null;
              return (
                <a key={p.id} href={`/projects/${p.projectId || p.id}`} className="group rounded-md border border-brand-main/10 overflow-hidden bg-white hover:shadow transition relative flex flex-col">
                  {p.coverPhotoUrl && (
                    <div className="h-32 w-full overflow-hidden">
                      <img src={p.coverPhotoUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                    </div>
                  )}
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="text-sm font-semibold text-brand-dark line-clamp-1 mb-1">{p.name}</div>
                    {budget && isOwner && (
                      <div className='text-[11px] text-gray-600 flex items-center gap-0.5 mb-1'>
                        <svg xmlns='http://www.w3.org/2000/svg' className='w-3 h-3 flex-shrink-0' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><circle cx='12' cy='12' r='10'/><path d='M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8'/><path d='M12 18V6'/></svg>
                        <span className='font-medium'>{budget}</span>
                      </div>
                    )}
                    {p.description && <div className="text-[11px] text-gray-600 line-clamp-3 flex-1">{p.description}</div>}
                    <div className="mt-2 flex items-center justify-between flex-wrap gap-1">
                      <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-brand-main/10 text-brand-main">{p.projectId}</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {isOwner && isDraft && <span className='text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200'>Draft</span>}
                        {isOwner && isLive && <span className='text-[9px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200'>Live</span>}
                        {isOwner && isPrivate && <span className='text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200'>Private</span>}
                        {isOwner && isPublic && <span className='text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200'>Public</span>}
                        {p.createdAt?.seconds && <span className="text-[10px] text-gray-400">{new Date(p.createdAt.seconds*1000).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function OrgTypeEditor({ current, orgDbId }: { current?: string; orgDbId: string }){
  const [mode, setMode] = useState<'select'|'custom'>(!current || ['Religious Organization','NGO','Business','Church'].includes(current)? 'select':'custom');
  const [value, setValue] = useState(current || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const PRESETS = ['Religious Organization','NGO','Business','Church','Other'];
  async function save(newType:string){
    setSaving(true); setError('');
    try { await updateOrg(orgDbId, { orgType: newType }); }
    catch(e:any){ setError(e.message || 'Save failed'); }
    finally { setSaving(false); }
  }
  return (
    <div className='flex items-center gap-2'>
      {mode==='select' && (
        <select
          value={PRESETS.includes(value)? value : ''}
          onChange={e=> { const v=e.target.value; if(v==='Other'){ setMode('custom'); setValue(''); } else { setValue(v); save(v); } }}
          className='border rounded px-2 py-1 text-[11px]'
        >
          <option value=''>Type…</option>
          {PRESETS.map(p=> <option key={p} value={p}>{p}</option>)}
        </select>
      )}
      {mode==='custom' && (
        <form onSubmit={e=> { e.preventDefault(); if(!value.trim()) return; save(value.trim()); }} className='flex items-center gap-1'>
          <input value={value} onChange={e=> setValue(e.target.value)} placeholder='Custom type' className='border rounded px-2 py-1 text-[11px]' />
            <button type='submit' disabled={saving || !value.trim()} className='px-2 py-1 rounded bg-brand-main text-white text-[10px] font-semibold disabled:opacity-50'>{saving? '…' : 'Save'}</button>
            <button type='button' onClick={()=> { setMode('select'); setValue(''); }} className='px-2 py-1 rounded bg-white border border-brand-main/30 text-[10px] text-brand-main'>Preset</button>
        </form>
      )}
      {error && <span className='text-[10px] text-red-600'>{error}</span>}
    </div>
  );
}
