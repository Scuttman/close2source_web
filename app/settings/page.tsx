"use client";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, updateProfile, User } from "firebase/auth";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";
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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
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

  if (loading) return <div className="text-center py-10">Loading...</div>;
  if (!user) return <div className="text-center py-10">Please log in to manage settings.</div>;

  return (
    <PageShell title={<span>Settings</span>} contentClassName="p-6 md:p-8">
      <form onSubmit={handleSave} className="space-y-6 max-w-xl">
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
    </PageShell>
  );
}
