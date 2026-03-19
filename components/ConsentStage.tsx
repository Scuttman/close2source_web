"use client";
/**
 * ConsentStage.tsx
 *
 * A full-page onboarding step that forces the user to scroll through a policy
 * document and tick an agreement checkbox before they can continue.
 *
 * Props
 * ─────
 * title       – heading shown above the document panel
 * policyHref  – link to the full standalone policy page (opens in new tab)
 * policyBody  – the policy text rendered inside the scrollable panel
 * checkLabel  – label text beside the checkbox
 * onAgree()   – called when the user submits
 * onDecline() – called when the user declines (optional – show for AI only)
 * declineLabel – label for the decline button (default "Decline & continue without AI")
 * agreed      – controlled value of the checkbox
 * setAgreed   – setter for the controlled checkbox value
 */

import { useEffect, useRef, useState } from "react";

interface ConsentStageProps {
  title: string;
  policyHref: string;
  policyBody: React.ReactNode;
  checkLabel: string;
  onAgree: () => void | Promise<void>;
  onDecline?: () => void | Promise<void>;
  declineLabel?: string;
  agreed: boolean;
  setAgreed: (v: boolean) => void;
  submitting?: boolean;
}

export default function ConsentStage({
  title,
  policyHref,
  policyBody,
  checkLabel,
  onAgree,
  onDecline,
  declineLabel = "Decline & continue without this feature",
  agreed,
  setAgreed,
  submitting = false,
}: ConsentStageProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Reset scroll state whenever the stage mounts
    setScrolledToBottom(false);
    setAgreed(false);
    setError("");
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    // Allow a 10px buffer for rounding differences
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
      setScrolledToBottom(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError("Please scroll to the bottom and tick the box to continue.");
      return;
    }
    setError("");
    await onAgree();
  }

  return (
    <div className="w-full max-w-2xl mx-auto py-8 px-4">
      <h2 className="text-xl font-bold text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-4">
        Please read the full policy below before continuing.{" "}
        <a
          href={policyHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-main underline hover:text-brand-dark"
        >
          Open in new tab ↗
        </a>
      </p>

      {/* Scrollable policy panel */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-72 overflow-y-auto border border-gray-200 rounded-xl bg-white px-5 py-4 text-sm text-gray-700 leading-relaxed shadow-inner"
      >
        {policyBody}
        {/* Sentinel so users know they have reached the end */}
        <div className="pt-6 pb-2 text-center text-xs text-gray-400 font-semibold tracking-wide uppercase">
          — End of document —
        </div>
      </div>

      {/* Scroll hint */}
      {!scrolledToBottom && (
        <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          Scroll to the bottom to enable the checkbox
        </p>
      )}

      {/* Agreement form */}
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <label className={`flex items-start gap-3 cursor-pointer rounded-lg border p-3 transition ${scrolledToBottom ? "border-gray-300 bg-gray-50 hover:bg-gray-100" : "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"}`}>
          <input
            type="checkbox"
            checked={agreed}
            disabled={!scrolledToBottom}
            onChange={e => { setAgreed(e.target.checked); setError(""); }}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-brand-main cursor-pointer disabled:cursor-not-allowed"
          />
          <span className="text-sm text-gray-700">{checkLabel}</span>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={submitting || !agreed}
            className="flex-1 py-2.5 px-4 rounded-lg bg-brand-main text-white font-semibold hover:bg-brand-dark disabled:opacity-50 transition text-sm"
          >
            {submitting ? "Saving…" : "I agree — Continue"}
          </button>

          {onDecline && (
            <button
              type="button"
              onClick={async () => { setError(""); await onDecline!(); }}
              disabled={submitting}
              className="flex-1 py-2.5 px-4 rounded-lg border border-gray-300 bg-white text-gray-600 font-medium hover:bg-gray-50 disabled:opacity-50 transition text-sm"
            >
              {declineLabel}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
