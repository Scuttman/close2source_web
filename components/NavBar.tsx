
"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "../src/lib/firebase";
import C2SLogo from "./C2SLogo";

const UserHero = dynamic(() => import("./UserHero"), { ssr: false });

export default function NavBar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, [auth]);

  const homeHref = authReady && isLoggedIn ? "/profile" : "/";

  return (
    <>
      <nav className="flex items-center justify-between py-3 md:py-4">
        {/* Brand */}
        <Link href={homeHref} className="flex items-center gap-2 shrink-0">
          <C2SLogo variant="white" size={36} />
          <span className="font-thin text-2xl sm:text-3xl md:text-4xl text-white lowercase tracking-wide">
            close2source
          </span>
        </Link>

        {/* Desktop nav — hidden on mobile */}
        <div className="hidden md:flex items-center gap-6">
          <ul className="flex gap-6 text-white font-medium">
            <li><Link href={homeHref} className="hover:text-white/80 transition">Home</Link></li>
            <li><Link href="/about" className="hover:text-white/80 transition">About</Link></li>
            <li><Link href="/contact" className="hover:text-white/80 transition">Contact</Link></li>
          </ul>
          <div className="ml-4">
            <UserHero />
          </div>
        </div>

        {/* Mobile hamburger — hidden on desktop */}
        <button
          className="md:hidden text-white p-2 -mr-1 rounded-lg transition hover:bg-white/10"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </nav>

      {/* Mobile drawer — drops below the header, full width */}
      {menuOpen && (
        <div className="md:hidden absolute left-0 right-0 z-50 bg-brand-main border-t border-white/20 shadow-2xl px-6 py-5 flex flex-col gap-5">
          {/* Nav links */}
          <ul className="flex flex-col gap-4">
            <li>
              <Link
                href={homeHref}
                onClick={() => setMenuOpen(false)}
                className="block text-white font-semibold text-lg hover:text-white/80 transition"
              >
                Home
              </Link>
            </li>
            <li>
              <Link
                href="/about"
                onClick={() => setMenuOpen(false)}
                className="block text-white font-semibold text-lg hover:text-white/80 transition"
              >
                About
              </Link>
            </li>
            <li>
              <Link
                href="/contact"
                onClick={() => setMenuOpen(false)}
                className="block text-white font-semibold text-lg hover:text-white/80 transition"
              >
                Contact
              </Link>
            </li>
          </ul>

          {/* User account section */}
          <div className="border-t border-white/20 pt-4">
            <UserHero />
          </div>
        </div>
      )}
    </>
  );
}
