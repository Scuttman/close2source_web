"use client";
import { Suspense } from "react";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, onSnapshot, updateDoc, runTransaction } from "firebase/firestore";
import { app } from "../../src/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import { BuildingOfficeIcon, RectangleGroupIcon, UserCircleIcon, PlusCircleIcon, SparklesIcon, PencilIcon, PhotoIcon, ArrowUpTrayIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import PageShell from "../../components/PageShell";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

function ProfilePageInner() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState({ name: "", surname: "", email: "", bio: "", photoURL: "", role: "", coverPhotoUrl: "" });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [editMode, setEditMode] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  
  // User's organizations, projects, and individual profiles
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [individualProfiles, setIndividualProfiles] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return');

  // Profile update state
  const [profileUpdating, setProfileUpdating] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  // Password reset state
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Join org modal state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinPin, setJoinPin] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');

  // Load user profile
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
            coverPhotoUrl: userDoc.data().coverPhotoUrl || "",
          });
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load user's organizations, projects, and individual profiles
  useEffect(() => {
    if (!user) return;
    
    setDataLoading(true);
    
    // Organizations where user is owner
    const orgsQuery = query(collection(db, "organizations"), where("ownerUid", "==", user.uid));
    const unsubOrgs = onSnapshot(orgsQuery, (snapshot) => {
      const orgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrganizations(orgs);
    });

    // Projects where user is creator or in team
    const projectsQuery = query(collection(db, "projects"), where("createdBy", "==", user.uid));
    const unsubProjects = onSnapshot(projectsQuery, (snapshot) => {
      const projs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProjects(projs);
      setDataLoading(false);
    });

    // Individual profiles owned by user
    const individualsQuery = query(
      collection(db, "individuals"), 
      where("ownerUid", "==", user.uid)
    );
    const unsubIndividuals = onSnapshot(individualsQuery, (snapshot) => {
      const individuals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setIndividualProfiles(individuals);
    });

    return () => {
      unsubOrgs();
      unsubProjects();
      unsubIndividuals();
    };
  }, [user]);

  // Join an organization via code + PIN
  async function handleJoinOrg(e: React.FormEvent) {
    e.preventDefault();
    setJoinError('');
    setJoinSuccess('');
    setJoinLoading(true);
    try {
      const code = joinCode.trim().toUpperCase();
      const pin = joinPin.trim();
      if (!code || !pin) throw new Error('Please enter both the organization code and PIN.');
      // Find org by orgId field
      const q = query(collection(db, 'organizations'), where('orgId', '==', code));
      const snap = await getDocs(q);
      if (snap.empty) throw new Error('Organization not found. Check the code and try again.');
      const orgDocSnap = snap.docs[0];
      const orgData = orgDocSnap.data();
      if (!orgData.joinPin || orgData.joinPin !== pin) throw new Error('Incorrect PIN. Please try again.');
      if (!user) throw new Error('You must be logged in.');
      // Check if already a member
      const team: any[] = Array.isArray(orgData.team) ? orgData.team : [];
      const alreadyMember = team.some((m: any) => m.uid === user.uid || (m.email && m.email.toLowerCase() === (user.email || '').toLowerCase()));
      if (alreadyMember) throw new Error('You are already a member of this organization.');
      // Add user to team atomically
      await runTransaction(db, async (transaction) => {
        const orgRef = orgDocSnap.ref;
        const latest = await transaction.get(orgRef);
        const latestTeam: any[] = Array.isArray(latest.data()?.team) ? latest.data()!.team : [];
        const stillMember = latestTeam.some((m: any) => m.uid === user.uid);
        if (stillMember) return;
        const userDocSnap = await getDoc(doc(db, 'users', user.uid));
        const userData = userDocSnap.exists() ? userDocSnap.data() : {};
        const member = {
          uid: user.uid,
          email: user.email || '',
          name: `${userData.name || ''} ${userData.surname || ''}`.trim() || user.displayName || user.email || '',
          type: 'user',
          role: 'Member',
        };
        transaction.update(orgRef, { team: [...latestTeam, member] });
      });
      setJoinSuccess(`You have joined ${orgData.name}! Refreshing...`);
      setJoinCode('');
      setJoinPin('');
      setTimeout(() => {
        setShowJoinModal(false);
        setJoinSuccess('');
        router.push(`/org/${code}`);
      }, 1500);
    } catch (err: any) {
      setJoinError(err.message || 'Failed to join organization.');
    } finally {
      setJoinLoading(false);
    }
  }

  // Update user profile (name, surname, bio)
  async function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setProfileUpdating(true);
    setProfileError('');
    setProfileSuccess('');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: profile.name,
        surname: profile.surname,
        bio: profile.bio,
      });
      setProfileSuccess('Profile updated successfully!');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setProfileUpdating(false);
    }
  }

  // Upload profile photo
  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const { ref: storageRefFn, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
      const fileRef = storageRefFn(storage, `profile-pics/${user.uid}/${Date.now()}_${file.name}`);
      const task = uploadBytesResumable(fileRef, file);
      await new Promise<void>((resolve, reject) => {
        task.on('state_changed',
          snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          () => resolve()
        );
      });
      const url = await getDownloadURL(fileRef);
      await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
      setProfile(prev => ({ ...prev, photoURL: url }));
    } catch (err: any) {
      setProfileError(err.message || 'Failed to upload photo.');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      e.target.value = '';
    }
  }

  // Send password reset email
  async function handlePasswordReset() {
    if (!user?.email) return;
    setResetLoading(true);
    setResetError('');
    setResetSent(false);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetSent(true);
    } catch (err: any) {
      setResetError(err.message || 'Failed to send reset email.');
    } finally {
      setResetLoading(false);
    }
  }

  // Upload cover photo
  async function uploadCoverPhoto(file: File) {
    if (!user) return;
    setUploadingCover(true);
    try {
      const fileRef = storageRef(storage, `users/${user.uid}/cover_${Date.now()}.jpg`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      await updateDoc(doc(db, "users", user.uid), { coverPhotoUrl: url });
      setProfile(prev => ({ ...prev, coverPhotoUrl: url }));
    } catch (err) {
      console.error("Error uploading cover photo:", err);
    } finally {
      setUploadingCover(false);
    }
  }

  if (!user) {
    return (
      <PageShell title="Profile">
        <div className="text-center py-20">
          <p className="text-gray-600 mb-4">Please log in to view your profile.</p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-2 bg-brand-main text-white rounded-lg font-semibold hover:bg-brand-dark transition"
          >
            Go to Login
          </button>
        </div>
      </PageShell>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: InformationCircleIcon },
    { id: 'organizations', label: 'Organizations', icon: BuildingOfficeIcon },
    { id: 'projects', label: 'Projects', icon: RectangleGroupIcon },
    { id: 'userprofile', label: 'User Profile', icon: UserCircleIcon },
  ];

  return (
    <PageShell 
      title={<span>{profile.name || 'Your Profile'}</span>}
      headerRight={(
        <div className='flex items-center gap-3'>
          <button
            onClick={() => setEditMode(m => !m)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold border transition ${
              editMode
                ? 'bg-brand-main text-white border-brand-main shadow-inner'
                : 'bg-white/10 text-white border-white/30 hover:bg-white/20'
            }`}
          >
            <PencilIcon className="h-4 w-4" />
            <span>{editMode ? 'Done' : 'Edit'}</span>
          </button>
        </div>
      )}
    >
      <div className="space-y-0">
        {/* Hero Header */}
        <div className='relative w-[calc(100%+3rem)] md:w-[calc(100%+4rem)] -ml-6 md:-ml-8' style={{ marginTop: '-2rem' }}>
          {/* Background with overlay */}
          <div className='absolute inset-0 bg-gray-900 overflow-hidden'>
            {profile.coverPhotoUrl && (
              <>
                <img src={profile.coverPhotoUrl} alt="Cover" className='absolute inset-0 w-full h-full object-cover' />
                <div className='absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20'></div>
              </>
            )}
          </div>

          {/* Profile Photo - Top Right */}
          {profile.photoURL && (
            <div className='absolute top-10 right-[2.7rem] z-20'>
              <img src={profile.photoURL} alt={profile.name} className='h-24 w-24 rounded-full object-cover bg-white shadow-2xl border-4 border-white' />
            </div>
          )}

          {/* Cover photo upload (edit mode) */}
          {editMode && (
            <div className='absolute bottom-4 left-[2.7rem] z-20'>
              <label className='flex items-center gap-2 px-3 py-2 bg-black/50 backdrop-blur-sm text-white text-xs font-medium rounded-lg border border-white/20 cursor-pointer hover:bg-black/70 transition'>
                {uploadingCover ? (
                  <><ArrowUpTrayIcon className='h-4 w-4 animate-bounce' /><span>Uploading…</span></>
                ) : (
                  <><PhotoIcon className='h-4 w-4' /><span>{profile.coverPhotoUrl ? 'Change Cover Photo' : 'Upload Cover Photo'}</span></>
                )}
                <input type='file' accept='image/*' className='hidden' disabled={uploadingCover} onChange={e => { const f = e.target.files?.[0]; if (f) uploadCoverPhoto(f); e.target.value = ''; }} />
              </label>
            </div>
          )}

          {/* Hero Content */}
          <div className='relative py-12 md:py-20 px-8'>
            <div className='max-w-3xl'>
              <h1 className='text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight'>
                {profile.name} {profile.surname}
              </h1>
              {profile.bio && (
                <p className='text-lg text-white/80 max-w-xl'>{profile.bio}</p>
              )}
            </div>
          </div>
        </div>

        {/* Black border line */}
        <div className='w-[calc(100%+3rem)] md:w-[calc(100%+4rem)] -ml-6 md:-ml-8 h-[2px] bg-black'></div>

        {/* Tab Nav + Content */}
        <div className='pt-6 flex flex-col md:flex-row gap-6 flex-1 min-h-0 items-stretch'>
          <nav className='md:w-56 flex md:flex-col gap-1 border-b md:border-b-0 md:border-r border-gray-200 pb-3 md:pb-0 md:pr-4 shrink-0'>
            {tabs.map(t => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-orange-50 text-orange-700 border border-orange-200 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? 'text-orange-600' : 'text-gray-400'}`} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>

          <div className='flex-1 min-w-0 flex flex-col min-h-0'>
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Quick Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-lg border border-gray-200 p-6 text-center shadow-sm hover:shadow-md transition">
                    <div className="text-3xl font-bold text-brand-main">{organizations.length}</div>
                    <div className="text-sm text-gray-600 mt-1">Organizations</div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-6 text-center shadow-sm hover:shadow-md transition">
                    <div className="text-3xl font-bold text-brand-main">{projects.length}</div>
                    <div className="text-sm text-gray-600 mt-1">Projects</div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-6 text-center shadow-sm hover:shadow-md transition">
                    <div className="text-3xl font-bold text-brand-main">{individualProfiles.length}</div>
                    <div className="text-sm text-gray-600 mt-1">Individual Profiles</div>
                  </div>
                </div>

                {/* Individual Profile Section */}
                <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl border border-orange-200 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-brand-dark mb-4">My Individual Profile</h3>
                  {individualProfiles.length > 0 ? (
                    <div className="space-y-3">
                      {individualProfiles.map((profile) => (
                        <a
                          key={profile.id}
                          href={`/individuals/profile?id=${profile.individualId}`}
                          className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition group"
                        >
                          <div>
                            <div className="font-semibold text-brand-dark group-hover:text-brand-main">{profile.name}</div>
                            <div className="text-sm text-gray-600">Code: {profile.individualId}</div>
                          </div>
                          <svg className="w-5 h-5 text-gray-400 group-hover:text-brand-main transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-600 mb-4">You haven't created an individual profile yet.</p>
                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                          onClick={() => router.push('/individuals/register-ai')}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-brand-main text-white rounded-lg font-semibold hover:bg-brand-dark transition"
                        >
                          <SparklesIcon className="w-5 h-5" />
                          Create with AI
                        </button>
                        <button
                          onClick={() => router.push('/individuals/create')}
                          className="inline-flex items-center gap-2 px-6 py-3 bg-white text-brand-main border-2 border-brand-main rounded-lg font-semibold hover:bg-brand-main/10 transition"
                        >
                          <PlusCircleIcon className="w-5 h-5" />
                          Create Manually
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'organizations' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-brand-dark">Your Organizations</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setJoinCode(''); setJoinPin(''); setJoinError(''); setJoinSuccess(''); setShowJoinModal(true); }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white text-brand-main border border-brand-main rounded-lg text-sm font-semibold hover:bg-brand-main/10 transition"
                    >
                      <PlusCircleIcon className="w-4 h-4" />
                      Join Organization
                    </button>
                    <button
                      onClick={() => router.push('/org/create')}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-brand-main text-white rounded-lg text-sm font-semibold hover:bg-brand-dark transition"
                    >
                      <PlusCircleIcon className="w-4 h-4" />
                      New Organization
                    </button>
                  </div>
                </div>
                {dataLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : organizations.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
                    <BuildingOfficeIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">You haven't created any organizations yet.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {organizations.map((org) => (
                      <a
                        key={org.id}
                        href={`/org/${org.orgId}`}
                        className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-lg font-semibold text-brand-dark group-hover:text-brand-main transition">{org.name}</h4>
                            <p className="text-sm text-gray-600 mt-1">Code: {org.orgId}</p>
                            {org.tagline && <p className="text-sm text-gray-500 mt-2">{org.tagline}</p>}
                          </div>
                          <svg className="w-5 h-5 text-gray-400 group-hover:text-brand-main transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'projects' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-brand-dark">Your Projects</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push('/projects/register-ai')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-brand-main text-white rounded-lg text-sm font-semibold hover:bg-brand-dark transition"
                  >
                    <SparklesIcon className="w-4 h-4" />
                    Register with AI
                  </button>
                  <button
                    onClick={() => router.push('/projects/register')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white text-brand-main border border-brand-main rounded-lg text-sm font-semibold hover:bg-brand-main/10 transition"
                  >
                    <PlusCircleIcon className="w-4 h-4" />
                    Register Project
                  </button>
                </div>
              </div>
              {dataLoading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : projects.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
                  <RectangleGroupIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">You haven't created any projects yet.</p>
                  <p className="text-sm text-gray-500">Use the buttons above to register your first project.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {projects.map((project) => (
                    <a
                      key={project.id}
                      href={`/projects/${project.projectId || project.id}/proposal`}
                      className="group relative rounded-xl overflow-hidden border border-gray-200 bg-white hover:shadow-md transition flex flex-col"
                    >
                      {project.coverPhotoUrl && (
                        <img src={project.coverPhotoUrl} alt={project.name} className="w-full h-40 object-cover" />
                      )}
                      <div className="p-4 flex-1 flex flex-col">
                        <h4 className="text-sm font-semibold text-brand-dark group-hover:text-brand-main transition mb-1 line-clamp-1">{project.name}</h4>
                        <p className="text-xs text-gray-600 mb-2">Code: {project.projectId}</p>
                        {project.description && <p className="text-xs text-gray-500 line-clamp-3 flex-1 mb-2">{project.description}</p>}
                        {project.locationName && (
                          <div className="text-xs text-gray-400 flex items-center gap-1 mb-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
                              <circle cx="12" cy="10" r="3"/>
                            </svg>
                            {project.locationName}
                          </div>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
            {activeTab === 'userprofile' && (
              <div className="space-y-6">
                {/* Profile Photo */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-brand-dark mb-4">Profile Photo</h3>
                  <div className="flex items-center gap-6">
                    <div className="relative shrink-0">
                      <img
                        src={profile.photoURL || '/images/individuals.svg'}
                        alt="Profile"
                        className="w-24 h-24 rounded-full object-cover border-2 border-brand-main bg-slate-100"
                      />
                      {uploading && (
                        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                          <span className="text-white text-xs font-bold">{uploadProgress}%</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-brand-main text-white text-sm font-semibold rounded-lg hover:bg-brand-dark transition">
                        <PhotoIcon className="w-4 h-4" />
                        {uploading ? 'Uploading…' : 'Change Photo'}
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} disabled={uploading} />
                      </label>
                      <p className="text-xs text-gray-500 mt-2">JPG, PNG or GIF. Max 5MB.</p>
                    </div>
                  </div>
                </div>

                {/* Profile Details Form */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-brand-dark mb-4">Personal Details</h3>
                  <form onSubmit={handleProfileUpdate} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                        <input
                          type="text"
                          value={profile.name}
                          onChange={e => setProfile(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Surname</label>
                        <input
                          type="text"
                          value={profile.surname}
                          onChange={e => setProfile(prev => ({ ...prev, surname: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={profile.email}
                        disabled
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Biography</label>
                      <textarea
                        value={profile.bio}
                        onChange={e => setProfile(prev => ({ ...prev, bio: e.target.value }))}
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none"
                        placeholder="Tell us about yourself…"
                      />
                    </div>
                    {profileError && <p className="text-red-600 text-sm">{profileError}</p>}
                    {profileSuccess && <p className="text-green-600 text-sm">{profileSuccess}</p>}
                    <button
                      type="submit"
                      disabled={profileUpdating}
                      className="px-6 py-2 bg-brand-main text-white text-sm font-semibold rounded-lg hover:bg-brand-dark transition disabled:opacity-60"
                    >
                      {profileUpdating ? 'Saving…' : 'Save Changes'}
                    </button>
                  </form>
                </div>

                {/* Password Reset */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-brand-dark mb-1">Password</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {user?.providerData?.some(p => p.providerId === 'password')
                      ? 'Reset your password via email. A reset link will be sent to your registered email address.'
                      : 'You signed in with a third-party provider (Google, etc.) and do not have a password to reset.'}
                  </p>
                  {user?.providerData?.some(p => p.providerId === 'password') && (
                    <>
                      {resetSent ? (
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 text-green-700 text-sm font-medium rounded-lg">
                          ✓ Reset email sent to {user.email}
                        </div>
                      ) : (
                        <button
                          onClick={handlePasswordReset}
                          disabled={resetLoading}
                          className="px-6 py-2 bg-gray-800 text-white text-sm font-semibold rounded-lg hover:bg-gray-900 transition disabled:opacity-60"
                        >
                          {resetLoading ? 'Sending…' : 'Send Password Reset Email'}
                        </button>
                      )}
                      {resetError && <p className="text-red-600 text-sm mt-2">{resetError}</p>}
                    </>
                  )}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
      {/* Join Organization Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
            <button
              onClick={() => setShowJoinModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-xl font-bold"
              aria-label="Close"
            >✕</button>
            <h2 className="text-xl font-bold text-brand-main mb-1">Join an Organization</h2>
            <p className="text-sm text-gray-500 mb-6">Enter the organization code and PIN shared with you by the organization admin.</p>
            {joinSuccess ? (
              <div className="text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm font-medium">{joinSuccess}</div>
            ) : (
              <form onSubmit={handleJoinOrg} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Organization Code</label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. OWKCMMQ"
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono tracking-widest uppercase focus:ring-2 focus:ring-brand-main focus:outline-none"
                    required
                    disabled={joinLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">PIN</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={joinPin}
                    onChange={e => setJoinPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="4-digit PIN"
                    maxLength={4}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono tracking-widest focus:ring-2 focus:ring-brand-main focus:outline-none"
                    required
                    disabled={joinLoading}
                  />
                </div>
                {joinError && <p className="text-red-600 text-sm">{joinError}</p>}
                <button
                  type="submit"
                  disabled={joinLoading}
                  className="w-full py-2.5 rounded-lg bg-brand-main text-white font-semibold hover:bg-brand-dark transition disabled:opacity-60"
                >
                  {joinLoading ? 'Joining...' : 'Join Organization'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <PageShell title="Profile">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-main" />
        </div>
      </PageShell>
    }>
      <ProfilePageInner />
    </Suspense>
  );
}
