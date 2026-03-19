"use client";

/**
 * /admin/review
 *
 * Moderation review queue — visible to SuperAdmin users only.
 * Lists profiles flagged by the mandatory AI content-moderation pipeline
 * that are currently in `pending_review` status awaiting a manual decision.
 *
 * Actions:
 *   Approve  → sets moderationQueue.status = 'approved', doc.status = 'live'
 *   Reject   → sets moderationQueue.status = 'rejected', doc.status = 'rejected'
 */

import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { getPendingModerationItems } from "@/lib/dal";
import { resolveModerationItem, type ModerationQueueEntry } from "../../../src/lib/moderation";
import PageShell from "../../../components/PageShell";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  DocumentMagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

const auth = typeof window !== "undefined" ? getAuth() : null;

type QueueDoc = ModerationQueueEntry & {
  id: string;
  flaggedAtTs?: any;
};

type Decision = "approved" | "rejected";

const SEVERITY_STYLES: Record<string, string> = {
  low:    "bg-yellow-100 text-yellow-800 border-yellow-300",
  medium: "bg-orange-100 text-orange-800 border-orange-300",
  high:   "bg-red-100    text-red-800    border-red-300",
};

export default function AdminReviewPage() {
  const [user, setUser]           = useState<any>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [authLoading, setAuthLoading]   = useState(true);

  const [items, setItems]         = useState<QueueDoc[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const [expanded, setExpanded]   = useState<string | null>(null);
  const [notes, setNotes]         = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Auth check ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!auth) { setAuthLoading(false); return; }
    const unsub = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        try {
          const token = await u.getIdTokenResult();
          setIsSuperAdmin(
            token.claims.role === "SuperAdmin" || token.claims.admin === true
          );
        } catch { setIsSuperAdmin(false); }
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // ── Load queue ──────────────────────────────────────────────────────────────

  async function loadQueue() {
    setLoading(true);
    setError(null);
    try {
      const results = await getPendingModerationItems();
      setItems(
        results.map((d: any) => ({ id: d.id, ...d } as QueueDoc))
      );
    } catch (e: any) {
      setError(e.message || "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isSuperAdmin) loadQueue();
  }, [isSuperAdmin]);

  // ── Decide ──────────────────────────────────────────────────────────────────

  async function decide(item: QueueDoc, decision: Decision) {
    if (!user) return;
    setProcessing(item.id);
    try {
      await resolveModerationItem(
        item.id,
        item.docId,
        item.docCollection,
        decision,
        user.uid,
        notes[item.id] || ""
      );
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setToast({ msg: decision === "approved" ? "Profile approved and set live." : "Profile rejected.", ok: decision === "approved" });
      setTimeout(() => setToast(null), 4000);
    } catch (e: any) {
      setToast({ msg: e.message || "Action failed", ok: false });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setProcessing(null);
    }
  }

  // ── Render guards ───────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <PageShell title="Content Review">
        <div className="flex items-center justify-center h-64 text-gray-500">Loading…</div>
      </PageShell>
    );
  }

  if (!user || !isSuperAdmin) {
    return (
      <PageShell title="Content Review">
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-600">
          <ShieldExclamationIcon className="w-12 h-12 text-gray-400" />
          <p className="font-semibold text-lg">Access restricted</p>
          <p className="text-sm text-gray-500">This area is for Close2Source staff only.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="Content Review Queue">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-white text-sm font-medium transition-all ${
            toast.ok ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.ok ? <CheckCircleIcon className="w-5 h-5" /> : <XCircleIcon className="w-5 h-5" />}
          {toast.msg}
        </div>
      )}

      <div className="px-6 md:px-8 py-6 space-y-6">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Content Review Queue</h1>
            <p className="text-sm text-gray-500 mt-1">
              Profiles flagged by the mandatory AI safety check. Review and approve or reject before they go live.
            </p>
          </div>
          <button
            onClick={loadQueue}
            className="text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition"
          >
            Refresh
          </button>
        </div>

        {/* States */}
        {loading && (
          <div className="text-center py-16 text-gray-500">Loading queue…</div>
        )}
        {error && (
          <div className="text-center py-8 text-red-600">{error}</div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
            <DocumentMagnifyingGlassIcon className="w-14 h-14 text-gray-300" />
            <p className="font-medium">Queue is clear</p>
            <p className="text-sm">No profiles are currently pending review.</p>
          </div>
        )}

        {/* Item list */}
        {items.map((item) => {
          const isOpen = expanded === item.id;
const snapshot: Record<string, string> = item.contentSnapshot || {};

          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
            >
              {/* Summary row */}
              <div className="flex items-center justify-between px-6 py-4 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <ExclamationTriangleIcon className="w-6 h-6 text-orange-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{item.profileName || item.profileCode}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="capitalize">{item.type}</span>
                      <span>·</span>
                      <span className="font-mono">{item.profileCode}</span>
                      <span>·</span>
                      <ClockIcon className="w-3.5 h-3.5 inline -mt-0.5" />
                      <span>{new Date(item.flaggedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Severity badge */}
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                      SEVERITY_STYLES[item.severity] || SEVERITY_STYLES.low
                    }`}
                  >
                    {item.severity.toUpperCase()}
                  </span>

                  {/* Categories */}
                  {item.flagCategories?.slice(0, 2).map((cat: string) => (
                    <span
                      key={cat}
                      className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full border border-gray-200 hidden sm:inline"
                    >
                      {cat.replace(/\//g, ' › ')}
                    </span>
                  ))}

                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : item.id)}
                    className="text-xs text-indigo-600 underline ml-2"
                  >
                    {isOpen ? "Hide" : "Review"}
                  </button>
                </div>
              </div>

              {/* Expanded detail panel */}
              {isOpen && (
                <div className="border-t border-gray-100 px-6 py-5 space-y-5 bg-gray-50">

                  {/* Flag reason */}
                  {item.flagReason && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                      <p className="text-xs font-semibold text-orange-700 mb-1">AI flag reason</p>
                      <p className="text-sm text-orange-900">{item.flagReason}</p>
                    </div>
                  )}

                  {/* All categories */}
                  {item.flagCategories?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Flagged categories</p>
                      <div className="flex flex-wrap gap-2">
                        {item.flagCategories.map((cat: string) => (
                          <span key={cat} className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Content snapshot */}
                  {Object.keys(snapshot).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">Content submitted</p>
                      <div className="space-y-3">
                        {Object.entries(snapshot).map(([field, value]: [string, string]) => (
                          <div key={field} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                            <p className="text-xs font-medium text-gray-500 capitalize mb-1">
                              {field.replace(/([A-Z])/g, ' $1').toLowerCase()}
                            </p>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reviewer notes */}
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">
                      Review notes (optional — visible to Close2Source admins only)
                    </label>
                    <textarea
                      rows={3}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="Add any context for internal records…"
                      value={notes[item.id] || ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />
                  </div>

                  {/* Decision buttons */}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      disabled={processing === item.id}
                      onClick={() => decide(item, "approved")}
                      className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm transition disabled:opacity-60"
                    >
                      <CheckCircleIcon className="w-5 h-5" />
                      Approve &amp; Go Live
                    </button>
                    <button
                      disabled={processing === item.id}
                      onClick={() => decide(item, "rejected")}
                      className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm transition disabled:opacity-60"
                    >
                      <XCircleIcon className="w-5 h-5" />
                      Reject
                    </button>
                    {processing === item.id && (
                      <span className="text-sm text-gray-500">Processing…</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
