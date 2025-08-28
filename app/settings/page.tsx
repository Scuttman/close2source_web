"use client";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, updateProfile, User } from "firebase/auth";
import { getFirestore, doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { app } from "../../src/lib/firebase";
import PageShell from "../../components/PageShell";

export default function SettingsPage() {
  const auth = getAuth(app);
  const db = getFirestore(app);
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
        // Optionally pull extra profile data from Firestore
        try {
          const userRef = doc(db, "users", u.uid);
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data();
            if (typeof data.displayName === 'string' && !displayName) setDisplayName(data.displayName);
          }
        } catch { /* ignore */ }
        // Load pricing config
        try {
          const pricingRef = doc(db, "config", "pricing");
          const pSnap = await getDoc(pricingRef);
          if (pSnap.exists()) {
            const d: any = pSnap.data();
            if (typeof d.costCreateIndividualProfile === 'number') setCostCreateIndividualProfile(d.costCreateIndividualProfile);
            if (typeof d.costCreateFundraisingProfile === 'number') setCostCreateFundraisingProfile(d.costCreateFundraisingProfile);
            if (typeof d.costCreateProjectProfile === 'number') setCostCreateProjectProfile(d.costCreateProjectProfile);
            if (typeof d.costImprovePost === 'number') setCostImprovePost(d.costImprovePost);
          }
        } catch (e) { /* ignore pricing load errors */ }
        finally { setPricingLoading(false); }
      } else {
        setPricingLoading(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [auth, db]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateProfile(user, { displayName: displayName || undefined, photoURL: photoURL || undefined });
      // Mirror to Firestore user doc
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { displayName, photoURL });
      setMessage("Profile updated.");
    } catch (err: any) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
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
      const pricingRef = doc(db, "config", "pricing");
      await setDoc(pricingRef, {
        costCreateIndividualProfile,
        costCreateFundraisingProfile,
        costCreateProjectProfile,
        costImprovePost,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      setPricingMessage("Pricing saved.");
    } catch (err: any) {
      setPricingError(err.message || "Failed to save pricing.");
    } finally {
      setPricingSaving(false);
    }
  }

  if (loading) return <div className="text-center py-10">Loading...</div>;
  if (!user) return <div className="text-center py-10">Please log in to manage settings.</div>;

  return (
    <PageShell title={<span>Settings</span>} contentClassName="p-6 md:p-8">
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
    </PageShell>
  );
}
