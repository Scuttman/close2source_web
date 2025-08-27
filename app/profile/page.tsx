"use client";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, updateProfile, User } from "firebase/auth";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from "../../src/lib/firebase";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState({ name: "", surname: "", email: "", bio: "", photoURL: "", role: "" });
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
        if (userDoc.exists()) {
          setProfile({
            name: userDoc.data().name || "",
            surname: userDoc.data().surname || "",
            email: userDoc.data().email || firebaseUser.email || "",
            bio: userDoc.data().bio || "",
            photoURL: userDoc.data().photoURL || "",
            role: userDoc.data().role || "User",
          });
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name: profile.name,
        surname: profile.surname,
        email: profile.email,
  bio: profile.bio,
  photoURL: profile.photoURL,
  role: profile.role || "User",
      });
      await updateProfile(user, { displayName: profile.name, photoURL: profile.photoURL });
      setSuccess("Profile updated successfully.");
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user || !e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    setError("");
    setSuccess("");
    const file = e.target.files[0];
    const storageRef = ref(storage, `profile-pics/${user.uid}`);
    try {
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setProfile((prev) => ({ ...prev, photoURL: url }));
      await updateDoc(doc(db, "users", user.uid), { photoURL: url });
      await updateProfile(user, { photoURL: url });
      setSuccess("Profile picture updated.");
    } catch (err: any) {
      setError("Failed to upload image: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <div className="text-center py-20">Loading...</div>;
  if (!user) return <div className="text-center py-20">Please log in to view your profile.</div>;

  return (
  <div className="max-w-3xl mx-auto mt-4 mb-4 bg-white p-6 md:p-12 rounded-xl shadow-lg border border-brand-100">
      <h1 className="text-2xl md:text-3xl font-bold mb-8 text-brand-main text-center">Your Profile</h1>
      <div className="mb-4 text-center">
        <span className="inline-block px-4 py-1 rounded-full bg-brand-main/10 text-brand-main font-semibold text-sm">
          {profile.role || "User"}
        </span>
      </div>
      <form className="flex flex-col md:flex-row gap-8 items-stretch" onSubmit={handleUpdate}>
        {/* Avatar and upload */}
        <div className="flex flex-col items-center md:items-start md:w-1/3 gap-4">
          <div className="relative">
            <img
              src={profile.photoURL || "/images/individuals.svg"}
              alt="Profile"
              className="w-28 h-28 md:w-36 md:h-36 rounded-full object-cover border-2 border-brand-main bg-slate-100"
            />
            <label className="absolute bottom-0 right-0 bg-brand-main text-white rounded-full p-1 cursor-pointer hover:bg-brand-dark transition" title="Change profile picture">
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={uploading} />
              <span className="text-xs">✏️</span>
            </label>
          </div>
          {uploading && <div className="text-xs text-brand-main">Uploading...</div>}
        </div>
        {/* Details */}
        <div className="flex-1 flex flex-col gap-4">
          <div>
            <label className="block mb-1 font-medium">Name</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={profile.name}
              onChange={e => setProfile({ ...profile, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Surname</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={profile.surname}
              onChange={e => setProfile({ ...profile, surname: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Email</label>
            <input
              type="email"
              className="w-full border rounded px-3 py-2"
              value={profile.email}
              onChange={e => setProfile({ ...profile, email: e.target.value })}
              required
              disabled
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Biography</label>
            <textarea
              className="w-full border rounded px-3 py-2 min-h-[80px]"
              value={profile.bio}
              onChange={e => setProfile({ ...profile, bio: e.target.value })}
              placeholder="Tell us about yourself..."
            />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          {success && <div className="text-green-600 text-sm">{success}</div>}
          <button
            type="submit"
            className="w-full py-2 px-4 rounded bg-brand-main text-white font-semibold hover:bg-brand-dark transition mt-2"
          >
            Update Profile
          </button>
        </div>
      </form>
    </div>
  );
}
