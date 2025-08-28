"use client";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";
import { logCreditTransaction, getCreditStatement } from "../../src/lib/credits";
import { useRouter } from "next/navigation";
import { app } from "../../src/lib/firebase";


export default function CreditsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [amount, setAmount] = useState<number>(10);
  const [loading, setLoading] = useState(true);
  const [statement, setStatement] = useState<any[]>([]);
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
        // Fetch statement
        const txs = await getCreditStatement(firebaseUser.uid);
        setStatement(txs);
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
      await logCreditTransaction(user.uid, "purchase", amount, "Purchased credits");
      // Refresh statement
      const txs = await getCreditStatement(user.uid);
      setStatement(txs);
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
  <div className="max-w-[1200px] mx-auto mt-16 bg-white p-8 rounded-xl shadow-lg border border-brand-100">
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
      <h2 className="text-xl font-bold mt-10 mb-4 text-brand-main">Credit Statement</h2>
      <div className="w-full overflow-x-auto">
        <table className="min-w-[800px] w-full text-sm border">
          <thead>
            <tr className="bg-brand-main/10">
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Amount</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-left">Balance</th>
            </tr>
          </thead>
          <tbody>
            {statement.length === 0 ? (
              <tr>
                <td className="text-center py-4" colSpan={5}>No transactions yet.</td>
              </tr>
            ) : (
              (() => {
                // Sort transactions oldest to newest
                const sorted = [...statement].sort((a, b) => {
                  const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
                  const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
                  return aTime - bTime;
                });
                // Calculate running balance as user's credit after each transaction
                let running = credits;
                const rows = [];
                for (let i = sorted.length - 1; i >= 0; i--) {
                  const tx = sorted[i];
                  rows.unshift(
                    <tr key={tx.id}>
                      <td className="px-3 py-2">{tx.timestamp?.toDate ? tx.timestamp.toDate().toLocaleString() : "-"}</td>
                      <td className="px-3 py-2">{tx.type}</td>
                      <td className="px-3 py-2">{tx.amount}</td>
                      <td className="px-3 py-2">{tx.description}</td>
                      <td className="px-3 py-2">{typeof running === 'number' && !isNaN(running) ? running : '-'}</td>
                    </tr>
                  );
                  if (tx.type === "purchase") {
                    running -= tx.amount;
                  } else {
                    running += tx.amount;
                  }
                }
                return rows;
              })()
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}