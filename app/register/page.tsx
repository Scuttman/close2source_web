
"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
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
      <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-xl shadow-lg border border-brand-100">
        <h1 className="text-2xl font-bold mb-6 text-brand-700">Create Your Account</h1>
        <p className="text-sm text-slate-600 mb-4">After registering you can create an Individual or Organization profile.</p>
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
              className={`w-full border rounded px-3 py-2 ${emailLocked? 'bg-slate-100 cursor-not-allowed':''}`}
              value={email}
              onChange={e => { if(!emailLocked) setEmail(e.target.value); }}
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
          <div className="flex justify-end">
            <button type="submit" className="py-2 px-4 rounded bg-brand-500 text-white font-semibold hover:bg-brand-600 transition">Register</button>
          </div>
        </form>
      </div>
    );
  }

  // Stage 2: Profile picture upload
  if (stage === 2) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white p-8 rounded-xl shadow-lg border border-brand-100 text-center">
        <h2 className="text-xl font-semibold mb-2 text-brand-700">Add a Profile Picture</h2>
        <p className="text-sm text-slate-600 mb-6">This helps people recognize you. You can skip for now.</p>
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="w-32 h-32 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border">
            {photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-slate-400 text-sm">No Image</span>
            )}
          </div>
          <input type="file" accept="image/*" onChange={handleFileChange} />
          {uploading && (
            <div className="w-full bg-slate-200 h-2 rounded overflow-hidden">
              <div className="bg-brand-500 h-2" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
          {error && <div className="text-red-600 text-sm">{error}</div>}
        </div>
        <div className="flex gap-3">
          <button onClick={() => setStage(3)} className="flex-1 px-4 py-2 rounded bg-slate-200 text-slate-800 font-medium hover:bg-slate-300 transition">Skip</button>
          <button disabled={uploading} onClick={() => setStage(3)} className="flex-1 px-4 py-2 rounded bg-brand-500 text-white font-semibold hover:bg-brand-600 disabled:opacity-50 transition">Continue</button>
        </div>
      </div>
    );
  }

  // Stage 3: Description
  if (stage === 3) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-white p-8 rounded-xl shadow-lg border border-brand-100">
        <h2 className="text-xl font-semibold mb-2 text-brand-700 text-center">Tell Us About You</h2>
        <p className="text-sm text-slate-600 mb-4 text-center">Add a short description. You can change this later in settings.</p>
        <textarea
          className="w-full border rounded p-3 h-40 resize-none mb-4"
          placeholder="e.g. Passionate about community development and sustainable agriculture..."
          value={description}
          maxLength={500}
          onChange={e => setDescription(e.target.value)}
        />
        <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
          <span>{description.length}/500</span>
          {error && <span className="text-red-600">{error}</span>}
        </div>
        <div className="flex gap-3">
          <button onClick={() => setStage(4)} className="flex-1 px-4 py-2 rounded bg-slate-200 text-slate-800 font-medium hover:bg-slate-300 transition" type="button">Skip</button>
          <button onClick={handleSaveDescription} className="flex-1 px-4 py-2 rounded bg-brand-500 text-white font-semibold hover:bg-brand-600 transition" type="button">Save & Continue</button>
        </div>
      </div>
    );
  }

  // Stage 4: Confirmation
  if (stage === 4) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-xl shadow-lg border border-brand-100 text-center">
        <h1 className="text-2xl font-bold mb-4 text-brand-700">Registration Complete!</h1>
        {inviteToken && inviteAccepted && (
          <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded">
            You have been added to {inviteOrgName || 'the organization'}.
          </div>
        )}
        <div className="text-5xl mb-4">🎉</div>
        <p className="mb-6 text-slate-600">Your account is ready. You can now create an Individual or Organization profile.</p>
        <div className="flex flex-col gap-3 items-stretch">
          {inviteToken && inviteAccepted && inviteOrgId && (
            <button
              onClick={() => router.push(`/org/${inviteOrgId}?tab=team`)}
              className="w-full px-6 py-2 rounded bg-brand-500 text-white font-semibold hover:bg-brand-600 transition"
            >
              Go to Invited Organization
            </button>
          )}
          <button
            onClick={() => router.push('/individuals/create')}
            className="w-full px-6 py-2 rounded bg-brand-500 text-white font-semibold hover:bg-brand-600 transition"
          >
            Create Individual Profile
          </button>
          <button
            onClick={() => router.push('/org/create')}
            className="w-full px-6 py-2 rounded bg-brand-500 text-white font-semibold hover:bg-brand-600 transition"
          >
            Create Organization Profile
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full px-6 py-2 rounded bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300 transition"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// Disable SSR for this page to avoid intermittent hydration attribute mismatches from dynamic client-only logic.
export default dynamic(() => Promise.resolve(RegisterPage), { ssr: false });
