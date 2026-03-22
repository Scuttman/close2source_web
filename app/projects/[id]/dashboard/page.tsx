"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getProjectByCode, subscribeProject, getOrg, getOrgByCode } from '@/lib/dal';
import { getAuth } from "firebase/auth";
import ProjectFinanceTab from "../../../../components/ProjectFinanceTab";
import ProjectUpdatesTab from "../../../../components/ProjectUpdatesTab";
import PageShell from "../../../../components/PageShell";
import { InformationCircleIcon, ArrowPathIcon, CurrencyDollarIcon, Cog6ToothIcon, ClipboardDocumentCheckIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import ProjectPlanTab from "../../../../components/ProjectPlanTab";
import { useRouter } from 'next/navigation';
import ProjectSettingsTab from "../../../../components/ProjectSettingsTab";
import ProjectOverviewTab from "../../../../components/ProjectOverviewTab";
import ProjectTeamTab from "../../../../components/ProjectTeamTab";
import ProfileLoadingShell from "../../../../components/ProfileLoadingShell";

const auth = typeof window !== "undefined" ? getAuth() : null;

export default function ProjectSettings() {
  const params = useParams();
  const router = useRouter();
  const routeParam = params.id as string;
  const [resolvedDocId, setResolvedDocId] = useState<string | null>(null);
  const [canonicalCode, setCanonicalCode] = useState<string | null>(null);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("home");
  const [editMode, setEditMode] = useState(false);
  const searchParams = useSearchParams();
  
  useEffect(()=> {
    const qp = searchParams?.get('tab');
    if(qp){
      const validIds = ['home','plan','updates','finance','team','settings'];
      if(validIds.includes(qp)) setActiveTab(qp);
    }
  }, [searchParams]);
  
  const [financeTransactions, setFinanceTransactions] = useState<any[]>([]);
  const [projectCurrency, setProjectCurrency] = useState<string>("");

  // Resolve whether routeParam is code or doc id
  useEffect(()=> {
    let cancelled=false;
    (async()=> {
      if(!routeParam){ setError('Missing project'); return; }
      if(/^P[A-Z0-9]{6}$/i.test(routeParam)){
        try {
          const found = await getProjectByCode(routeParam.toUpperCase());
            if(!found){ setError('Project not found.'); setResolvedDocId(null); return; }
            setResolvedDocId(found.id);
            setCanonicalCode(routeParam.toUpperCase());
        } catch(e:any){ setError(e.message || 'Lookup failed'); }
        return;
      }
      setResolvedDocId(routeParam);
    })();
    return ()=> { cancelled=true; };
  },[routeParam]);

  // Subscribe once doc id resolved
  useEffect(()=> {
    if(!resolvedDocId) return;
    setLoading(true); setError('');
    const unsub = subscribeProject(resolvedDocId, (data) => {
      if(!data){ setError('Project not found.'); setProject(null); setLoading(false); return; }
      const raw:any = data;
      if(!Array.isArray(raw.updates)) raw.updates=[];
      setProject(raw);
      setProjectCurrency(raw.currency || '');
      setLoading(false);
    }, (err) => { setError(err.message || 'Error loading project.'); setLoading(false); });
    return ()=> unsub();
  },[resolvedDocId]);
  
  const currentUser = auth?.currentUser;
  
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  useEffect(() => {
    if (!currentUser) {
      setIsOrgAdmin(false);
      return;
    }
    
    const orgDocId = project?.originatingOrganizationDbId;
    const orgCode = project?.organizationId;
    
    if (!orgDocId && !orgCode) {
      setIsOrgAdmin(false);
      return;
    }
    
    let cancelled = false;
    (async () => {
      try {
        const orgData = orgDocId 
          ? await getOrg(orgDocId)
          : orgCode 
            ? await getOrgByCode(orgCode)
            : null;
            
        if (!cancelled && orgData) {
          setIsOrgAdmin(orgData?.ownerUid === currentUser.uid);
        } else {
          setIsOrgAdmin(false);
        }
      } catch {
        if (!cancelled) setIsOrgAdmin(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.uid, project?.originatingOrganizationDbId, project?.organizationId]);
  
  const isProjectCreator = !!(currentUser && project?.createdBy && [currentUser.displayName, currentUser.email, currentUser.uid].includes(project.createdBy)) || isOrgAdmin;
  
  // Redirect non-creators
  useEffect(() => {
    if (!loading && project && !isProjectCreator) {
      router.replace(`/projects/${canonicalCode || resolvedDocId || routeParam}`);
    }
  }, [loading, project, isProjectCreator, router, canonicalCode, resolvedDocId, routeParam]);
  
  type AccessLevel = 'public' | 'supporter' | 'representative' | 'owner';
  const accessSettings = project?.accessSettings || {};
  const representatives: string[] = Array.isArray(project?.representatives)? project.representatives: [];
  const supporters: string[] = Array.isArray(project?.supporters)? project.supporters: [];
  let viewerRole: AccessLevel = 'public';
  if(isProjectCreator) viewerRole = 'owner';
  else if(currentUser){
    const ident = [currentUser.uid, currentUser.email, currentUser.displayName].filter(Boolean);
    if(representatives.some(r=> ident.includes(r))) viewerRole = 'representative';
    else if(supporters.some(s=> ident.includes(s))) viewerRole = 'supporter';
  }
  const DEFAULT_VIEW: Record<string, AccessLevel[]> = {
    overview: ['public','supporter','representative','owner'],
    plan: ['supporter','representative','owner'],
    updates: ['supporter','representative','owner'],
    finance: ['representative','owner'],
    team: ['supporter','representative','owner'],
    settings: ['owner']
  };
  function canView(tabId:string): boolean {
    const cfg = accessSettings?.[tabId];
    const allowed: AccessLevel[] = Array.isArray(cfg?.view)? cfg.view : (typeof cfg==='string'? DEFAULT_VIEW[tabId] : DEFAULT_VIEW[tabId]);
    return allowed? allowed.includes(viewerRole) : true;
  }
  const rawTabs: { id: string; label: string; icon: any }[] = [
    { id: 'home', label: 'Overview', icon: InformationCircleIcon },
    { id: 'plan', label: 'Plan', icon: ClipboardDocumentCheckIcon },
    { id: 'updates', label: 'Updates', icon: ArrowPathIcon },
    { id: 'finance', label: 'Finance', icon: CurrencyDollarIcon },
    { id: 'team', label: 'Team', icon: UserGroupIcon },
    ...(isProjectCreator ? [{ id: 'settings', label: 'Settings', icon: Cog6ToothIcon }] : []),
  ];
  const tabs = rawTabs.filter(t=> canView(t.id));
  
  useEffect(()=> {
    if(!tabs.find(t=> t.id===activeTab)) {
      setActiveTab(tabs.length? tabs[0].id : 'home');
    }
  }, [JSON.stringify(tabs.map(t=> t.id)), activeTab, tabs]);
  
  if(activeTab === 'settings' && !isProjectCreator) { setActiveTab('home'); }

  useEffect(()=>{ if(!isProjectCreator) setFinanceTransactions([]); },[isProjectCreator]);

  const currencySymbol = useMemo(()=>{
    const map: Record<string,string> = {
      USD:'$', EUR:'€', GBP:'£', ZAR:'R', KES:'KSh', UGX:'USh', TZS:'TSh', GHS:'₵', NGN:'₦', MWK:'MK', ETB:'Br', RWF:'FRw', CAD:'$', AUD:'$', NZD:'$', INR:'₹'
    };
    return projectCurrency ? (map[projectCurrency] || projectCurrency) : '';
  },[projectCurrency]);

  if (loading) return <ProfileLoadingShell title="Project Settings" />;
  if (error) return <PageShell title={<span>Error</span>}><div className="text-sm text-red-600">{error}</div></PageShell>;
  if (!project) return <PageShell title={<span>Project</span>}><div className="text-sm text-gray-500">Project not found.</div></PageShell>;
  if (!isProjectCreator) return null;

  const idKey = canonicalCode || project?.projectId || resolvedDocId || routeParam;
  const externalProjectCode = project?.projectId || canonicalCode || routeParam;
  
  return (
    <>
      {project && idKey && (
        <style>{`#project-theme-${idKey} {${[
          project.themeHeaderBg? `--project-header-bg:${project.themeHeaderBg};` : '',
          project.themeHeaderText? `--project-header-text:${project.themeHeaderText};` : '',
          project.themeAccent? `--project-accent:${project.themeAccent};` : '',
          project.themeAccentText? `--project-accent-text:${project.themeAccentText};` : '',
          project.themeAccentHover? `--project-accent-hover:${project.themeAccentHover};` : '',
          project.themeTabActiveBg? `--project-tab-active-bg:${project.themeTabActiveBg};` : '',
          project.themeTabActiveText? `--project-tab-active-text:${project.themeTabActiveText};` : '',
          project.themeTabInactiveText? `--project-tab-inactive-text:${project.themeTabInactiveText};` : '',
          project.themeWidgetTitleColor? `--project-widget-title-color:${project.themeWidgetTitleColor};` : '',
          typeof project.backgroundFade === 'number' ? `--project-background-fade:${project.backgroundFade};` : '--project-background-fade:0.4;'
        ].filter(Boolean).join('')}}\n#project-theme-${idKey} .text-brand-main { color: var(--project-accent) !important; }\n#project-theme-${idKey} .bg-brand-main { background-color: var(--project-accent) !important; }\n#project-theme-${idKey} .hover\\:bg-brand-dark:hover { background-color: var(--project-accent-hover) !important; }`}</style>
      )}
     {project?.backgroundUrl && (
        <div className="fixed inset-0 z-0 pointer-events-none" id={`project-bg-${idKey}`}>
          <img
            src={project.backgroundUrl}
            alt={`${project.name} background`}
            style={{ filter: `brightness(${typeof project.backgroundBrightness === 'number' ? project.backgroundBrightness : 1}) blur(${typeof project.backgroundBlur === 'number' ? project.backgroundBlur : 0}px)` }}
            className="w-full h-full object-cover object-center transition-[filter] duration-300" />
          <div className='absolute inset-0 bg-gradient-to-b from-white/30 to-white/5' />
          <div className='absolute inset-0' style={{ background: `rgba(255,255,255,${typeof project.backgroundFade === 'number' ? project.backgroundFade : 0.4})` }} />
        </div>
      )}
      <div id={`project-theme-${idKey}`} className="flex flex-col flex-1 min-h-0 relative">
  <PageShell
          title={<span>{project.name} - Settings</span>}
          headerStyle={{ background:'#000000', color:'#ffffff' }}
          headerRight={(
            <div className="flex items-center gap-3">
              <a
                href={`/projects/${externalProjectCode}/profile`}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold bg-white/10 text-white border border-white/20 hover:bg-white/20 transition"
              >
                ← Back to Profile
              </a>
              {project.projectId && (
                <span className="inline-block text-xs font-mono bg-white/10 text-white px-2 py-1 rounded border border-white/20 tracking-wide md:text-sm md:scale-110 origin-left">
                  {project.projectId}
                </span>
              )}
              <button
                type="button"
                onClick={()=> setEditMode(m=>!m)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold border transition ${editMode? 'shadow-inner':''}`}
                style={ editMode ? {background:'var(--project-accent)', color:'var(--project-accent-text)', borderColor:'var(--project-accent)' } : { background:'rgba(255,255,255,0.1)', color:'#ffffff', borderColor:'rgba(255,255,255,0.3)' }}
              >
                <span>Edit</span>
                <span className='inline-flex items-center h-4 w-8 rounded-full transition' style={{ background: editMode? 'var(--project-accent-hover)' : 'rgba(255,255,255,0.3)' }}>
                  <span className='h-4 w-4 rounded-full bg-white shadow transform transition' style={{ transform: editMode? 'translateX(1rem)' : 'translateX(0)' }}></span>
                </span>
              </button>
            </div>
          )}
          contentClassName="p-6"
        >
          <div className="flex flex-col md:flex-row gap-6">
            <nav className="md:w-56 flex md:flex-col md:items-stretch gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 md:border-r border-brand-main/10">
              {tabs.map(t=> {
                const Icon = t.icon; const active = activeTab===t.id;
                return (
                  <button
                    key={t.id}
                    onClick={()=>setActiveTab(t.id)}
                    className='flex items-center gap-2 px-3 py-2 rounded md:rounded-none md:border-l-4 text-sm font-medium transition whitespace-nowrap'
                    style={ active ? { background:'var(--project-tab-active-bg)', color:'var(--project-tab-active-text)', borderLeftColor:'var(--project-accent)' } : { color:'var(--project-tab-inactive-text)', borderLeftColor:'transparent' } }
                  >
                    <Icon className="h-5 w-5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </nav>
  <div className="flex-1 min-w-0 relative z-10">
      {activeTab === "home" && (
              <ProjectOverviewTab
                project={project}
        projectId={externalProjectCode}
                setProject={setProject}
                isProjectCreator={isProjectCreator}
                currentUser={auth?.currentUser}
                allowEdit={editMode}
              />
            )}
            {activeTab === 'plan' && canView('plan') && (
              <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm text-brand-dark">
                <h2 className="text-lg font-semibold text-brand-main mb-4">Project Plan</h2>
                <ProjectPlanTab
                  projectId={externalProjectCode}
                  projectName={project?.name}
                  plan={project?.plan}
                  isProjectCreator={isProjectCreator}
                  allowEdit={editMode}
                  onUpdated={(plan)=> setProject((p:any)=> ({ ...p, plan }))}
                  projectCurrency={projectCurrency}
                  currencySymbol={currencySymbol}
                  teamMembers={(Array.isArray(project?.team)? project.team: []).map((m:any)=> ({
                    id: m.id,
                    name: m.name || (m.email? m.email.split('@')[0] : m.id),
                    role: m.role,
                    email: m.email,
                    type: m.type,
                    photoURL: m.photoURL || m.image || m.avatar
                  }))}
                />
              </div>
            )}
            {activeTab === "updates" && canView('updates') && (
              <ProjectUpdatesTab
                project={project}
                setProject={setProject}
                projectId={externalProjectCode}
                projectDocId={resolvedDocId || externalProjectCode}
                currentUser={auth?.currentUser}
                allowEdit={editMode}
              />
            )}
            {activeTab === "finance" && canView('finance') && (
              <ProjectFinanceTab
                projectId={externalProjectCode}
                project={project}
                isProjectCreator={isProjectCreator}
                projectCurrency={projectCurrency}
                currencySymbol={currencySymbol}
                financeTransactions={financeTransactions}
                setFinanceTransactions={setFinanceTransactions}
                allowEdit={editMode}
              />
            )}
            {activeTab === 'team' && canView('team') && (
              <ProjectTeamTab
                project={project}
                projectId={externalProjectCode}
                isProjectCreator={isProjectCreator}
                allowEdit={editMode}
                setProject={setProject}
              />
            )}
      {isProjectCreator && activeTab === 'settings' && (
              <ProjectSettingsTab
                projectId={externalProjectCode}
                docId={resolvedDocId || externalProjectCode}
                project={project}
                projectCurrency={projectCurrency}
                setProjectCurrency={setProjectCurrency}
                setProject={setProject}
                currencySymbol={currencySymbol}
                allowEdit={editMode}
              />
            )}
          </div>
    </div>
    </PageShell>
      </div>
    </>
  );
}
