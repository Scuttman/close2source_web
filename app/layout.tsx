"use client";

import "./globals.css";
import { Inter } from "next/font/google";
import NavBar from "../components/NavBar";
import { AIConsentProvider } from "../src/lib/aiContext";
import LegacyConsentGate from "../components/LegacyConsentGate";
import type { Metadata } from "next";
import { useEffect, useState } from "react";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });


/** PECR Regulation 6 / UK GDPR Art. 6(1)(a) compliant cookie consent.
 *
 * Storage key: "c2s_cookie_consent"
 *   "accepted"  — user opted in to analytics cookies
 *   "declined"  — user opted out; only essential cookies/storage may be used
 *   (absent)    — no decision yet; banner shown; analytics must NOT fire
 *
 * Use isCookieConsentGranted() anywhere analytics initialisation is guarded.
 */
export function isCookieConsentGranted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("c2s_cookie_consent") === "accepted";
}

function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("c2s_cookie_consent");
      // Show banner only when no decision has been recorded yet
      setShow(stored !== "accepted" && stored !== "declined");
    }
  }, []);

  function handleAccept() {
    localStorage.setItem("c2s_cookie_consent", "accepted");
    setShow(false);
    // Initialise Firebase Analytics now that consent is granted
    // Import is deferred so analytics never loads before consent
    import("firebase/analytics").then(({ getAnalytics }) => {
      import("../src/lib/firebase").then(({ app }) => {
        try { getAnalytics(app); } catch { /* already initialised */ }
      });
    });
  }

  function handleDecline() {
    localStorage.setItem("c2s_cookie_consent", "declined");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="w-full bg-gray-900 text-white text-sm z-20 border-b border-gray-700">
      <div className="mx-auto max-w-[1200px] px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 leading-relaxed">
          <span className="font-semibold">Cookies &amp; analytics</span>
          {" — "}We use essential cookies to keep the site working and, with your
          permission, Firebase Analytics to understand how the site is used. No
          advertising or tracking cookies are used.{" "}
          <a href="/privacy#cookies" className="underline hover:text-gray-300 transition">
            Cookie details
          </a>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={handleDecline}
            className="px-4 py-2 rounded-lg border border-gray-500 text-gray-300 hover:bg-gray-700 font-semibold transition text-sm"
          >
            Decline analytics
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 rounded-lg bg-brand-main hover:opacity-90 text-white font-semibold transition text-sm"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh flex flex-col bg-brand-sand text-brand-dark antialiased relative overflow-x-hidden">
        <AIConsentProvider>
        <LegacyConsentGate>
        {/* Global background image and overlay */}
        <div className="fixed inset-0 -z-10 w-full h-full">
          <img
            src="/images/sitebg.jpg"
            alt="Site background"
            className="w-full h-full object-cover object-center opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/10" />
        </div>
  <header className="border-b bg-brand-main relative z-30">
          <div className="mx-auto max-w-[1200px] w-full px-4">
            <NavBar />
          </div>
        </header>
        <CookieBanner />
  <main className="flex-1 relative z-10 py-4 flex flex-col min-h-0">{children}</main>
        <footer className="border-t-0 bg-black relative z-10">
          <div className="absolute top-0 left-0 w-full h-2 bg-brand-main" style={{height: '8px'}} />
          <div className="mx-auto max-w-[1200px] w-full px-4 py-6 text-sm text-white relative z-10 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>© {new Date().getFullYear()} Close2Source</span>
            <div className="flex gap-6">
              <a href="/privacy" className="text-white/70 hover:text-white transition">Privacy Policy</a>
              <a href="/terms" className="text-white/70 hover:text-white transition">Terms of Service</a>
              <a href="/ai-policy" className="text-white/70 hover:text-white transition">AI Policy</a>
            </div>
          </div>
        </footer>
        </LegacyConsentGate>
        </AIConsentProvider>
      </body>
    </html>
  );
}