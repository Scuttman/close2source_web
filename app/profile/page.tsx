"use client";
import { Suspense } from "react";
import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User, sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { app } from "../../src/lib/firebase";
import {
  getUser,
  updateUser,
  subscribeUserOrgs,
  subscribeUserProjects,
  subscribeUserIndividuals,
  subscribeUserShowcases,
  createShowcase,
  deleteShowcase,
  getOrgByCode,
  getUserIndividuals,
  getUserOrgs,
  getUserProjects,
  getActivityLog,
  joinOrgByPin,
} from "@/lib/dal";
import { generateCode } from "../../src/lib/codes";
import { useRouter, useSearchParams } from "next/navigation";
import { BuildingOfficeIcon, RectangleGroupIcon, UserCircleIcon, PlusCircleIcon, SparklesIcon, PencilIcon, PhotoIcon, ArrowUpTrayIcon, InformationCircleIcon, ShieldCheckIcon, DocumentTextIcon, CheckCircleIcon, XCircleIcon, ArrowDownTrayIcon, PresentationChartBarIcon, TrashIcon } from "@heroicons/react/24/outline";
import { updateAIConsent } from "../../src/lib/userConsent";
import AIConsentModal from "../../components/AIConsentModal";
import PageShell from "../../components/PageShell";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { resizeImageFile, IMAGE_MAX_BANNER, IMAGE_MAX_THUMB } from "../../src/lib/imageResize";

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
  const [showcases, setShowcases] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Create showcase modal state
  const [showCreateShowcase, setShowCreateShowcase] = useState(false);
  const [showcaseTitle, setShowcaseTitle] = useState('');
  const [showcaseDesc, setShowcaseDesc] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [showcaseCreating, setShowcaseCreating] = useState(false);
  const [showcaseCreateError, setShowcaseCreateError] = useState('');
  const [showcaseOrgScope, setShowcaseOrgScope] = useState<string | undefined>(undefined); // undefined = personal
  
  const auth = getAuth(app);
  const storage = getStorage(app);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return');

  // Honour ?tab= query param on initial load (e.g. back from AI registration)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) setActiveTab(tabParam);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Compliance / consent state
  const [consentData, setConsentData] = useState<any>(null);
  const [aiConsentLocal, setAiConsentLocal] = useState(false);
  const [aiConsentSaving, setAiConsentSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showAIReconsentModal, setShowAIReconsentModal] = useState(false);

  // Load user profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userData = await getUser(firebaseUser.uid);
        if (userData) {
          const d = userData as any;
          setProfile({
            name: d.name || "",
            surname: d.surname || "",
            email: d.email || firebaseUser.email || "",
            bio: d.bio || "",
            photoURL: d.photoURL || "",
            role: d.role || "User",
            coverPhotoUrl: d.coverPhotoUrl || "",
          });
          setConsentData(d?.consent ?? null);
          setAiConsentLocal(d?.aiConsent === true);
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
    const unsubOrgs = subscribeUserOrgs(user.uid, (orgs) => {
      setOrganizations(orgs);
    });

    // Projects where user is creator
    const unsubProjects = subscribeUserProjects(user.uid, (projs) => {
      setProjects(projs);
      setDataLoading(false);
    });

    // Individual profiles owned by user
    const unsubIndividuals = subscribeUserIndividuals(user.uid, (individuals) => {
      setIndividualProfiles(individuals);
    });

    // Showcases owned by user
    const unsubShowcases = subscribeUserShowcases(user.uid, (sc) => {
      console.log('[showcases] snapshot received', sc.length, 'docs', sc);
      setShowcases(sc);
    }, (err) => {
      console.error('[showcases] subscription error', err);
    });

    return () => {
      unsubOrgs();
      unsubProjects();
      unsubIndividuals();
      unsubShowcases();
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
      // Find org by orgId field via DAL
      const orgResult = await getOrgByCode(code);
      if (!orgResult) throw new Error('Organization not found. Check the code and try again.');
      const orgData = orgResult as any;
      const orgDocId = orgResult.id;
      if (!orgData.joinPin || orgData.joinPin !== pin) throw new Error('Incorrect PIN. Please try again.');
      if (!user) throw new Error('You must be logged in.');
      // Check if already a member
      const team: any[] = Array.isArray(orgData.team) ? orgData.team : [];
      const alreadyMember = team.some((m: any) => m.uid === user.uid || (m.email && m.email.toLowerCase() === (user.email || '').toLowerCase()));
      if (alreadyMember) throw new Error('You are already a member of this organization.');
      // Add user to team atomically
      const userData = await getUser(user.uid);
      await joinOrgByPin({
        orgDocId,
        user: { uid: user.uid, email: user.email || '', displayName: user.displayName || '' },
        memberName: `${(userData as any)?.name || ''} ${(userData as any)?.surname || ''}`.trim() || user.displayName || user.email || '',
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
      await updateUser(user.uid, {
        name: profile.name,
        surname: profile.surname,
        bio: profile.bio,
      } as any);
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
      const resized = await resizeImageFile(file, IMAGE_MAX_THUMB);
      const { ref: storageRefFn, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
      const fileRef = storageRefFn(storage, `profile-pics/${user.uid}/${Date.now()}_${file.name}`);
      const task = uploadBytesResumable(fileRef, resized);
      await new Promise<void>((resolve, reject) => {
        task.on('state_changed',
          snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          () => resolve()
        );
      });
      const url = await getDownloadURL(fileRef);
      await updateUser(user.uid, { photoURL: url } as any);
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
      const resized = await resizeImageFile(file, IMAGE_MAX_BANNER);
      const fileRef = storageRef(storage, `users/${user.uid}/cover_${Date.now()}.jpg`);
      await uploadBytes(fileRef, resized);
      const url = await getDownloadURL(fileRef);
      await updateUser(user.uid, { coverPhotoUrl: url } as any);
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
    { id: 'showcases', label: 'Showcases', icon: PresentationChartBarIcon },
    { id: 'userprofile', label: 'User Profile', icon: UserCircleIcon },
    { id: 'compliance', label: 'Compliance', icon: ShieldCheckIcon },
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

            {/* ── Showcases Tab ─────────────────────────────────────────── */}
            {activeTab === 'showcases' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-brand-dark">Your Showcases</h3>
                  <button
                    onClick={() => {
                      setShowcaseTitle('');
                      setShowcaseDesc('');
                      setSelectedProjectIds([]);
                      setShowcaseOrgScope(undefined);
                      setShowcaseCreateError('');
                      setShowCreateShowcase(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-brand-main text-white rounded-lg text-sm font-semibold hover:bg-brand-dark transition"
                  >
                    <PlusCircleIcon className="w-4 h-4" />
                    New Showcase
                  </button>
                </div>

                {dataLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : showcases.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
                    <PresentationChartBarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2 font-medium">No showcases yet.</p>
                    <p className="text-sm text-gray-500 mb-6">Create a showcase to share a curated set of projects with partners via a single link or code.</p>
                    <button
                      onClick={() => {
                        setShowcaseTitle('');
                        setShowcaseDesc('');
                        setSelectedProjectIds([]);
                        setShowcaseOrgScope(undefined);
                        setShowcaseCreateError('');
                        setShowCreateShowcase(true);
                      }}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-brand-main text-white rounded-lg font-semibold hover:bg-brand-dark transition"
                    >
                      <PlusCircleIcon className="w-5 h-5" />
                      Create Your First Showcase
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {showcases.map((sc) => (
                      <div key={sc.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-base font-semibold text-brand-dark mb-1 truncate">{sc.title}</h4>
                            {sc.description && <p className="text-sm text-gray-500 line-clamp-2 mb-2">{sc.description}</p>}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                              <span className="font-mono font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{sc.showcaseId}</span>
                              <span>{(sc.projectDocIds || []).length} project{(sc.projectDocIds || []).length !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <a
                              href={`/showcase/${sc.showcaseId}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-xs font-semibold hover:bg-orange-100 transition"
                            >
                              View
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            </a>
                            <button
                              onClick={async () => {
                                if (!confirm('Delete this showcase? This cannot be undone.')) return;
                                await deleteShowcase(sc.id);
                              }}
                              className="inline-flex items-center p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Delete showcase"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Compliance Tab ─────────────────────────────────────────── */}
            {activeTab === 'compliance' && (
              <div className="flex flex-col gap-6">

                {/* Header */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-1">
                    <ShieldCheckIcon className="w-6 h-6 text-brand-main" />
                    <h2 className="text-xl font-bold text-brand-dark">Compliance &amp; Privacy</h2>
                  </div>
                  <p className="text-sm text-gray-500">
                    Your consent records, data rights and account options — all in one place.
                  </p>
                </div>

                {/* Consent Status */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-brand-dark mb-4">Consent Records</h3>
                  <div className="flex flex-col gap-3">
                    {[
                      { key: 'privacyPolicy', label: 'Privacy Policy', href: '/privacy' },
                      { key: 'terms',         label: 'Terms of Service', href: '/terms' },
                      { key: 'aiPolicy',      label: 'AI Use Policy', href: '/ai-policy' },
                    ].map(({ key, label, href }) => {
                      const record = consentData?.[key];
                      const agreed = record?.agreed === true;
                      const date = record?.timestamp
                        ? new Date(record.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                        : null;
                      const version = record?.version ?? null;
                      return (
                        <div key={key} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                          <div className="flex items-center gap-3">
                            {agreed
                              ? <CheckCircleIcon className="w-5 h-5 text-green-500 shrink-0" />
                              : <XCircleIcon className="w-5 h-5 text-red-400 shrink-0" />
                            }
                            <div>
                              <p className="text-sm font-medium text-gray-800">{label}</p>
                              {date && <p className="text-xs text-gray-400">Agreed {date}{version ? ` · v${version}` : ''}</p>}
                              {!date && <p className="text-xs text-gray-400">Not yet recorded</p>}
                            </div>
                          </div>
                          <a href={href} className="text-xs text-brand-main hover:underline font-medium" target="_blank" rel="noreferrer">
                            View
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* AI Consent Toggle */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-brand-dark mb-1">AI Features Consent</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Control whether Close2Source may use AI features on your content. You can change this at any time.
                  </p>
                  <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">Enable AI features</p>
                      <p className="text-xs text-gray-400">Allows AI-assisted tools on your projects and profiles.</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={aiConsentLocal}
                      disabled={aiConsentSaving}
                      onClick={async () => {
                        if (!user) return;
                        if (!aiConsentLocal) {
                          // Turning ON — require fresh re-agreement
                          setShowAIReconsentModal(true);
                          return;
                        }
                        // Turning OFF — no modal needed
                        setAiConsentSaving(true);
                        try {
                          await updateAIConsent(user.uid, false);
                          setAiConsentLocal(false);
                          setConsentData((prev: any) => ({
                            ...prev,
                            aiPolicy: { agreed: false, version: '1.0', timestamp: new Date().toISOString() },
                          }));
                        } finally {
                          setAiConsentSaving(false);
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-main ${aiConsentLocal ? 'bg-brand-main' : 'bg-gray-300'} ${aiConsentSaving ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${aiConsentLocal ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>

                {/* Data Rights */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-brand-dark mb-1">Your Data Rights</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Under UK GDPR you have the right to access, port and erase your personal data.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      disabled={exporting}
                      onClick={async () => {
                        if (!user) return;
                        setExporting(true);
                        try {
                          const [userData, individualsData, orgsData, projectsData, activityData] = await Promise.all([
                            getUser(user.uid),
                            getUserIndividuals(user.uid),
                            getUserOrgs(user.uid),
                            getUserProjects(user.uid),
                            getActivityLog(user.uid),
                          ]);
                          const payload = {
                            exportedAt: new Date().toISOString(),
                            user: userData,
                            individuals: individualsData,
                            organizations: orgsData,
                            projects: projectsData,
                            activityLog: activityData,
                          };
                          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `close2source-data-${user.uid.slice(0, 8)}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } finally {
                          setExporting(false);
                        }
                      }}
                      className="flex items-center gap-2 px-5 py-2 bg-brand-main text-white text-sm font-semibold rounded-lg hover:bg-brand-dark transition disabled:opacity-60"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      {exporting ? 'Exporting…' : 'Download My Data'}
                    </button>
                    <button
                      onClick={() => router.push('/settings')}
                      className="flex items-center gap-2 px-5 py-2 bg-red-50 text-red-700 border border-red-200 text-sm font-semibold rounded-lg hover:bg-red-100 transition"
                    >
                      <XCircleIcon className="w-4 h-4" />
                      Close / Delete Account
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    Account deletion is managed in Settings. This action is permanent and cannot be undone.
                  </p>
                </div>

              </div>
            )}
        </div>
        {/* Right Tools Panel */}
        {user && (
          <div className="hidden lg:flex flex-col w-60 shrink-0 self-start sticky top-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <PlusCircleIcon className="w-4 h-4 text-orange-500" />
                Profile Tools
              </h3>
              <button
                disabled
                className="w-full flex items-center gap-2 px-4 py-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-800 text-sm font-medium opacity-70 cursor-not-allowed"
                title="Coming soon"
              >
                <UserCircleIcon className="w-5 h-5 text-orange-500" />
                <span className="flex-1 text-left">Add Profile</span>
                <span className="text-xs bg-orange-200 text-orange-700 px-2 py-0.5 rounded-full">Soon</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
      {/* AI Re-consent Modal */}
      {showAIReconsentModal && (
        <AIConsentModal
          saving={aiConsentSaving}
          onAgree={async () => {
            if (!user) return;
            setAiConsentSaving(true);
            try {
              await updateAIConsent(user.uid, true);
              setAiConsentLocal(true);
              setConsentData((prev: any) => ({
                ...prev,
                aiPolicy: { agreed: true, version: '1.0', timestamp: new Date().toISOString() },
              }));
              setShowAIReconsentModal(false);
            } finally {
              setAiConsentSaving(false);
            }
          }}
          onCancel={() => setShowAIReconsentModal(false)}
        />
      )}

      {/* Create Showcase Modal */}
      {showCreateShowcase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowCreateShowcase(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition text-xl font-bold"
              aria-label="Close"
            >✕</button>
            <h2 className="text-xl font-bold text-brand-main mb-1">Create a Showcase</h2>
            <p className="text-sm text-gray-500 mb-6">Give your showcase a title, add a description, and pick the projects to include. Share it with partners via the generated code or link.</p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!user) return;
                if (!showcaseTitle.trim()) { setShowcaseCreateError('Please enter a title.'); return; }
                if (selectedProjectIds.length === 0) { setShowcaseCreateError('Select at least one project.'); return; }
                setShowcaseCreating(true);
                setShowcaseCreateError('');
                try {
                  const code = generateCode('showcase');
                  console.log('[showcases] creating with ownerUid', user.uid, 'code', code);
                  const newId = await createShowcase({
                    showcaseId: code,
                    title: showcaseTitle.trim(),
                    description: showcaseDesc.trim() || undefined,
                    ownerUid: user.uid,
                    orgId: showcaseOrgScope,
                    projectDocIds: selectedProjectIds,
                  });
                  console.log('[showcases] created doc id', newId);
                  setShowCreateShowcase(false);
                  setActiveTab('showcases');
                } catch (err: any) {
                  setShowcaseCreateError(err.message || 'Failed to create showcase.');
                } finally {
                  setShowcaseCreating(false);
                }
              }}
              className="space-y-5"
            >
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={showcaseTitle}
                  onChange={e => setShowcaseTitle(e.target.value)}
                  placeholder="e.g. Our Impact Projects 2025"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none"
                  required
                  disabled={showcaseCreating}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea
                  value={showcaseDesc}
                  onChange={e => setShowcaseDesc(e.target.value)}
                  placeholder="Briefly describe what this showcase represents..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none resize-none"
                  disabled={showcaseCreating}
                />
              </div>

              {/* Org scope (optional) */}
              {organizations.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Assign to Organization <span className="text-gray-400 font-normal">(optional)</span></label>
                  <select
                    value={showcaseOrgScope ?? ''}
                    onChange={e => setShowcaseOrgScope(e.target.value || undefined)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-main focus:outline-none bg-white"
                    disabled={showcaseCreating}
                  >
                    <option value="">Personal showcase (all my projects)</option>
                    {organizations.map(org => (
                      <option key={org.id} value={org.orgId}>{org.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Project picker */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Select Projects <span className="text-red-500">*</span></label>
                {projects.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">You have no projects yet. Create a project first.</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">
                    {projects.map(p => {
                      const checked = selectedProjectIds.includes(p.id);
                      return (
                        <label key={p.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-orange-50 transition ${checked ? 'bg-orange-50' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedProjectIds(prev =>
                                prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id],
                              );
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-brand-main focus:ring-brand-main"
                            disabled={showcaseCreating}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
                            <div className="text-xs text-gray-400 font-mono">{p.projectId}</div>
                          </div>
                          {p.coverPhotoUrl && (
                            <img src={p.coverPhotoUrl} alt="" className="w-10 h-8 object-cover rounded shrink-0" />
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
                {selectedProjectIds.length > 0 && (
                  <p className="text-xs text-orange-600 mt-1.5 font-medium">{selectedProjectIds.length} project{selectedProjectIds.length !== 1 ? 's' : ''} selected</p>
                )}
              </div>

              {showcaseCreateError && (
                <p className="text-red-600 text-sm">{showcaseCreateError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateShowcase(false)}
                  className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition"
                  disabled={showcaseCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={showcaseCreating || projects.length === 0}
                  className="flex-1 py-2.5 rounded-lg bg-brand-main text-white text-sm font-semibold hover:bg-brand-dark transition disabled:opacity-60"
                >
                  {showcaseCreating ? 'Creating…' : 'Create Showcase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
