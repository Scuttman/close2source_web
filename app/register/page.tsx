
"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import PageShell from "../../components/PageShell";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { getAuth, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { getFirestore, doc, setDoc, runTransaction, getDoc } from "firebase/firestore";
import { app } from "../../src/lib/firebase";
import { logCreditTransaction } from "../../src/lib/credits";

// Legacy role selection removed. Users register first, then create profiles.

function RegisterPage() {
  const router = useRouter();
  // Since SSR is disabled for this page, we can safely read query params synchronously on first render
  const qp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialInviteToken = qp?.get('invite') || qp?.get('inviteToken') || null;
  const initialEmail = qp?.get('email') || '';
  const [inviteToken, setInviteToken] = useState<string | null>(initialInviteToken);
  const [stage, setStage] = useState(1); // 1: form, 2: profile pic, 3: description, 4: complete
  const role = "User"; // fixed base role
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [inviteAccepting, setInviteAccepting] = useState(false);
  const [inviteAccepted, setInviteAccepted] = useState(false);
  const [inviteOrgId, setInviteOrgId] = useState<string>("");
  const [inviteOrgName, setInviteOrgName] = useState<string>("");

  // Locked when invite supplies an email
  const [emailLocked, setEmailLocked] = useState(!!initialEmail);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [photoURL, setPhotoURL] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [currentUid, setCurrentUid] = useState<string>("");
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
  const userRole = role;
    if (!name.trim() || !surname.trim()) return setError("Please enter your name and surname.");
    if (password !== repeatPassword) return setError("Passwords do not match.");
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      setCurrentUid(userCredential.user.uid);
      await setDoc(doc(db, "users", userCredential.user.uid), {
        email,
        name,
        surname,
        role: userRole,
        createdAt: new Date().toISOString(),
        credits: 50,
      });
      // Award initial signup credits
      try {
        await logCreditTransaction(userCredential.user.uid, 'purchase', 50, 'Initial signup credits');
      } catch (creditErr) {
        // Non-fatal; continue flow even if credit logging fails
        console.warn('Failed to award initial credits', creditErr);
      }

      // If arriving via invitation token, attempt to accept & attach to org team
      if(inviteToken){
        setInviteAccepting(true);
        try {
          await runTransaction(db, async(transaction)=> {
            const inviteRef = doc(db,'orgInvites', inviteToken);
            const inviteSnap = await transaction.get(inviteRef);
            if(!inviteSnap.exists()) throw new Error('Invite not found');
            const inv:any = inviteSnap.data();
            if(inv.status !== 'pending') throw new Error('Invite already processed');
            if(inv.email && inv.email.toLowerCase() !== email.toLowerCase()) throw new Error('Invitation email mismatch');
            const orgRef = doc(db,'organizations', inv.orgDbId);
            const orgSnap = await transaction.get(orgRef);
            if(!orgSnap.exists()) throw new Error('Organization missing');
            const orgData:any = orgSnap.data();
            const team = Array.isArray(orgData.team)? orgData.team : [];
            const already = team.some((m:any)=> (m.uid && m.uid === userCredential.user.uid) || (m.email && m.email.toLowerCase() === email.toLowerCase()));
            const member = { uid: userCredential.user.uid, email, name: `${name} ${surname}`.trim(), type: 'user', role: 'Member' };
            const newTeam = already? team : [...team, member];
            transaction.update(orgRef, { team: newTeam });
            transaction.update(inviteRef, { status: 'accepted', acceptedAt: new Date().toISOString(), acceptedBy: userCredential.user.uid });
            setInviteOrgId(inv.orgId || inv.orgDbId || '');
            setInviteOrgName(inv.orgName || 'Organization');
          });
          setInviteAccepted(true);
        } catch(invErr:any){
          console.warn('Invite acceptance failed', invErr?.message || invErr);
        } finally { setInviteAccepting(false); }
      }
      setSuccess("Account created!");
      // proceed to profile picture stage
      setStage(2);
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
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        // Create new user document
        const displayNameParts = (user.displayName || "").split(" ");
        const firstName = displayNameParts[0] || "";
        const lastName = displayNameParts.slice(1).join(" ") || "";
        
        await setDoc(userDocRef, {
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
        
        setSuccess("Account created with Google!");
      } else {
        setSuccess("Welcome back!");
      }
      
      setTimeout(() => router.push("/app/profile"), 1000);
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
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        // Create new user document
        const displayNameParts = (user.displayName || "").split(" ");
        const firstName = displayNameParts[0] || "";
        const lastName = displayNameParts.slice(1).join(" ") || "";
        
        await setDoc(userDocRef, {
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
        
        setSuccess("Account created with Apple!");
      } else {
        setSuccess("Welcome back!");
      }
      
      setTimeout(() => router.push("/app/profile"), 1000);
    } catch (err: any) {
      setError(err.message || "Apple sign-in failed");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentUid) return;
    setUploading(true);
    setError("");
  // Use same path as profile settings page for consistent security rules
  const storageRef = ref(storage, `profile-pics/${currentUid}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on("state_changed", snapshot => {
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      setUploadProgress(progress);
    }, err => {
      setError(err.message || "Upload failed");
      setUploading(false);
    }, async () => {
      const url = await getDownloadURL(uploadTask.snapshot.ref);
      setPhotoURL(url);
      await setDoc(doc(db, "users", currentUid), { photoURL: url }, { merge: true });
      setUploading(false);
    });
  }

  async function handleSaveDescription() {
    if (!currentUid) {
      setStage(4);
      return;
    }
    try {
      await setDoc(doc(db, "users", currentUid), { description }, { merge: true });
      setStage(4);
    } catch (err: any) {
      setError(err.message);
    }
  }

  // (Removed deferred query param extraction; values now initialized synchronously above.)

  // If we have an inviteToken but no email param, attempt to load invite doc (public readable while pending)
  useEffect(() => {
    const fetchInviteEmail = async () => {
      if (!inviteToken) return;
      if (emailLocked) return; // already locked
      if (email) return; // user started typing; don't override
      try {
        setInviteLoading(true);
        const inviteRef = doc(db, 'orgInvites', inviteToken);
        const snap = await getDoc(inviteRef);
        if (snap.exists()) {
          const inv: any = snap.data();
          if (inv.status === 'pending' && inv.email) {
            setEmail(inv.email);
            setEmailLocked(true);
          }
        }
      } catch (err) {
        // silent; not critical
      } finally {
        setInviteLoading(false);
      }
    };
    fetchInviteEmail();
  }, [inviteToken, email, emailLocked, db]);

  // Registration form
  if (stage === 1) {
    return (
      <PageShell title="Sign Up" contentClassName="!p-0 overflow-hidden">
      <div className="flex flex-1 min-h-[500px]">
        {/* Left: 2/3 photo panel */}
        <div className="hidden md:flex md:w-2/3 relative overflow-hidden">
          <img
            src="/images/african-farming-bg.jpg"
            alt="Close2Source"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-brand-main/70 via-brand-main/40 to-transparent" />
          <div className="relative z-10 flex flex-col justify-end p-12 text-white">
            <h2 className="text-4xl font-bold mb-3 drop-shadow-lg">Close2Source</h2>
            <p className="text-lg text-white/90 max-w-md drop-shadow">
              Connecting communities to sustainable development projects across Africa.
            </p>
          </div>
        </div>

        {/* Right: 1/3 form panel */}
        <div className="w-full md:w-1/3 flex items-center justify-center bg-white px-8 py-12 overflow-y-auto">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="md:hidden text-center mb-8">
              <h1 className="text-2xl font-bold text-brand-main">Close2Source</h1>
            </div>

            <h1 className="text-2xl font-bold mb-1 text-gray-900">Create an account</h1>
            <p className="text-sm text-gray-500 mb-6">After registering you can create an Individual or Organization profile.</p>

            <form className="space-y-4" onSubmit={handleRegister}>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block mb-1 text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/40 focus:border-brand-main transition"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex-1">
                  <label className="block mb-1 text-sm font-medium text-gray-700">Surname</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/40 focus:border-brand-main transition"
                    value={surname}
                    onChange={e => setSurname(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/40 focus:border-brand-main transition ${emailLocked ? 'bg-slate-100 cursor-not-allowed' : ''}`}
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { if (!emailLocked) setEmail(e.target.value); }}
                  required
                  disabled={emailLocked || inviteLoading}
                />
                {inviteToken && inviteLoading && (
                  <div className="mt-1 text-[11px] text-brand-500 animate-pulse">Loading invitation…</div>
                )}
                {inviteToken && !inviteLoading && emailLocked && (
                  <div className="mt-1 text-[11px] text-brand-600">Invitation email locked for security.</div>
                )}
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
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">Repeat Password</label>
                <input
                  type="password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/40 focus:border-brand-main transition"
                  placeholder="••••••••"
                  value={repeatPassword}
                  onChange={e => setRepeatPassword(e.target.value)}
                  required
                />
              </div>
              {password && repeatPassword && password !== repeatPassword && (
                <div className="text-red-600 text-sm">Passwords do not match.</div>
              )}
              {error && <div className="text-red-600 text-sm">{error}</div>}
              {success && <div className="text-green-600 text-sm">{success}</div>}
              <button type="submit" className="w-full py-2.5 px-4 rounded-lg bg-brand-main text-white font-semibold hover:bg-brand-dark transition text-sm">
                Create account
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
              Already have an account?{' '}
              <a href="/login" className="text-brand-main font-semibold hover:text-brand-dark">
                Sign in
              </a>
            </p>
          </div>
        </div>
      </div>
      </PageShell>
    );
  }

  // Stage 2: Profile picture upload
  if (stage === 2) {
    return (
      <PageShell title="Profile Picture">
        <div className="max-w-md mx-auto py-8 text-center">
          <h2 className="text-xl font-semibold mb-1 text-brand-main">Add a Profile Picture</h2>
          <p className="text-sm text-slate-500 mb-8">This helps people recognize you. You can skip for now.</p>

          {/* Clickable circle */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <label className="relative w-36 h-36 rounded-full cursor-pointer group">
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
              {/* Image or placeholder */}
              <div className="w-full h-full rounded-full overflow-hidden bg-slate-100 border-2 border-brand-main/30">
                {photoURL ? (
                  <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>
              {/* Upload overlay */}
              {uploading ? (
                <div className="absolute inset-0 rounded-full bg-black/50 flex flex-col items-center justify-center gap-1">
                  <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  <span className="text-white text-xs font-semibold">{Math.round(uploadProgress)}%</span>
                </div>
              ) : (
                <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all">
                  <svg className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              )}
            </label>
            <p className="text-xs text-slate-400">{uploading ? 'Uploading…' : 'Click circle to choose a photo'}</p>
            {error && <div className="text-red-600 text-sm">{error}</div>}
          </div>

          <div className="flex gap-3 max-w-xs mx-auto">
            <button onClick={() => setStage(3)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 transition">Skip</button>
            <button disabled={uploading} onClick={() => setStage(3)} className="flex-1 px-4 py-2.5 rounded-lg bg-brand-main text-white font-semibold hover:bg-brand-dark disabled:opacity-50 transition">Continue</button>
          </div>
        </div>
      </PageShell>
    );
  }

  // Stage 3: Description
  if (stage === 3) {
    return (
      <PageShell title="About You">
        <div className="max-w-md mx-auto py-8">
          <h2 className="text-xl font-semibold mb-1 text-brand-main text-center">Tell Us About You</h2>
          <p className="text-sm text-slate-500 mb-6 text-center">Add a short description. You can change this later in your profile.</p>
          <textarea
            className="w-full border border-gray-200 rounded-lg p-3 h-40 resize-none mb-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main"
            placeholder="e.g. Passionate about community development and sustainable agriculture..."
            value={description}
            maxLength={500}
            onChange={e => setDescription(e.target.value)}
          />
          <div className="flex items-center justify-between text-xs text-slate-400 mb-6">
            <span>{description.length}/500</span>
            {error && <span className="text-red-600">{error}</span>}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStage(4)} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 transition" type="button">Skip</button>
            <button onClick={handleSaveDescription} className="flex-1 px-4 py-2.5 rounded-lg bg-brand-main text-white font-semibold hover:bg-brand-dark transition" type="button">Save & Continue</button>
          </div>
        </div>
      </PageShell>
    );
  }

  // Stage 4: Confirmation
  if (stage === 4) {
    return (
      <PageShell title="Welcome!">
        <div className="max-w-md mx-auto py-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold mb-2 text-brand-main">Registration Complete!</h1>
          {inviteToken && inviteAccepted && (
            <div className="my-4 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
              You have been added to {inviteOrgName || 'the organization'}.
            </div>
          )}
          <p className="mb-8 text-slate-500 text-sm">Your account is ready. You can now create an Individual or Organization profile.</p>
          <div className="flex flex-col gap-3 items-stretch">
            {inviteToken && inviteAccepted && inviteOrgId && (
              <button
                onClick={() => router.push(`/org/${inviteOrgId}?tab=team`)}
                className="w-full px-6 py-2.5 rounded-lg bg-brand-main text-white font-semibold hover:bg-brand-dark transition"
              >
                Go to Invited Organization
              </button>
            )}
            <button
              onClick={() => router.push('/individuals/create')}
              className="w-full px-6 py-2.5 rounded-lg bg-brand-main text-white font-semibold hover:bg-brand-dark transition"
            >
              Create Individual Profile
            </button>
            <button
              onClick={() => router.push('/org/create')}
              className="w-full px-6 py-2.5 rounded-lg bg-brand-main text-white font-semibold hover:bg-brand-dark transition"
            >
              Create Organization Profile
            </button>
            <button
              onClick={() => router.push('/profile')}
              className="w-full px-6 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-700 font-semibold hover:bg-gray-50 transition"
            >
              Continue to Home
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  return null;
}

// Disable SSR for this page to avoid intermittent hydration attribute mismatches from dynamic client-only logic.
export default dynamic(() => Promise.resolve(RegisterPage), { ssr: false });
