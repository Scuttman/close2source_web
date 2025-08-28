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
        </div>
        {user && (
          <aside className="w-full lg:w-80 flex-shrink-0">
            <div className="bg-white/70 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-white/30">
              <h2 className="text-xl font-bold text-brand-main mb-4">My Projects</h2>
              {myProjects.length === 0 ? (
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
        )}
      </div>
    </PageShell>
  );
}