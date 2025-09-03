"use client";
import { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, query, orderBy, setDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { db } from '../src/lib/firebase';

interface ProjectTransactionsManagerProps {
  projectId: string;
  transactions: any[];
  setTransactions: React.Dispatch<React.SetStateAction<any[]>>;
  projectCurrency: string;
  currencySymbol: string;
}

export default function ProjectTransactionsManager({ projectId, transactions, setTransactions, projectCurrency, currencySymbol }: ProjectTransactionsManagerProps){
  // Form state
  const [newTxType, setNewTxType] = useState<'income' | 'expense'>('expense');
  const [newTxCategory, setNewTxCategory] = useState('');
  const [newTxManualId, setNewTxManualId] = useState('');
  const [newTxAmount, setNewTxAmount] = useState('');
  const [newTxNote, setNewTxNote] = useState('');
  const [newTxDate, setNewTxDate] = useState(()=> new Date().toISOString().slice(0,10));
  const [newTxCompany, setNewTxCompany] = useState('');
  const [newTxReceipts, setNewTxReceipts] = useState<FileList|null>(null);
  const [uploadingReceipts, setUploadingReceipts] = useState(false);
  const [addingTx, setAddingTx] = useState(false);
  // Data state
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeError, setFinanceError] = useState('');

  const auth = typeof window !== 'undefined' ? getAuth() : null;

  // Load transactions on mount / project change
  useEffect(()=>{
    async function loadFinance(){
      setFinanceLoading(true); setFinanceError('');
      try {
        const txRef = collection(db, 'projects', projectId, 'financeTransactions');
        const qRef = query(txRef, orderBy('createdAt','desc'));
        const snap = await getDocs(qRef);
        const rows = snap.docs.map(d=>({ id:d.id, ...d.data() }));
        const sorted = rows.sort((a:any,b:any)=>{
          const ad = (a.transactionDate || (a.createdAt? String(a.createdAt).slice(0,10):'')) as string;
          const bd = (b.transactionDate || (b.createdAt? String(b.createdAt).slice(0,10):'')) as string;
          if(bd === ad){
            return String(b.createdAt||'').localeCompare(String(a.createdAt||''));
          }
          return bd.localeCompare(ad);
        });
        setTransactions(sorted as any[]);
      } catch(e:any){ setFinanceError(e.message || 'Failed to load transactions'); }
      finally { setFinanceLoading(false); }
    }
    loadFinance();
  },[projectId, setTransactions]);

  const formatMoney = (v:number) => {
    const n = v.toLocaleString(undefined,{ minimumFractionDigits:2, maximumFractionDigits:2 });
    return projectCurrency ? `${currencySymbol}${n}` : n;
  };

  async function addTransaction(){
    setAddingTx(true);
    try {
      const user = auth?.currentUser; if(!user) throw new Error('Sign in required');
      const amount = parseFloat(newTxAmount);
      if(isNaN(amount) || amount <= 0) throw new Error('Amount must be > 0');
      const category = newTxCategory.trim().toLowerCase() || 'uncategorised';
      const manualIdRaw = newTxManualId.trim();
      if(manualIdRaw){
        const exists = transactions.some(t=> (t.manualId||'').toLowerCase() === manualIdRaw.toLowerCase());
        if(exists) throw new Error('Manual ID already used');
      }
      const txData: any = {
        type: newTxType,
        category,
        amount,
        note: newTxNote.trim() || null,
        company: newTxCompany.trim() || null,
        transactionDate: newTxDate,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
      };
      if(manualIdRaw) txData.manualId = manualIdRaw;
      if(newTxReceipts && newTxReceipts.length){
        setUploadingReceipts(true);
        const storage = getStorage();
        const uploaded: any[] = [];
        for(let i=0;i<newTxReceipts.length;i++){
          const f = newTxReceipts[i];
          const path = `projects/${projectId}/receipts/${Date.now()}_${i}_${f.name}`;
          const r = storageRef(storage, path);
          await uploadBytes(r, f);
          const url = await getDownloadURL(r);
          uploaded.push({ name: f.name, url, size: f.size, type: f.type });
        }
        txData.receipts = uploaded;
        setUploadingReceipts(false);
      }
      const colRef = collection(db,'projects', projectId, 'financeTransactions');
      const docRef = await addDoc(colRef, txData);
      // Persist the id field inside the document for redundancy / export convenience
      try { await setDoc(docRef, { id: docRef.id }, { merge: true }); } catch {/* ignore */}
      setTransactions(prev=> {
        const list = [{ id: docRef.id, ...txData }, ...prev.filter(t=> t.id !== docRef.id)];
        return list.sort((a:any,b:any)=>{
          const ad = (a.transactionDate || (a.createdAt? String(a.createdAt).slice(0,10):'')) as string;
          const bd = (b.transactionDate || (b.createdAt? String(b.createdAt).slice(0,10):'')) as string;
          if(bd === ad){
            return String(b.createdAt||'').localeCompare(String(a.createdAt||''));
          }
          return bd.localeCompare(ad);
        });
      });
  setNewTxAmount(''); setNewTxCategory(''); setNewTxNote(''); setNewTxCompany(''); setNewTxReceipts(null); setNewTxDate(new Date().toISOString().slice(0,10)); setNewTxManualId('');
    } catch(e:any){ alert(e.message || 'Failed to add transaction'); }
    finally { setAddingTx(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-brand-main mb-2">Add Transaction</h3>
  <form onSubmit={e=>{e.preventDefault(); addTransaction();}} className="grid sm:grid-cols-6 gap-3 text-sm items-end">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold uppercase mb-1 text-brand-main">Type</label>
            <select value={newTxType} onChange={e=> setNewTxType(e.target.value as any)} className="w-full border rounded px-2 py-2">
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold uppercase mb-1 text-brand-main">Date</label>
              <input type="date" value={newTxDate} onChange={e=>setNewTxDate(e.target.value)} className="w-full border rounded px-2 py-2" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold uppercase mb-1 text-brand-main">Category</label>
              <input value={newTxCategory} onChange={e=>setNewTxCategory(e.target.value)} placeholder="e.g. materials" className="w-full border rounded px-2 py-2" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold uppercase mb-1 text-brand-main">Manual ID (optional)</label>
              <input value={newTxManualId} onChange={e=> setNewTxManualId(e.target.value)} placeholder="Reference" className="w-full border rounded px-2 py-2" maxLength={40} />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-semibold uppercase mb-1 text-brand-main">Amount</label>
              <input value={newTxAmount} onChange={e=>setNewTxAmount(e.target.value)} placeholder="0.00" className="w-full border rounded px-2 py-2" />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-semibold uppercase mb-1 text-brand-main">Company / Vendor</label>
              <input value={newTxCompany} onChange={e=>setNewTxCompany(e.target.value)} placeholder="Who is this with?" className="w-full border rounded px-2 py-2" />
            </div>
            <div className="sm:col-span-6">
              <label className="block text-[11px] font-semibold uppercase mb-1 text-brand-main">Note (optional)</label>
              <input value={newTxNote} onChange={e=>setNewTxNote(e.target.value)} placeholder="Details" className="w-full border rounded px-2 py-2" />
            </div>
            <div className="sm:col-span-6">
              <label className="block text-[11px] font-semibold uppercase mb-1 text-brand-main">Receipts (optional)</label>
              <input type="file" multiple onChange={e=> setNewTxReceipts(e.target.files)} accept="image/*,application/pdf" className="w-full text-xs" />
              {uploadingReceipts && <div className="text-[10px] text-gray-500 mt-1">Uploading...</div>}
              {newTxReceipts && newTxReceipts.length>0 && <div className="mt-1 flex flex-wrap gap-2">{Array.from(newTxReceipts).map((f,i)=>(<span key={i} className="px-2 py-1 bg-brand-main/10 text-brand-main rounded text-[10px] truncate max-w-[120px]">{f.name}</span>))}</div>}
            </div>
            <div className="sm:col-span-6 flex justify-end">
              <button disabled={addingTx || uploadingReceipts} className="px-4 py-2 rounded bg-brand-main text-white font-semibold text-sm disabled:opacity-50">{addingTx? 'Adding...' : 'Add'}</button>
            </div>
        </form>
      </div>
      <div>
        <h3 className="text-base font-semibold text-brand-main mb-3">All Transactions</h3>
        {financeLoading && <div className="text-sm text-gray-500">Loading...</div>}
        {financeError && <div className="text-sm text-red-600">{financeError}</div>}
        {!financeLoading && !transactions.length && <div className="text-sm text-gray-500">No transactions yet.</div>}
        <ul className="divide-y divide-gray-200 text-sm">
          {transactions.map(tx=> (
            <li key={tx.id} className="py-2 flex flex-col sm:flex-row sm:items-center sm:gap-4">
              <div className="flex-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${tx.type==='income' ? 'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{tx.type}</span>
                {tx.manualId && <span className="px-2 py-0.5 rounded bg-brand-main/10 text-brand-main text-[10px] font-medium">#{tx.manualId}</span>}
                <span className="capitalize font-medium">{tx.category}</span>
                {tx.company && <span className="text-gray-700 text-xs italic">{tx.company}</span>}
                {tx.note && <span className="text-gray-500 truncate max-w-[200px]">{tx.note}</span>}
                {Array.isArray(tx.receipts) && tx.receipts.length>0 && (
                  <div className="flex flex-wrap gap-1">
                    {tx.receipts.map((r:any,i:number)=> (
                      <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-1.5 py-0.5 rounded bg-brand-main/10 text-brand-main text-[10px] hover:bg-brand-main/20">Receipt {i+1}</a>
                    ))}
                  </div>
                )}
              </div>
              <div className={`font-mono tabular-nums w-28 text-right ${tx.type==='income' ? 'text-green-700':'text-red-700'}`}>{formatMoney(tx.amount||0)}</div>
              <div className="w-40 text-xs text-gray-400 sm:text-right">{tx.transactionDate || (tx.createdAt ? new Date(tx.createdAt).toISOString().slice(0,10):'')}</div>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[10px] text-gray-400">Only you (project creator) can see detailed transactions. Others see only aggregated category totals and balance.</p>
    </div>
  );
}
