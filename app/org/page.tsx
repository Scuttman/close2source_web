"use client";
import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { app } from '../../src/lib/firebase';
import { subscribeUserOrgs } from '@/lib/dal';
import PageShell from '../../components/PageShell';
import Link from 'next/link';

export default function OrganizationsListPage(){
  const [user, setUser] = useState<User | null>(null);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) { setOrgs([]); setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeUserOrgs(user.uid, (rows) => {
      // Sort by createdAt descending
      const sorted = [...rows].sort((a: any, b: any) => {
        const ta = a.createdAt?.seconds ?? 0;
        const tb = b.createdAt?.seconds ?? 0;
        return tb - ta;
      });
      setOrgs(sorted);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  return (
    <PageShell title={<span>My Organizations</span>} contentClassName="p-6">
      {loading && <div className="text-sm text-gray-500">Loading...</div>}
      {!loading && !user && <div className="text-sm text-gray-600">Sign in to see your organizations.</div>}
      {!loading && user && !orgs.length && <div className="text-sm text-gray-600">You don&apos;t have any organizations yet.</div>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
        {orgs.map(o=> (
          <Link key={o.id} href={`/org/${o.orgId}`} className="block bg-white border border-brand-main/10 rounded-lg p-4 hover:shadow transition">
            <div className="flex items-center gap-3">
              {o.logoUrl && <img src={o.logoUrl} alt={o.name} className="w-12 h-12 object-cover rounded border border-brand-main/20" />}
              <div className="min-w-0">
                <div className="font-semibold text-brand-main truncate">{o.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  {o.orgType && <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-brand-main/10 text-brand-main font-semibold tracking-wide">{o.orgType}</span>}
                </div>
                {o.bio && <div className="text-[11px] text-gray-500 line-clamp-2 mt-1">{o.bio}</div>}
              </div>
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-8">
        <Link href="/org/create" className="inline-block px-5 py-3 rounded bg-brand-main text-white font-semibold text-sm hover:bg-brand-dark">Create Organization</Link>
      </div>
    </PageShell>
  );
}
