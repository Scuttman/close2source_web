"use client";
import { useState } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';
import { useRouter } from 'next/navigation';
import { getAuth } from 'firebase/auth';

interface ProjectSettingsTabProps {
  projectId: string;
  project: any;
  projectCurrency: string;
  setProjectCurrency: (val: string) => void;
  setProject: React.Dispatch<React.SetStateAction<any>>;
  currencySymbol: string;
}

export default function ProjectSettingsTab({
  projectId,
  project,
  projectCurrency,
  setProjectCurrency,
  setProject,
  currencySymbol,
}: ProjectSettingsTabProps) {
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const router = useRouter();
  const auth = typeof window !== 'undefined' ? getAuth() : null;

  return (
    <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm text-brand-dark space-y-8 max-w-xl">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-brand-main">Project Settings</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
          <select
            value={projectCurrency}
            onChange={async e => {
              const val = e.target.value;
              setProjectCurrency(val);
              try {
                await updateDoc(doc(db, 'projects', projectId), { currency: val });
                setProject((prev: any) => ({ ...prev, currency: val }));
              } catch { /* silent */ }
            }}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="">Select currency…</option>
            {['USD','EUR','GBP','ZAR','KES','UGX','TZS','GHS','NGN','MWK','ETB','RWF','CAD','AUD','NZD','INR'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <p className="text-[10px] text-gray-500 mt-1">Applies as a prefix to displayed amounts (no FX conversion).</p>
          {projectCurrency && <p className="text-[10px] text-gray-600 mt-1">Symbol: <span className="font-semibold">{currencySymbol}</span></p>}
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-brand-main mb-1">Danger Zone</h2>
        <p className="text-sm text-gray-600">Deleting a project is permanent. All updates and data stored directly on this project document will be removed. This action cannot be undone.</p>
      </div>
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Type <span className="font-mono text-brand-main">delete</span> to enable the delete button.</label>
        <input
          type="text"
          value={deleteInput}
          onChange={e => setDeleteInput(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder="delete"
          disabled={deleting}
        />
        {deleteError && <div className="text-sm text-red-600">{deleteError}</div>}
        <button
          disabled={deleteInput.trim().toLowerCase() !== 'delete' || deleting}
          onClick={async () => {
            if (deleteInput.trim().toLowerCase() !== 'delete') return;
            if (!confirm('Are you absolutely sure you want to delete this project? This cannot be undone.')) return;
            setDeleting(true); setDeleteError('');
            try {
              const user = auth?.currentUser;
              if (!user) throw new Error('Must be signed in');
              if (project.createdBy && ![user.displayName, user.email, user.uid].includes(project.createdBy)) {
                const isAdmin = (user as any)?.stsTokenManager || false; // placeholder admin check
                if (!isAdmin) throw new Error('You are not allowed to delete this project');
              }
              await deleteDoc(doc(db, 'projects', projectId));
              router.push('/projects');
            } catch (e: any) { setDeleteError(e.message || 'Failed to delete'); }
            finally { setDeleting(false); }
          }}
          className="px-4 py-2 rounded bg-red-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700"
        >{deleting ? 'Deleting...' : 'Delete Project'}</button>
      </div>
    </div>
  );
}
