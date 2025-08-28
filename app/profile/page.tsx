"use client";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, updateProfile, User } from "firebase/auth";
import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app } from "../../src/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState({ name: "", surname: "", email: "", bio: "", photoURL: "", role: "" });
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [project, setProject] = useState<any>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [activeTab, setActiveTab] = useState("profile");
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("id") || "";

  // If ?id=CODE is present, show project profile for that code
  useEffect(() => {
    async function fetchProject() {
      if (!code) return;
      setProjectLoading(true);
      setProjectError("");
      try {
        const q = query(collection(db, "projects"), where("projectId", "==", code));
        const snap = await getDocs(q);
        if (snap.empty) {
          setProjectError("No project found for this code.");
          setProject(null);
        } else {
          setProject({ id: snap.docs[0].id, ...snap.docs[0].data() });
        }
      } catch (e: any) {
        setProjectError(e.message || "Error loading project.");
      } finally {
        setProjectLoading(false);
      }
    }
    if (code) fetchProject();
  }, [code]);

  // Default: user profile
  useEffect(() => {
    if (code) return; // skip user profile if project code is present
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
  }, [code]);

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
    // If project profile by code
    if (code) {
      if (projectLoading) return <div className="max-w-xl mx-auto mt-10">Loading...</div>;
      if (projectError) return <div className="max-w-xl mx-auto mt-10 text-red-600">{projectError}</div>;
      if (!project) return null;
      return (
        <div className="max-w-5xl mx-auto mt-10 bg-white rounded-xl shadow p-0 flex flex-col min-h-[70vh]">
          <div className="px-8 py-6 border-b border-brand-main flex items-center gap-4">
            {project.coverPhotoUrl && (
              <img
                src={project.coverPhotoUrl}
                alt={project.name}
                className="w-20 h-20 object-cover rounded border border-brand-main"
                loading="lazy"
                decoding="async"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold text-brand-main mb-1">{project.name}</h1>
              <div className="text-sm text-gray-500">Project Code: <span className="font-mono bg-gray-100 px-2 py-1 rounded text-brand-dark">{project.projectId}</span></div>
            </div>
          </div>
          <div className="flex flex-1 min-h-0">
            {/* Left tabs */}
            <nav className="w-48 border-r border-brand-main bg-brand-main/5 flex flex-col py-6">
              <button className={`text-left px-6 py-3 font-semibold text-brand-main hover:bg-brand-main/10 transition ${activeTab === "overview" ? "bg-brand-main/20" : ""}`} onClick={() => setActiveTab("overview")}>Overview</button>
              <button className={`text-left px-6 py-3 font-semibold text-brand-main hover:bg-brand-main/10 transition ${activeTab === "updates" ? "bg-brand-main/20" : ""}`} onClick={() => setActiveTab("updates")}>Updates</button>
              <button className={`text-left px-6 py-3 font-semibold text-brand-main hover:bg-brand-main/10 transition ${activeTab === "members" ? "bg-brand-main/20" : ""}`} onClick={() => setActiveTab("members")}>Members</button>
              {/* Add more tabs as needed */}
            </nav>
            {/* Content area */}
            <div className="flex-1 p-8">
              {activeTab === "overview" && (
                <>
                  <div className="mb-4 text-brand-dark">{project.description}</div>
                  <div className="text-sm text-gray-500 mt-4">Created by: {project.createdBy}</div>
                </>
              )}
              {activeTab === "updates" && (
                <div className="text-brand-dark">Project updates will appear here.</div>
              )}
              {activeTab === "members" && (
                <div className="text-brand-dark">Project members will appear here.</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Default: user profile dashboard
    if (!user) return <div className="text-center py-20">Please log in to view your profile.</div>;

    return (
      <div className="max-w-5xl mx-auto mt-10 bg-white rounded-xl shadow p-0 flex flex-col min-h-[70vh]">
        <div className="px-8 py-6 border-b border-brand-main flex items-center gap-4">
          <img
            src={profile.photoURL || "/images/individuals.svg"}
            alt="Profile"
            className="w-20 h-20 object-cover rounded border-2 border-brand-main bg-slate-100"
          />
          <div>
            <h1 className="text-2xl font-bold text-brand-main mb-1">{profile.name || "Your Profile"}</h1>
            <div className="text-sm text-gray-500">{profile.email}</div>
          </div>
        </div>
        <div className="flex flex-1 min-h-0">
          {/* Left tabs */}
          <nav className="w-48 border-r border-brand-main bg-brand-main/5 flex flex-col py-6">
            <button className={`text-left px-6 py-3 font-semibold text-brand-main hover:bg-brand-main/10 transition ${activeTab === "profile" ? "bg-brand-main/20" : ""}`} onClick={() => setActiveTab("profile")}>Profile</button>
            <button className={`text-left px-6 py-3 font-semibold text-brand-main hover:bg-brand-main/10 transition ${activeTab === "settings" ? "bg-brand-main/20" : ""}`} onClick={() => setActiveTab("settings")}>Settings</button>
            {/* Add more tabs as needed */}
          </nav>
          {/* Content area */}
          <div className="flex-1 p-8">
            {activeTab === "profile" && (
              <form onSubmit={handleUpdate} className="space-y-4 max-w-lg">
                {/* ...existing code for profile form... */}
                <div className="mb-4">
                  <label className="block font-semibold mb-1">Name</label>
                  <input
                    className="w-full border rounded p-2"
                    value={profile.name}
                    onChange={e => setProfile({ ...profile, name: e.target.value })}
                    placeholder="Name"
                  />
                </div>
                <div className="mb-4">
                  <label className="block font-semibold mb-1">Surname</label>
                  <input
                    className="w-full border rounded p-2"
                    value={profile.surname}
                    onChange={e => setProfile({ ...profile, surname: e.target.value })}
                    placeholder="Surname"
                  />
                </div>
                <div className="mb-4">
                  <label className="block font-semibold mb-1">Email</label>
                  <input
                    className="w-full border rounded p-2"
                    value={profile.email}
                    onChange={e => setProfile({ ...profile, email: e.target.value })}
                    placeholder="Email"
                    type="email"
                  />
                </div>
                <div className="mb-4">
                  <label className="block font-semibold mb-1">Bio</label>
                  <textarea
                    className="w-full border rounded p-2"
                    value={profile.bio}
                    onChange={e => setProfile({ ...profile, bio: e.target.value })}
                    placeholder="Bio"
                    rows={3}
                  />
                </div>
                <button className="btn-primary" type="submit" disabled={loading}>Save</button>
                {success && <div className="text-green-600 mt-4">{success}</div>}
                {error && <div className="text-red-600 mt-4">{error}</div>}
              </form>
            )}
            {activeTab === "settings" && (
              <div className="text-brand-dark">Settings content will appear here.</div>
            )}
          </div>
        </div>
      </div>
    );
  }
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
