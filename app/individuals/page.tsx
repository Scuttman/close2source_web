
"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../src/lib/firebase";
import PageShell from "../../components/PageShell";
import Link from "next/link";

export default function IndividualsPage() {
  const [individuals, setIndividuals] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "individuals"), (snap) => {
      setIndividuals(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const filtered = individuals.filter((ind) => {
    const s = search.toLowerCase();
    return (
      ind.name?.toLowerCase().includes(s) ||
      ind.individualId?.toLowerCase().includes(s) ||
      ind.bio?.toLowerCase().includes(s)
    );
  });

  return (
    <PageShell
      title={<span>Individuals</span>}
      contentClassName="p-6 md:p-8"
      searchEnabled
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search individuals by name or code..."
      headerRight={
        <Link
          href="/individuals/create"
          className="inline-flex items-center rounded-md bg-brand-main hover:bg-brand-main/90 text-white text-sm font-semibold px-4 py-2 shadow transition"
        >
          Add Profile
        </Link>
      }
    >
      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold mb-6 text-brand-main">All Individuals</h1>
  <div className="flex flex-wrap gap-3 justify-start">
          {filtered.length === 0 ? (
            <div className="col-span-full text-brand-dark text-center">No individuals found.</div>
          ) : (
            filtered.map((ind) => (
              <a
                key={ind.id}
                href={`/i?id=${ind.individualId}`}
                className="group relative flex flex-col bg-white/70 backdrop-blur-sm border border-white/40 rounded-xl shadow hover:shadow-lg transition overflow-hidden w-24 sm:w-28 md:w-32"
                title={ind.name}
              >
                {ind.photoUrl ? (
                  <img
                    src={ind.photoUrl}
                    alt={ind.name}
                    className="w-full h-36 object-cover bg-gray-100 transition-transform duration-300 group-hover:scale-[1.03]"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-36 bg-gray-200 flex items-center justify-center text-gray-400 text-4xl">
                    <span className="material-icons">person</span>
                  </div>
                )}
                <div className="p-3 bg-brand-main/10 border-t border-brand-main text-center flex flex-col items-center justify-center flex-1">
                  <span className="text-brand-main font-semibold text-sm leading-tight line-clamp-2">{ind.name}</span>
                  <span className="text-[10px] text-brand-dark mt-1 tracking-wide uppercase">Code: {ind.individualId}</span>
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </PageShell>
  );
}
