"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getOrgInvite, acceptOrgInvite } from '@/lib/dal';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import PageShell from '../../../../components/PageShell';

export default function OrgInviteAcceptPage(){
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  useEffect(()=> {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, u=> setUser(u));
    return ()=> unsub();
  }, []);
  useEffect(()=> { (async()=> {
    try {
      const inviteData = await getOrgInvite(token);
      if(!inviteData) { setError('Invite not found.'); setLoading(false); return; }
      if(inviteData.status !== 'pending') { setError('Invite already processed.'); setLoading(false); return; }
      setInvite(inviteData);
    } catch(e:any){ setError(e.message || 'Failed to load invite'); }
    finally { setLoading(false); }
  })(); }, [token]);

  async function accept(){
    if(!invite || !user) return;
    if(invite.email && user.email?.toLowerCase() !== invite.email){ setError('Email mismatch. Please sign in with invited email.'); return; }
    setAccepting(true); setError('');
    try {
      await acceptOrgInvite({
        inviteToken: invite.id,
        user: { uid: user.uid, email: user.email, displayName: user.displayName || user.email },
      });
      router.push(`/org/${invite.orgId}?tab=team`);
    } catch(e:any){ setError(e.message || 'Failed to accept invite'); }
    finally { setAccepting(false); }
  }

  const needAuth = !user;
  return (
    <PageShell title={<span>Organization Invite</span>} contentClassName='p-6 max-w-xl'>
      {loading && <div className='text-sm text-gray-500'>Loading invite…</div>}
      {!loading && error && <div className='text-sm text-red-600'>{error}</div>}
      {!loading && !error && invite && (
        <div className='space-y-4'>
          <h1 className='text-xl font-bold'>Join {invite.orgName || 'Organization'}</h1>
          <p className='text-sm text-gray-600'>You were invited {invite.email? `(${invite.email})` : ''}. Accepting will add you to the team.</p>
          {needAuth && (
            <div className='space-y-3'>
              <div className='text-sm text-gray-700'>Please sign in or register to continue.</div>
              <div className='flex gap-3'>
                <a href={`/login?return=/org/invite/${invite.id}`} className='px-4 py-2 rounded bg-brand-main text-white text-sm font-semibold'>Login</a>
                <a
                  href={`/register?return=/org/invite/${invite.id}&invite=${invite.id}${invite.email ? `&email=${encodeURIComponent(invite.email)}` : ''}`}
                  className='px-4 py-2 rounded bg-brand-main/80 text-white text-sm font-semibold'
                >Register</a>
              </div>
            </div>
          )}
          {!needAuth && (
            <div className='space-y-3'>
              {invite.email && user.email?.toLowerCase() !== invite.email && (
                <div className='text-[11px] text-amber-600 font-medium'>You are signed in as {user.email}. This invite is for {invite.email}. Sign out and sign in with the invited email or continue (may be blocked).</div>
              )}
              <button disabled={accepting} onClick={accept} className='px-4 py-2 rounded bg-brand-main text-white text-sm font-semibold disabled:opacity-50'>
                {accepting? 'Accepting…' : 'Accept Invite'}
              </button>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
