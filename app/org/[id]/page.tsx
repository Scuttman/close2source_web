"use client";
import { useEffect, useState, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getOrgByCode, updateOrg, subscribeOrg, getUsersByEmails, subscribeOrgProjects, subscribeOrgShowcases, createShowcase, deleteShowcase } from '@/lib/dal';
import { generateCode } from '../../../src/lib/codes';
import { storage } from '../../../src/lib/firebase';
import { getAuth } from 'firebase/auth';
import PageShell from '../../../components/PageShell';
import { InformationCircleIcon, UserGroupIcon, ArrowPathIcon, Cog6ToothIcon, CurrencyDollarIcon, ArrowLeftOnRectangleIcon, Squares2X2Icon, PencilIcon, EyeIcon, PhotoIcon, ArrowUpTrayIcon, ShieldCheckIcon, MapPinIcon, LinkIcon, DocumentTextIcon, TrashIcon, PlusCircleIcon, PresentationChartBarIcon } from '@heroicons/react/24/outline';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import OrgEnhancedOverviewTab from 'components/OrgEnhancedOverviewTab';
import OrgSettingsTab from 'components/OrgSettingsTab';
import OrgProjectsTab from 'components/OrgProjectsTab';
import OrgTeamTab from 'components/OrgTeamTab';
import OrgPartnersTab from 'components/OrgPartnersTab';
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

  // Org showcases
  const [orgShowcases, setOrgShowcases] = useState<any[]>([]);
  const [orgProjectsForPicker, setOrgProjectsForPicker] = useState<any[]>([]);
  // Create showcase modal state
  const [showCreateShowcase, setShowCreateShowcase] = useState(false);
  const [showcaseTitle, setShowcaseTitle] = useState('');
  const [showcaseDesc, setShowcaseDesc] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [showcaseCreating, setShowcaseCreating] = useState(false);
  const [showcaseCreateError, setShowcaseCreateError] = useState('');
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
  // Subscribe to org showcases and load org projects for the picker
  useEffect(()=> {
    if(!orgDoc?.id || !orgDoc?.orgId) return;
    const unsubShowcases = subscribeOrgShowcases(orgDoc.orgId, setOrgShowcases);
    const unsubPicker = subscribeOrgProjects(orgDoc.id, (projs) => setOrgProjectsForPicker(projs));
    return ()=> { unsubShowcases(); unsubPicker(); };
  }, [orgDoc?.id, orgDoc?.orgId]);
  // Resolve document by orgId field (like project code) once, then subscribe real-time
  useEffect(()=>{
    let unsub: any = null; let cancelled = false;
    (async()=>{
      setLoading(true); setError(''); setOrgDoc(null);
      try {
        const orgResult = await getOrgByCode(orgIdParam);
        if(!orgResult){ setError('Organization not found'); setLoading(false); return; }
        unsub = subscribeOrg(orgResult.id, (data) => {
          if(!data){ setError('Organization not found'); setOrgDoc(null); setLoading(false); return; }
          setOrgDoc(data);
          setDescDraft((data as any).bio || '');
          setLoading(false);
        }, (err) => { setError(err.message || 'Error loading organization'); setLoading(false); });
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
          const fetched = await getUsersByEmails(uniqueEmails);
          Object.entries(fetched).forEach(([key, data]) => { userDocs[key] = { uid: data.id, ...data }; });
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
      await updateOrg(orgDoc.id, { coverPhotoUrl: url } as any);
    } catch (e: any) {
      console.error('Cover photo upload failed', e);
    } finally {
      setUploadingCover(false);
    }
  }

  type AccessLevel = 'public' | 'supporter' | 'representative' | 'admin' | 'owner';
  const accessSettings = orgDoc?.accessSettings || {};
  const representatives: string[] = Array.isArray(orgDoc?.representatives)? orgDoc.representatives: [];
  const supporters: string[] = Array.isArray(orgDoc?.supporters)? orgDoc.supporters: [];
  const teamMembers: any[] = Array.isArray(orgDoc?.team) ? orgDoc.team : [];
  const isActualAdmin = !isActualOwner && !!user &&
    teamMembers.some(m => (m.uid === user.uid || m.email === user.email) && m.role === 'Admin');
  const isAdmin = isActualAdmin && !previewMode;
  const canEdit = isOwner || isAdmin;
  let viewerRole: AccessLevel = 'public';
  if(isOwner) viewerRole = 'owner';
  else if(isAdmin) viewerRole = 'admin';
  else if(user){
    const ident = [user.uid, user.email, user.displayName].filter(Boolean);
    if(representatives.some(r=> ident.includes(r))) viewerRole = 'representative';
    else if(supporters.some(s=> ident.includes(s))) viewerRole = 'supporter';
  }
  const DEFAULT_VIEW: Record<string, AccessLevel[]> = {
    overview: ['public','supporter','representative','admin','owner'],
    projects: ['public','supporter','representative','admin','owner'],
    locations: ['public','supporter','representative','admin','owner'],
    updates: ['supporter','representative','admin','owner'],
    team: ['supporter','representative','admin','owner'],
    partners: ['supporter','representative','admin','owner'],
    showcases: ['public','supporter','representative','admin','owner'],
    finance: ['representative','admin','owner'],
    compliance: ['representative','admin','owner'],
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
    { id: 'partners', label: 'Partners', icon: LinkIcon },
    { id: 'showcases', label: 'Showcases', icon: PresentationChartBarIcon },
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
          {(isActualOwner || isActualAdmin) && user && (
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

          {/* Cover photo upload (owner or admin, edit mode) */}
          {canEdit && editMode && (
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
                <OrgProjectsTab org={orgDoc} isOwner={canEdit} currentUser={user} />
              </div>
            )}
            {activeTab === 'team' && canView('team') && (
              <div className='flex-1 flex flex-col min-h-0'>
                <OrgTeamTab org={orgDoc} isOwner={canEdit} editMode={editMode} />
              </div>
            )}
            {activeTab === 'partners' && canView('partners') && (
              <div className='flex-1 flex flex-col min-h-0'>
                <OrgPartnersTab org={orgDoc} isOwner={canEdit} />
              </div>
            )}
            {activeTab === 'locations' && canView('locations') && (
              <div className='flex-1 flex flex-col min-h-0'>
                <OrgLocationsTab org={orgDoc} isOwner={canEdit} />
              </div>
            )}
            {activeTab === 'finance' && canView('finance') && (
              <div className='flex-1 flex flex-col min-h-0'>
                <div className='bg-white rounded-lg shadow-md p-6 text-sm text-gray-600 flex-1'>Finance summary coming soon.</div>
              </div>
            )}
            {activeTab === 'compliance' && canView('compliance') && (
              <div className='flex-1 flex flex-col min-h-0'>
                <OrgComplianceTab org={orgDoc} isOwner={canEdit} />
              </div>
            )}
            {activeTab === 'showcases' && canView('showcases') && (
              <div className='flex-1 flex flex-col min-h-0 space-y-4'>
                <div className='flex items-center justify-between'>
                  <h3 className='text-xl font-semibold text-gray-900'>Showcases</h3>
                  {canEdit && (
                    <button
                      onClick={() => {
                        setShowcaseTitle('');
                        setShowcaseDesc('');
                        setSelectedProjectIds([]);
                        setShowcaseCreateError('');
                        setShowCreateShowcase(true);
                      }}
                      className='inline-flex items-center gap-2 px-4 py-2 bg-brand-main text-white rounded-lg text-sm font-semibold hover:bg-brand-dark transition'
                    >
                      <PlusCircleIcon className='w-4 h-4' />
                      New Showcase
                    </button>
                  )}
                </div>
                {orgShowcases.length === 0 ? (
                  <div className='bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm'>
                    <PresentationChartBarIcon className='w-16 h-16 text-gray-300 mx-auto mb-4' />
                    <p className='text-gray-600 mb-2 font-medium'>No showcases yet.</p>
                    <p className='text-sm text-gray-500 mb-6'>Create a showcase to share a curated set of this organisation&apos;s projects with partners via a single link or code.</p>
                    {canEdit && (
                      <button
                        onClick={() => {
                          setShowcaseTitle('');
                          setShowcaseDesc('');
                          setSelectedProjectIds([]);
                          setShowcaseCreateError('');
                          setShowCreateShowcase(true);
                        }}
                        className='inline-flex items-center gap-2 px-6 py-3 bg-brand-main text-white rounded-lg font-semibold hover:bg-brand-dark transition'
                      >
                        <PlusCircleIcon className='w-5 h-5' />
                        Create First Showcase
                      </button>
                    )}
                  </div>
                ) : (
                  <div className='grid gap-4'>
                    {orgShowcases.map(sc => (
                      <div key={sc.id} className='bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition'>
                        <div className='flex items-start justify-between gap-4'>
                          <div className='flex-1 min-w-0'>
                            <h4 className='text-base font-semibold text-gray-900 mb-1 truncate'>{sc.title}</h4>
                            {sc.description && <p className='text-sm text-gray-500 line-clamp-2 mb-2'>{sc.description}</p>}
                            <div className='flex flex-wrap items-center gap-3 text-xs text-gray-500'>
                              <span className='font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded'>{sc.showcaseId}</span>
                              <span>{(sc.projectDocIds || []).length} project{(sc.projectDocIds || []).length !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                          <div className='flex items-center gap-2 shrink-0'>
                            <a
                              href={`/showcase/${sc.showcaseId}`}
                              className='inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-xs font-semibold hover:bg-orange-100 transition'
                            >
                              View
                              <svg className='w-3.5 h-3.5' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' /></svg>
                            </a>
                            {canEdit && (
                              <button
                                onClick={async () => {
                                  if(!confirm('Delete this showcase? This cannot be undone.')) return;
                                  await deleteShowcase(sc.id);
                                }}
                                className='inline-flex items-center p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition'
                                title='Delete showcase'
                              >
                                <TrashIcon className='w-4 h-4' />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

      {/* Create Showcase Modal */}
      {showCreateShowcase && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'>
          <div className='bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 relative max-h-[90vh] overflow-y-auto'>
            <button
              onClick={() => setShowCreateShowcase(false)}
              className='absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-xl font-bold'
              aria-label='Close'
            >✕</button>
            <h2 className='text-xl font-bold text-brand-main mb-1'>Create an Org Showcase</h2>
            <p className='text-sm text-gray-500 mb-6'>Pick projects from <strong>{orgDoc?.name}</strong>, give the showcase a title and description, then share it with partners via a code or link.</p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!user) return;
                if (!showcaseTitle.trim()) { setShowcaseCreateError('Please enter a title.'); return; }
                if (selectedProjectIds.length === 0) { setShowcaseCreateError('Select at least one project.'); return; }
                setShowcaseCreating(true);
                setShowcaseCreateError('');
                try {
                  const code = generateCode('showcase');
                  await createShowcase({
                    showcaseId: code,
                    title: showcaseTitle.trim(),
                    description: showcaseDesc.trim() || undefined,
                    ownerUid: user.uid,
                    orgId: orgDoc?.orgId,
                    projectDocIds: selectedProjectIds,
                  });
                  setShowCreateShowcase(false);
                  setActiveTab('showcases');
                } catch (err: any) {
                  setShowcaseCreateError(err.message || 'Failed to create showcase.');
                } finally {
                  setShowcaseCreating(false);
                }
              }}
              className='space-y-5'
            >
              {/* Title */}
              <div>
                <label className='block text-sm font-semibold text-gray-700 mb-1'>Title <span className='text-red-500'>*</span></label>
                <input
                  type='text'
                  value={showcaseTitle}
                  onChange={e => setShowcaseTitle(e.target.value)}
                  placeholder='e.g. Our Impact Projects 2025'
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none'
                  required
                  disabled={showcaseCreating}
                />
              </div>

              {/* Description */}
              <div>
                <label className='block text-sm font-semibold text-gray-700 mb-1'>Description <span className='text-gray-400 font-normal'>(optional)</span></label>
                <textarea
                  value={showcaseDesc}
                  onChange={e => setShowcaseDesc(e.target.value)}
                  placeholder='Briefly describe what this showcase represents...'
                  rows={3}
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none resize-none'
                  disabled={showcaseCreating}
                />
              </div>

              {/* Project picker */}
              <div>
                <label className='block text-sm font-semibold text-gray-700 mb-2'>Select Projects <span className='text-red-500'>*</span></label>
                {orgProjectsForPicker.length === 0 ? (
                  <p className='text-sm text-gray-500 italic'>This organisation has no projects yet.</p>
                ) : (
                  <div className='border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto'>
                    {orgProjectsForPicker.map(p => {
                      const checked = selectedProjectIds.includes(p.id);
                      return (
                        <label key={p.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-orange-50 transition ${checked ? 'bg-orange-50' : ''}`}>
                          <input
                            type='checkbox'
                            checked={checked}
                            onChange={() => setSelectedProjectIds(prev =>
                              prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                            )}
                            className='h-4 w-4 rounded border-gray-300 text-brand-main focus:ring-brand-main'
                            disabled={showcaseCreating}
                          />
                          <div className='flex-1 min-w-0'>
                            <div className='text-sm font-medium text-gray-800 truncate'>{p.name}</div>
                            <div className='text-xs text-gray-400 font-mono'>{p.projectId}</div>
                          </div>
                          {p.coverPhotoUrl && (
                            <img src={p.coverPhotoUrl} alt='' className='w-10 h-8 object-cover rounded shrink-0' />
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
                {selectedProjectIds.length > 0 && (
                  <p className='text-xs text-orange-600 mt-1.5 font-medium'>{selectedProjectIds.length} project{selectedProjectIds.length !== 1 ? 's' : ''} selected</p>
                )}
              </div>

              {showcaseCreateError && <p className='text-red-600 text-sm'>{showcaseCreateError}</p>}

              <div className='flex gap-3 pt-2'>
                <button
                  type='button'
                  onClick={() => setShowCreateShowcase(false)}
                  className='flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition'
                  disabled={showcaseCreating}
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={showcaseCreating || orgProjectsForPicker.length === 0}
                  className='flex-1 py-2.5 rounded-lg bg-brand-main text-white text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60'
                >
                  {showcaseCreating ? 'Creating…' : 'Create Showcase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

interface AuditorReport {
  url: string;
  year: string;
  label: string;
  fileName: string;
  uploadedAt: string;
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

  // Auditor reports
  const [auditorReports, setAuditorReports] = useState<AuditorReport[]>(
    Array.isArray(org.auditorReports) ? org.auditorReports : []
  );
  const [reportUploading, setReportUploading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));
  const [reportLabel, setReportLabel] = useState('');
  const [deletingIdx, setDeletingIdx] = useState<number | null>(null);

  async function handleReportUpload(file: File) {
    if (!reportYear.trim()) { setReportError('Please enter a year for this report.'); return; }
    setReportUploading(true); setReportError('');
    try {
      const uid = getAuth().currentUser?.uid;
      if (!uid) throw new Error('You must be signed in.');
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const sRef = storageRef(storage, `organizations/${org.id}/auditor-reports/${reportYear}_${Date.now()}_${safeName}`);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      const newReport: AuditorReport = {
        url,
        year: reportYear.trim(),
        label: reportLabel.trim(),
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
      };
      const updated = [...auditorReports, newReport].sort((a, b) => b.year.localeCompare(a.year));
      await updateOrg(org.id, { auditorReports: updated } as any);
      setAuditorReports(updated);
      setReportLabel('');
    } catch (e: any) {
      setReportError(e.message || 'Upload failed');
    } finally {
      setReportUploading(false);
    }
  }

  async function handleDeleteReport(idx: number) {
    setDeletingIdx(idx);
    try {
      const updated = auditorReports.filter((_, i) => i !== idx);
      await updateOrg(org.id, { auditorReports: updated } as any);
      setAuditorReports(updated);
    } catch (e: any) {
      setReportError(e.message || 'Delete failed');
    } finally {
      setDeletingIdx(null);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaveError(''); setSaveSuccess(false);
    try {
      const finalType = orgType === 'Other' ? (customType.trim() || 'Other') : orgType;
      await updateOrg(org.id, {
        companyNumber: companyNumber.trim() || null,
        taxId: taxId.trim() || null,
        orgType: finalType || null,
      } as any);
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
      await updateOrg(org.id, { safeguardingPolicyUrl: url } as any);
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

      {/* Auditor Reports */}
      <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-6'>
        <div className='flex items-center gap-2 mb-4'>
          <DocumentTextIcon className='h-5 w-5 text-brand-main' />
          <h2 className='text-base font-semibold text-gray-900'>Auditor Reports</h2>
          <span className='ml-auto text-xs text-gray-400'>{auditorReports.length} report{auditorReports.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Report list */}
        {auditorReports.length === 0 ? (
          <p className='text-sm text-gray-500 mb-4'>No auditor reports have been uploaded yet.</p>
        ) : (
          <ul className='divide-y divide-gray-100 mb-4'>
            {auditorReports.map((r, i) => (
              <li key={i} className='flex items-center gap-3 py-3'>
                <div className='flex-shrink-0 w-10 h-10 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center'>
                  <DocumentTextIcon className='w-5 h-5 text-orange-500' />
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-2 flex-wrap'>
                    <span className='text-sm font-semibold text-gray-900'>{r.year}</span>
                    {r.label && <span className='text-sm text-gray-600'>— {r.label}</span>}
                  </div>
                  <div className='flex items-center gap-3 mt-0.5'>
                    <a
                      href={r.url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-xs text-brand-main hover:underline truncate max-w-[200px]'
                      title={r.fileName}
                    >
                      {r.fileName}
                    </a>
                    <span className='text-xs text-gray-400 flex-shrink-0'>
                      {new Date(r.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <a
                  href={r.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='flex-shrink-0 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition'
                >
                  View
                </a>
                {isOwner && (
                  <button
                    onClick={() => handleDeleteReport(i)}
                    disabled={deletingIdx === i}
                    className='flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-50'
                    title='Remove report'
                  >
                    <TrashIcon className='w-4 h-4' />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Upload form — owner only */}
        {isOwner && (
          <div className='border-t border-gray-100 pt-4'>
            <p className='text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3'>Upload New Report</p>
            <div className='flex flex-wrap gap-3 items-end'>
              <div>
                <label className='block text-xs font-medium text-gray-600 mb-1'>Year <span className='text-red-500'>*</span></label>
                <input
                  type='text'
                  value={reportYear}
                  onChange={e => setReportYear(e.target.value)}
                  placeholder='e.g. 2025'
                  maxLength={4}
                  className='w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main transition'
                />
              </div>
              <div className='flex-1 min-w-[180px]'>
                <label className='block text-xs font-medium text-gray-600 mb-1'>Description <span className='text-gray-400'>(optional)</span></label>
                <input
                  type='text'
                  value={reportLabel}
                  onChange={e => setReportLabel(e.target.value)}
                  placeholder='e.g. Annual Financial Audit'
                  className='w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main transition'
                />
              </div>
              <div>
                <label className='block text-xs font-medium text-gray-600 mb-1'>File</label>
                <label className='inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-main hover:bg-brand-dark text-white text-sm font-medium cursor-pointer transition'>
                  {reportUploading ? (
                    <><ArrowUpTrayIcon className='h-4 w-4 animate-bounce' /><span>Uploading…</span></>
                  ) : (
                    <><ArrowUpTrayIcon className='h-4 w-4' /><span>Choose & Upload</span></>
                  )}
                  <input
                    type='file'
                    accept='.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.xls,.xlsx'
                    className='hidden'
                    disabled={reportUploading}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleReportUpload(f); e.target.value = ''; }}
                  />
                </label>
              </div>
            </div>
            <p className='text-xs text-gray-400 mt-2'>Accepted: PDF, DOC, DOCX, XLS, XLSX</p>
            {reportError && <p className='text-xs text-red-600 mt-1'>{reportError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function OrgProjectsList({ orgId }: { orgId:string }){
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{ const unsub = subscribeOrgProjects(orgId, (rows) => {
    setProjects(rows); setLoading(false);
  }, () => { setLoading(false); });
  return ()=> unsub(); }, [orgId]);
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
    try { await updateOrg(orgDbId, { orgType: newType } as any); }
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

