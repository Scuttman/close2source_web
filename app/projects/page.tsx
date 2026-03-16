"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where, orderBy, limit, startAfter, doc, getDoc } from "firebase/firestore";
import { db } from "../../src/lib/firebase";
import PageShell from "../../components/PageShell";
import Link from "next/link";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [ownerNames, setOwnerNames] = useState<Record<string,string>>({}); // cache of individual creator names

  // Pagination state
  const PAGE_SIZE = 24;
  const [loading, setLoading] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);

  async function loadPage(initial=false){
    if(loading) return; setLoading(true);
    try {
      let qRef = query(
        collection(db,'projects'),
        where('publicVisible','!=', false), // include undefined or true
        orderBy('publicVisible'), // needed because of inequality; false filtered later when == false
        orderBy('nameLower'),
        limit(PAGE_SIZE)
      );
      if(!initial && lastDoc){
        qRef = query(
          collection(db,'projects'),
            where('publicVisible','!=', false),
            orderBy('publicVisible'),
            orderBy('nameLower'),
            startAfter(lastDoc),
            limit(PAGE_SIZE)
        );
      }
      const snap = await getDocs(qRef);
      if(snap.empty){
        if(initial) setProjects([]);
        setExhausted(true); return;
      }
      const rows = snap.docs.map(d=> ({ id: d.id, ...d.data() }));
      setLastDoc(snap.docs[snap.docs.length-1]);
      setProjects(prev=> initial? rows : [...prev, ...rows]);
      if(rows.length < PAGE_SIZE) setExhausted(true);
    } finally { setLoading(false); }
  }

  useEffect(()=> { loadPage(true); // initial page
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch individual (user) names for projects without organizationName
  useEffect(()=> {
    async function fillMissing(){
      const toFetch = new Set<string>();
      projects.forEach(p=> {
        if(!p.organizationName && p.createdBy && !ownerNames[p.createdBy]) toFetch.add(p.createdBy);
      });
      for(const uid of toFetch){
        try {
          const userSnap = await getDoc(doc(db,'users', uid));
          if(userSnap.exists()){
            const data = userSnap.data() as any;
            const fullName = [data.name, data.surname].filter(Boolean).join(' ') || data.name || data.email || 'Individual';
            setOwnerNames(prev=> ({ ...prev, [uid]: fullName }));
          } else {
            setOwnerNames(prev=> ({ ...prev, [uid]: 'Individual' }));
          }
        } catch {
          setOwnerNames(prev=> ({ ...prev, [uid]: 'Individual' }));
        }
      }
    }
    if(projects.length) fillMissing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  const filtered = projects
    .filter((p) => {
      const s = search.toLowerCase();
      const matches = (
        p.name?.toLowerCase().includes(s) ||
        p.projectId?.toLowerCase().includes(s)
      );
      const isPublic = p.publicVisible !== false; // Only include publicly visible projects
      return matches && isPublic;
    })
    .sort((a,b)=> {
      const an = (a.name || '').toLowerCase();
      const bn = (b.name || '').toLowerCase();
      if(an && bn) return an.localeCompare(bn);
      if(an) return -1; if(bn) return 1; // names first
      return (a.projectId || '').localeCompare(b.projectId || '');
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
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.length === 0 && (
            <div className="col-span-full text-brand-dark text-center">No projects found.</div>
          )}
          {filtered.map((p) => {
            const owner = p.organizationName || ownerNames[p.createdBy] || '';
            return (
              <a
                key={p.id}
                href={`/projects/${p.projectId || p.id}`}
                className="group rounded-md border border-brand-main/10 overflow-hidden bg-white hover:shadow transition relative flex flex-col"
              >
                {p.coverPhotoUrl && (
                  <div className="h-32 w-full overflow-hidden">
                    <img
                      src={p.coverPhotoUrl}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                )}
                {!p.coverPhotoUrl && (
                  <div className="h-32 w-full flex items-center justify-center bg-gray-200 text-gray-400">
                    <span className="material-icons">image</span>
                  </div>
                )}
                <div className="p-3 flex-1 flex flex-col">
                  <div className="text-sm font-semibold text-brand-dark line-clamp-1 mb-1">{p.name}</div>
                  {p.description && (
                    <div className="text-[11px] text-gray-600 line-clamp-3 flex-1">{p.description}</div>
                  )}
                  {owner && (
                    <div className="mt-2 text-[10px] font-medium text-brand-main/80 line-clamp-1">
                      {owner}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-brand-main/10 text-brand-main">{p.projectId}</span>
                    {p.createdAt?.seconds && (
                      <span className="text-[10px] text-gray-400">
                        {new Date(p.createdAt.seconds * 1000).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
        <div className="mt-6 flex flex-col items-center gap-3">
          {loading && <div className="text-xs text-gray-500">Loading…</div>}
          {!loading && !exhausted && (
            <button onClick={()=> loadPage(false)} className="px-4 py-2 rounded bg-brand-main text-white text-sm font-semibold hover:bg-brand-main/90">
              Load More
            </button>
          )}
          {exhausted && filtered.length > 0 && (
            <div className="text-[11px] text-gray-400">No more projects.</div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
