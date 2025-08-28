"use client";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { app } from "../src/lib/firebase";
import Link from "next/link";
import Image from "next/image";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";

export default function UserHero() {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let unsubscribeSnap: (() => void) | null = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (unsubscribeSnap) {
        unsubscribeSnap();
        unsubscribeSnap = null;
      }
      if (firebaseUser) {
        // Listen to credits in real-time
        const userRef = doc(db, "users", firebaseUser.uid);
        unsubscribeSnap = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setCredits(docSnap.data().credits ?? 0);
          } else {
            setCredits(0);
          }
        });
      } else {
        setCredits(null);
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribeSnap) unsubscribeSnap();
    };
  }, [auth, db]);

  if (!user) {
    return (
      <Link href="/login">
        <span className="inline-block px-5 py-2 rounded-full bg-white text-brand-main font-bold shadow hover:bg-brand-main hover:text-white transition cursor-pointer">Login</span>
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-white rounded-full px-4 py-2 shadow">
      <Link href="/profile" className="flex items-center gap-2 group">
        {user.photoURL ? (
          <span className="w-8 h-8 rounded-full overflow-hidden bg-brand-main flex items-center justify-center">
            <Image
              src={user.photoURL}
              alt="Profile"
              width={32}
              height={32}
              className="rounded-full object-cover"
              priority={false}
            />
          </span>
        ) : (
          <span className="w-8 h-8 rounded-full bg-brand-main flex items-center justify-center text-white font-bold text-lg group-hover:bg-brand-dark transition">
            {user.email?.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="font-semibold text-brand-dark text-sm truncate max-w-[120px] group-hover:underline">
          {user.email}
        </span>
      </Link>
      {credits !== null && (
        <Link href="/credits" className="ml-2 px-3 py-1 rounded-full bg-brand-main/10 text-brand-main text-xs font-semibold hover:bg-brand-main/20 transition cursor-pointer" title="Buy credits or view balance">
          {credits} credits
        </Link>
      )}
      <button
        onClick={async () => {
          if (signingOut) return;
          try {
            setSigningOut(true);
            await signOut(auth);
          } finally {
            setSigningOut(false);
            router.push('/');
          }
        }}
        disabled={signingOut}
        className="ml-2 p-2 rounded-full bg-brand-main text-white hover:bg-brand-dark transition flex items-center justify-center disabled:opacity-60"
        title="Logout"
        aria-label="Logout"
      >
        {signingOut ? (
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m-6-3h12m0 0l-3-3m3 3l-3 3" />
          </svg>
        )}
      </button>
    </div>
  );
}
