"use client";
import { useState } from "react";
import { getAuth } from "firebase/auth";
import { useSearchParams, useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../src/lib/firebase";
import { logCreditTransaction } from "../../../src/lib/credits";

export default function CreateIndividualProfileForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const type = searchParams.get("type") || "fundraising";
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("You must be signed in to create a profile.");
      const generatedId = Math.random().toString(36).substring(2, 10);
      // Deduct 50 credits from user
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      const currentCredits = userDoc.exists() ? userDoc.data().credits ?? 0 : 0;
      if (currentCredits < 50) throw new Error("Not enough credits to create a profile.");
      await updateDoc(userRef, { credits: currentCredits - 50 });
      const docRef = await addDoc(collection(db, "individuals"), {
        name,
        bio,
        type,
        createdAt: serverTimestamp(),
        individualId: generatedId,
        ownerUid: user.uid,
        updates: [],
        prayerRequests: [],
        financeSummary: [],
      });
      // Log credit spend
      await logCreditTransaction(user.uid, "spend", 50, `Created ${type} profile: ${name}`);
      setSuccess(true);
      setTimeout(() => {
        router.push(`/i?id=${generatedId}`);
      }, 1200);
    } catch (e: any) {
      setError(e.message || "Error creating profile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto mt-16 bg-white rounded-xl shadow p-8">
      <h1 className="text-2xl font-bold text-brand-main mb-4">Create a {type === "fundraising" ? "Fundraising" : "Personal Updates"} Profile</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="font-semibold">Name
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </label>
        <label className="font-semibold">{type === "fundraising" ? "Fundraising Story" : "Personal Bio"}
          <textarea
            className="mt-1 w-full border rounded px-3 py-2"
            value={bio}
            onChange={e => setBio(e.target.value)}
            required
            rows={4}
          />
        </label>
        <button
          type="submit"
          className="mt-4 px-6 py-3 rounded bg-brand-main text-white font-semibold text-lg hover:bg-brand-main/90 transition disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Creating..." : "Create Profile"}
        </button>
        {error && <div className="text-red-600 mt-2">{error}</div>}
        {success && <div className="text-green-700 mt-2">Profile created! Redirecting...</div>}
      </form>
    </div>
  );
}
