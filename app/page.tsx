"use client";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { app } from "../src/lib/firebase";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  return (
    <section className="flex flex-col items-center justify-center min-h-screen gap-10 w-full">
      <div className="w-full max-w-2xl text-center space-y-6 bg-white/90 rounded-xl p-8 mt-8">
        <h1 className="text-5xl md:text-6xl text-brand-dark drop-shadow-sm">
          <span className="font-bold">Welcome to</span> <span className="font-thin text-brand-main lowercase tracking-wide">close2source</span>
        </h1>
        <p className="text-lg md:text-xl text-brand-dark font-medium">
          Connect directly with projects and individuals making a difference.<br />
          Follow updates, support causes, and be part of the story.
        </p>
        {!user && (
          <div className="mb-8">
            <span className="inline-block bg-brand-main text-white px-4 py-2 rounded-full font-semibold text-sm shadow">
              New here?
            </span>
            <div className="mt-3 text-brand-dark text-base">
              Don’t have an account?{' '}
              <a href="/register" className="text-brand-main underline font-semibold hover:text-brand-dark transition">Register now</a>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-8 mt-8">
        <div className="bg-white rounded-xl shadow-lg p-6 w-72 flex flex-col items-center border-2 border-brand-main hover:shadow-xl transition h-80">
          <img src="/images/projects.svg" alt="Projects" className="w-20 h-20 mb-4" />
          <h2 className="text-xl font-semibold text-brand-main mb-2">Discover Projects</h2>
          <p className="text-brand-dark text-sm mb-4">Browse impactful projects and see real-time updates from the field.</p>
          <div className="flex-grow" />
          <a href="/projects" className="inline-block px-4 py-2 rounded bg-brand-main text-white font-semibold hover:bg-brand-dark transition w-full text-center mt-2">Explore Projects</a>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 w-72 flex flex-col items-center border-2 border-brand-main hover:shadow-xl transition h-80">
          <img src="/images/individuals.svg" alt="Individuals" className="w-20 h-20 mb-4" />
          <h2 className="text-xl font-semibold text-brand-main mb-2">Support Individuals</h2>
          <p className="text-brand-dark text-sm mb-4">Connect with and support individuals, following their journeys and stories.</p>
          <div className="flex-grow" />
          <a href="/individuals" className="inline-block px-4 py-2 rounded bg-brand-main text-white font-semibold hover:bg-brand-dark transition w-full text-center mt-2">Meet Individuals</a>
        </div>
      </div>
    </section>
  );
}