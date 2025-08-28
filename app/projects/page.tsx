"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../src/lib/firebase";
import PageShell from "../../components/PageShell";
import Link from "next/link";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "projects"), (snap) => {
      setProjects(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const filtered = projects.filter((p) => {
    const s = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(s) ||
      p.projectId?.toLowerCase().includes(s)
    );
  });

  return (
    <PageShell
      title={<span>Projects</span>}
      contentClassName="p-6 md:p-8"
      searchEnabled
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search projects by name or code..."
      headerRight={
        <Link
          href="/projects/register"
          className="inline-flex items-center gap-2 rounded-md bg-brand-main hover:bg-brand-main/90 text-white text-sm font-semibold px-4 py-2 shadow transition"
        >
          <span className="material-icons text-base">add</span>
          <span>New Project</span>
        </Link>
      }
    >
      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold mb-6 text-brand-main">All Projects</h1>
        <div className="flex flex-wrap gap-3 justify-start">
          {filtered.length === 0 ? (
            <div className="col-span-full text-brand-dark text-center">No projects found.</div>
          ) : (
            filtered.map((proj) => (
              <a
                key={proj.id}
                href={`/projects/${proj.id}`}
                className="block bg-white/70 backdrop-blur-sm border border-white/40 rounded-xl shadow hover:shadow-lg transition overflow-hidden w-40 sm:w-44 md:w-48"
                title={proj.name}
              >
                {proj.coverPhotoUrl ? (
                  <img
                    src={proj.coverPhotoUrl}
                    alt={proj.name}
                    className="w-full h-32 object-cover bg-gray-100"
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
            ))
          )}
        </div>
      </div>
    </PageShell>
  );
}
