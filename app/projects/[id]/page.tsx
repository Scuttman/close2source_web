"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../../src/lib/firebase";
import { getAuth } from "firebase/auth";
import ProjectFinanceTab from "../../../components/ProjectFinanceTab";
import ProjectUpdatesTab from "../../../components/ProjectUpdatesTab";
import PageShell from "../../../components/PageShell";
import { InformationCircleIcon, ArrowPathIcon, CurrencyDollarIcon, Cog6ToothIcon, ClipboardDocumentCheckIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import ProjectPlanTab from "../../../components/ProjectPlanTab";
import { useRouter } from 'next/navigation';
import ProjectSettingsTab from "../../../components/ProjectSettingsTab";
import ProjectOverviewTab from "../../../components/ProjectOverviewTab";
import ProjectTeamTab from "../../../components/ProjectTeamTab";
  const auth = typeof window !== "undefined" ? getAuth() : null;

export default function ProjectDetail() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("home");
  const [editMode, setEditMode] = useState(false); // global edit toggle
  const searchParams = useSearchParams();
  // Sync tab from query (e.g., ?tab=team) once on mount / change
  useEffect(()=> {
    const qp = searchParams?.get('tab');
    if(qp){
      const validIds = ['home','plan','updates','finance','team','settings'];
      if(validIds.includes(qp)) setActiveTab(qp);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  // Updates tab state moved into ProjectUpdatesTab component
  // Settings tab state moved to ProjectSettingsTab
  // Location editing state
  // Finance state
  const [financeTransactions, setFinanceTransactions] = useState<any[]>([]);
  // Currency
  const [projectCurrency, setProjectCurrency] = useState<string>("");
  // Pie chart hover state
  // (hover state & refs for updates moved into child components)
  const router = useRouter();

  useEffect(() => {
    if(!projectId) return;
    setLoading(true); setError("");
    const docRef = doc(db, 'projects', projectId);
    // Real-time listener so updates/comments/reactions stream live
    const unsub = onSnapshot(docRef, (snap)=>{
      if(!snap.exists()) { setError('Project not found.'); setProject(null); setLoading(false); return; }
      const raw:any = snap.data();
      if(!Array.isArray(raw.updates)) raw.updates = [];
      setProject(raw);
      setProjectCurrency(raw.currency || "");
      setLoading(false);
    }, (err)=>{ setError(err.message || 'Error loading project.'); setLoading(false); });
    return ()=> unsub();
  },[projectId]);
  // IMPORTANT: All hooks (useMemo, etc.) must run on every render to preserve order.
  // Moved early returns BELOW hook declarations to fix hook order warning.
  // SidebarSearchTags, filtering, editing & reactions moved to ProjectUpdatesTab

  // Overview map & geocode logic moved into ProjectOverviewTab
  // (Early returns moved below finance hooks to preserve hook order.)
  const currentUser = auth?.currentUser;
  const isProjectCreator = !!(currentUser && project?.createdBy && [currentUser.displayName, currentUser.email, currentUser.uid].includes(project.createdBy));
  // Resolve viewer role for permissions
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
  // If current tab becomes hidden by permissions, fallback to first visible
  useEffect(()=> {
    if(!tabs.find(t=> t.id===activeTab)) {
      setActiveTab(tabs.length? tabs[0].id : 'home');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(tabs.map(t=> t.id)), activeTab]);
  if(activeTab === 'settings' && !isProjectCreator) { setActiveTab('home'); }

  // Load finance transactions only for creator when finance tab active (or project loads)
  // Transactions now loaded inside ProjectTransactionsManager for creator;
  useEffect(()=>{ if(!isProjectCreator) setFinanceTransactions([]); },[isProjectCreator]);

  // Currency helpers (simple prefix display, no conversion)
  const currencySymbol = useMemo(()=>{
    const map: Record<string,string> = {
      USD:'$', EUR:'€', GBP:'£', ZAR:'R', KES:'KSh', UGX:'USh', TZS:'TSh', GHS:'₵', NGN:'₦', MWK:'MK', ETB:'Br', RWF:'FRw', CAD:'$', AUD:'$', NZD:'$', INR:'₹'
    };
    return projectCurrency ? (map[projectCurrency] || projectCurrency) : '';
  },[projectCurrency]);

  // addTransaction moved into ProjectTransactionsManager

  // Handle loading / error / missing project states AFTER all hooks above to keep hook order stable.
  if (loading) return <PageShell title={<span>Loading…</span>}><div className="text-sm text-gray-500">Loading...</div></PageShell>;
  if (error) return <PageShell title={<span>Error</span>}><div className="text-sm text-red-600">{error}</div></PageShell>;
  if (!project) return <PageShell title={<span>Project</span>}><div className="text-sm text-gray-500">Project not found.</div></PageShell>;

  return (
    <PageShell
      title={<span>{project.name}</span>}
      headerRight={(
        <div className="flex items-center gap-3">
          {project.projectId && (
            <span className="inline-block text-xs font-mono bg-white/10 text-white px-2 py-1 rounded border border-white/20 tracking-wide md:text-sm md:scale-110 origin-left">
              {project.projectId}
            </span>
          )}
          {isProjectCreator && (
            <button
              type="button"
              onClick={()=> setEditMode(m=>!m)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold border transition ${editMode? 'bg-brand-main text-white border-brand-main shadow-inner':'bg-white/10 text-white border-white/30 hover:bg-white/20'}`}
              aria-pressed={editMode}
              aria-label="Toggle edit mode"
            >
              <span>Edit</span>
              <span className={`inline-flex items-center h-4 w-8 rounded-full transition ${editMode? 'bg-brand-accent/80':'bg-white/30'}`}>
                <span className={`h-4 w-4 rounded-full bg-white shadow transform transition ${editMode? 'translate-x-4':'translate-x-0'}`}></span>
              </span>
            </button>
          )}
        </div>
      )}
      contentClassName="p-6"
    >
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left vertical tabs */}
        <nav className="md:w-56 flex md:flex-col md:items-stretch gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 border-b md:border-b-0 md:border-r border-brand-main/10">
          {tabs.map(t=> {
            const Icon = t.icon; const active = activeTab===t.id;
            return (
              <button key={t.id} onClick={()=>setActiveTab(t.id)} className={`flex items-center gap-2 px-3 py-2 rounded md:rounded-none md:border-l-4 text-sm font-medium transition whitespace-nowrap ${active? 'bg-brand-main/10 md:bg-transparent md:border-brand-main text-brand-main':'md:border-transparent text-gray-600 hover:text-brand-main hover:bg-brand-main/5'}`}>
                <Icon className="h-5 w-5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>
        {/* Right panel content */}
        <div className="flex-1 min-w-0">
            {activeTab === "home" && (
              <ProjectOverviewTab
                project={project}
                projectId={projectId}
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
                  projectId={projectId}
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
              <ProjectUpdatesTab project={project} setProject={setProject} projectId={projectId} currentUser={auth?.currentUser} allowEdit={editMode} />
            )}
            {activeTab === "finance" && canView('finance') && (
              <ProjectFinanceTab
                projectId={projectId}
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
                projectId={projectId}
                isProjectCreator={isProjectCreator}
                allowEdit={editMode}
                setProject={setProject}
              />
            )}
            {isProjectCreator && activeTab === 'settings' && (
              <ProjectSettingsTab
                projectId={projectId}
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
  );
}
