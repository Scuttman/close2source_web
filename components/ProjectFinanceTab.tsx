"use client";
import { useEffect, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';
import ProjectSpendingBreakdown from './ProjectSpendingBreakdown';
import ProjectTransactionsManager from './ProjectTransactionsManager';

interface ProjectFinanceTabProps {
  projectId: string;
  project: any;
  isProjectCreator: boolean;
  projectCurrency: string;
  currencySymbol: string;
  financeTransactions: any[];
  setFinanceTransactions: React.Dispatch<React.SetStateAction<any[]>>;
  allowEdit?: boolean;
}

export default function ProjectFinanceTab({
  projectId,
  project,
  isProjectCreator,
  projectCurrency,
  currencySymbol,
  financeTransactions,
  setFinanceTransactions,
  allowEdit=false,
}: ProjectFinanceTabProps) {
  // Derive finance summary (creator from transactions; others from stored summary)
  const financeSummary = useMemo(() => {
    if (isProjectCreator) {
      const categories: Record<string, { income: number; expense: number; net: number }> = {};
      let incomeTotal = 0; let expenseTotal = 0;
      financeTransactions.forEach(tx => {
        const type = tx.type === 'income' ? 'income' : 'expense';
        const amt = typeof tx.amount === 'number' ? tx.amount : parseFloat(String(tx.amount || 0));
        if (!amt || isNaN(amt)) return;
        const cat = (tx.category || 'uncategorised').toLowerCase();
        if (!categories[cat]) categories[cat] = { income: 0, expense: 0, net: 0 };
        if (type === 'income') { categories[cat].income += amt; incomeTotal += amt; }
        else { categories[cat].expense += amt; expenseTotal += amt; }
      });
      Object.values(categories).forEach(c => { c.net = c.income - c.expense; });
      const balance = incomeTotal - expenseTotal;
      return { incomeTotal, expenseTotal, balance, categories };
    }
    return project?.financeSummary || { incomeTotal: 0, expenseTotal: 0, balance: 0, categories: {} };
  }, [isProjectCreator, financeTransactions, project?.financeSummary]);

  // Persist aggregated summary when creator changes (simple effect)
  useEffect(() => {
    if (!isProjectCreator) return;
    const summary = financeSummary;
    let cancelled = false;
    async function persist() {
      try {
        await updateDoc(doc(db, 'projects', projectId), { financeSummary: summary });
        if (cancelled) return;
      } catch { /* silent */ }
    }
    persist();
    return () => { cancelled = true; };
  }, [financeSummary, isProjectCreator, projectId]);

  const formatMoney = (v: number) => {
    const n = v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return projectCurrency ? `${currencySymbol}${n}` : n;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm text-brand-dark">
        <h2 className="text-lg font-semibold text-brand-main mb-2">Finance Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div className="p-3 rounded-lg bg-green-50 border border-green-200">
            <div className="text-[11px] font-semibold uppercase text-green-700">Income</div>
            <div className="text-base font-bold text-green-800">{formatMoney(financeSummary.incomeTotal)}</div>
          </div>
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <div className="text-[11px] font-semibold uppercase text-red-700">Spent</div>
            <div className="text-base font-bold text-red-800">{formatMoney(financeSummary.expenseTotal)}</div>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="text-[11px] font-semibold uppercase text-blue-700">Balance</div>
            <div className="text-base font-bold text-blue-800">{formatMoney(financeSummary.balance)}</div>
          </div>
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 col-span-2 sm:col-span-1">
            <div className="text-[11px] font-semibold uppercase text-amber-700">Expense Categories</div>
            <div className="text-base font-bold text-amber-800">{Object.values(financeSummary.categories || {}).filter((c: any) => (c.expense || 0) > 0).length}</div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm text-brand-dark">
        <h3 className="text-base font-semibold text-brand-main mb-4">Spending Breakdown</h3>
        <ProjectSpendingBreakdown financeSummary={financeSummary} />
      </div>
  {isProjectCreator && allowEdit && (
        <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm text-brand-dark">
          <ProjectTransactionsManager
            projectId={projectId}
            transactions={financeTransactions}
            setTransactions={setFinanceTransactions}
            projectCurrency={projectCurrency}
            currencySymbol={currencySymbol}
          />
        </div>
      )}
    </div>
  );
}
