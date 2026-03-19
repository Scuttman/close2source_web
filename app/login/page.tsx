"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "../../components/PageShell";
import { getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { app } from "../../src/lib/firebase";
import { getUser, createUserDoc } from "@/lib/dal";
import { logCreditTransaction } from "../../src/lib/credits";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const auth = getAuth(app);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userData = await getUser(userCredential.user.uid);
      if (userData) {
        setSuccess("Login successful!");
        setTimeout(() => router.push("/profile"), 1000);
      } else {
        setError("User profile not found in Firestore.");
      }
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setSuccess("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user already exists
      const existingUser = await getUser(user.uid);
      
      if (!existingUser) {
        // Create new user document if signing in for first time
        const displayNameParts = (user.displayName || "").split(" ");
        const firstName = displayNameParts[0] || "";
        const lastName = displayNameParts.slice(1).join(" ") || "";
        
        await createUserDoc(user.uid, {
          email: user.email,
          name: firstName,
          surname: lastName,
          role: "User",
          createdAt: new Date().toISOString(),
          photoURL: user.photoURL || "",
          credits: 50,
        });
        
        // Award initial signup credits
        try {
          await logCreditTransaction(user.uid, 'purchase', 50, 'Initial signup credits');
        } catch (creditErr) {
          console.warn('Failed to award initial credits', creditErr);
        }
      }
      
      setSuccess("Login successful!");
      setTimeout(() => router.push("/profile"), 1000);
    } catch (err: any) {
      setError(err.message || "Google sign-in failed");
    }
  }

  async function handleAppleSignIn() {
    setError("");
    setSuccess("");
    try {
      const provider = new OAuthProvider('apple.com');
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user already exists
      const existingUser = await getUser(user.uid);
      
      if (!existingUser) {
        // Create new user document if signing in for first time
        const displayNameParts = (user.displayName || "").split(" ");
        const firstName = displayNameParts[0] || "";
        const lastName = displayNameParts.slice(1).join(" ") || "";
        
        await createUserDoc(user.uid, {
          email: user.email,
          name: firstName || "User",
          surname: lastName,
          role: "User",
          createdAt: new Date().toISOString(),
          photoURL: user.photoURL || "",
          credits: 50,
        });
        
        // Award initial signup credits
        try {
          await logCreditTransaction(user.uid, 'purchase', 50, 'Initial signup credits');
        } catch (creditErr) {
          console.warn('Failed to award initial credits', creditErr);
        }
      }
      
      setSuccess("Login successful!");
      setTimeout(() => router.push("/profile"), 1000);
    } catch (err: any) {
      setError(err.message || "Apple sign-in failed");
    }
  }

  return (
    <PageShell title="Sign In" contentClassName="!p-0 overflow-hidden">
      <div className="flex flex-1 min-h-[500px]">
      {/* Left: 2/3 photo panel */}
      <div className="hidden md:flex md:w-2/3 relative overflow-hidden">
        <img
          src="/images/african-farming-bg.jpg"
          alt="Close2Source"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Overlay with branding */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-main/70 via-brand-main/40 to-transparent" />
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <h2 className="text-4xl font-bold mb-3 drop-shadow-lg">Close2Source</h2>
          <p className="text-lg text-white/90 max-w-md drop-shadow">
            Connecting communities to sustainable development projects across Africa.
          </p>
        </div>
      </div>

      {/* Right: 1/3 login panel */}
      <div className="w-full md:w-1/3 flex items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="md:hidden text-center mb-8">
            <h1 className="text-2xl font-bold text-brand-main">Close2Source</h1>
          </div>

          <h1 className="text-2xl font-bold mb-2 text-gray-900">Welcome back</h1>
          <p className="text-sm text-gray-500 mb-8">Sign in to your account</p>

          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/40 focus:border-brand-main transition"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/40 focus:border-brand-main transition"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            {success && <div className="text-green-600 text-sm">{success}</div>}
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-brand-main text-white font-semibold hover:bg-brand-dark transition text-sm"
            >
              Sign in
            </button>
          </form>

          {/* Social Sign In Options */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white text-gray-400">Or continue with</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full inline-flex justify-center items-center gap-2 py-2.5 px-4 border border-gray-200 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google
              </button>

              <button
                type="button"
                onClick={handleAppleSignIn}
                className="w-full inline-flex justify-center items-center gap-2 py-2.5 px-4 border border-gray-200 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                Apple
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <a href="/register" className="text-brand-main font-semibold hover:text-brand-dark">
              Sign up
            </a>
          </p>
        </div>
      </div>
      </div>
    </PageShell>
  );
}
