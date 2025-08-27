"use client";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth";
import { app } from "../src/lib/firebase";
import Link from "next/link";

export default function UserHero() {
  const [user, setUser] = useState<User | null>(null);
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, [auth]);

  if (!user) {
    return (
      <Link href="/login">
        <span className="inline-block px-5 py-2 rounded-full bg-white text-brand-main font-bold shadow hover:bg-brand-main hover:text-white transition cursor-pointer">Login</span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-white rounded-full px-4 py-2 shadow">
      <span className="w-8 h-8 rounded-full bg-brand-main flex items-center justify-center text-white font-bold text-lg">
        {user.email?.charAt(0).toUpperCase()}
      </span>
      <span className="font-semibold text-brand-dark text-sm truncate max-w-[120px]">{user.email}</span>
      <button
        onClick={() => signOut(auth)}
        className="ml-2 px-3 py-1 rounded-full bg-brand-main text-white text-xs font-semibold hover:bg-brand-dark transition"
      >
        Logout
      </button>
    </div>
  );
}
