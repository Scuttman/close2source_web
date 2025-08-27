"use client";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { app } from "../../src/lib/firebase";


export default function CreditsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [amount, setAmount] = useState<number>(10);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const auth = getAuth(app);
  const db = getFirestore(app);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          setCredits(userDoc.data().credits ?? 0);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth, db]);

  async function handlePurchase(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!user) return;
    try {
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      const currentCredits = userDoc.exists() ? userDoc.data().credits ?? 0 : 0;
      await updateDoc(userRef, { credits: currentCredits + amount });
      setCredits(currentCredits + amount);
      setSuccess(`Purchased ${amount} credits!`);
      setTimeout(() => {
        router.push("/");
      }, 800);
    } catch (err: any) {
      setError("Failed to purchase credits: " + err.message);
    }
  }

  if (loading) return <div className="text-center py-20">Loading...</div>;
  if (!user) return <div className="text-center py-20">Please log in to purchase credits.</div>;

  return (
    <div className="max-w-md mx-auto mt-16 bg-white p-8 rounded-xl shadow-lg border border-brand-100">
      <h1 className="text-2xl font-bold mb-6 text-brand-main text-center">Buy Credits</h1>
      <div className="mb-4 text-center text-brand-dark font-medium">You have <span className="font-bold text-brand-main">{credits}</span> credits</div>
      <form className="space-y-4" onSubmit={handlePurchase}>
        <div>
          <label className="block mb-1 font-medium">Amount to purchase</label>
          <input
            type="number"
            min={1}
            className="w-full border rounded px-3 py-2"
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            required
          />
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        {success && <div className="text-green-600 text-sm">{success}</div>}
        <button
          type="submit"
          className="w-full py-2 px-4 rounded bg-brand-main text-white font-semibold hover:bg-brand-dark transition"
        >
          Purchase Credits
        </button>
      </form>
    </div>
  );
}