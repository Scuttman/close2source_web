"use client";
/**
 * LegacyConsentGate.tsx
 *
 * Full-screen blocking overlay for users who registered before the GDPR
 * consent system was introduced (18 March 2026) and therefore have no
 * consent records on their Firestore user document.
 *
 * Logic
 * ─────
 * On every page load:
 * 1. Wait for Firebase Auth to resolve.
 * 2. If no user is signed in → render children normally (unauthenticated pages).
 * 3. If signed in → fetch users/{uid} and check:
 *      consent.privacyPolicy.agreed === true  (required)
 *      consent.terms.agreed          === true  (required)
 *      consent.aiPolicy exists                 (optional — can be agreed or declined)
 * 4. Build an ordered queue of missing stages and render each one as a
 *    full-screen overlay in sequence before children are shown.
 * 5. Certain routes are exempt so users can still read policies / log out
 *    while the gate is active: /login /register /privacy /terms /ai-policy
 *
 * After the user completes all stages the gate unmounts and normal
 * navigation resumes without any page reload.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { app } from "../src/lib/firebase";
import { getUser } from "@/lib/dal";
import { recordConsent } from "../src/lib/userConsent";
import ConsentStage from "./ConsentStage";

// Routes that must always be accessible — never gate these
const EXEMPT_PATHS = ["/login", "/register", "/privacy", "/terms", "/ai-policy"];

// ─── Policy summary text (compact) ────────────────────────────────────────────

function PrivacyPolicySummary() {
  return (
    <div className="space-y-4 text-sm text-gray-700">
      <p className="font-semibold text-gray-900">Close2Source — Privacy Policy Summary (v1.0, 18 March 2026)</p>
      <p>This is a summary of our full <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-main underline">Privacy Policy</a>.</p>
      <section>
        <p className="font-semibold mb-1">What we collect</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Account details: name, email, password (hashed)</li>
          <li>Profile, organisation, and project data you create</li>
          <li>Usage data via Firebase Analytics (only with cookie consent)</li>
        </ul>
      </section>
      <section>
        <p className="font-semibold mb-1">Why we collect it</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>To provide and secure your account (legal basis: contract)</li>
          <li>To operate project and organisation features (legal basis: contract)</li>
          <li>To send transactional emails (legal basis: contract)</li>
          <li>To improve the platform using anonymised analytics (legal basis: consent)</li>
        </ul>
      </section>
      <section>
        <p className="font-semibold mb-1">Who we share it with</p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>Google Firebase</strong> — auth, database, storage (London region)</li>
          <li><strong>Krystal Hosting Ltd (UK)</strong> — transactional email delivery only</li>
          <li>We do not sell your data to third parties</li>
        </ul>
      </section>
      <section>
        <p className="font-semibold mb-1">Your rights (UK GDPR)</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Access, correct, export, or delete your data at any time via Settings</li>
          <li>Withdraw consent at any time</li>
          <li>Lodge a complaint with the ICO at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="underline">ico.org.uk</a></li>
        </ul>
      </section>
      <section>
        <p className="font-semibold mb-1">Data controller</p>
        <p>Christopher Scutt trading as Close2Source, 87 Little Breach, Chichester, West Sussex, PO19 5TZ. Email: info@close2source.com</p>
      </section>
      <p className="text-xs text-gray-500">Full policy: <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">close2source.com/privacy</a></p>
    </div>
  );
}

function TermsSummary() {
  return (
    <div className="space-y-4 text-sm text-gray-700">
      <p className="font-semibold text-gray-900">Close2Source — Terms of Service Summary (v1.0, 18 March 2026)</p>
      <p>This is a summary of our full <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-brand-main underline">Terms of Service</a>.</p>
      <section>
        <p className="font-semibold mb-1">Your account</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>You must be 18 or over (or have parental consent) to register</li>
          <li>You are responsible for keeping your password secure</li>
          <li>One account per person — accounts may not be shared</li>
        </ul>
      </section>
      <section>
        <p className="font-semibold mb-1">Content you post</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>You retain ownership of content you create</li>
          <li>You grant Close2Source a licence to display it on the platform</li>
          <li>You must not post false, misleading, harmful, or illegal content</li>
          <li>We may remove content or suspend accounts that violate these Terms</li>
        </ul>
      </section>
      <section>
        <p className="font-semibold mb-1">Credits and payments</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Platform credits have no monetary value and cannot be withdrawn as cash</li>
          <li>Refunds are at our discretion as set out in the full Terms</li>
        </ul>
      </section>
      <section>
        <p className="font-semibold mb-1">Limitation of liability</p>
        <p>Close2Source is provided &ldquo;as is&rdquo;. We are not liable for the accuracy of
        user-generated content or project outcomes. Our liability is limited to the fullest
        extent permitted by English law.</p>
      </section>
      <p className="text-xs text-gray-500">Governing law: England and Wales. Full terms: <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">close2source.com/terms</a></p>
    </div>
  );
}

function AIPolicySummary() {
  return (
    <div className="space-y-4 text-sm text-gray-700">
      <p className="font-semibold text-gray-900">Close2Source — AI Use Policy Summary (v1.0, 18 March 2026)</p>
      <p>This is a summary of our full <a href="/ai-policy" target="_blank" rel="noopener noreferrer" className="text-brand-main underline">AI Use Policy</a>.</p>
      <section>
        <p className="font-semibold mb-1">What AI features do</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Help you improve, shorten, or lengthen text in forms and profiles</li>
          <li>Assist in building project proposals via a guided chat</li>
          <li>All AI features are <strong>optional</strong> — the platform works fully without them</li>
        </ul>
      </section>
      <section>
        <p className="font-semibold mb-1">What data is sent to AI</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>The text of the specific field(s) you are working on</li>
          <li>Conversation history within an AI chat session</li>
          <li><strong>Not sent:</strong> your email, password, payment details, or credentials</li>
        </ul>
      </section>
      <section>
        <p className="font-semibold mb-1">Who processes it</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>AI requests are handled by <strong>OpenAI, Inc. (USA)</strong> via a secure
          server-side connection. Transfer is covered by OpenAI&rsquo;s DPA and the UK IDTA.</li>
          <li>OpenAI does not use API submissions to train its models</li>
        </ul>
      </section>
      <section>
        <p className="font-semibold mb-1">Legal basis &amp; your choices</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Basis: your explicit consent (UK GDPR Art. 6(1)(a))</li>
          <li>You can <strong>decline below</strong> and still use the platform without AI features</li>
          <li>Change your preference at any time in Settings → AI Features</li>
        </ul>
      </section>
      <p className="text-xs text-gray-500">Full policy: <a href="/ai-policy" target="_blank" rel="noopener noreferrer" className="underline">close2source.com/ai-policy</a></p>
    </div>
  );
}

// ─── Stage definitions ─────────────────────────────────────────────────────────

type StageKey = "privacyPolicy" | "terms" | "aiPolicy";

interface Stage {
  key: StageKey;
  title: string;
  policyHref: string;
  body: React.ReactNode;
  checkLabel: string;
  allowDecline: boolean;
}

const STAGES: Stage[] = [
  {
    key: "privacyPolicy",
    title: "Privacy Policy — please review and agree to continue",
    policyHref: "/privacy",
    body: <PrivacyPolicySummary />,
    checkLabel: "I have read and agree to the Close2Source Privacy Policy",
    allowDecline: false,
  },
  {
    key: "terms",
    title: "Terms of Service — please review and agree to continue",
    policyHref: "/terms",
    body: <TermsSummary />,
    checkLabel: "I have read and agree to the Close2Source Terms of Service",
    allowDecline: false,
  },
  {
    key: "aiPolicy",
    title: "AI Use Policy — you can opt in or out",
    policyHref: "/ai-policy",
    body: <AIPolicySummary />,
    checkLabel: "I agree to my content being processed by AI as described above",
    allowDecline: true,
  },
];

// ─── Gate component ────────────────────────────────────────────────────────────

export default function LegacyConsentGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pendingStages, setPendingStages] = useState<StageKey[]>([]);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Skip the gate entirely on exempt paths
  const isExempt = EXEMPT_PATHS.some(p => pathname?.startsWith(p));

  useEffect(() => {
    if (isExempt) {
      setChecking(false);
      return;
    }

    const auth = getAuth(app);

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Not signed in — no gate needed
        setChecking(false);
        setPendingStages([]);
        setUid(null);
        return;
      }

      setUid(user.uid);

      try {
        const userData = await getUser(user.uid);
        const consent = (userData as unknown as Record<string, unknown>)?.consent as Record<string, { agreed?: boolean }> ?? {};

        const missing: StageKey[] = [];
        if (!consent.privacyPolicy?.agreed) missing.push("privacyPolicy");
        if (!consent.terms?.agreed)         missing.push("terms");
        // Show AI policy stage if it has never been answered (neither agreed nor declined)
        if (consent.aiPolicy === undefined || consent.aiPolicy === null) missing.push("aiPolicy");

        setPendingStages(missing);
        setCurrentStageIndex(0);
      } catch {
        // On read error, don't gate — fail open so users aren't locked out
        setPendingStages([]);
      } finally {
        setChecking(false);
      }
    });

    return () => unsub();
  }, [isExempt]);

  // Nothing to gate — render normally
  if (isExempt || checking || pendingStages.length === 0) {
    return <>{children}</>;
  }

  const currentKey = pendingStages[currentStageIndex];
  const stage = STAGES.find(s => s.key === currentKey)!;
  const totalRequired = pendingStages.filter(k => k !== "aiPolicy").length;
  const total = pendingStages.length;
  const stepNumber = currentStageIndex + 1;

  async function advance(aiDecision?: boolean) {
    if (!uid) return;
    setSubmitting(true);
    try {
      const decisions: Record<string, boolean> = {};
      if (currentKey === "privacyPolicy") decisions.privacyPolicy = true;
      if (currentKey === "terms")         decisions.terms = true;
      if (currentKey === "aiPolicy")      decisions.aiPolicy = aiDecision ?? false;
      await recordConsent(uid, decisions);

      const next = currentStageIndex + 1;
      if (next < pendingStages.length) {
        setCurrentStageIndex(next);
        setAgreed(false);
      } else {
        setPendingStages([]);
      }
    } catch (err) {
      console.error("Failed to record consent:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Blocking overlay — no click-away, no scroll-through */}
      <div className="fixed inset-0 z-[9999] bg-brand-sand flex flex-col overflow-y-auto">
        {/* Top strip */}
        <div className="bg-brand-main text-white text-center py-3 px-4 text-sm font-semibold shrink-0">
          We&rsquo;ve updated our policies — please review{" "}
          {totalRequired > 0 ? "and agree to continue" : "before continuing"}
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center gap-2 pt-5 shrink-0">
          {pendingStages.map((key, i) => (
            <div
              key={key}
              className={`h-2 rounded-full transition-all ${
                i < currentStageIndex
                  ? "w-8 bg-green-500"
                  : i === currentStageIndex
                  ? "w-8 bg-brand-main"
                  : "w-8 bg-gray-300"
              }`}
            />
          ))}
        </div>
        <p className="text-center text-xs text-gray-500 mt-2 shrink-0">
          Step {stepNumber} of {total}
        </p>

        {/* ConsentStage */}
        <div className="flex-1 flex items-start justify-center px-4 pb-10">
          <ConsentStage
            title={stage.title}
            policyHref={stage.policyHref}
            policyBody={stage.body}
            checkLabel={stage.checkLabel}
            agreed={agreed}
            setAgreed={setAgreed}
            submitting={submitting}
            onAgree={() => advance(true)}
            onDecline={stage.allowDecline ? () => advance(false) : undefined}
            declineLabel="Decline — continue without AI features"
          />
        </div>

        {/* Escape hatch — sign out only */}
        <div className="text-center pb-6 shrink-0">
          <button
            onClick={() => signOut(getAuth(app))}
            className="text-xs text-gray-400 hover:text-gray-600 underline transition"
          >
            Sign out instead
          </button>
        </div>
      </div>

      {/* Children rendered beneath (not visible while gate is open) */}
      <div className="invisible" aria-hidden="true">{children}</div>
    </>
  );
}
