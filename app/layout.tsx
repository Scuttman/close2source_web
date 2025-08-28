"use client";

import "./globals.css";
import { Inter } from "next/font/google";
import NavBar from "../components/NavBar";
import type { Metadata } from "next";
import { useEffect, useState } from "react";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });


function CookieBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setShow(localStorage.getItem("c2s_cookie_consent") !== "true");
    }
  }, []);
  const handleClose = () => {
    setShow(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("c2s_cookie_consent", "true");
    }
  };
  if (!show) return null;
  return (
    <div className="w-full bg-yellow-100 border-b border-yellow-300 text-yellow-900 text-sm flex items-center justify-between px-4 py-3 z-20">
      <span>By continuing to use this site, you agree to the use of cookies and local storage on your device.</span>
      <button onClick={handleClose} className="ml-4 px-3 py-1 rounded bg-yellow-300 hover:bg-yellow-400 text-yellow-900 font-semibold transition">Close</button>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh flex flex-col bg-brand-sand text-brand-dark antialiased relative overflow-x-hidden">
        {/* Global background image and overlay */}
        <div className="fixed inset-0 -z-10 w-full h-full">
          <img
            src="/images/african-farming-bg.png"
            alt="African farming landscape background"
            className="w-full h-full object-cover object-center opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/10" />
        </div>
        <header className="border-b bg-brand-main relative z-10">
          <div className="mx-auto max-w-[1200px] w-full px-4">
            <NavBar />
          </div>
        </header>
        <CookieBanner />
        <main className="mx-auto max-w-[1200px] w-full px-4 py-2 flex-1 relative z-10">{children}</main>
        <footer className="border-t-0 bg-black relative z-10">
          <div className="absolute top-0 left-0 w-full h-2 bg-brand-main" style={{height: '8px'}} />
          <div className="mx-auto max-w-[1200px] w-full px-4 py-6 text-sm text-white relative z-10">
            © {new Date().getFullYear()} Close2Source
          </div>
        </footer>
      </body>
    </html>
  );
}