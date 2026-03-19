"use client";
/**
 * AIConsentModal
 *
 * Shown whenever a user tries to re-enable AI features after previously
 * disabling them.  They must actively tick the checkbox and click
 * "I Agree" before consent is recorded — satisfying the GDPR requirement
 * that re-consent must be as active and granular as the original consent.
 */
import { useState } from "react";
import { ShieldCheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

interface Props {
  onAgree: () => void | Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

export default function AIConsentModal({ onAgree, onCancel, saving }: Props) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 relative">

        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition"
          aria-label="Cancel"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-brand-main/10 flex items-center justify-center shrink-0">
            <ShieldCheckIcon className="w-5 h-5 text-brand-main" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-brand-dark">Re-enable AI Features</h2>
            <p className="text-xs text-gray-400">A fresh agreement is required</p>
          </div>
        </div>

        {/* Body */}
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-sm text-gray-600 mb-5 space-y-2 leading-relaxed">
          <p>
            To re-enable AI features, you must re-read and re-agree to the{" "}
            <a
              href="/ai-policy"
              target="_blank"
              rel="noreferrer"
              className="text-brand-main underline hover:text-brand-dark font-medium"
            >
              AI Use Policy
            </a>
            .
          </p>
          <p>
            By agreeing, you acknowledge that your content may be processed by{" "}
            <strong>OpenAI (USA)</strong> as described in the policy, and that
            Close2Source will log this consent decision with a timestamp for compliance purposes.
          </p>
          <p>
            You can withdraw this consent again at any time from Settings or your Compliance tab.
          </p>
        </div>

        {/* Checkbox */}
        <label className="flex items-start gap-3 cursor-pointer mb-6 group">
          <input
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-brand-main cursor-pointer"
          />
          <span className="text-sm text-gray-700 group-hover:text-gray-900">
            I have read the{" "}
            <a
              href="/ai-policy"
              target="_blank"
              rel="noreferrer"
              className="text-brand-main underline hover:text-brand-dark"
            >
              AI Use Policy
            </a>{" "}
            and I consent to my content being processed by AI as described.
          </span>
        </label>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            disabled={!checked || saving}
            onClick={onAgree}
            className="flex-1 px-5 py-2.5 bg-brand-main text-white text-sm font-semibold rounded-lg hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "I Agree — Enable AI Features"}
          </button>
          <button
            onClick={onCancel}
            className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
}
