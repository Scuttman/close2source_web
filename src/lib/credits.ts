// Firestore structure: users/{uid}/transactions/{txId}
// Each transaction: { type: 'purchase' | 'spend', amount: number, timestamp, description }

import { addCreditTransaction, getCreditTransactions } from '@/lib/dal';

export async function logCreditTransaction(uid: string, type: 'purchase' | 'spend', amount: number, description: string) {
  await addCreditTransaction(uid, { type, amount, description });
}

export async function getCreditStatement(uid: string) {
  return getCreditTransactions(uid);
}

export function formatMoney(v: number | undefined | null, currency: string = 'USD'){ 
  const n = typeof v === 'number' ? v : 0; 
  try { return new Intl.NumberFormat('en-US',{ style:'currency', currency }).format(n); } catch { return `$${n.toFixed(2)}`; }
}
