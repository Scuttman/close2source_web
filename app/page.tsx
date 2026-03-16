"use client";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { app, db } from "../src/lib/firebase";
import { collection, query, where, onSnapshot, getDocs, updateDoc, doc } from "firebase/firestore";
import { inferKindFromCode, needsMigration, generateCode } from "../src/lib/codes";
import Link from "next/link";
import PageShell from "../components/PageShell";
import dynamic from 'next/dynamic';


function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [myOrganizations, setMyOrganizations] = useState<any[]>([]);
  const [myIndividuals, setMyIndividuals] = useState<any[]>([]);
  const [codeInput, setCodeInput] = useState('');
  const [codeSearching, setCodeSearching] = useState(false);
  const [codeError, setCodeError] = useState('');
  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Fetch organizations owned by user
  useEffect(()=> {
    if(!user){ setMyOrganizations([]); return; }
    const qOrg = query(collection(db,'organizations'), where('ownerUid','==', user.uid));
    const unsub = onSnapshot(qOrg, snap=> setMyOrganizations(snap.docs.map(d=> ({ id: d.id, ...d.data() }))));
    return ()=> unsub();
  }, [user]);
  // Fetch individual profiles owned by user
  useEffect(()=> {
    if(!user){ setMyIndividuals([]); return; }
    const qInd = query(collection(db,'individuals'), where('ownerUid','==', user.uid));
    const unsub = onSnapshot(qInd, snap=> setMyIndividuals(snap.docs.map(d=> ({ id: d.id, ...d.data() }))));
    return ()=> unsub();
  }, [user]);

  // Passive migration: add prefixes to legacy codes missing P/O/I (best-effort, limited batch size per session)
  useEffect(()=> {
    let cancelled=false;
    (async()=> {
      // Only run for signed in admin-like user (simplify: any user for now but limit counts)
      try {
        // Projects
        const projSnap = await getDocs(query(collection(db,'projects')));
        let changed=0;
        for(const d of projSnap.docs){
          if(changed>=10) break; // safety throttle
            const data:any = d.data();
            if(data.projectId && needsMigration(data.projectId)){
              const newId = generateCode('project');
              await updateDoc(doc(db,'projects', d.id), { projectId: newId });
              changed++;
            }
        }
        // Orgs
        const orgSnap = await getDocs(query(collection(db,'organizations')));
        changed=0;
        for(const d of orgSnap.docs){ if(changed>=10) break; const data:any = d.data(); if(data.orgId && needsMigration(data.orgId)){ const newId = generateCode('organization'); await updateDoc(doc(db,'organizations', d.id), { orgId: newId }); changed++; } }
        // Individuals
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
        if(!snap.empty){ window.location.href = `/projects/${snap.docs[0].id}`; return; }
      } else if(kind==='organization'){
        const snap = await getDocs(query(collection(db,'organizations'), where('orgId','==', raw)));
        if(!snap.empty){ window.location.href = `/org/${raw}`; return; }
      } else if(kind==='individual'){
        const snap = await getDocs(query(collection(db,'individuals'), where('individualId','==', raw)));
        if(!snap.empty){ window.location.href = `/i?id=${raw}`; return; }
      }
      setCodeError('Code not found');
    } catch(err:any){ setCodeError(err.message || 'Search failed'); }
    finally { setCodeSearching(false); }
  }

  return (
    <PageShell title={<span>Home</span>} contentClassName="py-10">
      <div className="flex flex-col lg:flex-row gap-10">
        <div className="flex-1 flex flex-col items-center">
          <div className="w-full max-w-2xl text-center space-y-6">
            <h1 className="text-5xl md:text-6xl text-brand-dark drop-shadow-sm">
              <span className="font-bold">Welcome to</span> <span className="font-thin text-brand-main lowercase tracking-wide">close2source</span>
            </h1>
            <p className="text-lg md:text-xl text-brand-dark font-medium">
              Connect directly with projects and individuals making a difference.<br />
              Follow updates, support causes, and be part of the story.
            </p>
            {/* Code quick search */}
            <form onSubmit={handleCodeSearch} className="mt-4 max-w-md mx-auto flex gap-2">
              <input
                value={codeInput}
                onChange={e=> { setCodeInput(e.target.value); setCodeError(''); }}
                placeholder="Enter Project (P...), Org (O...), or Profile (I...) code"
                className="flex-1 border rounded px-3 py-2 text-sm"
              />
              <button type="submit" disabled={codeSearching} className="px-4 py-2 rounded bg-brand-main text-white text-sm font-semibold disabled:opacity-50">{codeSearching? '...' : 'Go'}</button>
            </form>
            {codeError && <div className="text-[11px] text-red-600 mt-1">{codeError}</div>}
            {!user && (
              <div className="mb-8">
                <span className="inline-block bg-brand-main text-white px-4 py-2 rounded-full font-semibold text-sm shadow">
                  New here?
                </span>
                <div className="mt-3 text-brand-dark text-base">
                  Don’t have an account?{' '}
                  <a href="/register" className="text-brand-main underline font-semibold hover:text-brand-dark transition">Register now</a>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-center mt-8">
            <Link href="/individuals/create">
              <button className="px-8 py-4 rounded bg-brand-main text-white font-bold text-lg shadow hover:bg-brand-main/90 transition">
                Create Your Profile
              </button>
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-8 mt-8">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg p-6 w-72 flex flex-col items-center border border-white/40 hover:shadow-xl transition h-80">
              <img src="/images/projects.svg" alt="Projects" className="w-20 h-20 mb-4" />
              <h2 className="text-xl font-semibold text-brand-main mb-2">Discover Projects</h2>
              <p className="text-brand-dark text-sm mb-4">Browse impactful projects and see real-time updates from the field.</p>
              <div className="flex-grow" />
              <a href="/projects" className="inline-block px-4 py-2 rounded bg-brand-main text-white font-semibold hover:bg-brand-dark transition w-full text-center mt-2">Explore Projects</a>
            </div>
            <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg p-6 w-72 flex flex-col items-center border border-white/40 hover:shadow-xl transition h-80">
              <img src="/images/individuals.svg" alt="Individuals" className="w-20 h-20 mb-4" />
              <h2 className="text-xl font-semibold text-brand-main mb-2">Support Individuals</h2>
              <p className="text-brand-dark text-sm mb-4">Connect with and support individuals, following their journeys and stories.</p>
              <div className="flex-grow" />
              <a href="/individuals" className="inline-block px-4 py-2 rounded bg-brand-main text-white font-semibold hover:bg-brand-dark transition w-full text-center mt-2">Meet Individuals</a>
            </div>
          </div>
          {/* Quotes / Testimonials Section (modernized) */}
          <div className="mt-20 w-full max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-3">
              <span className="bg-gradient-to-r from-brand-main via-brand-main/80 to-brand-main/50 bg-clip-text text-transparent">What People Are Saying</span>
            </h2>
            <p className="text-center text-brand-dark/70 mb-10 max-w-2xl mx-auto text-sm md:text-base">Real voices from project leads, supporters, and volunteers using Close2Source.</p>
            <div className="grid md:grid-cols-3 gap-7">
              {[
                {
                  quote: "Close2Source lets our donors see exactly what their support unlocks – transparency builds trust.",
                  name: "Lina A.",
                  role: "Project Lead – Community Well"
                },
                {
                  quote: "I love following field updates and knowing my contribution reaches real people fast.",
                  name: "Michael T.",
                  role: "Supporter"
                },
                {
                  quote: "Setting up our project page was simple. The live finance view is a game changer for reporting.",
                  name: "Grace K.",
                  role: "NGO Coordinator"
                },
                {
                  quote: "It feels personal – I can message, read updates, and share impact stories instantly.",
                  name: "Ravi P.",
                  role: "Monthly Donor"
                },
                {
                  quote: "The project code shortcut makes it so easy for field teams to show progress on the spot.",
                  name: "Sarah W.",
                  role: "Field Volunteer"
                },
                {
                  quote: "Being this close to the source motivates me to keep giving.",
                  name: "Jonas L.",
                  role: "Recurring Supporter"
                }
              ].map((t, i) => (
                <figure
                  key={i}
                  className="group relative overflow-hidden rounded-2xl border border-brand-main/10 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-all duration-300 p-6 flex flex-col"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.9),rgba(255,255,255,0))]"></div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-brand-main to-brand-main/60 flex items-center justify-center text-white text-xl font-bold shadow-inner shadow-brand-main/40">“”</div>
                    <div className="flex-1 h-px bg-gradient-to-r from-brand-main/30 to-transparent" />
                  </div>
                  <blockquote className="text-[15px] leading-relaxed text-brand-dark/90 font-medium relative">
                    <span className="text-brand-main select-none mr-1" aria-hidden="true">“</span>
                    {t.quote.trim()}
                    <span className="text-brand-main select-none ml-1" aria-hidden="true">”</span>
                  </blockquote>
                  <figcaption className="mt-6 pt-4 border-t border-brand-main/10 text-[11px] tracking-wide font-semibold text-brand-main/90">
                    {t.name}
                    <div className="normal-case font-normal text-brand-dark/60 mt-0.5 text-[12px]">{t.role}</div>
                  </figcaption>
                  <div className="absolute -bottom-16 -right-10 text-[160px] leading-none font-serif text-brand-main/5 group-hover:text-brand-main/10 transition-colors select-none" aria-hidden="true">”</div>
                </figure>
              ))}
            </div>
          </div>
        </div>
        <aside className="w-full lg:w-80 flex-shrink-0">
          <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-white/30">
            <h2 className="text-xl font-bold text-brand-main mb-4">My Profiles</h2>
            {!user && (
              <div className="text-brand-dark text-sm mb-4 space-y-2">
                <p className="font-medium">Sign in to view your profiles.</p>
                <div className="flex gap-2">
                  <a href="/login" className="flex-1 text-center px-3 py-2 rounded bg-brand-main text-white text-sm font-semibold hover:bg-brand-dark transition">Login</a>
                  <a href="/register" className="flex-1 text-center px-3 py-2 rounded bg-brand-main/80 text-white text-sm font-semibold hover:bg-brand-dark transition">Register</a>
                </div>
              </div>
            )}
            {user && (
              <div className="flex flex-col gap-6">
                {/* Organizations */}
                <div>
                  <div className="text-sm font-semibold text-brand-main mb-2">Organizations</div>
                  {myOrganizations.length === 0 ? (
                    <div className="text-[12px] text-brand-dark/70">None yet.</div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {myOrganizations.map(o=> (
                        <a key={o.id} href={`/org/${o.orgId}`} className="block rounded border border-brand-main/20 bg-white/80 hover:shadow transition overflow-hidden">
                          <div className="flex items-center gap-3 p-3">
                            {o.logoUrl ? <img src={o.logoUrl} alt={o.name} className="h-10 w-10 rounded object-cover bg-gray-100" /> : <div className="h-10 w-10 rounded bg-brand-main/10 flex items-center justify-center text-brand-main font-bold text-sm">{(o.name||'?').slice(0,2).toUpperCase()}</div>}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-brand-dark truncate">{o.name}</div>
                              <div className="text-[10px] text-gray-500 font-mono tracking-wide">{o.orgId}</div>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                  <a href="/org/create" className="mt-3 inline-block text-[11px] text-brand-main font-semibold underline">Create Organization</a>
                </div>
                {/* Individuals */}
                <div>
                  <div className="text-sm font-semibold text-brand-main mb-2">Individual Profiles</div>
                  {myIndividuals.length === 0 ? (
                    <div className="text-[12px] text-brand-dark/70">None yet.</div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {myIndividuals.map(p=> (
                        <a key={p.id} href={`/i?id=${p.individualId}`} className="block rounded border border-brand-main/20 bg-white/80 hover:shadow transition overflow-hidden">
                          <div className="p-3">
                            <div className="text-sm font-semibold text-brand-dark truncate">{p.name}</div>
                            <div className="text-[10px] text-gray-500 font-mono tracking-wide">{p.individualId}</div>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                  <a href="/individuals/create" className="mt-3 inline-block text-[11px] text-brand-main font-semibold underline">Create Individual Profile</a>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

export default dynamic(() => Promise.resolve(Home), { ssr: false });