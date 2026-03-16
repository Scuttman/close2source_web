"use client";
import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { collection, query, where, getDocs, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, storage } from '../../../src/lib/firebase';
import { getAuth } from 'firebase/auth';
import PageShell from '../../../components/PageShell';
import { InformationCircleIcon, UserGroupIcon, ArrowPathIcon, Cog6ToothIcon, CurrencyDollarIcon, ArrowLeftOnRectangleIcon, Squares2X2Icon } from '@heroicons/react/24/outline';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import OrgEnhancedOverviewTab from 'components/OrgEnhancedOverviewTab';
import OrgSettingsTab from 'components/OrgSettingsTab';
import OrgProjectsTab from 'components/OrgProjectsTab';
import OrgTeamTab from 'components/OrgTeamTab';

export default function OrganizationDetailPage(){
  const params = useParams();
  const orgIdParam = params.id as string;
  const [orgDoc, setOrgDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [editMode, setEditMode] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [enrichedTeam, setEnrichedTeam] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  // Ownership transfer state moved into OrgSettingsTab
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  useEffect(()=> {
    const auth = getAuth();
    const unsub = auth.onAuthStateChanged(u=> setUser(u));
    setUser(auth.currentUser);
    return ()=> unsub();
  }, []);
  // Support multiple possible query parameter names for the external site return URL
  const rawReturnUrl = searchParams?.get('returnUrl') || searchParams?.get('receiver') || searchParams?.get('return') || searchParams?.get('ref') || '';
  const returnUrl = useMemo(()=> {
    if(!rawReturnUrl) return '';
    try {
      const decoded = decodeURIComponent(rawReturnUrl);
      // Basic safety: only allow http/https
      const url = new URL(decoded, decoded.startsWith('http')? undefined : undefined);
      if(url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
    } catch {/* ignore invalid */}
    return '';
  }, [rawReturnUrl]);

  useEffect(()=>{ const qtab = searchParams?.get('tab'); if(qtab) setActiveTab(qtab); },[searchParams]);

  // Resolve document by orgId field (like project code) once, then subscribe real-time
  useEffect(()=>{
    let unsub: any = null; let cancelled = false;
    (async()=>{
      setLoading(true); setError(''); setOrgDoc(null);
      try {
        const qy = query(collection(db,'organizations'), where('orgId','==', orgIdParam));
        const snap = await getDocs(qy);
        if(snap.empty){ setError('Organization not found'); setLoading(false); return; }
        const first = snap.docs[0];
        unsub = onSnapshot(doc(db,'organizations', first.id), d=> {
          if(!d.exists()){ setError('Organization not found'); setOrgDoc(null); setLoading(false); return; }
          const data:any = d.data();
          setOrgDoc({ id: d.id, ...data });
          setDescDraft(data.bio || '');
          setLoading(false);
        }, err=> { setError(err.message || 'Error loading organization'); setLoading(false); });
      } catch(e:any){ if(!cancelled){ setError(e.message || 'Error loading organization'); setLoading(false);} }
    })();
    return ()=> { cancelled = true; if(unsub) unsub(); };
  },[orgIdParam]);

  // Enrich team members with user profile (name, surname, photo) if they match a user account by email or uid
  useEffect(()=> {
    // Only enrich (and thus read from users collection) when Team tab is actually visible
    if(activeTab !== 'team') return; // prevents background reads when user never opens Team tab
    let cancelled = false;
    async function enrich(){
      if(!orgDoc || !Array.isArray(orgDoc.team) || !orgDoc.team.length) { if(!cancelled){ setEnrichedTeam([]); } return; }
      setTeamLoading(true);
      try {
        const members:any[] = orgDoc.team;
        const emails = members.map(m=> m.email).filter((e:string)=> e && typeof e==='string');
        const uniqueEmails = Array.from(new Set(emails)).slice(0,10); // Firestore 'in' limit
        let userDocs: Record<string, any> = {};
        if(uniqueEmails.length){
          const usersQ = query(collection(db,'users'), where('email','in', uniqueEmails));
          const snap = await getDocs(usersQ);
          snap.forEach(d=> { const data = d.data(); userDocs[(data.email||'').toLowerCase()] = { uid: d.id, ...data }; });
        }
        if(cancelled) return;
        const enriched = members.map(m=> {
          const emailKey = (m.email||'').toLowerCase();
            const prof = userDocs[emailKey];
            if(prof){
              return { ...m, uid: prof.uid, name: (prof.name || '') + (prof.surname? (' ' + prof.surname) : ''), photoURL: prof.photoURL || m.photoURL, type: 'user' };
            }
            return m;
        });
        setEnrichedTeam(enriched);
      } catch { if(!cancelled) setEnrichedTeam(orgDoc?.team || []); }
      finally { if(!cancelled) setTeamLoading(false); }
    }
    enrich();
    return ()=> { cancelled = true; };
  }, [orgDoc?.team, orgDoc?.id, activeTab]);

  const isOwner = !!(user && orgDoc?.ownerUid === user.uid);
  type AccessLevel = 'public' | 'supporter' | 'representative' | 'owner';
  const accessSettings = orgDoc?.accessSettings || {};
  const representatives: string[] = Array.isArray(orgDoc?.representatives)? orgDoc.representatives: [];
  const supporters: string[] = Array.isArray(orgDoc?.supporters)? orgDoc.supporters: [];
  let viewerRole: AccessLevel = 'public';
  if(isOwner) viewerRole = 'owner';
  else if(user){
    const ident = [user.uid, user.email, user.displayName].filter(Boolean);
    if(representatives.some(r=> ident.includes(r))) viewerRole = 'representative';
    else if(supporters.some(s=> ident.includes(s))) viewerRole = 'supporter';
  }
  const DEFAULT_VIEW: Record<string, AccessLevel[]> = {
    overview: ['public','supporter','representative','owner'],
    projects: ['public','supporter','representative','owner'],
    updates: ['supporter','representative','owner'],
    team: ['supporter','representative','owner'],
    finance: ['representative','owner'],
    settings: ['owner']
  };
  function canView(tabId:string): boolean {
    const cfg = accessSettings?.[tabId];
    const allowed: AccessLevel[] = Array.isArray(cfg?.view)? cfg.view : (typeof cfg==='string'? DEFAULT_VIEW[tabId] : DEFAULT_VIEW[tabId]);
    return allowed? allowed.includes(viewerRole) : true;
  }
  const rawTabs = [
    { id: 'overview', label: 'Overview', icon: InformationCircleIcon },
    { id: 'projects', label: 'Our Projects', icon: Squares2X2Icon },
    { id: 'updates', label: 'Updates', icon: ArrowPathIcon },
    { id: 'team', label: 'Team', icon: UserGroupIcon },
    { id: 'finance', label: 'Finance', icon: CurrencyDollarIcon },
    ...(isOwner ? [{ id: 'settings', label: 'Settings', icon: Cog6ToothIcon }] : []),
  ];
  const tabs = rawTabs.filter(t=> canView(t.id));
  useEffect(()=> { if(!tabs.find(t=> t.id===activeTab)) setActiveTab(tabs[0]?.id || 'overview'); }, [JSON.stringify(tabs.map(t=>t.id)), activeTab]);
  // If no logged-in user, force overview tab (projects could later be allowed – keep simple for now)
  useEffect(()=> { if(!user && activeTab!=='overview') setActiveTab('overview'); }, [user, activeTab]);
  const showNav = !!user; // hide left nav for visitors (logged out)

  if(loading) return <PageShell title={<span>Organization</span>}><div className='p-6 text-sm text-gray-500'>Loading...</div></PageShell>;
  if(error) return <PageShell title={<span>Organization</span>}><div className='p-6 text-sm text-red-600'>{error}</div></PageShell>;
  if(!orgDoc) return <PageShell title={<span>Organization</span>}><div className='p-6 text-sm text-gray-500'>Not found.</div></PageShell>;

  return (
    <>
  {/* Org theme CSS variables injected only when custom values exist */}
      {orgDoc && (
        <style>{`#org-theme-${orgDoc.id} {${[
          orgDoc.themeHeaderBg? `--org-header-bg:${orgDoc.themeHeaderBg};` : '',
          orgDoc.themeHeaderText? `--org-header-text:${orgDoc.themeHeaderText};` : '',
          orgDoc.themeAccent? `--org-accent:${orgDoc.themeAccent};` : '',
          orgDoc.themeAccentText? `--org-accent-text:${orgDoc.themeAccentText};` : '',
          orgDoc.themeAccentHover? `--org-accent-hover:${orgDoc.themeAccentHover};` : '',
          orgDoc.themeTabActiveBg? `--org-tab-active-bg:${orgDoc.themeTabActiveBg};` : '',
          orgDoc.themeTabActiveText? `--org-tab-active-text:${orgDoc.themeTabActiveText};` : '',
          orgDoc.themeTabInactiveText? `--org-tab-inactive-text:${orgDoc.themeTabInactiveText};` : ''
          ,orgDoc.themeWidgetTitleColor? `--org-widget-title-color:${orgDoc.themeWidgetTitleColor};` : ''
        ].filter(Boolean).join('')}}`}</style>
      )}
      {orgDoc.backgroundUrl && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <img
            src={orgDoc.backgroundUrl}
            alt={`${orgDoc.name} background`}
            style={{ filter: `brightness(${typeof orgDoc.backgroundBrightness === 'number' ? orgDoc.backgroundBrightness : 1}) blur(${typeof orgDoc.backgroundBlur === 'number' ? orgDoc.backgroundBlur : 0}px)` }}
            className="w-full h-full object-cover object-center transition-[filter] duration-300" />
          {/* Existing gradient plus adjustable fade overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-white/5" />
          <div className="absolute inset-0" style={{ background: `rgba(255,255,255,${typeof orgDoc.backgroundFade === 'number' ? orgDoc.backgroundFade : 0.4})` }} />
        </div>
      )}
  <div className='flex flex-col flex-1 min-h-0' id={`org-theme-${orgDoc.id}`}>
  <PageShell
      title={<span>{orgDoc.name}</span>}
      headerStyle={{ background: 'var(--org-header-bg)', color: 'var(--org-header-text)' }}
      headerRight={(
        <div className='flex items-center gap-3'>
          <span className='inline-flex items-center px-3 py-2 rounded-md border text-sm font-mono font-semibold tracking-wide'
            style={{ background:'#6b7280', borderColor:'#ffffff', color:'#ffffff' }}>{orgDoc.orgId}</span>
          {returnUrl && (
            <a href={returnUrl} className='px-3 py-2 rounded-md text-xs font-semibold border transition flex items-center gap-1'
               style={{ background:'rgba(255,255,255,0.1)', color:'var(--org-header-text)', borderColor:'rgba(255,255,255,0.3)' }}
               rel='noopener noreferrer'>
              <ArrowLeftOnRectangleIcon className='h-4 w-4' /> Exit
            </a>
          )}
          {isOwner && user && (
            <button onClick={()=> setEditMode(m=>!m)} className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold border transition ${editMode? 'shadow-inner' : ''}`} style={ editMode ? { background:'var(--org-accent)', color:'var(--org-accent-text)', borderColor:'var(--org-accent)' } : { background:'rgba(255,255,255,0.1)', color:'var(--org-header-text)', borderColor:'rgba(255,255,255,0.3)' } }>
              <span>Edit</span>
              <span className='inline-flex items-center h-4 w-8 rounded-full transition' style={{ background: editMode? 'var(--org-accent-hover)' : 'rgba(255,255,255,0.3)' }}>
                <span className='h-4 w-4 rounded-full bg-white shadow transform transition' style={{ transform: editMode? 'translateX(1rem)' : 'translateX(0)' }}></span>
              </span>
            </button>
          )}
        </div>
      )}
  className='flex-1'
  contentClassName='p-6'
    >
      <div className='flex flex-col md:flex-row gap-6 flex-1 min-h-0 items-stretch'>
        {showNav && (
          <nav className='md:w-56 flex md:flex-col gap-2 border-b md:border-b-0 md:border-r border-brand-main/10 pb-2 md:pb-0 md:h-full'>
            {tabs.map(t=> { const Icon = t.icon; const active = activeTab===t.id; return (
              <button key={t.id} onClick={()=> setActiveTab(t.id)}
                className='flex items-center gap-2 px-3 py-2 rounded md:rounded-none md:border-l-4 text-sm font-medium transition'
                style={ active ? { background:'var(--org-tab-active-bg)', color:'var(--org-tab-active-text)', borderLeftColor:'var(--org-accent)' } : { color:'var(--org-tab-inactive-text)', borderLeftColor:'transparent' } }>
                <Icon className='h-5 w-5' /> <span>{t.label}</span>
              </button>
            ); })}
          </nav>
        )}
  <div className='flex-1 min-w-0 flex flex-col min-h-0'>
          {activeTab==='overview' && (
            <div className='flex-1 flex flex-col min-h-0'>
              <OrgEnhancedOverviewTab
                org={orgDoc}
                isOwner={isOwner}
                editMode={editMode}
                onOrgUpdate={(patch:Record<string,any>)=> setOrgDoc((prev:any)=> ({ ...prev, ...patch }))}
                logoUploading={logoUploading}
                setLogoUploading={setLogoUploading}
                logoError={logoError}
                setLogoError={setLogoError}
              />
            </div>
          )}
          {activeTab==='updates' && canView('updates') && (
            <div className='flex-1 flex flex-col min-h-0'>
              <div className='bg-white border border-brand-main/10 rounded-xl p-6 text-sm text-gray-600 flex-1'>Organization updates coming soon.</div>
            </div>
          )}
          {activeTab==='projects' && canView('projects') && (
            <div className='flex-1 flex flex-col min-h-0'>
              <OrgProjectsTab org={orgDoc} isOwner={isOwner} currentUser={user} />
            </div>
          )}
          {activeTab==='team' && canView('team') && (
            <div className='flex-1 flex flex-col min-h-0'>
              <OrgTeamTab org={orgDoc} isOwner={isOwner} editMode={editMode} />
            </div>
          )}
          {activeTab==='finance' && canView('finance') && (
            <div className='flex-1 flex flex-col min-h-0'>
              <div className='bg-white border border-brand-main/10 rounded-xl p-6 text-sm text-gray-600 flex-1'>Finance summary coming soon.</div>
            </div>
          )}
          {isOwner && activeTab==='settings' && (
            <div className='flex-1 flex flex-col min-h-0'>
              <OrgSettingsTab
                org={orgDoc}
                enrichedTeam={enrichedTeam}
                isOwner={isOwner}
                editMode={editMode}
                onOrgUpdate={(patch:Record<string,any>)=> setOrgDoc((prev:any)=> ({ ...prev, ...patch }))}
              />
            </div>
          )}
        </div>
      </div>
  </PageShell>
  </div>
    </>
  );
}

function OrgProjectsList({ orgId }: { orgId:string }){
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{ let mounted=true; (async()=>{
    try { const qy = query(collection(db,'projects'), where('organizationId','==', orgId)); const snap = await getDocs(qy); if(!mounted) return; setProjects(snap.docs.map(d=> ({ id: d.id, ...d.data() }))); }
    catch{ /* ignore */ } finally { if(mounted) setLoading(false); }
  })(); return ()=> { mounted=false; }; }, [orgId]);
  if(loading) return <div className='text-xs text-gray-500'>Loading...</div>;
  if(!projects.length) return <div className='text-xs text-gray-500'>No linked projects.</div>;
  return (
    <ul className='space-y-2'>
  {projects.map(p=> <li key={p.id} className='text-sm'><a href={`/projects/${p.projectId || p.id}`} className='text-brand-main underline'>{p.name}</a></li>)}
    </ul>
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
    try { await updateDoc(doc(db,'organizations', orgDbId), { orgType: newType }); }
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

