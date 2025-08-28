"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../src/lib/firebase";

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
    <div className="max-w-5xl mx-auto mt-10 p-4">
      <h1 className="text-3xl font-bold mb-6 text-brand-main">All Projects</h1>
      <input
        type="text"
        className="w-full max-w-md border rounded p-2 mb-6"
        placeholder="Search projects by name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {filtered.length === 0 ? (
          <div className="col-span-full text-brand-dark text-center">No projects found.</div>
        ) : (
          filtered.map((proj) => (
            <a
              key={proj.id}
              href={`/projects/${proj.id}`}
              className="block bg-white border border-brand-main rounded-xl shadow hover:shadow-lg transition overflow-hidden"
              style={{ minWidth: 220, maxWidth: 340 }}
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
          ))
        )}
      </div>
    </div>
  );
}
