"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getAuth, onAuthStateChanged, updateProfile, User,
  EmailAuthProvider, reauthenticateWithCredential, deleteUser,
} from "firebase/auth";
import { app } from "../../src/lib/firebase";
import {
  getUser,
  updateUser,
  getPricingConfig,
  savePricingConfig,
  getUserIndividuals,
  getUserOrgs,
  getAllOrgs,
  getUserProjects,
  getOrg,
  getActivityLog,
  deleteUserAccount,
} from "@/lib/dal";
import PageShell from "../../components/PageShell";
import { updateAIConsent, logUserActivity } from "../../src/lib/userConsent";
import AIConsentModal from "../../components/AIConsentModal";

export default function SettingsPage() {
  const auth = getAuth(app);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  // Pricing config state
  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingError, setPricingError] = useState("");
  const [pricingMessage, setPricingMessage] = useState("");
  const [costCreateIndividualProfile, setCostCreateIndividualProfile] = useState<number>(50);
  const [costCreateFundraisingProfile, setCostCreateFundraisingProfile] = useState<number>(50);
  const [costCreateProjectProfile, setCostCreateProjectProfile] = useState<number>(50);
  const [costImprovePost, setCostImprovePost] = useState<number>(10);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  // AI consent
  const [aiConsent, setAiConsent] = useState(false);
  const [aiConsentLoading, setAiConsentLoading] = useState(true);
  const [aiConsentSaving, setAiConsentSaving] = useState(false);
  const [aiConsentMessage, setAiConsentMessage] = useState("");
  const [showAIReconsentModal, setShowAIReconsentModal] = useState(false);
  // Account deletion
  const [deleteStep, setDeleteStep] = useState<'idle'|'analyzing'|'blocked'|'confirm'|'deleting'>('idle');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteImpact, setDeleteImpact] = useState<{
    individuals:  { id: string; name: string }[];
    soloOrgs:     { docId: string; name: string; orgId: string; projectCount: number }[];
    blockedOrgs:  { docId: string; name: string; orgId: string; memberCount: number }[];
    memberOrgs:   { docId: string; name: string; orgId: string }[];
  }>({ individuals: [], soloOrgs: [], blockedOrgs: [], memberOrgs: [] });
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Inspect token claims for role
        try {
          const token = await u.getIdTokenResult();
          setIsSuperAdmin(token.claims.role === 'SuperAdmin' || token.claims.admin === true);
        } catch { setIsSuperAdmin(false); }
        setDisplayName(u.displayName || "");
        setPhotoURL(u.photoURL || "");
        // Pull extra profile data from Firestore via DAL
        try {
          const userData = await getUser(u.uid);
          if (userData) {
            if (typeof userData.displayName === 'string' && !displayName) setDisplayName(userData.displayName);
          }
          // Load AI consent
          setAiConsent(userData?.aiConsent === true);
          setAiConsentLoading(false);
        } catch { setAiConsentLoading(false); }
        // Load pricing config via DAL
        try {
          const pricing = await getPricingConfig();
          if (pricing) {
            if (typeof pricing.costCreateIndividualProfile === 'number') setCostCreateIndividualProfile(pricing.costCreateIndividualProfile);
            if (typeof pricing.costCreateFundraisingProfile === 'number') setCostCreateFundraisingProfile(pricing.costCreateFundraisingProfile);
            if (typeof pricing.costCreateProjectProfile === 'number') setCostCreateProjectProfile(pricing.costCreateProjectProfile);
            if (typeof pricing.costImprovePost === 'number') setCostImprovePost(pricing.costImprovePost);
          }
        } catch (e) { /* ignore pricing load errors */ }
        finally { setPricingLoading(false); }
      } else {
        setAiConsentLoading(false);
        setPricingLoading(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [auth]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateProfile(user, { displayName: displayName || undefined, photoURL: photoURL || undefined });
      // Mirror to Firestore user doc via DAL
      await updateUser(user.uid, { displayName, photoURL } as any);
      setMessage("Profile updated.");
    } catch (err: any) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAIConsentToggle(enabled: boolean) {
    if (!user) return;
    // Re-enabling: show re-agreement modal instead of toggling directly
    if (enabled) {
      setShowAIReconsentModal(true);
      return;
    }
    setAiConsentSaving(true);
    setAiConsentMessage("");
    try {
      await updateAIConsent(user.uid, false);
      setAiConsent(false);
      setAiConsentMessage("AI features disabled.");
      setTimeout(() => setAiConsentMessage(""), 4000);
    } catch (err: any) {
      setAiConsentMessage("Failed to save preference.");
    } finally {
      setAiConsentSaving(false);
    }
  }

  async function handleAIReconsentAgree() {
    if (!user) return;
    setAiConsentSaving(true);
    setAiConsentMessage("");
    try {
      await updateAIConsent(user.uid, true);
      setAiConsent(true);
      setShowAIReconsentModal(false);
      setAiConsentMessage("AI features enabled.");
      setTimeout(() => setAiConsentMessage(""), 4000);
    } catch (err: any) {
      setAiConsentMessage("Failed to save preference.");
    } finally {
      setAiConsentSaving(false);
    }
  }

  async function handleSavePricing(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setPricingSaving(true);
    setPricingError("");
    setPricingMessage("");
    try {
      // Basic validation non-negative
      const values = [costCreateIndividualProfile, costCreateFundraisingProfile, costCreateProjectProfile, costImprovePost];
      if (values.some(v => isNaN(v) || v < 0)) throw new Error("Costs must be non-negative numbers.");
      await savePricingConfig({
        costCreateIndividualProfile,
        costCreateFundraisingProfile,
        costCreateProjectProfile,
        costImprovePost,
        updatedAt: new Date().toISOString(),
      } as any);
      setPricingMessage("Pricing saved.");
    } catch (err: any) {
      setPricingError(err.message || "Failed to save pricing.");
    } finally {
      setPricingSaving(false);
    }
  }

  async function analyzeDeletion() {
    if (!user) return;
    setDeleteStep('analyzing');
    setDeleteError('');
    try {
      // 1. Individual profiles owned by this user
      const indivs = await getUserIndividuals(user.uid);
      const individuals = indivs.map(d => ({
        id: d.id,
        name: (d as any).name || (d as any).individualId || d.id,
      }));

      // 2. Orgs where this user is owner
      const ownedOrgs = await getUserOrgs(user.uid);
      const soloOrgs: typeof deleteImpact.soloOrgs = [];
      const blockedOrgs: typeof deleteImpact.blockedOrgs = [];

      for (const orgData of ownedOrgs) {
        const team: any[] = Array.isArray((orgData as any).team) ? (orgData as any).team : [];
        const otherMembers = team.filter((m: any) => m.uid && m.uid !== user.uid);
        const memberCount = 1 + otherMembers.length;

        if (otherMembers.length === 0) {
          const projs = await getUserProjects(user.uid);
          const orgProjs = projs.filter((p: any) => p.organizationId === (orgData as any).orgId);
          soloOrgs.push({ docId: orgData.id, name: (orgData as any).name || (orgData as any).orgId, orgId: (orgData as any).orgId, projectCount: orgProjs.length });
        } else {
          blockedOrgs.push({ docId: orgData.id, name: (orgData as any).name || (orgData as any).orgId, orgId: (orgData as any).orgId, memberCount });
        }
      }

      // 3. Orgs where this user is a team member (not owner) — must scan all orgs
      const allOrgs = await getAllOrgs();
      const memberOrgs: typeof deleteImpact.memberOrgs = [];
      for (const orgData of allOrgs) {
        if ((orgData as any).ownerUid === user.uid) continue;
        const team: any[] = Array.isArray((orgData as any).team) ? (orgData as any).team : [];
        if (team.some((m: any) => m.uid === user.uid || m.email === user.email)) {
          memberOrgs.push({ docId: orgData.id, name: (orgData as any).name || (orgData as any).orgId, orgId: (orgData as any).orgId });
        }
      }

      setDeleteImpact({ individuals, soloOrgs, blockedOrgs, memberOrgs });
      setDeleteStep(blockedOrgs.length > 0 ? 'blocked' : 'confirm');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to analyse account. Please try again.');
      setDeleteStep('idle');
    }
  }

  async function handleDeleteAccount() {
    if (!user) return;
    setDeleteStep('deleting');
    setDeleteError('');
    try {
      // Re-authenticate for email/password accounts
      if (user.providerData.some(p => p.providerId === 'password')) {
        if (!deletePassword) { setDeleteError('Please enter your password.'); setDeleteStep('confirm'); return; }
        const credential = EmailAuthProvider.credential(user.email!, deletePassword);
        await reauthenticateWithCredential(user, credential);
      }

      // Log deletion event before any data is removed
      try { await logUserActivity(user.uid, 'account_deleted'); } catch { /* best-effort */ }

      await deleteUserAccount({
        uid: user.uid,
        email: user.email!,
        individuals: deleteImpact.individuals,
        soloOrgs: deleteImpact.soloOrgs,
        memberOrgs: deleteImpact.memberOrgs,
      });

      // Delete Firebase Auth account (must be last)
      await deleteUser(user);

      router.push('/');
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setDeleteError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/requires-recent-login') {
        setDeleteError('For security, please sign out and sign back in before deleting your account.');
      } else {
        setDeleteError(err.message || 'Deletion failed. Please contact support at info@close2source.com.');
      }
      setDeleteStep('confirm');
    }
  }

  function closeDeleteModal() {
    setDeleteStep('idle');
    setDeletePassword('');
    setDeleteError('');
  }

  // ── Data Export (Art. 20 GDPR) ──────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  async function exportData() {
    if (!user) return;
    setExporting(true);
    try {
      const out: Record<string, unknown> = {
        exportedAt: new Date().toISOString(),
        exportedBy: user.uid,
      };

      // 1. User document
      const userData = await getUser(user.uid);
      out.account = userData;

      // 2. Individual profiles
      const indivList = await getUserIndividuals(user.uid);
      out.individualProfiles = indivList;

      // 3. Owned organisations
      const orgList = await getUserOrgs(user.uid);
      out.organisations = orgList;

      // 4. Projects created by this user
      const projList = await getUserProjects(user.uid);
      out.projects = projList;

      // 5. Consent / activity log
      const logList = await getActivityLog(user.uid);
      out.activityLog = logList;

      // Trigger browser download
      const json = JSON.stringify(out, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `close2source-data-export-${user.uid.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <div className="text-center py-10">Loading...</div>;
  if (!user) return <div className="text-center py-10">Please log in to manage settings.</div>;

  return (
    <>
    <PageShell title={<span>Settings</span>} contentClassName="p-6 md:p-8">
      {/* AI Features Toggle */}
      <div className="max-w-xl mb-10">
        <h2 className="text-xl font-bold mb-1 text-brand-main">AI Features</h2>
        <p className="text-sm text-gray-500 mb-4">
          When enabled, AI tools help you improve text, build project proposals, and craft profiles. Your content may be processed by OpenAI (USA) as described in our{" "}
          <a href="/ai-policy" target="_blank" className="text-brand-main underline hover:text-brand-dark">AI Use Policy</a>.
        </p>
        {aiConsentLoading ? (
          <div className="text-sm text-gray-400">Loading…</div>
        ) : (
          <div className="flex items-center gap-4">
            <button
              type="button"
              disabled={aiConsentSaving}
              onClick={() => handleAIConsentToggle(!aiConsent)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                aiConsent ? 'bg-brand-main' : 'bg-gray-300'
              }`}
              aria-label={aiConsent ? 'Disable AI features' : 'Enable AI features'}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  aiConsent ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm font-medium text-gray-700">
              {aiConsent ? 'AI features enabled' : 'AI features disabled'}
            </span>
            {aiConsentMessage && (
              <span className="text-sm text-green-600">{aiConsentMessage}</span>
            )}
          </div>
        )}
      </div>
      <hr className="max-w-xl mb-10 border-gray-200" />
      <form onSubmit={handleSave} className="space-y-6 max-w-xl mb-12">
        <div>
          <label className="block font-semibold mb-1">Display Name</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div>
          <label className="block font-semibold mb-1">Photo URL</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={photoURL}
            onChange={(e) => setPhotoURL(e.target.value)}
            placeholder="https://..."
          />
          {photoURL && (
            <div className="mt-3">
              <img src={photoURL} alt="Preview" className="h-24 w-24 object-cover rounded-full border" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 rounded bg-brand-main text-white font-semibold hover:bg-brand-dark transition disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {message && <span className="text-green-600 text-sm">{message}</span>}
          {error && <span className="text-red-600 text-sm">{error}</span>}
        </div>
      </form>
      <div className="max-w-2xl">
        <h2 className="text-xl font-bold mb-4 text-brand-main">Credit Costs</h2>
        {pricingLoading ? (
          <div className="text-sm text-gray-500">Loading pricing...</div>
        ) : (
          <form onSubmit={handleSavePricing} className="space-y-5">
            <div className="grid md:grid-cols-2 gap-6">
              <label className="text-sm font-semibold flex flex-col gap-2">Individual Profile Cost
                <input type="number" min={0} className="border rounded px-3 py-2" value={costCreateIndividualProfile} onChange={e=>setCostCreateIndividualProfile(Number(e.target.value))} disabled={!isSuperAdmin} />
              </label>
              <label className="text-sm font-semibold flex flex-col gap-2">Fundraising Profile Cost
                <input type="number" min={0} className="border rounded px-3 py-2" value={costCreateFundraisingProfile} onChange={e=>setCostCreateFundraisingProfile(Number(e.target.value))} disabled={!isSuperAdmin} />
              </label>
              <label className="text-sm font-semibold flex flex-col gap-2">Project Profile Cost
                <input type="number" min={0} className="border rounded px-3 py-2" value={costCreateProjectProfile} onChange={e=>setCostCreateProjectProfile(Number(e.target.value))} disabled={!isSuperAdmin} />
              </label>
              <label className="text-sm font-semibold flex flex-col gap-2">Improve Post Cost
                <input type="number" min={0} className="border rounded px-3 py-2" value={costImprovePost} onChange={e=>setCostImprovePost(Number(e.target.value))} disabled={!isSuperAdmin} />
              </label>
            </div>
            <div className="flex items-center gap-3">
              {isSuperAdmin ? (
                <button type="submit" disabled={pricingSaving} className="px-6 py-2 rounded bg-brand-main text-white font-semibold hover:bg-brand-dark transition disabled:opacity-60">
                  {pricingSaving ? 'Saving...' : 'Save Pricing'}
                </button>
              ) : (
                <span className="text-xs text-gray-500 italic">View only. SuperAdmin role required to change pricing.</span>
              )}
              {pricingMessage && <span className="text-green-600 text-sm">{pricingMessage}</span>}
              {pricingError && <span className="text-red-600 text-sm">{pricingError}</span>}
            </div>
            <p className="text-xs text-gray-500">These values control how many credits are deducted for each action across the platform.</p>
          </form>
        )}
      </div>

      {/* Your Data — Art. 20 GDPR portability */}
      <div className="max-w-xl mt-14 pt-8 border-t border-gray-200">
        <h2 className="text-xl font-bold mb-2 text-gray-800">Your Data</h2>
        <p className="text-sm text-gray-500 mb-5">
          Download a copy of all personal data we hold about you — your account details, individual profiles,
          organisations, projects, and consent log — as a JSON file. This is your right under UK GDPR Article 20.
        </p>
        <button
          onClick={exportData}
          disabled={exporting}
          className="px-5 py-2.5 rounded-lg border border-gray-400 text-gray-700 font-semibold hover:bg-gray-50 transition text-sm disabled:opacity-60"
        >
          {exporting ? 'Preparing export…' : 'Download my data'}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="max-w-xl mt-14 pt-8 border-t border-red-200">
        <h2 className="text-xl font-bold mb-2 text-red-700">Danger Zone</h2>
        <p className="text-sm text-gray-500 mb-5">
          Permanently delete your account and all associated personal data. Individual profiles you own will be
          removed. For organisations you own alone, the organisation and all its projects will also be deleted.
          If you own an organisation with other members, you must transfer ownership or ask all members to leave
          before your account can be deleted. This action <strong>cannot be undone</strong>.
        </p>
        <button
          onClick={analyzeDeletion}
          className="px-5 py-2.5 rounded-lg border border-red-400 text-red-700 font-semibold hover:bg-red-50 transition text-sm"
        >
          Delete my account
        </button>
      </div>

      {/* Delete Account Modal — multi-step */}
      {deleteStep !== 'idle' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full">

            {/* ── Analysing ── */}
            {(deleteStep === 'analyzing' || deleteStep === 'deleting') && (
              <div className="flex flex-col items-center py-8 gap-4">
                <svg className="animate-spin h-8 w-8 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <p className="text-sm text-gray-600">
                  {deleteStep === 'analyzing' ? 'Analysing your account data…' : 'Deleting your account…'}
                </p>
              </div>
            )}

            {/* ── Blocked ── */}
            {deleteStep === 'blocked' && (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Action required before deletion</h3>
                <p className="text-sm text-gray-600 mb-4">
                  You are the owner of the following organisation{deleteImpact.blockedOrgs.length > 1 ? 's' : ''} which
                  still {deleteImpact.blockedOrgs.length > 1 ? 'have' : 'has'} other members. Your account cannot be
                  deleted until you resolve this.
                </p>

                <ul className="mb-5 space-y-3">
                  {deleteImpact.blockedOrgs.map(org => (
                    <li key={org.docId} className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                      <p className="font-semibold text-gray-800 text-sm">{org.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{org.memberCount} member{org.memberCount !== 1 ? 's' : ''} (including you)</p>
                    </li>
                  ))}
                </ul>

                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 mb-5">
                  To resolve: <strong>transfer the Admin role</strong> to another team member on each organisation,
                  or ask all other members to leave so the organisation can be fully deleted alongside your account.
                </div>

                <button
                  onClick={closeDeleteModal}
                  className="w-full py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition"
                >
                  Close
                </button>
              </>
            )}

            {/* ── Confirm ── */}
            {deleteStep === 'confirm' && (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm account deletion</h3>
                <p className="text-sm text-gray-500 mb-4">The following data will be permanently removed:</p>

                {/* Impact summary */}
                <div className="border border-gray-200 rounded-xl overflow-hidden mb-5 text-sm">
                  {/* Personal data */}
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <p className="font-semibold text-gray-700 mb-1">Your account &amp; personal data</p>
                    <p className="text-gray-500 text-xs">Account record, login credentials, consent logs</p>
                  </div>

                  {deleteImpact.individuals.length > 0 && (
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="font-semibold text-gray-700 mb-1">
                        Individual profile{deleteImpact.individuals.length !== 1 ? 's' : ''} ({deleteImpact.individuals.length})
                      </p>
                      <ul className="text-gray-500 text-xs space-y-0.5">
                        {deleteImpact.individuals.map(ind => <li key={ind.id}>• {ind.name}</li>)}
                      </ul>
                    </div>
                  )}

                  {deleteImpact.soloOrgs.length > 0 && (
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="font-semibold text-gray-700 mb-1">
                        Organisation{deleteImpact.soloOrgs.length !== 1 ? 's' : ''} you own ({deleteImpact.soloOrgs.length}) + their projects
                      </p>
                      <ul className="text-gray-500 text-xs space-y-0.5">
                        {deleteImpact.soloOrgs.map(org => (
                          <li key={org.docId}>• {org.name} — {org.projectCount} project{org.projectCount !== 1 ? 's' : ''}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {deleteImpact.memberOrgs.length > 0 && (
                    <div className="px-4 py-3">
                      <p className="font-semibold text-gray-700 mb-1">
                        Organisation membership{deleteImpact.memberOrgs.length !== 1 ? 's' : ''} removed ({deleteImpact.memberOrgs.length})
                      </p>
                      <ul className="text-gray-500 text-xs space-y-0.5">
                        {deleteImpact.memberOrgs.map(org => <li key={org.docId}>• {org.name}</li>)}
                      </ul>
                      <p className="text-xs text-blue-700 mt-1">Organisation records shared with other members are not deleted.</p>
                    </div>
                  )}
                </div>

                {/* Password confirmation for email users */}
                {user?.providerData?.some(p => p.providerId === 'password') ? (
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Enter your password to confirm
                    </label>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={e => setDeletePassword(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                      placeholder="Your current password"
                      autoComplete="current-password"
                    />
                  </div>
                ) : (
                  <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
                    You signed in with a social provider. Click <strong>Delete account</strong> to confirm.
                    If your session has expired, sign out and sign back in first.
                  </div>
                )}

                {deleteError && (
                  <p className="text-sm text-red-600 mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{deleteError}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteAccount}
                    className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition"
                  >
                    Delete account
                  </button>
                  <button
                    onClick={closeDeleteModal}
                    className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </PageShell>

    {/* AI Re-consent Modal */}
    {showAIReconsentModal && (
      <AIConsentModal
        saving={aiConsentSaving}
        onAgree={handleAIReconsentAgree}
        onCancel={() => setShowAIReconsentModal(false)}
      />
    )}
    </>
  );
}
