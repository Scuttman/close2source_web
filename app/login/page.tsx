"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "../../src/lib/firebase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setUserRole(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserRole(data.role);
        setSuccess("Login successful! Welcome, " + (data.role === "donor" ? "Donor" : "Field Worker") + ".");
        setTimeout(() => router.push("/"), 1000);
      } else {
        setError("User profile not found in Firestore.");
      }
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16 bg-white p-8 rounded-xl shadow-lg border border-brand-main">
      <h1 className="text-2xl font-bold mb-6 text-brand-main">Login</h1>
      <form className="space-y-4" onSubmit={handleLogin}>
        <div>
          <label className="block mb-1 font-medium">Email</label>
          <input
            type="email"
            className="w-full border rounded px-3 py-2"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Password</label>
          <input
            type="password"
            className="w-full border rounded px-3 py-2"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        {success && <div className="text-green-600 text-sm">{success}</div>}
        {userRole && (
          <div className="text-brand-main text-sm font-semibold">Role: {userRole === "donor" ? "Donor" : "Field Worker"}</div>
        )}
        <button
          type="submit"
          className="w-full py-2 px-4 rounded bg-brand-main text-white font-semibold hover:bg-brand-dark transition"
        >
          Login
        </button>
      </form>
    </div>
  );
}
