"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
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
    async function fetchProject() {
      setLoading(true);
      setError("");
      try {
        const docRef = doc(db, "projects", projectId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          setError("Project not found.");
          setProject(null);
        } else {
          const raw: any = docSnap.data();
          if(!Array.isArray(raw.updates)) raw.updates = [];
          setProject(raw);
          setProjectCurrency(raw.currency || "");
        }
      } catch (e: any) {
        setError(e.message || "Error loading project.");
      } finally {
        setLoading(false);
      }
    }
    if (projectId) fetchProject();
  }, [projectId]);
  // IMPORTANT: All hooks (useMemo, etc.) must run on every render to preserve order.
  // Moved early returns BELOW hook declarations to fix hook order warning.
  // SidebarSearchTags, filtering, editing & reactions moved to ProjectUpdatesTab

  // Overview map & geocode logic moved into ProjectOverviewTab
  // (Early returns moved below finance hooks to preserve hook order.)
  const currentUser = auth?.currentUser;
  const isProjectCreator = !!(currentUser && project?.createdBy && [currentUser.displayName, currentUser.email, currentUser.uid].includes(project.createdBy));
  const tabs: { id: string; label: string; icon: any }[] = [
    { id: 'home', label: 'Overview', icon: InformationCircleIcon },
    { id: 'plan', label: 'Plan', icon: ClipboardDocumentCheckIcon },
    { id: 'updates', label: 'Updates', icon: ArrowPathIcon },
  { id: 'finance', label: 'Finance', icon: CurrencyDollarIcon },
  { id: 'team', label: 'Team', icon: UserGroupIcon },
  ...(isProjectCreator ? [{ id: 'settings', label: 'Settings', icon: Cog6ToothIcon }] : []),
  ];
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
    <PageShell title={<span>{project.name}</span>} contentClassName="p-6">
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
              />
            )}
            {activeTab === 'plan' && (
              <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm text-brand-dark">
                <h2 className="text-lg font-semibold text-brand-main mb-4">Project Plan</h2>
                <ProjectPlanTab
                  projectId={projectId}
                  plan={project?.plan}
                  isProjectCreator={isProjectCreator}
                  onUpdated={(plan)=> setProject((p:any)=> ({ ...p, plan }))}
                />
              </div>
            )}
            {activeTab === "updates" && (
              <ProjectUpdatesTab project={project} setProject={setProject} projectId={projectId} currentUser={auth?.currentUser} />
            )}
            {activeTab === "finance" && (
              <ProjectFinanceTab
                projectId={projectId}
                project={project}
                isProjectCreator={isProjectCreator}
                projectCurrency={projectCurrency}
                currencySymbol={currencySymbol}
                financeTransactions={financeTransactions}
                setFinanceTransactions={setFinanceTransactions}
              />
            )}
            {activeTab === 'team' && (
              <ProjectTeamTab project={project} />
            )}
            {isProjectCreator && activeTab === 'settings' && (
              <ProjectSettingsTab
                projectId={projectId}
                project={project}
                projectCurrency={projectCurrency}
                setProjectCurrency={setProjectCurrency}
                setProject={setProject}
                currencySymbol={currencySymbol}
              />
            )}
        </div>
      </div>
    </PageShell>
  );
}
