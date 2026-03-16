"use client";
import { useEffect, useState } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, storage } from '../src/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';

interface ProjectSettingsTabProps {
  projectId: string; // display / code id
  docId: string; // Firestore document id
  project: any;
  projectCurrency: string;
  setProjectCurrency: (val: string) => void;
  setProject: React.Dispatch<React.SetStateAction<any>>;
  currencySymbol: string;
  allowEdit?: boolean;
}

type AccessLevel = 'public' | 'supporter' | 'representative' | 'owner';
interface TabPermission { view: AccessLevel[]; edit: AccessLevel[]; }
type AccessSettings = Record<string, TabPermission>;
const ROLES: AccessLevel[] = ['public','supporter','representative','owner'];
const ROLE_LABEL: Record<AccessLevel,string> = { public:'Public', supporter:'Supporter', representative:'Representative', owner:'Owner'};
const DEFAULT_ACCESS: AccessSettings = {
  overview: { view: ['public','supporter','representative','owner'], edit: ['owner'] },
  plan: { view: ['supporter','representative','owner'], edit: ['owner','representative'] },
  updates: { view: ['supporter','representative','owner'], edit: ['owner','representative'] },
  finance: { view: ['representative','owner'], edit: ['owner','representative'] },
  team: { view: ['supporter','representative','owner'], edit: ['owner','representative'] }
};

export default function ProjectSettingsTab({
  projectId,
  docId,
  project,
  projectCurrency,
  setProjectCurrency,
  setProject,
  currencySymbol,
  allowEdit=false,
}: ProjectSettingsTabProps) {
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const router = useRouter();
  const auth = typeof window !== 'undefined' ? getAuth() : null;

  // Permissions state (mirroring IndividualSettingsTab)
  function normalizeAccess(raw:any): AccessSettings {
    if(!raw || typeof raw!=='object' || Array.isArray(raw)) return DEFAULT_ACCESS;
    const rank = ROLES;
    const thresholdToArray = (lvl: string): AccessLevel[] => { const i = rank.indexOf(lvl as any); return i===-1? [...rank]: rank.slice(i) as AccessLevel[]; };
    const out: AccessSettings = { ...DEFAULT_ACCESS };
    Object.entries(raw).forEach(([k,v])=>{
      if(typeof v==='string'){ out[k] = { view: thresholdToArray(v), edit:['owner'] }; }
      else if(v && typeof v==='object' && 'view' in (v as any) && 'edit' in (v as any)){
        const vv = Array.isArray((v as any).view)? (v as any).view.filter((r:any)=> rank.includes(r)): out[k]?.view;
        const ee = Array.isArray((v as any).edit)? (v as any).edit.filter((r:any)=> rank.includes(r)): out[k]?.edit;
        out[k] = { view: vv && vv.length? vv: out[k].view, edit: ee && ee.length? ee: out[k].edit };
      }
    });
    return out;
  }
  const [accessSettings, setAccessSettings] = useState<AccessSettings>(normalizeAccess(project?.accessSettings));
  const [representatives, setRepresentatives] = useState<string[]>(Array.isArray(project?.representatives)? project.representatives: []);
  const [supporters, setSupporters] = useState<string[]>(Array.isArray(project?.supporters)? project.supporters: []);
  const [repInput, setRepInput] = useState('');
  const [supInput, setSupInput] = useState('');
  const [savingPerms, setSavingPerms] = useState(false);
  const [savedAt, setSavedAt] = useState<number|undefined>(undefined);
  const [allowRepSettings, setAllowRepSettings] = useState<boolean>(!!project?.settingsAllowRepresentative);

  // Theme customization (mirrors OrgSettingsTab)
  const THEME_DEFAULTS = {
    headerBg: '#FF6A1A',
    headerText: '#FFFFFF',
    accent: '#FF6A1A',
    accentText: '#FFFFFF',
    accentHover: '#e75e12',
    tabActiveBg: '#FF6A1A',
    tabActiveText: '#FFFFFF',
    tabInactiveText: '#475569',
    widgetTitleColor: '#FF6A1A'
  } as const;
  const [themeHeaderBg, setThemeHeaderBg] = useState<string>(project?.themeHeaderBg || THEME_DEFAULTS.headerBg);
  const [themeHeaderText, setThemeHeaderText] = useState<string>(project?.themeHeaderText || THEME_DEFAULTS.headerText);
  const [themeAccent, setThemeAccent] = useState<string>(project?.themeAccent || THEME_DEFAULTS.accent);
  const [themeAccentText, setThemeAccentText] = useState<string>(project?.themeAccentText || THEME_DEFAULTS.accentText);
  const [themeAccentHover, setThemeAccentHover] = useState<string>(project?.themeAccentHover || THEME_DEFAULTS.accentHover);
  const [themeTabActiveBg, setThemeTabActiveBg] = useState<string>(project?.themeTabActiveBg || (project?.themeAccent || THEME_DEFAULTS.tabActiveBg));
  const [themeTabActiveText, setThemeTabActiveText] = useState<string>(project?.themeTabActiveText || THEME_DEFAULTS.tabActiveText);
  const [themeTabInactiveText, setThemeTabInactiveText] = useState<string>(project?.themeTabInactiveText || THEME_DEFAULTS.tabInactiveText);
  const [themeWidgetTitleColor, setThemeWidgetTitleColor] = useState<string>(project?.themeWidgetTitleColor || THEME_DEFAULTS.widgetTitleColor);
  const [themeSaving, setThemeSaving] = useState(false);
  const [themeSavedAt, setThemeSavedAt] = useState<number|undefined>(undefined);

  // Org overview visibility
  const [showOnOrgOverview, setShowOnOrgOverview] = useState<boolean>(!!project?.showOnOrganizationOverview);
  const [savingVisibility, setSavingVisibility] = useState(false);
  // Public listing visibility
  const [publicVisible, setPublicVisible] = useState<boolean>(project?.publicVisible !== false); // default true
  const [savingPublicVisible, setSavingPublicVisible] = useState(false);
  // Background controls (image + adjustments)
  const [bgUploading, setBgUploading] = useState(false);
  const [bgProgress, setBgProgress] = useState<number|null>(null);
  const [bgError, setBgError] = useState('');
  const [backgroundBrightness, setBackgroundBrightness] = useState<number>(typeof project?.backgroundBrightness === 'number' ? project.backgroundBrightness : 1);
  const [bgBrightnessSaving, setBgBrightnessSaving] = useState(false);
  const [bgBrightnessSavedAt, setBgBrightnessSavedAt] = useState<number|undefined>(undefined);
  const [backgroundBlur, setBackgroundBlur] = useState<number>(typeof project?.backgroundBlur === 'number' ? project.backgroundBlur : 0);
  const [bgBlurSaving, setBgBlurSaving] = useState(false);
  const [bgBlurSavedAt, setBgBlurSavedAt] = useState<number|undefined>(undefined);
  // Background fade (dark overlay strength) – 0 = none, 0.8 = very dark
  const [backgroundFade, setBackgroundFade] = useState<number>(typeof project?.backgroundFade === 'number' ? project.backgroundFade : 0.4);
  const [bgFadeSaving, setBgFadeSaving] = useState(false);
  const [bgFadeSavedAt, setBgFadeSavedAt] = useState<number|undefined>(undefined);
  useEffect(()=> { setShowOnOrgOverview(!!project?.showOnOrganizationOverview); }, [project?.showOnOrganizationOverview]);
  useEffect(()=> { if(typeof project?.publicVisible === 'boolean') setPublicVisible(project.publicVisible); }, [project?.publicVisible]);
  useEffect(()=> { if(typeof project?.backgroundFade === 'number') setBackgroundFade(project.backgroundFade); }, [project?.backgroundFade]);
  useEffect(()=> { if(typeof project?.backgroundBrightness === 'number') setBackgroundBrightness(project.backgroundBrightness); }, [project?.backgroundBrightness]);
  useEffect(()=> { if(typeof project?.backgroundBlur === 'number') setBackgroundBlur(project.backgroundBlur); }, [project?.backgroundBlur]);
  // Auto-save debounce
  useEffect(()=> {
    if(!allowEdit) return;
    const t = setTimeout(async()=> {
      setSavingVisibility(true);
      try {
  await updateDoc(doc(db,'projects', docId || projectId), { showOnOrganizationOverview: showOnOrgOverview });
        setProject((p:any)=> ({ ...p, showOnOrganizationOverview: showOnOrgOverview }));
      } catch {/* ignore */}
      finally { setSavingVisibility(false); }
    }, 400);
    return ()=> clearTimeout(t);
  }, [showOnOrgOverview, allowEdit, projectId, setProject]);
  // Auto-save public visibility
  useEffect(()=> {
    if(!allowEdit) return;
    const t = setTimeout(async()=> {
      setSavingPublicVisible(true);
      try {
  await updateDoc(doc(db,'projects', docId || projectId), { publicVisible });
        setProject((p:any)=> ({ ...p, publicVisible }));
      } catch {/* ignore */}
      finally { setSavingPublicVisible(false); }
    }, 400);
    return ()=> clearTimeout(t);
  }, [publicVisible, allowEdit, projectId, setProject]);
  // Auto-save background brightness
  useEffect(()=> {
    if(!allowEdit) return;
    const t = setTimeout(async()=> {
      setBgBrightnessSaving(true);
      try {
        await updateDoc(doc(db,'projects', docId || projectId), { backgroundBrightness });
        setProject((p:any)=> ({ ...p, backgroundBrightness }));
        setBgBrightnessSavedAt(Date.now());
      } catch {/* ignore */}
      finally { setBgBrightnessSaving(false); }
    }, 500);
    return ()=> clearTimeout(t);
  }, [backgroundBrightness, allowEdit, docId, projectId, setProject]);
  // Auto-save background blur
  useEffect(()=> {
    if(!allowEdit) return;
    const t = setTimeout(async()=> {
      setBgBlurSaving(true);
      try {
        await updateDoc(doc(db,'projects', docId || projectId), { backgroundBlur });
        setProject((p:any)=> ({ ...p, backgroundBlur }));
        setBgBlurSavedAt(Date.now());
      } catch {/* ignore */}
      finally { setBgBlurSaving(false); }
    }, 500);
    return ()=> clearTimeout(t);
  }, [backgroundBlur, allowEdit, docId, projectId, setProject]);
  // Auto-save background fade
  useEffect(()=> {
    if(!allowEdit) return;
    const t = setTimeout(async()=> {
      setBgFadeSaving(true);
      try {
        await updateDoc(doc(db,'projects', docId || projectId), { backgroundFade });
        setProject((p:any)=> ({ ...p, backgroundFade }));
        setBgFadeSavedAt(Date.now());
      } catch {/* ignore */}
      finally { setBgFadeSaving(false); }
    }, 400);
    return ()=> clearTimeout(t);
  }, [backgroundFade, allowEdit, docId, projectId, setProject]);

  useEffect(()=> { setThemeHeaderBg(project?.themeHeaderBg || THEME_DEFAULTS.headerBg); }, [project?.themeHeaderBg]);
  useEffect(()=> { setThemeHeaderText(project?.themeHeaderText || THEME_DEFAULTS.headerText); }, [project?.themeHeaderText]);
  useEffect(()=> { setThemeAccent(project?.themeAccent || THEME_DEFAULTS.accent); }, [project?.themeAccent]);
  useEffect(()=> { setThemeAccentText(project?.themeAccentText || THEME_DEFAULTS.accentText); }, [project?.themeAccentText]);
  useEffect(()=> { setThemeAccentHover(project?.themeAccentHover || THEME_DEFAULTS.accentHover); }, [project?.themeAccentHover]);
  useEffect(()=> { setThemeTabActiveBg(project?.themeTabActiveBg || (project?.themeAccent || THEME_DEFAULTS.tabActiveBg)); }, [project?.themeTabActiveBg, project?.themeAccent]);
  useEffect(()=> { setThemeTabActiveText(project?.themeTabActiveText || THEME_DEFAULTS.tabActiveText); }, [project?.themeTabActiveText]);
  useEffect(()=> { setThemeTabInactiveText(project?.themeTabInactiveText || THEME_DEFAULTS.tabInactiveText); }, [project?.themeTabInactiveText]);
  useEffect(()=> { setThemeWidgetTitleColor(project?.themeWidgetTitleColor || THEME_DEFAULTS.widgetTitleColor); }, [project?.themeWidgetTitleColor]);

  useEffect(()=>{ setAccessSettings(normalizeAccess(project?.accessSettings)); },[project?.accessSettings]);

  function toggleView(tab:string, role:AccessLevel){
    if(!allowEdit) return;
    setAccessSettings(s=> {
      const cur = s[tab];
      const has = cur.view.includes(role);
      let newView: AccessLevel[];
      let newEdit = [...cur.edit];
      if(has){
        // Removing view: also remove from edit if present
        newView = cur.view.filter(r=> r!==role);
        if(newEdit.includes(role)) newEdit = newEdit.filter(r=> r!==role);
      } else {
        // Adding view
        newView = [...cur.view, role].sort((a,b)=> ROLES.indexOf(a)-ROLES.indexOf(b));
      }
      return { ...s, [tab]: { ...cur, view: newView, edit: newEdit } };
    });
  }
  function toggleEdit(tab:string, role:AccessLevel){
    if(!allowEdit || role==='public') return;
    setAccessSettings(s=> {
      const cur = s[tab];
      const has = cur.edit.includes(role);
      let newEdit: AccessLevel[];
      let newView = [...cur.view];
      if(has){
        // Removing edit: leave view intact
        newEdit = cur.edit.filter(r=> r!==role);
      } else {
        // Adding edit: ensure view includes role
        if(!newView.includes(role)) newView = [...newView, role].sort((a,b)=> ROLES.indexOf(a)-ROLES.indexOf(b));
        newEdit = [...cur.edit, role].sort((a,b)=> ROLES.indexOf(a)-ROLES.indexOf(b));
      }
      return { ...s, [tab]: { ...cur, view: newView, edit: newEdit } };
    });
  }
  function sanitizeAccess(inSet:AccessSettings): AccessSettings { const copy:AccessSettings = {} as any; Object.entries(inSet).forEach(([k,v])=>{ const view = Array.from(new Set(v.view)).filter(r=>ROLES.includes(r)); const edit = Array.from(new Set(v.edit)).filter(r=>ROLES.includes(r) && view.includes(r)); copy[k] = { view, edit }; }); return copy; }
  async function savePermissions(){
    if(!allowEdit) return;
    setSavingPerms(true);
    try {
      const clean = sanitizeAccess(accessSettings);
  await updateDoc(doc(db,'projects', docId || projectId), { accessSettings: clean, representatives, supporters, settingsAllowRepresentative: allowRepSettings });
      setProject((p:any)=> ({ ...p, accessSettings: clean, representatives, supporters, settingsAllowRepresentative: allowRepSettings }));
      setSavedAt(Date.now());
    } catch(e){ /* ignore */ }
    finally { setSavingPerms(false); }
  }
  function addRep(){ const val = repInput.trim(); if(!val) return; if(!representatives.includes(val)) setRepresentatives(r=>[...r,val]); setRepInput(''); }
  function removeRep(v:string){ setRepresentatives(r=> r.filter(x=> x!==v)); }
  function addSup(){ const val = supInput.trim(); if(!val) return; if(!supporters.includes(val)) setSupporters(r=>[...r,val]); setSupInput(''); }
  function removeSup(v:string){ setSupporters(r=> supporters.filter(x=> x!==v)); }

  return (
    <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm text-brand-dark space-y-10 max-w-4xl">
      <div className="space-y-4 max-w-xl">
        <h2 className="text-lg font-semibold text-brand-main">Project Settings</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
          <select
            value={projectCurrency}
            onChange={async e => {
              const val = e.target.value;
              setProjectCurrency(val);
              try {
                await updateDoc(doc(db, 'projects', docId || projectId), { currency: val });
                setProject((prev: any) => ({ ...prev, currency: val }));
              } catch { /* silent */ }
            }}
            disabled={!allowEdit}
            className="w-full border rounded px-3 py-2 text-sm disabled:opacity-60"
          >
            <option value="">Select currency…</option>
            {['USD','EUR','GBP','ZAR','KES','UGX','TZS','GHS','NGN','MWK','ETB','RWF','CAD','AUD','NZD','INR'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <p className="text-[10px] text-gray-500 mt-1">Applies as a prefix to displayed amounts (no FX conversion).</p>
          {projectCurrency && <p className="text-[10px] text-gray-600 mt-1">Symbol: <span className="font-semibold">{currencySymbol}</span></p>}
        </div>
        {/* Background Image */}
        <div className="border rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-semibold text-brand-main">Background Image</h3>
          <p className='text-[11px] text-gray-600'>Appears behind the project page. Wide image (≥1600px) recommended. Optimized & limited to 2MB.</p>
          <div className='flex flex-col md:flex-row gap-6'>
            <div className='md:w-72 w-full'>
              <div className='relative group rounded-lg overflow-hidden border border-brand-main/20 bg-brand-main/5 aspect-video flex items-center justify-center cursor-pointer hover:border-brand-main/60 transition'
                onClick={()=> { if(allowEdit && !bgUploading) (document.getElementById('project-bg-input') as HTMLInputElement)?.click(); }}
                role={allowEdit? 'button': undefined}
                tabIndex={allowEdit? 0 : -1}
                onKeyDown={e=> { if((e.key==='Enter'|| e.key===' ') && allowEdit && !bgUploading){ e.preventDefault(); (document.getElementById('project-bg-input') as HTMLInputElement)?.click(); } }}>
                {project.backgroundUrl ? (
                  <img src={project.backgroundUrl} alt='Background' className='absolute inset-0 w-full h-full object-cover'/>
                ) : (
                  <div className='text-[11px] text-gray-400 flex flex-col items-center justify-center text-center px-4'>
                    <span>{allowEdit ? 'Upload background image' : 'No background set'}</span>
                  </div>
                )}
                {allowEdit && (
                  <>
                    <input id='project-bg-input' type='file' className='hidden' accept='image/png,image/jpeg,image/webp'
                      onChange={async e=> {
                        const file = e.target.files?.[0]; if(!file) return; setBgError(''); setBgUploading(true); setBgProgress(0);
                        try {
                          async function processBg(f:File): Promise<Blob>{
                            const dataUrl: string = await new Promise((resolve, reject)=> { const fr = new FileReader(); fr.onerror=()=> reject(new Error('Read error')); fr.onload=()=> resolve(fr.result as string); fr.readAsDataURL(f); });
                            const img: HTMLImageElement = await new Promise((resolve, reject)=> { const im = new Image(); im.onload=()=> resolve(im); im.onerror=()=> reject(new Error('Image load failed')); im.src = dataUrl; });
                            const maxWidth = 2000; let { naturalWidth: w, naturalHeight: h } = img; if(w > maxWidth){ const scale = maxWidth / w; w = maxWidth; h = Math.round(h * scale); }
                            const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h; const ctx = canvas.getContext('2d'); if(!ctx) return f;
                            ctx.drawImage(img,0,0,w,h);
                            const qualities = [0.85,0.75,0.65];
                            for(const q of qualities){
                              const blob: Blob = await new Promise(res=> canvas.toBlob(b=> res(b as Blob),'image/webp', q));
                              if(blob.size <= 2*1024*1024 || q===qualities[qualities.length-1]) return blob;
                            }
                            return f;
                          }
                          const processed = await processBg(file);
                          if(processed.size > 2*1024*1024) throw new Error('Image remains over 2MB after optimization');
                          const ext = processed.type==='image/webp'? 'webp' : (file.name.split('.').pop() || 'jpg');
                          const storagePathId = docId || projectId;
                          const r = ref(storage, `projects/${storagePathId}/background.${ext}`);
                          const prev = project.backgroundUrl as string | undefined;
                          const task = uploadBytesResumable(r, processed, { contentType: processed.type || file.type });
                          task.on('state_changed', snap=> { setBgProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)); }, err=> { setBgError(err?.message || 'Upload failed'); setBgUploading(false); setBgProgress(null); }, async ()=> {
                            try {
                              const url = await getDownloadURL(task.snapshot.ref);
                              if(prev && prev !== url){
                                try {
                                  const match = prev.match(/\/o\/([^?]+)/); if(match){ const encoded = decodeURIComponent(match[1]).replace(/%2F/g,'/'); const objectPath = encoded.includes('projects/')? encoded.substring(encoded.indexOf('projects/')): encoded; const newPath = `projects/${storagePathId}/background.${ext}`; if(objectPath !== newPath){ await deleteObject(ref(storage, objectPath)); } }
                                } catch {/* ignore */}
                              }
                              await updateDoc(doc(db,'projects', storagePathId), { backgroundUrl: url });
                              setProject((p:any)=> ({ ...p, backgroundUrl: url }));
                            } catch(e:any){ setBgError(e.message || 'Upload failed'); }
                            finally { setBgUploading(false); setBgProgress(null); }
                          });
                        } catch(e:any){ setBgError(e.message || 'Upload failed'); setBgUploading(false); setBgProgress(null); }
                        finally { if(e.target) e.target.value=''; }
                      }} />
                    {!bgUploading && <div className='absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center text-[11px] font-semibold text-white opacity-0 group-hover:opacity-100 transition'>{project.backgroundUrl? 'Change' : 'Upload'}</div>}
                    {bgUploading && (
                      <div className='absolute inset-0 flex flex-col items-center justify-center bg-black/40'>
                        <div className='w-12 h-12 rounded-full border-2 border-white/60 border-t-transparent animate-spin mb-1' />
                        <span className='text-[11px] font-semibold text-white'>{bgProgress!==null? `${bgProgress}%` : '...'}</span>
                      </div>
                    )}
                    {project.backgroundUrl && !bgUploading && (
                      <button type='button' onClick={async ev=> { ev.preventDefault(); ev.stopPropagation(); if(!confirm('Remove background image?')) return; setBgUploading(true); setBgError(''); try { try { const prev = project.backgroundUrl; const match = prev.match(/\/o\/([^?]+)/); if(match){ const encoded = decodeURIComponent(match[1]).replace(/%2F/g,'/'); const objectPath = encoded.includes('projects/')? encoded.substring(encoded.indexOf('projects/')): encoded; await deleteObject(ref(storage, objectPath)); } } catch {/* ignore */} await updateDoc(doc(db,'projects', docId || projectId), { backgroundUrl: null }); setProject((p:any)=> ({ ...p, backgroundUrl: null })); } catch(e:any){ setBgError(e.message || 'Remove failed'); } finally { setBgUploading(false); } }} className='absolute top-2 right-2 bg-red-600 text-white w-7 h-7 rounded-full shadow flex items-center justify-center text-xs hover:bg-red-700' aria-label='Remove background'>×</button>
                    )}
                  </>
                )}
              </div>
              {bgError && <div className='mt-2 text-[10px] text-red-600'>{bgError}</div>}
              {bgUploading && bgProgress!==null && <div className='mt-2 text-[10px] text-gray-500'>Uploading {bgProgress}%</div>}
              {allowEdit && <div className='mt-2 text-[10px] text-gray-400'>Recommended 16:9 wide. Max 2MB.</div>}
            </div>
            <div className='flex-1 text-xs text-gray-600 space-y-3'>
              <p>Adjust readability by tuning brightness, blur and fade. Fade adds a white overlay (0 = none, higher = more white). Changes auto-save.</p>
              {project.backgroundUrl && <p className='text-green-700 font-medium'>Background image active.</p>}
              <div className='pt-2 border-t border-brand-main/10'>
                <div className='flex items-center justify-between mb-1'>
                  <span className='font-medium text-brand-main text-[11px] tracking-wide uppercase'>Brightness</span>
                  <span className='text-[10px] text-gray-500'>{backgroundBrightness.toFixed(2)}x</span>
                </div>
                <div className='flex items-center gap-3'>
                  <input type='range' min={0.2} max={2.5} step={0.05} value={backgroundBrightness} disabled={!allowEdit} onChange={e=> setBackgroundBrightness(parseFloat(e.target.value))} className='flex-1 accent-brand-main' aria-label='Background brightness' />
                  <button type='button' disabled={!allowEdit || Math.abs(backgroundBrightness-1)<0.01 || bgBrightnessSaving} onClick={()=> setBackgroundBrightness(1)} className='px-2 py-1 rounded bg-white border border-brand-main/30 text-[10px] text-brand-main disabled:opacity-40'>Reset</button>
                </div>
                {allowEdit && <div className='mt-1 text-[10px] text-gray-500 h-4'>{bgBrightnessSaving? 'Saving…' : (bgBrightnessSavedAt? 'Saved' : '')}</div>}
                <div className='mt-4 flex items-center justify-between mb-1'>
                  <span className='font-medium text-brand-main text-[11px] tracking-wide uppercase'>Blur</span>
                  <span className='text-[10px] text-gray-500'>{backgroundBlur.toFixed(0)}px</span>
                </div>
                <div className='flex items-center gap-3'>
                  <input type='range' min={0} max={30} step={1} value={backgroundBlur} disabled={!allowEdit} onChange={e=> setBackgroundBlur(parseInt(e.target.value,10))} className='flex-1 accent-brand-main' aria-label='Background blur' />
                  <button type='button' disabled={!allowEdit || backgroundBlur===0 || bgBlurSaving} onClick={()=> setBackgroundBlur(0)} className='px-2 py-1 rounded bg-white border border-brand-main/30 text-[10px] text-brand-main disabled:opacity-40'>Reset</button>
                </div>
                {allowEdit && <div className='mt-1 text-[10px] text-gray-500 h-4'>{bgBlurSaving? 'Saving…' : (bgBlurSavedAt? 'Saved' : '')}</div>}
                <div className='mt-4 flex items-center justify-between mb-1'>
                  <span className='font-medium text-brand-main text-[11px] tracking-wide uppercase'>Fade Overlay (White)</span>
                  <span className='text-[10px] text-gray-500'>{backgroundFade.toFixed(2)}</span>
                </div>
                <div className='flex items-center gap-3'>
                  <input type='range' min={0} max={0.9} step={0.05} value={backgroundFade} disabled={!allowEdit} onChange={e=> setBackgroundFade(parseFloat(e.target.value))} className='flex-1 accent-brand-main' aria-label='Background fade overlay' />
                  <button type='button' disabled={!allowEdit || Math.abs(backgroundFade-0.4)<0.01 || bgFadeSaving} onClick={()=> setBackgroundFade(0.4)} className='px-2 py-1 rounded bg-white border border-brand-main/30 text-[10px] text-brand-main disabled:opacity-40'>Reset</button>
                </div>
                {allowEdit && <div className='mt-1 text-[10px] text-gray-500 h-4'>{bgFadeSaving? 'Saving…' : (bgFadeSavedAt? 'Saved' : '')}</div>}
              </div>
            </div>
          </div>
        </div>
        {/* Organization Visibility */}
        <div className="mt-6 border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-brand-main">Organization Visibility</h3>
          <p className="text-[11px] text-gray-600 leading-relaxed">Enable this to feature the project on its linked organization's Overview tab (in addition to always appearing in the organization Projects tab). Helpful for flagship or priority initiatives.</p>
          <label className="flex items-center gap-2 text-[11px] font-medium">
            <input type="checkbox" disabled={!allowEdit} checked={showOnOrgOverview} onChange={e=> setShowOnOrgOverview(e.target.checked)} />
            Show on Organization Overview {savingVisibility && <span className='text-[10px] text-gray-400'>(saving…)</span>}
          </label>
          <div className="pt-3 border-t border-gray-200" />
          <h3 className="text-sm font-semibold text-brand-main">Public Visibility</h3>
          <p className="text-[11px] text-gray-600 leading-relaxed">Control whether this project appears in public project exploration lists and searches. Hidden projects are only accessible via direct link or within the owning organization (if you share it).</p>
          <label className="flex items-center gap-2 text-[11px] font-medium">
            <input type="checkbox" disabled={!allowEdit} checked={publicVisible} onChange={e=> setPublicVisible(e.target.checked)} />
            Publicly Listed {savingPublicVisible && <span className='text-[10px] text-gray-400'>(saving…)</span>}
          </label>
          {!publicVisible && <div className='text-[10px] text-amber-600'>Hidden: only users with direct link or organization access can reach this project.</div>}
        </div>
        {/* Theme & Colors */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-brand-main mb-4">Theme & Colors</h3>
          <p className="text-[11px] text-gray-600 mb-4">Customize this project's appearance. Colors apply to header, tabs and accent buttons.</p>
          <div className="grid md:grid-cols-2 gap-4 text-[11px]">
            <ColorInput label='Header Background' value={themeHeaderBg} onChange={setThemeHeaderBg} disabled={!allowEdit} />
            <ColorInput label='Header Text' value={themeHeaderText} onChange={setThemeHeaderText} disabled={!allowEdit} />
            <ColorInput label='Accent' value={themeAccent} onChange={setThemeAccent} disabled={!allowEdit} />
            <ColorInput label='Accent Text' value={themeAccentText} onChange={setThemeAccentText} disabled={!allowEdit} />
            <ColorInput label='Accent Hover' value={themeAccentHover} onChange={setThemeAccentHover} disabled={!allowEdit} />
            <ColorInput label='Active Tab Background' value={themeTabActiveBg} onChange={setThemeTabActiveBg} disabled={!allowEdit} />
            <ColorInput label='Active Tab Text' value={themeTabActiveText} onChange={setThemeTabActiveText} disabled={!allowEdit} />
            <ColorInput label='Inactive Tab Text' value={themeTabInactiveText} onChange={setThemeTabInactiveText} disabled={!allowEdit} />
            <ColorInput label='Widget Title Color' value={themeWidgetTitleColor} onChange={setThemeWidgetTitleColor} disabled={!allowEdit} />
          </div>
          <div className='mt-4 flex items-center gap-3'>
            <button type='button' disabled={!allowEdit || themeSaving} onClick={async()=> {
              if(!allowEdit) return; setThemeSaving(true);
              try {
                const patch = { themeHeaderBg, themeHeaderText, themeAccent, themeAccentText, themeAccentHover, themeTabActiveBg, themeTabActiveText, themeTabInactiveText, themeWidgetTitleColor };
                await updateDoc(doc(db,'projects', docId || projectId), patch);
                setProject((p:any)=> ({ ...p, ...patch }));
                setThemeSavedAt(Date.now());
              } catch {/* ignore */}
              finally { setThemeSaving(false); }
            }} className='px-4 py-2 rounded text-xs font-semibold shadow' style={{ background:'var(--project-accent, var(--org-accent, #2563eb))', color:'#fff' }}>{themeSaving? 'Saving…':'Save Theme'}</button>
            <button type='button' disabled={!allowEdit || themeSaving} onClick={()=> {
              setThemeHeaderBg(THEME_DEFAULTS.headerBg);
              setThemeHeaderText(THEME_DEFAULTS.headerText);
              setThemeAccent(THEME_DEFAULTS.accent);
              setThemeAccentText(THEME_DEFAULTS.accentText);
              setThemeAccentHover(THEME_DEFAULTS.accentHover);
              setThemeTabActiveBg(THEME_DEFAULTS.tabActiveBg);
              setThemeTabActiveText(THEME_DEFAULTS.tabActiveText);
              setThemeTabInactiveText(THEME_DEFAULTS.tabInactiveText);
              setThemeWidgetTitleColor(THEME_DEFAULTS.widgetTitleColor);
            }} className='px-4 py-2 rounded border text-xs font-semibold' style={{ borderColor:'var(--project-accent, var(--org-accent, #2563eb))', color:'var(--project-accent, var(--org-accent, #2563eb))' }}>Reset</button>
            <div className='text-[10px] text-gray-500 h-4'>{themeSaving? 'Saving…' : (themeSavedAt? 'Saved':'')}</div>
          </div>
        </div>
      {/* Permissions Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-brand-main">Permissions</h3>
          <label className="flex items-center gap-2 text-xs font-medium">
            <input type="checkbox" disabled={!allowEdit} checked={allowRepSettings} onChange={e=> setAllowRepSettings(e.target.checked)} />
            Allow Representatives to access Settings
          </label>
        </div>
        <div className="space-y-4">
          {Object.keys(DEFAULT_ACCESS).map(tab=> (
            <div key={tab} className="border rounded px-3 py-3">
              <div className="font-medium text-sm mb-2 capitalize">{tab}</div>
              <div className="flex flex-col md:flex-row gap-4 md:gap-8">
                <div className="flex-1">
                  <div className="text-[11px] font-semibold mb-1 text-brand-main">View</div>
                  <div className="flex flex-wrap gap-3">
                    {ROLES.map(r=> (
                      <label key={r} className="flex items-center gap-1 text-[11px]">
                        <input type="checkbox" disabled={!allowEdit} checked={accessSettings[tab].view.includes(r)} onChange={()=>toggleView(tab,r)} /> {ROLE_LABEL[r]}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-[11px] font-semibold mb-1 text-brand-main">Edit</div>
                  <div className="flex flex-wrap gap-3">
                    {ROLES.map(r=> (
                      <label key={r} className="flex items-center gap-1 text-[11px] opacity-90">
                        <input type="checkbox" disabled={!allowEdit || r==='public'} checked={accessSettings[tab].edit.includes(r)} onChange={()=>toggleEdit(tab,r)} /> {ROLE_LABEL[r]}
                      </label>
                    ))}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">Edit roles must also have view access.</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h4 className="font-semibold text-brand-main text-sm mb-2">Representatives</h4>
            <div className="flex gap-2 mb-2">
              <input value={repInput} onChange={e=>setRepInput(e.target.value)} placeholder="User UID or email" className="flex-1 border rounded px-2 py-1 text-sm" disabled={!allowEdit} />
              <button type="button" onClick={addRep} disabled={!allowEdit} className="px-3 py-1 text-xs rounded bg-brand-main text-white disabled:opacity-50">Add</button>
            </div>
            {representatives.length? (
              <ul className="space-y-1 text-xs">
                {representatives.map(r=> (
                  <li key={r} className="flex items-center gap-2 bg-brand-main/5 rounded px-2 py-1">
                    <span className="truncate flex-1">{r}</span>
                    {allowEdit && <button type="button" onClick={()=>removeRep(r)} className="text-red-600 hover:underline">remove</button>}
                  </li>
                ))}
              </ul>
            ) : <div className="text-xs text-gray-400">No representatives.</div>}
          </div>
          <div>
            <h4 className="font-semibold text-brand-main text-sm mb-2">Supporters</h4>
            <div className="flex gap-2 mb-2">
              <input value={supInput} onChange={e=>setSupInput(e.target.value)} placeholder="User UID or email" className="flex-1 border rounded px-2 py-1 text-sm" disabled={!allowEdit} />
              <button type="button" onClick={addSup} disabled={!allowEdit} className="px-3 py-1 text-xs rounded bg-brand-main text-white disabled:opacity-50">Add</button>
            </div>
            {supporters.length? (
              <ul className="space-y-1 text-xs">
                {supporters.map(r=> (
                  <li key={r} className="flex items-center gap-2 bg-brand-main/5 rounded px-2 py-1">
                    <span className="truncate flex-1">{r}</span>
                    {allowEdit && <button type="button" onClick={()=>removeSup(r)} className="text-red-600 hover:underline">remove</button>}
                  </li>
                ))}
              </ul>
            ) : <div className="text-xs text-gray-400">No supporters.</div>}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" onClick={savePermissions} disabled={!allowEdit || savingPerms} className="px-4 py-2 rounded bg-brand-main text-white text-sm font-semibold disabled:opacity-50">{savingPerms? 'Saving...':'Save Permissions'}</button>
          {savedAt && <span className="text-xs text-gray-500">Saved {new Date(savedAt).toLocaleTimeString()}</span>}
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed">Roles cascade upward. Public edits are never allowed. Representatives/supporters lists are raw identifiers (UID or email) that your auth rules can interpret.</p>
      </div>
      <div className="pt-2">
        <h2 className="text-lg font-semibold text-brand-main mb-1">Danger Zone</h2>
        <p className="text-sm text-gray-600">Deleting a project is permanent. All updates and data stored directly on this project document will be removed. This action cannot be undone.</p>
      </div>
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Type <span className="font-mono text-brand-main">delete</span> to enable the delete button.</label>
        <input
          type="text"
          value={deleteInput}
          onChange={e => setDeleteInput(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="delete"
          disabled={deleting}
        />
  {deleteError && <div className="text-sm text-red-600">{deleteError}</div>}
  <button
          disabled={deleteInput.trim().toLowerCase() !== 'delete' || deleting}
          onClick={async () => {
            if (deleteInput.trim().toLowerCase() !== 'delete') return;
            if (!confirm('Are you absolutely sure you want to delete this project? This cannot be undone.')) return;
            setDeleting(true); setDeleteError('');
            try {
              const user = auth?.currentUser;
              if (!user) throw new Error('Must be signed in');
              if (project.createdBy && ![user.displayName, user.email, user.uid].includes(project.createdBy)) {
                const isAdmin = (user as any)?.stsTokenManager || false; // placeholder admin check
                if (!isAdmin) throw new Error('You are not allowed to delete this project');
              }
              await deleteDoc(doc(db, 'projects', docId || projectId));
              router.push('/projects');
            } catch (e: any) { setDeleteError(e.message || 'Failed to delete'); }
            finally { setDeleting(false); }
          }}
          className="px-4 py-2 rounded bg-red-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700"
  >{deleting ? 'Deleting...' : 'Delete Project'}</button>
      </div>
    </div>
    </div>
  );
}

function ColorInput({ label, value, onChange, disabled }: { label:string; value:string; onChange:(v:string)=>void; disabled?: boolean }){
  return (
    <label className='flex items-center gap-2 font-medium'>
      <span className='w-40'>{label}</span>
      <input type='color' value={value} disabled={disabled} onChange={e=> onChange(e.target.value)} className='h-8 w-12 border rounded p-0 cursor-pointer disabled:opacity-50' />
      <input type='text' value={value} disabled={disabled} onChange={e=> onChange(e.target.value)} className='flex-1 border rounded px-2 py-1 text-[11px] font-mono disabled:opacity-50' />
      <span className='h-6 w-6 rounded border shadow-inner' style={{ background:value }}></span>
    </label>
  );
}
