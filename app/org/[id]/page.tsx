"use client";
import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { collection, query, where, getDocs, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, storage } from '../../../src/lib/firebase';
import { getAuth } from 'firebase/auth';
import PageShell from '../../../components/PageShell';
import { InformationCircleIcon, UserGroupIcon, ArrowPathIcon, Cog6ToothIcon, CurrencyDollarIcon, ArrowLeftOnRectangleIcon, Squares2X2Icon, PencilIcon, EyeIcon, PhotoIcon, ArrowUpTrayIcon, ShieldCheckIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import OrgEnhancedOverviewTab from 'components/OrgEnhancedOverviewTab';
import OrgSettingsTab from 'components/OrgSettingsTab';
import OrgProjectsTab from 'components/OrgProjectsTab';
import OrgTeamTab from 'components/OrgTeamTab';
import OrgLocationsTab from 'components/OrgLocationsTab';
import ProfileLoadingShell from 'components/ProfileLoadingShell';

export default function OrganizationDetailPage(){
  const params = useParams();
  const orgIdParam = params.id as string;
  const [orgDoc, setOrgDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [editMode, setEditMode] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [enrichedTeam, setEnrichedTeam] = useState<any[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
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

  const isActualOwner = !!(user && orgDoc?.ownerUid === user.uid);
  const isOwner = isActualOwner && !previewMode;

  async function uploadCoverPhoto(file: File) {
    if (!orgDoc?.id) return;
    setUploadingCover(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const sRef = storageRef(storage, `organizations/${orgDoc.id}/coverPhoto.${ext}`);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      await updateDoc(doc(db, 'organizations', orgDoc.id), { coverPhotoUrl: url });
    } catch (e: any) {
      console.error('Cover photo upload failed', e);
    } finally {
      setUploadingCover(false);
    }
  }

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
    locations: ['public','supporter','representative','owner'],
    updates: ['supporter','representative','owner'],
    team: ['supporter','representative','owner'],
    finance: ['representative','owner'],
    compliance: ['representative','owner'],
    settings: ['owner']
  };
  function canView(tabId:string): boolean {
    const cfg = accessSettings?.[tabId];
    const allowed: AccessLevel[] = Array.isArray(cfg?.view)? cfg.view : (typeof cfg==='string'? DEFAULT_VIEW[tabId] : DEFAULT_VIEW[tabId]);
    return allowed? allowed.includes(viewerRole) : true;
  }
  // In view mode (public), only show Overview and Our Projects
  const publicOnlyTabs = ['overview', 'projects'];
  const rawTabs = [
    { id: 'overview', label: 'Overview', icon: InformationCircleIcon },
    { id: 'projects', label: 'Our Projects', icon: Squares2X2Icon },
    { id: 'locations', label: 'Locations', icon: MapPinIcon },
    { id: 'updates', label: 'Updates', icon: ArrowPathIcon },
    { id: 'team', label: 'Team', icon: UserGroupIcon },
    { id: 'finance', label: 'Finance', icon: CurrencyDollarIcon },
    { id: 'compliance', label: 'Compliance', icon: ShieldCheckIcon },
    ...(isActualOwner ? [{ id: 'settings', label: 'Settings', icon: Cog6ToothIcon }] : []),
  ];
  const tabs = rawTabs.filter(t=> {
    if(viewerRole === 'public') return publicOnlyTabs.includes(t.id);
    return canView(t.id);
  });
  useEffect(()=> { if(!tabs.find(t=> t.id===activeTab)) setActiveTab(tabs[0]?.id || 'overview'); }, [JSON.stringify(tabs.map(t=>t.id)), activeTab]);
  const showNav = tabs.length > 1;

  if(loading) return <ProfileLoadingShell title="Organization" />;
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
          {isActualOwner && user && (
            <>
              <button
                onClick={() => setPreviewMode(p => !p)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border transition-all ${
                  previewMode
                    ? 'bg-orange-500 text-white border-orange-400 hover:bg-orange-600'
                    : 'bg-white/15 text-white border-white/25 hover:bg-white/25'
                }`}
                title={previewMode ? 'Return to edit mode' : 'Preview as public visitor'}
              >
                {previewMode ? (
                  <><PencilIcon className='h-4 w-4' /><span>Edit Mode</span></>
                ) : (
                  <><EyeIcon className='h-4 w-4' /><span>Preview</span></>
                )}
              </button>
              {!previewMode && (
                <button onClick={() => setEditMode(m => !m)} className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold border transition ${editMode ? 'shadow-inner' : ''}`} style={editMode ? { background: 'var(--org-accent)', color: 'var(--org-accent-text)', borderColor: 'var(--org-accent)' } : { background: 'rgba(255,255,255,0.1)', color: 'var(--org-header-text)', borderColor: 'rgba(255,255,255,0.3)' }}>
                  <span>Edit</span>
                  <span className='inline-flex items-center h-4 w-8 rounded-full transition' style={{ background: editMode ? 'var(--org-accent-hover)' : 'rgba(255,255,255,0.3)' }}>
                    <span className='h-4 w-4 rounded-full bg-white shadow transform transition' style={{ transform: editMode ? 'translateX(1rem)' : 'translateX(0)' }}></span>
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      )}
  className='flex-1'
    >
      <div className='space-y-0'>

        {/* Hero Header */}
        <div className='relative w-[calc(100%+3rem)] md:w-[calc(100%+4rem)] -ml-6 md:-ml-8' style={{ marginTop: '-2rem' }}>
          {/* Background with overlay */}
          <div className='absolute inset-0 bg-gray-900 overflow-hidden'>
            {orgDoc.coverPhotoUrl && (
              <>
                <img src={orgDoc.coverPhotoUrl} alt={orgDoc.name} className='absolute inset-0 w-full h-full object-cover' />
                <div className='absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20'></div>
              </>
            )}
          </div>

          {/* Org Logo - Top Right */}
          {orgDoc.logoUrl && (
            <div className='absolute top-10 right-[2.7rem] z-20'>
              <img src={orgDoc.logoUrl} alt={orgDoc.name} className='h-24 w-auto object-contain bg-white rounded-lg p-3 shadow-2xl border-2 border-gray-200' />
            </div>
          )}

          {/* Org ID badge - Bottom Right */}
          <div className='absolute bottom-10 right-[2.7rem] z-20'>
            <div className='px-4 py-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20'>
              <span className='text-xl font-mono font-bold text-white'>{orgDoc.orgId}</span>
            </div>
          </div>

          {/* Cover photo upload (owner, edit mode) */}
          {isOwner && editMode && (
            <div className='absolute bottom-4 left-[2.7rem] z-20'>
              <label className='flex items-center gap-2 px-3 py-2 bg-black/50 backdrop-blur-sm text-white text-xs font-medium rounded-lg border border-white/20 cursor-pointer hover:bg-black/70 transition'>
                {uploadingCover ? (
                  <><ArrowUpTrayIcon className='h-4 w-4 animate-bounce' /><span>Uploading…</span></>
                ) : (
                  <><PhotoIcon className='h-4 w-4' /><span>{orgDoc.coverPhotoUrl ? 'Change Cover Photo' : 'Upload Cover Photo'}</span></>
                )}
                <input type='file' accept='image/*' className='hidden' disabled={uploadingCover} onChange={e => { const f = e.target.files?.[0]; if (f) uploadCoverPhoto(f); e.target.value = ''; }} />
              </label>
            </div>
          )}

          {/* Hero Content */}
          <div className='relative py-12 md:py-20 px-8'>
            <div className='max-w-3xl'>
              {orgDoc.orgType && (
                <div className='inline-block mb-4 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20'>
                  <span className='text-xs font-semibold text-white uppercase tracking-wider'>{orgDoc.orgType}</span>
                </div>
              )}
              <h1 className='text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight'>{orgDoc.name}</h1>
              {orgDoc.tagline && (
                <p className='text-lg text-white/80 max-w-xl'>{orgDoc.tagline}</p>
              )}
            </div>
          </div>
        </div>

        {/* Black border line */}
        <div className='w-[calc(100%+3rem)] md:w-[calc(100%+4rem)] -ml-6 md:-ml-8 h-[2px] bg-black'></div>

        {/* Tab Nav + Content */}
        <div className='pt-6 flex flex-col md:flex-row gap-6 flex-1 min-h-0 items-stretch'>
          {showNav && (
            <nav className='md:w-56 flex md:flex-col gap-1 border-b md:border-b-0 md:border-r border-gray-200 pb-3 md:pb-0 md:pr-4 shrink-0'>
              {tabs.map(t => {
                const Icon = t.icon;
                const active = activeTab === t.id;
                return (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active ? 'bg-orange-50 text-orange-700 border border-orange-200 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                    <Icon className={`h-5 w-5 ${active ? 'text-orange-600' : 'text-gray-400'}`} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          <div className='flex-1 min-w-0 flex flex-col min-h-0'>
            {activeTab === 'overview' && (
              <div className='flex-1 flex flex-col min-h-0'>
                <OrgEnhancedOverviewTab
                  org={orgDoc}
                  isOwner={isOwner}
                  editMode={editMode}
                  onOrgUpdate={(patch: Record<string, any>) => setOrgDoc((prev: any) => ({ ...prev, ...patch }))}
                  logoUploading={logoUploading}
                  setLogoUploading={setLogoUploading}
                  logoError={logoError}
                  setLogoError={setLogoError}
                />
              </div>
            )}
            {activeTab === 'updates' && canView('updates') && (
              <div className='flex-1 flex flex-col min-h-0'>
                <div className='bg-white rounded-lg shadow-md p-6 text-sm text-gray-600 flex-1'>Organization updates coming soon.</div>
              </div>
            )}
            {activeTab === 'projects' && canView('projects') && (
              <div className='flex-1 flex flex-col min-h-0'>
                <OrgProjectsTab org={orgDoc} isOwner={isOwner} currentUser={user} />
              </div>
            )}
            {activeTab === 'team' && canView('team') && (
              <div className='flex-1 flex flex-col min-h-0'>
                <OrgTeamTab org={orgDoc} isOwner={isOwner} editMode={editMode} />
              </div>
            )}
            {activeTab === 'locations' && canView('locations') && (
              <div className='flex-1 flex flex-col min-h-0'>
                <OrgLocationsTab org={orgDoc} isOwner={isOwner} />
              </div>
            )}
            {activeTab === 'finance' && canView('finance') && (
              <div className='flex-1 flex flex-col min-h-0'>
                <div className='bg-white rounded-lg shadow-md p-6 text-sm text-gray-600 flex-1'>Finance summary coming soon.</div>
              </div>
            )}
            {activeTab === 'compliance' && canView('compliance') && (
              <div className='flex-1 flex flex-col min-h-0'>
                <OrgComplianceTab org={orgDoc} isOwner={isOwner} />
              </div>
            )}
            {isOwner && activeTab === 'settings' && (
              <div className='flex-1 flex flex-col min-h-0'>
                <OrgSettingsTab
                  org={orgDoc}
                  enrichedTeam={enrichedTeam}
                  isOwner={isOwner}
                  editMode={editMode}
                  onOrgUpdate={(patch: Record<string, any>) => setOrgDoc((prev: any) => ({ ...prev, ...patch }))}
                />
              </div>
            )}
          </div>
        </div>

      </div>
  </PageShell>
  </div>
    </>
  );
}

function OrgComplianceTab({ org, isOwner }: { org: any; isOwner: boolean }) {
  const ORG_TYPES = ['Religious Organization', 'NGO', 'Business', 'Church', 'Other'];
  const [companyNumber, setCompanyNumber] = useState(org.companyNumber || '');
  const [taxId, setTaxId] = useState(org.taxId || '');
  const [orgType, setOrgType] = useState(org.orgType || '');
  const [customType, setCustomType] = useState(!ORG_TYPES.includes(org.orgType || '') ? (org.orgType || '') : '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [safeguardingUploading, setSafeguardingUploading] = useState(false);
  const [safeguardingError, setSafeguardingError] = useState('');
  const [safeguardingUrl, setSafeguardingUrl] = useState(org.safeguardingPolicyUrl || '');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaveError(''); setSaveSuccess(false);
    try {
      const finalType = orgType === 'Other' ? (customType.trim() || 'Other') : orgType;
      await updateDoc(doc(db, 'organizations', org.id), {
        companyNumber: companyNumber.trim() || null,
        taxId: taxId.trim() || null,
        orgType: finalType || null,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: any) {
      setSaveError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleSafeguardingUpload(file: File) {
    setSafeguardingUploading(true); setSafeguardingError('');
    try {
      const uid = getAuth().currentUser?.uid;
      if (!uid) throw new Error('You must be signed in.');
      const sRef = storageRef(storage, `organizations/safeguarding/${uid}_${Date.now()}_${file.name}`);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      await updateDoc(doc(db, 'organizations', org.id), { safeguardingPolicyUrl: url });
      setSafeguardingUrl(url);
    } catch (e: any) {
      setSafeguardingError(e.message || 'Upload failed');
    } finally {
      setSafeguardingUploading(false);
    }
  }

  return (
    <div className='space-y-6'>
      {/* Safeguarding Policy */}
      <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-6'>
        <div className='flex items-center gap-2 mb-4'>
          <ShieldCheckIcon className='h-5 w-5 text-brand-main' />
          <h2 className='text-base font-semibold text-gray-900'>Safeguarding Policy</h2>
        </div>
        {safeguardingUrl ? (
          <div className='flex flex-col sm:flex-row sm:items-center gap-3 mb-4'>
            <a
              href={safeguardingUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-main/10 text-brand-main text-sm font-medium hover:bg-brand-main/20 transition'
            >
              <ArrowUpTrayIcon className='h-4 w-4 rotate-180' />
              View Current Document
            </a>
            <span className='text-xs text-gray-500'>Uploaded safeguarding policy</span>
          </div>
        ) : (
          <p className='text-sm text-gray-500 mb-4'>No safeguarding policy has been uploaded yet.</p>
        )}
        {isOwner && (
          <div>
            <label className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium cursor-pointer transition'>
              {safeguardingUploading ? (
                <><ArrowUpTrayIcon className='h-4 w-4 animate-bounce' /><span>Uploading…</span></>
              ) : (
                <><ArrowUpTrayIcon className='h-4 w-4' /><span>{safeguardingUrl ? 'Replace Document' : 'Upload Document'}</span></>
              )}
              <input
                type='file'
                accept='.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                className='hidden'
                disabled={safeguardingUploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleSafeguardingUpload(f); e.target.value = ''; }}
              />
            </label>
            <p className='text-xs text-gray-400 mt-2'>Accepted formats: PDF, DOC, DOCX</p>
            {safeguardingError && <p className='text-xs text-red-600 mt-1'>{safeguardingError}</p>}
          </div>
        )}
      </div>

      {/* Company Information */}
      <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-6'>
        <div className='flex items-center gap-2 mb-4'>
          <InformationCircleIcon className='h-5 w-5 text-brand-main' />
          <h2 className='text-base font-semibold text-gray-900'>Company Information</h2>
        </div>
        {isOwner ? (
          <form onSubmit={handleSave} className='space-y-4'>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Company / Charity Number</label>
                <input
                  className='w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main transition'
                  value={companyNumber}
                  onChange={e => setCompanyNumber(e.target.value)}
                  placeholder='e.g. 12345678'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Tax ID / EIN</label>
                <input
                  className='w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main transition'
                  value={taxId}
                  onChange={e => setTaxId(e.target.value)}
                  placeholder='e.g. 12-3456789'
                />
              </div>
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>Organization Type</label>
              <div className='flex flex-wrap gap-2'>
                {ORG_TYPES.map(t => (
                  <button
                    key={t}
                    type='button'
                    onClick={() => { setOrgType(t); if (t !== 'Other') setCustomType(''); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                      orgType === t
                        ? 'bg-brand-main text-white border-brand-main'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-brand-main'
                    }`}
                  >
                    {t}
                  </button>
                ))}
                {!ORG_TYPES.includes(orgType) && orgType && (
                  <button
                    type='button'
                    onClick={() => { setOrgType(orgType); }}
                    className='px-3 py-1.5 rounded-full text-xs font-semibold border bg-brand-main text-white border-brand-main'
                  >
                    {orgType}
                  </button>
                )}
              </div>
              {orgType === 'Other' && (
                <input
                  className='mt-2 border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-brand-main/30'
                  value={customType}
                  onChange={e => setCustomType(e.target.value)}
                  placeholder='Describe your organization type'
                />
              )}
            </div>
            {saveError && <p className='text-sm text-red-600'>{saveError}</p>}
            {saveSuccess && <p className='text-sm text-green-600'>Saved successfully.</p>}
            <button
              type='submit'
              disabled={saving}
              className='px-5 py-2 rounded-lg bg-brand-main text-white text-sm font-semibold hover:bg-brand-dark disabled:opacity-60 transition'
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        ) : (
          <dl className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm'>
            <div>
              <dt className='text-xs font-medium text-gray-500 uppercase tracking-wide'>Company / Charity Number</dt>
              <dd className='mt-1 text-gray-900'>{org.companyNumber || <span className='text-gray-400'>Not provided</span>}</dd>
            </div>
            <div>
              <dt className='text-xs font-medium text-gray-500 uppercase tracking-wide'>Tax ID / EIN</dt>
              <dd className='mt-1 text-gray-900'>{org.taxId || <span className='text-gray-400'>Not provided</span>}</dd>
            </div>
            <div>
              <dt className='text-xs font-medium text-gray-500 uppercase tracking-wide'>Organization Type</dt>
              <dd className='mt-1 text-gray-900'>{org.orgType || <span className='text-gray-400'>Not specified</span>}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
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

