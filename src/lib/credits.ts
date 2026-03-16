// Firestore structure: users/{uid}/transactions/{txId}
// Each transaction: { type: 'purchase' | 'spend', amount: number, timestamp, description }

import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";

export async function logCreditTransaction(uid: string, type: 'purchase' | 'spend', amount: number, description: string) {
  const db = getFirestore();
  await addDoc(collection(db, "users", uid, "transactions"), {
    type,
    amount,
    description,
    timestamp: serverTimestamp(),
  });
}

export async function getCreditStatement(uid: string) {
  const db = getFirestore();
  const q = query(collection(db, "users", uid, "transactions"), orderBy("timestamp", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export function formatMoney(v: number | undefined | null, currency: string = 'USD'){ 
  const n = typeof v === 'number' ? v : 0; 
  try { return new Intl.NumberFormat('en-US',{ style:'currency', currency }).format(n); } catch { return `$${n.toFixed(2)}`; }
}
