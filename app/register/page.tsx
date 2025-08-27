
"use client";
import { useState } from "react";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { app } from "../../src/lib/firebase";

const roles = [
  { key: "donor", label: "Donor", color: "bg-brand-100", icon: "💖" },
  { key: "field_worker", label: "Field Worker", color: "bg-brand-50", icon: "🌍" },
];

export default function RegisterPage() {
  const [stage, setStage] = useState(1); // 1: select role, 2: form, 3: confirmation
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const auth = getAuth(app);
  const db = getFirestore(app);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
  // If no role is selected, default to 'User'
  const userRole = role || "User";
    if (!name.trim() || !surname.trim()) return setError("Please enter your name and surname.");
    if (password !== repeatPassword) return setError("Passwords do not match.");
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", userCredential.user.uid), {
        email,
        name,
        surname,
        role: userRole,
        createdAt: new Date().toISOString(),
      });
      setSuccess("Registration successful! You can now log in.");
      setStage(3);
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Stage 1: Select role
  if (stage === 1) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white p-8 rounded-xl shadow-lg border border-brand-100 text-center">
        <h1 className="text-2xl font-bold mb-6 text-brand-700">Register</h1>
        <p className="mb-6 text-slate-600">Are you a Donor or a Field Worker?</p>
        <div className="flex gap-6 justify-center mb-6">
          {roles.map(r => (
            <button
              key={r.key}
              className={`flex-1 flex flex-col items-center py-6 rounded-lg border-2 transition shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-400 cursor-pointer min-w-[120px] ${role === r.key ? "border-brand-500 bg-brand-100" : "border-slate-200 bg-slate-50"}`}
              onClick={() => { setRole(r.key); setStage(2); }}
              aria-pressed={role === r.key}
            >
              <span className="text-4xl mb-2">{r.icon}</span>
              <span className="font-semibold text-brand-700 text-lg">{r.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Stage 2: Fill form
  if (stage === 2) {
    return (
      <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-xl shadow-lg border border-brand-100">
        <h1 className="text-2xl font-bold mb-6 text-brand-700">Register as {roles.find(r => r.key === role)?.label}</h1>
        <form className="space-y-4" onSubmit={handleRegister}>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block mb-1 font-medium">Name</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
            <div className="flex-1">
              <label className="block mb-1 font-medium">Surname</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                value={surname}
                onChange={e => setSurname(e.target.value)}
                required
              />
            </div>
          </div>
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
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block mb-1 font-medium">Password</label>
              <input
                type="password"
                className="w-full border rounded px-3 py-2"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex-1">
              <label className="block mb-1 font-medium">Repeat Password</label>
              <input
                type="password"
                className="w-full border rounded px-3 py-2"
                value={repeatPassword}
                onChange={e => setRepeatPassword(e.target.value)}
                required
              />
            </div>
          </div>
          {password && repeatPassword && password !== repeatPassword && (
            <div className="text-red-600 text-sm">Passwords do not match.</div>
          )}
          {error && <div className="text-red-600 text-sm">{error}</div>}
          {success && <div className="text-green-600 text-sm">{success}</div>}
          <div className="flex justify-between">
            <button
              type="button"
              className="py-2 px-4 rounded bg-slate-200 text-slate-700 font-semibold hover:bg-slate-300 transition"
              onClick={() => setStage(1)}
            >
              Back
            </button>
            <button
              type="submit"
              className="py-2 px-4 rounded bg-brand-500 text-white font-semibold hover:bg-brand-600 transition"
            >
              Register
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Stage 3: Confirmation
  if (stage === 3) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-xl shadow-lg border border-brand-100 text-center">
        <h1 className="text-2xl font-bold mb-4 text-brand-700">Registration Complete!</h1>
        <div className="text-5xl mb-4">🎉</div>
        <p className="mb-6 text-slate-600">Your account has been created. You can now log in and start using Close2Source.</p>
        <a href="/" className="inline-block px-6 py-2 rounded bg-brand-500 text-white font-semibold hover:bg-brand-600 transition">Go to Home</a>
      </div>
    );
  }

  return null;
}
