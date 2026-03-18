"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { app, db } from "../src/lib/firebase";
import { collection, query, where, onSnapshot, getDocs, updateDoc, doc } from "firebase/firestore";
import { inferKindFromCode, needsMigration, generateCode } from "../src/lib/codes";
import Link from "next/link";
import dynamic from 'next/dynamic';
import PageShell from "../components/PageShell";
import { SparklesIcon, DevicePhoneMobileIcon, ChartBarIcon, CheckCircleIcon, ArrowRightIcon, UserGroupIcon, GlobeAltIcon, MegaphoneIcon, ShareIcon, QrCodeIcon } from '@heroicons/react/24/outline';

function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [myOrganizations, setMyOrganizations] = useState<any[]>([]);
  const [myIndividuals, setMyIndividuals] = useState<any[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [codeSearching, setCodeSearching] = useState(false);
  const [codeError, setCodeError] = useState('');
  const router = useRouter();

  // Auto-redirect when ?id=CODE is in the URL (from share links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) return;
    const raw = id.trim().toUpperCase();
    const kind = inferKindFromCode(raw);
    if (!kind) return;
    (async () => {
      try {
        if (kind === 'project') {
          const snap = await getDocs(query(collection(db, 'projects'), where('projectId', '==', raw)));
          if (!snap.empty) { window.location.replace(`/projects/${snap.docs[0].id}/proposal`); return; }
        } else if (kind === 'organization') {
          const snap = await getDocs(query(collection(db, 'organizations'), where('orgId', '==', raw)));
          if (!snap.empty) { window.location.replace(`/org/${raw}`); return; }
        } else if (kind === 'individual') {
          const snap = await getDocs(query(collection(db, 'individuals'), where('individualId', '==', raw)));
          if (!snap.empty) { window.location.replace(`/individuals/profile?id=${raw}`); return; }
        }
      } catch { /* ignore */ }
    })();
  }, []);
  
  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(()=> {
    if(!user){ setMyOrganizations([]); return; }
    const qOrg = query(collection(db,'organizations'), where('ownerUid','==', user.uid));
    const unsub = onSnapshot(qOrg, snap=> setMyOrganizations(snap.docs.map(d=> ({ id: d.id, ...d.data() }))));
    return ()=> unsub();
  }, [user]);
  
  useEffect(()=> {
    if(!user){ setMyIndividuals([]); return; }
    const qInd = query(collection(db,'individuals'), where('ownerUid','==', user.uid));
    const unsub = onSnapshot(qInd, snap=> setMyIndividuals(snap.docs.map(d=> ({ id: d.id, ...d.data() }))));
    return ()=> unsub();
  }, [user]);

  useEffect(()=> {
    let cancelled=false;
    (async()=> {
      try {
        const projSnap = await getDocs(query(collection(db,'projects')));
        let changed=0;
        for(const d of projSnap.docs){
          if(changed>=10) break;
          const data:any = d.data();
          if(data.projectId && needsMigration(data.projectId)){
            const newId = generateCode('project');
            await updateDoc(doc(db,'projects', d.id), { projectId: newId });
            changed++;
          }
        }
        const orgSnap = await getDocs(query(collection(db,'organizations')));
        changed=0;
        for(const d of orgSnap.docs){ if(changed>=10) break; const data:any = d.data(); if(data.orgId && needsMigration(data.orgId)){ const newId = generateCode('organization'); await updateDoc(doc(db,'organizations', d.id), { orgId: newId }); changed++; } }
        const indSnap = await getDocs(query(collection(db,'individuals')));
        changed=0;
        for(const d of indSnap.docs){ if(changed>=10) break; const data:any = d.data(); if(data.individualId && needsMigration(data.individualId)){ const newId = generateCode('individual'); await updateDoc(doc(db,'individuals', d.id), { individualId: newId }); changed++; } }
      } catch {/* ignore silently */}
    })();
    return ()=> { cancelled=true; };
  }, []);

  async function handleCodeSearch(e?: React.FormEvent){
    if(e) e.preventDefault();
    const raw = codeInput.trim().toUpperCase();
    if(!raw){ setCodeError('Enter a code'); return; }
    setCodeError(''); setCodeSearching(true);
    try {
      const kind = inferKindFromCode(raw);
      if(!kind){ setCodeError('Unknown code prefix'); return; }
      if(kind==='project'){
        const snap = await getDocs(query(collection(db,'projects'), where('projectId','==', raw)));
        if(!snap.empty){ window.location.href = `/projects/${snap.docs[0].id}/proposal`; return; }
      } else if(kind==='organization'){
        const snap = await getDocs(query(collection(db,'organizations'), where('orgId','==', raw)));
        if(!snap.empty){ window.location.href = `/org/${raw}`; return; }
      } else if(kind==='individual'){
        const snap = await getDocs(query(collection(db,'individuals'), where('individualId','==', raw)));
        if(!snap.empty){ window.location.href = `/individuals/profile?id=${raw}`; return; }
      }
      setCodeError('Code not found');
    } catch(err:any){ setCodeError(err.message || 'Search failed'); }
    finally { setCodeSearching(false); }
  }

  return (
    <PageShell title="Home">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(251,146,60,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(251,146,60,0.05),transparent_50%)]" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 lg:pt-32 lg:pb-32">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              <span className="block text-gray-900">Connect Partners with</span>
              <span className="block bg-gradient-to-r from-orange-600 via-orange-500 to-orange-400 bg-clip-text text-transparent">
                Impact on the Ground
              </span>
            </h1>
            
            <p className="text-xl sm:text-2xl text-gray-600 mb-8 leading-relaxed max-w-3xl mx-auto">
              Real-time transparency, AI-assisted reporting, and powerful marketing tools that turn field updates into compelling stories.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Link href={user ? "/profile" : "/login"} className="group inline-flex items-center gap-2 px-8 py-4 bg-orange-500 text-white rounded-full font-semibold text-lg shadow-lg shadow-orange-500/25 hover:bg-orange-600 hover:shadow-xl hover:shadow-orange-500/30 transition-all">
                Get Started
                <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link href="/about" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-900 rounded-full font-semibold text-lg border-2 border-gray-200 hover:border-gray-300 hover:shadow-md transition-all">
                Learn More
              </Link>
            </div>

            {/* Quick Code Search */}
            <div className="max-w-md mx-auto">
              <form onSubmit={handleCodeSearch} className="relative">
                <input
                  value={codeInput}
                  onChange={e=> { setCodeInput(e.target.value); setCodeError(''); }}
                  placeholder="Quick access: Enter project or profile code"
                  className="w-full px-6 py-3 rounded-full border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-center text-sm font-medium placeholder:text-gray-400"
                />
                <button 
                  type="submit" 
                  disabled={codeSearching}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-orange-500 text-white rounded-full text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition"
                >
                  {codeSearching ? '...' : 'Go'}
                </button>
              </form>
              {codeError && <p className="text-red-500 text-sm mt-2">{codeError}</p>}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-white/50 backdrop-blur-sm border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-orange-500 mb-2">Real-Time</div>
              <div className="text-gray-600 font-medium">Updates from the Field</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-orange-500 mb-2">AI-Powered</div>
              <div className="text-gray-600 font-medium">Content & Reporting</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-orange-500 mb-2">Marketing Tools</div>
              <div className="text-gray-600 font-medium">Built Right In</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-orange-500 mb-2">Transparent</div>
              <div className="text-gray-600 font-medium">Grant Spending Tracking</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Simple, transparent, and direct connection between partners and projects
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            <div className="relative">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-8 text-white h-full shadow-lg">
                <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                  <UserGroupIcon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Partners Connect</h3>
                <p className="text-orange-50 leading-relaxed">
                  Support projects and individuals making real impact. Follow their journey and see exactly where your contribution goes.
                </p>
              </div>
              <div className="hidden md:block absolute top-1/2 -right-6 w-12 h-0.5 bg-gradient-to-r from-orange-300 to-transparent" />
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 text-white h-full shadow-lg">
                <div className="bg-white/10 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                  <DevicePhoneMobileIcon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Mobile Tracking</h3>
                <p className="text-gray-300 leading-relaxed">
                  Project staff use our mobile app to track grant spending, upload receipts, and document progress in real-time from anywhere.
                </p>
              </div>
              <div className="hidden md:block absolute top-1/2 -right-6 w-12 h-0.5 bg-gradient-to-r from-gray-300 to-transparent" />
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-8 text-white h-full shadow-lg">
              <div className="bg-white/20 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                <SparklesIcon className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-4">AI Assisted Reporting</h3>
              <p className="text-blue-50 leading-relaxed">
                Auto-generated insights and reports powered by AI. Project teams spend less time on paperwork and more time making impact.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Built for Transparency & Communication
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to connect, track, report, and market your impactful work
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: ChartBarIcon, title: "Digital Financial Tools", desc: "Live grant spending tracking with receipt uploads and automatic categorization" },
              { icon: DevicePhoneMobileIcon, title: "Mobile First", desc: "Field teams update progress and spending directly from their phones" },
              { icon: SparklesIcon, title: "AI-Assisted Updates", desc: "Auto-generate reports, social posts, and updates with AI help, saving hours of work" },
              { icon: GlobeAltIcon, title: "Direct Connection", desc: "Partners see unfiltered updates straight from project teams" },
              { icon: MegaphoneIcon, title: "Marketing Tools", desc: "Professional profiles, PDFs, and QR codes turn your work into compelling marketing materials" },
              { icon: ShareIcon, title: "Easy Sharing", desc: "Unique codes and shareable links make promoting your projects effortless" },
              { icon: CheckCircleIcon, title: "Verified Impact", desc: "Photo documentation and progress tracking ensure accountability" },
              { icon: QrCodeIcon, title: "Instant Access", desc: "QR codes on all materials provide immediate access to project details and updates" },
              { icon: UserGroupIcon, title: "Community Profiles", desc: "Follow individuals and organizations doing the work you care about" }
            ].map((feature, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition border border-gray-100">
                <div className="bg-orange-50 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials — commented out until real feedback is collected
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
              Trusted by Impact Makers
            </h2>
            <p className="text-xl text-gray-600">Real feedback from people using Close2Source</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { quote: "Our partners see exactly what their support unlocks. Transparency builds trust.", name: "Lina A.", role: "Project Lead" },
              { quote: "The mobile app makes tracking so easy. We update spending in real-time from the field.", name: "Grace K.", role: "Field Coordinator" },
              { quote: "AI-assisted reporting saves us hours. We focus on work, not paperwork.", name: "Michael T.", role: "NGO Director" },
              { quote: "I love seeing unfiltered updates. It feels personal and authentic.", name: "Ravi P.", role: "Monthly Partner" },
              { quote: "The project code system is genius. Instant access to everything.", name: "Sarah W.", role: "Volunteer" },
              { quote: "Being this close to the source motivates me to keep giving.", name: "Jonas L.", role: "Supporter" }
            ].map((t, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <p className="text-gray-700 mb-4 italic">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold">
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{t.name}</div>
                    <div className="text-gray-500 text-xs">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      */}

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-3xl p-12 text-center shadow-2xl shadow-orange-500/25">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-orange-50 mb-8 max-w-2xl mx-auto">
              Join partners and project teams using Close2Source for transparent, real-time impact reporting.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href={user ? "/profile" : "/login"} className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-orange-600 rounded-full font-semibold text-lg hover:bg-orange-50 transition shadow-lg">
                Get Started
                <ArrowRightIcon className="w-5 h-5" />
              </Link>
              <Link href="/individuals/register-ai" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-orange-700 text-white rounded-full font-semibold text-lg hover:bg-orange-800 transition border-2 border-orange-400">
                <SparklesIcon className="w-5 h-5" />
                Create Profile with AI
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

export default dynamic(() => Promise.resolve(Home), { ssr: false });
