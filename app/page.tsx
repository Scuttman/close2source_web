"use client";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { app, db } from "../src/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import PageShell from "../components/PageShell";


export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [myProjects, setMyProjects] = useState<any[]>([]);
  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Fetch projects where user is a member
  useEffect(() => {
    if (!user) {
      setMyProjects([]);
      return;
    }
    const q = query(
      collection(db, "projects"),
      where("users", "array-contains", { uid: user.uid, role: "Admin" })
    );
    const unsub = onSnapshot(q, (snap) => {
      setMyProjects(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user]);

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
            <h2 className="text-xl font-bold text-brand-main mb-4">My Projects</h2>
            {!user && (
              <div className="text-brand-dark text-sm mb-4 space-y-2">
                <p className="font-medium">Sign in to view and manage your projects.</p>
                <div className="flex gap-2">
                  <a href="/login" className="flex-1 text-center px-3 py-2 rounded bg-brand-main text-white text-sm font-semibold hover:bg-brand-dark transition">Login</a>
                  <a href="/register" className="flex-1 text-center px-3 py-2 rounded bg-brand-main/80 text-white text-sm font-semibold hover:bg-brand-dark transition">Register</a>
                </div>
              </div>
            )}
            {user && (
              myProjects.length === 0 ? (
                <div className="text-brand-dark text-sm mb-4">No projects found.</div>
              ) : (
                <div className="flex flex-col gap-4 mb-4">
                  {myProjects.map((proj) => (
                    <a
                      key={proj.id}
                      href={`/projects/${proj.id}`}
                      className="block bg-white/70 backdrop-blur-sm border border-brand-main rounded-xl shadow hover:shadow-lg transition overflow-hidden"
                      style={{ maxWidth: 320 }}
                      title={proj.name}
                    >
                      {proj.coverPhotoUrl ? (
                        <img
                          src={proj.coverPhotoUrl}
                          alt={proj.name}
                          className="w-full h-32 object-cover bg-gray-100"
                          style={{ minHeight: 96 }}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="w-full h-32 bg-gray-200 flex items-center justify-center text-gray-400 text-3xl">
                          <span className="material-icons">image</span>
                        </div>
                      )}
                      <div className="p-3 bg-brand-main/10 border-t border-brand-main text-center">
                        <span className="text-brand-main font-semibold text-base truncate block">{proj.name}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )
            )}
            <a
              href="/projects/register"
              className="block w-full text-center px-4 py-2 rounded bg-brand-main text-white font-semibold hover:bg-brand-dark transition mb-2"
            >
              Register New Project
            </a>
            <p className="text-sm text-brand-dark mt-2">Create a new project and become an admin.</p>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}