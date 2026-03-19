
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
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
    });
    return () => unsubscribe();
  }, [auth]);

  return (
    <nav className="flex items-center justify-between py-4">
      <div className="flex items-center gap-3">
        {/* Logo mark */}
        <C2SLogo variant="white" size={44} />
        <div className="font-thin text-4xl text-white lowercase tracking-wide">close2source</div>
      </div>
      <div className="flex items-center gap-6">
        <ul className="flex gap-6 text-white font-medium">
          <li><Link href={isLoggedIn ? "/profile" : "/"}>Home</Link></li>
          <li><Link href="/about">About</Link></li>
          <li><Link href="/contact">Contact</Link></li>
        </ul>
        <div className="ml-6"><UserHero /></div>
      </div>
    </nav>
  );
}
