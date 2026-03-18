"use client";
import { useState, useEffect } from 'react';
import { db } from '../src/lib/firebase';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { XMarkIcon, BuildingOfficeIcon, UserIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

interface BecomePartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  projectDocId: string;
  currentUser: any;
}

interface Organization {
  id: string;
  name: string;
  orgId: string;
  logoUrl?: string;
}

export default function BecomePartnerModal({ isOpen, onClose, project, projectDocId, currentUser }: BecomePartnerModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<'auth' | 'select-type' | 'org-selection' | 'support-details'>(
    currentUser ? 'select-type' : 'auth'
  );
  const [partnerType, setPartnerType] = useState<'individual' | 'organization' | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Support details form
  const [supportType, setSupportType] = useState<'full-grant' | 'pledge' | 'request-info' | 'other'>('pledge');
  const [pledgeAmount, setPledgeAmount] = useState('');
  const [message, setMessage] = useState('');

  // Inline auth state
  const [localUser, setLocalUser] = useState<any>(currentUser || null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const activeUser = localUser || currentUser;

  useEffect(() => {
    if (isOpen) {
      if (activeUser) {
        setStep('select-type');
        loadUserOrganizations(activeUser);
      } else {
        setStep('auth');
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setStep(currentUser ? 'select-type' : 'auth');
      setPartnerType(null);
      setSelectedOrg(null);
      setSupportType('pledge');
      setPledgeAmount('');
      setMessage('');
      setError('');
      setSuccess(false);
      setAuthEmail('');
      setAuthPassword('');
      setAuthName('');
      setAuthError('');
      setLocalUser(currentUser || null);
    }
  }, [isOpen]);

  async function handleAuthSubmit() {
    setAuthError('');
    setAuthLoading(true);
    const auth = getAuth();
    try {
      let result;
      if (authMode === 'login') {
        result = await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        result = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      }
      setLocalUser(result.user);
      await loadUserOrganizations(result.user);
      setStep('select-type');
    } catch (e: any) {
      const msg = e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password'
        ? 'Invalid email or password.'
        : e.code === 'auth/email-already-in-use'
        ? 'An account with this email already exists.'
        : e.code === 'auth/weak-password'
        ? 'Password must be at least 6 characters.'
        : e.message || 'Authentication failed.';
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleGoogleAuth() {
    setAuthError('');
    setAuthLoading(true);
    const auth = getAuth();
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setLocalUser(result.user);
      await loadUserOrganizations(result.user);
      setStep('select-type');
    } catch (e: any) {
      setAuthError(e.message || 'Google sign-in failed.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function loadUserOrganizations(user?: any) {
    const u = user || activeUser;
    if (!u) return;
    setLoadingOrgs(true);
    try {
      const q = query(collection(db, 'organizations'), where('ownerUid', '==', u.uid));
      const snapshot = await getDocs(q);
      const orgs = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        orgId: doc.data().orgId,
        logoUrl: doc.data().logoUrl
      }));
      setOrganizations(orgs);
    } catch (e: any) {
      console.error('Error loading organizations:', e);
    } finally {
      setLoadingOrgs(false);
    }
  }

  function handleSelectPartnerType(type: 'individual' | 'organization') {
    setPartnerType(type);
    if (type === 'individual') {
      setStep('support-details');
    } else {
      if (organizations.length === 0) {
        // No organizations - offer to create one
        setStep('org-selection');
      } else {
        setStep('org-selection');
      }
    }
  }

  function handleSelectOrganization(org: Organization) {
    setSelectedOrg(org);
    setStep('support-details');
  }

  function handleCreateOrganization() {
    // Navigate to org creation with return URL
    const returnUrl = `/projects/${project.projectId || projectDocId}/proposal?openPartner=true`;
    router.push(`/org/create?returnUrl=${encodeURIComponent(returnUrl)}`);
  }

  async function handleSubmit() {
    if (!activeUser) {
      setError('You must be logged in');
      return;
    }

    if (supportType === 'pledge' && !pledgeAmount) {
      setError('Please enter a pledge amount');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const projectRef = doc(db, 'projects', projectDocId);
      
      // Build partner object
      const partnerData: any = {
        uid: activeUser.uid,
        name: activeUser.displayName || activeUser.email || 'Anonymous',
        email: activeUser.email,
        type: partnerType,
        supportType,
        message: message || undefined,
        addedAt: new Date().toISOString(),
        timestamp: serverTimestamp()
      };

      if (partnerType === 'organization' && selectedOrg) {
        partnerData.organizationId = selectedOrg.orgId;
        partnerData.organizationDbId = selectedOrg.id;
        partnerData.organizationName = selectedOrg.name;
        partnerData.organizationLogoUrl = selectedOrg.logoUrl;
      }

      if (supportType === 'pledge' && pledgeAmount) {
        partnerData.pledgeAmount = parseFloat(pledgeAmount);
        partnerData.currency = project.currency || 'USD';
      }

      if (supportType === 'full-grant' && project.totalBudget) {
        partnerData.pledgeAmount = project.totalBudget;
        partnerData.currency = project.currency || 'USD';
      }

      // Update project with new partner
      await updateDoc(projectRef, {
        partners: arrayUnion(partnerData),
        updatedAt: serverTimestamp()
      });

      // If there's a pledge amount, update amountPledged
      if (partnerData.pledgeAmount) {
        const currentPledged = project.amountPledged || 0;
        await updateDoc(projectRef, {
          amountPledged: currentPledged + partnerData.pledgeAmount
        });
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (e: any) {
      console.error('Error becoming partner:', e);
      setError(e.message || 'Failed to submit partnership');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-16 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mb-16">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-brand-main">Become a Partner</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Partnership Submitted!</h3>
              <p className="text-gray-600">Thank you for your support. The project team will be notified.</p>
            </div>
          ) : (
            <>
              {/* Step 0: Auth — login or register */}
              {step === 'auth' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {authMode === 'login' ? 'Sign in to continue' : 'Create an account'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {authMode === 'login'
                        ? 'Log in to your Close2Source account to become a partner.'
                        : 'Create a free account to become a partner.'}
                    </p>
                  </div>

                  {/* Google button */}
                  <button
                    onClick={handleGoogleAuth}
                    disabled={authLoading}
                    className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium text-gray-700 disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400">or</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  {/* Email/password form */}
                  <div className="space-y-3">
                    {authMode === 'register' && (
                      <input
                        type="text"
                        placeholder="Full name"
                        value={authName}
                        onChange={e => setAuthName(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-main text-sm"
                      />
                    )}
                    <input
                      type="email"
                      placeholder="Email address"
                      value={authEmail}
                      onChange={e => setAuthEmail(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-main text-sm"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={authPassword}
                      onChange={e => setAuthPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAuthSubmit()}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-main text-sm"
                    />
                  </div>

                  {authError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{authError}</div>
                  )}

                  <button
                    onClick={handleAuthSubmit}
                    disabled={authLoading || !authEmail || !authPassword}
                    className="w-full py-2.5 px-4 bg-brand-main text-white rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-50"
                  >
                    {authLoading ? 'Please wait...' : authMode === 'login' ? 'Log In' : 'Create Account'}
                  </button>

                  <p className="text-center text-sm text-gray-600">
                    {authMode === 'login' ? (
                      <>
                        Don&apos;t have an account?{' '}
                        <button onClick={() => { setAuthMode('register'); setAuthError(''); }} className="text-brand-main hover:underline font-medium">Sign up</button>
                      </>
                    ) : (
                      <>
                        Already have an account?{' '}
                        <button onClick={() => { setAuthMode('login'); setAuthError(''); }} className="text-brand-main hover:underline font-medium">Log in</button>
                      </>
                    )}
                  </p>
                </div>
              )}
              {/* Step 1: Select Partner Type */}
              {step === 'select-type' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">How would you like to partner?</h3>
                    <p className="text-sm text-gray-600 mb-6">
                      Choose whether to support this project as an individual or on behalf of an organization.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Individual Option */}
                    <button
                      onClick={() => handleSelectPartnerType('individual')}
                      className="border-2 border-gray-200 rounded-xl p-6 hover:border-brand-main hover:bg-brand-main/5 transition group text-left"
                    >
                      <div className="w-12 h-12 bg-brand-main/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-brand-main/20 transition">
                        <UserIcon className="w-6 h-6 text-brand-main" />
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">As an Individual</h4>
                      <p className="text-sm text-gray-600">
                        Support this project personally in your own capacity.
                      </p>
                    </button>

                    {/* Organization Option */}
                    <button
                      onClick={() => handleSelectPartnerType('organization')}
                      className="border-2 border-gray-200 rounded-xl p-6 hover:border-brand-main hover:bg-brand-main/5 transition group text-left"
                    >
                      <div className="w-12 h-12 bg-brand-main/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-brand-main/20 transition">
                        <BuildingOfficeIcon className="w-6 h-6 text-brand-main" />
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">On Behalf of Organization</h4>
                      <p className="text-sm text-gray-600">
                        Partner through your organization {organizations.length > 0 && `(${organizations.length} available)`}.
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Organization Selection */}
              {step === 'org-selection' && (
                <div className="space-y-6">
                  <div>
                    <button
                      onClick={() => setStep('select-type')}
                      className="text-sm text-brand-main hover:underline mb-4"
                    >
                      ← Back
                    </button>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Select Organization</h3>
                    <p className="text-sm text-gray-600 mb-6">
                      Choose which organization will partner with this project.
                    </p>
                  </div>

                  {loadingOrgs ? (
                    <div className="text-center py-8 text-gray-500">Loading organizations...</div>
                  ) : organizations.length === 0 ? (
                    <div className="text-center py-8">
                      <BuildingOfficeIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">You don't have any organizations yet.</p>
                      <button
                        onClick={handleCreateOrganization}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-main text-white rounded-lg font-semibold hover:bg-brand-dark transition"
                      >
                        <PlusCircleIcon className="w-5 h-5" />
                        Create Organization
                      </button>
                      <div className="mt-4">
                        <button
                          onClick={() => handleSelectPartnerType('individual')}
                          className="text-sm text-brand-main hover:underline"
                        >
                          Or partner as an individual
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {organizations.map(org => (
                          <button
                            key={org.id}
                            onClick={() => handleSelectOrganization(org)}
                            className="w-full border-2 border-gray-200 rounded-lg p-4 hover:border-brand-main hover:bg-brand-main/5 transition text-left flex items-center gap-4"
                          >
                            {org.logoUrl ? (
                              <img src={org.logoUrl} alt={org.name} className="w-12 h-12 rounded-lg object-cover" />
                            ) : (
                              <div className="w-12 h-12 bg-brand-main/10 rounded-lg flex items-center justify-center">
                                <BuildingOfficeIcon className="w-6 h-6 text-brand-main" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-gray-900 truncate">{org.name}</h4>
                              <p className="text-sm text-gray-500">Code: {org.orgId}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                      <div className="pt-4 border-t border-gray-200">
                        <button
                          onClick={handleCreateOrganization}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-brand-main hover:text-brand-main transition"
                        >
                          <PlusCircleIcon className="w-5 h-5" />
                          Create New Organization
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Step 3: Support Details */}
              {step === 'support-details' && (
                <div className="space-y-6">
                  <div>
                    <button
                      onClick={() => {
                        if (partnerType === 'organization') {
                          setStep('org-selection');
                        } else {
                          setStep('select-type');
                        }
                      }}
                      className="text-sm text-brand-main hover:underline mb-4"
                    >
                      ← Back
                    </button>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Support Details</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      {partnerType === 'organization' && selectedOrg
                        ? `Partnering as ${selectedOrg.name}`
                        : 'Partnering as an individual'}
                    </p>
                  </div>

                  {/* Project Info */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-1">{project.name}</h4>
                    <p className="text-sm text-gray-600">Code: {project.projectId}</p>
                    {project.totalBudget && (
                      <p className="text-sm text-gray-600 mt-2">
                        Total Budget: {project.currency || 'USD'} {project.totalBudget.toLocaleString()}
                      </p>
                    )}
                  </div>

                  {/* Support Type */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      How would you like to support?
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-brand-main transition">
                        <input
                          type="radio"
                          name="supportType"
                          value="full-grant"
                          checked={supportType === 'full-grant'}
                          onChange={(e) => setSupportType(e.target.value as any)}
                          className="text-brand-main"
                        />
                        <div>
                          <div className="font-medium text-gray-900">Full Grant</div>
                          <div className="text-sm text-gray-600">Fund the entire project budget</div>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-brand-main transition">
                        <input
                          type="radio"
                          name="supportType"
                          value="pledge"
                          checked={supportType === 'pledge'}
                          onChange={(e) => setSupportType(e.target.value as any)}
                          className="text-brand-main"
                        />
                        <div>
                          <div className="font-medium text-gray-900">Pledge Amount</div>
                          <div className="text-sm text-gray-600">Commit a specific amount</div>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-brand-main transition">
                        <input
                          type="radio"
                          name="supportType"
                          value="request-info"
                          checked={supportType === 'request-info'}
                          onChange={(e) => setSupportType(e.target.value as any)}
                          className="text-brand-main"
                        />
                        <div>
                          <div className="font-medium text-gray-900">Request More Information</div>
                          <div className="text-sm text-gray-600">Learn more before committing</div>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-brand-main transition">
                        <input
                          type="radio"
                          name="supportType"
                          value="other"
                          checked={supportType === 'other'}
                          onChange={(e) => setSupportType(e.target.value as any)}
                          className="text-brand-main"
                        />
                        <div>
                          <div className="font-medium text-gray-900">Other</div>
                          <div className="text-sm text-gray-600">Specify your support type</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Pledge Amount (if applicable) */}
                  {supportType === 'pledge' && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Pledge Amount ({project.currency || 'USD'})
                      </label>
                      <input
                        type="number"
                        value={pledgeAmount}
                        onChange={(e) => setPledgeAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-main"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  )}

                  {/* Message */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Message (Optional)
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Add a message to the project team..."
                      rows={4}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-main"
                    />
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full py-3 px-4 bg-brand-main text-white rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Submitting...' : 'Submit Partnership'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
