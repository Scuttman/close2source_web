"use client";
import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../src/lib/firebase';
import PageShell from '../../components/PageShell';
import Link from 'next/link';

export default function OrganizationsListPage(){
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(()=>{
    let mounted = true;
    (async()=>{
      try {
        const qy = query(collection(db,'organizations'), orderBy('createdAt','desc'));
        const snap = await getDocs(qy);
        if(!mounted) return;
        setOrgs(snap.docs.map(d=> ({ id: d.id, ...d.data() }))); 
      } catch(e:any){ setError(e.message || 'Failed to load organizations'); }
      finally { if(mounted) setLoading(false); }
    })();
    return ()=> { mounted = false; };
  },[]);

  return (
    <PageShell title={<span>Organizations</span>} contentClassName="p-6">
      {loading && <div className="text-sm text-gray-500">Loading...</div>}
      {error && <div className="text-sm text-red-600 mb-4">{error}</div>}
      {!loading && !orgs.length && <div className="text-sm text-gray-600">No organizations yet.</div>}
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
