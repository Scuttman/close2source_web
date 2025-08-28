
"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../src/lib/firebase";
import PageShell from "../../components/PageShell";

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
    <PageShell title={<span>Individuals</span>} contentClassName="p-6 md:p-8">
      <div className="max-w-6xl">
        <h1 className="text-3xl font-bold mb-6 text-brand-main">All Individuals</h1>
        <input
          type="text"
          className="w-full max-w-md border rounded p-2 mb-6"
          placeholder="Search individuals by name or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filtered.length === 0 ? (
            <div className="col-span-full text-brand-dark text-center">No individuals found.</div>
          ) : (
            filtered.map((ind) => (
              <a
                key={ind.id}
                href={`/i?id=${ind.individualId}`}
                className="block bg-white/70 backdrop-blur-sm border border-white/40 rounded-xl shadow hover:shadow-lg transition overflow-hidden"
                style={{ minWidth: 220, maxWidth: 340 }}
                title={ind.name}
              >
                {ind.photoUrl ? (
                  <img
                    src={ind.photoUrl}
                    alt={ind.name}
                    className="w-full h-32 object-cover bg-gray-100"
                    style={{ minHeight: 96 }}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-32 bg-gray-200 flex items-center justify-center text-gray-400 text-3xl">
                    <span className="material-icons">person</span>
                  </div>
                )}
                <div className="p-3 bg-brand-main/10 border-t border-brand-main text-center">
                  <span className="text-brand-main font-semibold text-base truncate block">{ind.name}</span>
                  <span className="text-xs text-brand-dark block mt-1">Code: {ind.individualId}</span>
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </PageShell>
  );
}
