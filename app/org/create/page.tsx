"use client";
import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getUser, updateUser, createOrg } from '@/lib/dal';
import { generateCode } from '../../../src/lib/codes';
import { storage } from '../../../src/lib/firebase';
import PageShell from '../../../components/PageShell';
import { logCreditTransaction } from '../../../src/lib/credits';
import { useRouter } from 'next/navigation';

const ORG_CREATE_COST = 50; // credits
const ORG_TYPES = [
  'Religious Organization',
  'NGO',
  'Business',
  'Church',
  'Other'
];

export default function CreateOrganizationPage(){
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUploadProgress, setLogoUploadProgress] = useState<number | null>(null);
  
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [country, setCountry] = useState('');
  const [website, setWebsite] = useState('');
  
  const [companyNumber, setCompanyNumber] = useState('');
  const [taxId, setTaxId] = useState('');
  const [orgType, setOrgType] = useState('');
  const [customType, setCustomType] = useState('');
  
  const [safeguardingFile, setSafeguardingFile] = useState<File | null>(null);
  const [bio, setBio] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleNext = () => {
    setError('');
    // Validation per step
    if (step === 1 && !name.trim()) {
      setError('Organization name is required');
      return;
    }
    if (step === 4 && !orgType) {
      setError('Please select an organization type');
      return;
    }
    setStep(s => s + 1);
  };

  const handleBack = () => {
    setError('');
    setStep(s => s - 1);
  };

  async function handleSubmit(e: React.FormEvent){
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if(!user) throw new Error('You must be signed in to create an organization.');
      
      const userData = await getUser(user.uid);
      const currentCredits = userData? (userData.credits ?? 0) : 0;
      if(currentCredits < ORG_CREATE_COST) throw new Error(`Not enough credits (need ${ORG_CREATE_COST}).`);
      
      // Upload logo if provided with progress
      let logoUrl: string | null = null;
      if (logoFile) {
        setUploadingLogo(true);
        const { uploadBytesResumable } = await import('firebase/storage');
        const logoRef = ref(storage, `organizations/logos/${user.uid}_${Date.now()}_${logoFile.name}`);
        const uploadTask = uploadBytesResumable(logoRef, logoFile);
        
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              setLogoUploadProgress(progress);
            },
            (error) => reject(error),
            async () => {
              logoUrl = await getDownloadURL(uploadTask.snapshot.ref);
              setUploadingLogo(false);
              setLogoUploadProgress(null);
              resolve();
            }
          );
        });
      }
      
      // Upload safeguarding policy if provided
      let safeguardingUrl: string | null = null;
      if (safeguardingFile) {
        const safeguardingRef = ref(storage, `organizations/safeguarding/${user.uid}_${Date.now()}_${safeguardingFile.name}`);
        await uploadBytes(safeguardingRef, safeguardingFile);
        safeguardingUrl = await getDownloadURL(safeguardingRef);
      }
      
      await updateUser(user.uid, { credits: currentCredits - ORG_CREATE_COST } as any);
      
      const orgId = generateCode('organization');
      const finalType = orgType === 'Other' ? (customType.trim() || 'Other') : orgType;
      const joinPin = String(Math.floor(1000 + Math.random() * 9000));
      
      await createOrg({
        name: name.trim(),
        logoUrl,
        address: {
          line1: addressLine1.trim() || null,
          line2: addressLine2.trim() || null,
          city: city.trim() || null,
          postcode: postcode.trim() || null,
          country: country.trim() || null,
        },
        website: website.trim() || null,
        companyNumber: companyNumber.trim() || null,
        taxId: taxId.trim() || null,
        orgType: finalType,
        safeguardingPolicyUrl: safeguardingUrl,
        bio: bio.trim() || null,
        orgId,
        ownerUid: user.uid,
        team: [],
        accessSettings: {},
        supporters: [],
        representatives: [],
        joinPin,
      } as any);
      
      await logCreditTransaction(user.uid, 'spend', ORG_CREATE_COST, `Created organization: ${name}`);
      setSuccess(true);
      setTimeout(()=> router.push(`/org/${orgId}`), 1500);
    } catch(e:any){ 
      setError(e.message || 'Error creating organization');
      setUploadingLogo(false);
      setLogoUploadProgress(null);
    }
    finally { setLoading(false); }
  }

  return (
    <PageShell title={<span>Create Organization</span>} contentClassName="p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition ${
                    s < step
                      ? 'bg-brand-main text-white'
                      : s === step
                      ? 'bg-brand-main text-white ring-4 ring-brand-main/20'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {s < step ? '✓' : s}
                </div>
                {s < 6 && (
                  <div
                    className={`flex-1 h-1 mx-2 rounded transition ${
                      s < step ? 'bg-brand-main' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-xs text-center text-brand-dark/60 mt-2">
            Step {step} of 6: {
              step === 1 ? 'Name & Logo' :
              step === 2 ? 'Address' :
              step === 3 ? 'Website' :
              step === 4 ? 'Organization Details' :
              step === 5 ? 'Safeguarding' :
              'Summary'
            }
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 md:p-8">
          <form onSubmit={step === 6 ? handleSubmit : (e) => { e.preventDefault(); handleNext(); }}>
          {/* Step 1: Name & Logo */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-brand-main mb-2">Name & Logo</h2>
                <p className="text-sm text-brand-dark/70 mb-6">Let's start with your organization's name and visual identity.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-brand-dark">Organization Name <span className="text-red-500">*</span></label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main transition"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Hope Foundation"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-3 text-brand-dark">Organization Logo <span className="text-gray-400 font-normal">(optional)</span></label>
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-brand-main bg-gray-100 flex items-center justify-center">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      )}
                    </div>
                    <label 
                      className="absolute bottom-2 right-2 bg-brand-main text-white rounded-full p-2 cursor-pointer hover:bg-brand-dark transition shadow-lg"
                      title="Upload logo"
                    >
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleLogoChange}
                        disabled={uploadingLogo}
                      />
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </label>
                    {uploadingLogo && logoUploadProgress !== null && (
                      <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                        <div className="text-white font-semibold text-sm">{logoUploadProgress}%</div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 text-center">Click the camera icon to upload<br />PNG, JPG or SVG. Max 2MB.</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Address */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-brand-main mb-2">Address Details</h2>
                <p className="text-sm text-brand-dark/70 mb-6">Where is your organization based? <span className="text-gray-500">(All fields optional)</span></p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-brand-dark">Address Line 1</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main transition"
                  value={addressLine1}
                  onChange={e => setAddressLine1(e.target.value)}
                  placeholder="Building number and street name"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-brand-dark">Address Line 2</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main transition"
                  value={addressLine2}
                  onChange={e => setAddressLine2(e.target.value)}
                  placeholder="Apartment, suite, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-brand-dark">City/Town</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main transition"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="e.g. London"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1 text-brand-dark">Postcode/ZIP</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main transition"
                    value={postcode}
                    onChange={e => setPostcode(e.target.value)}
                    placeholder="e.g. SW1A 1AA"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-brand-dark">Country</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main transition"
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  placeholder="e.g. United Kingdom"
                />
              </div>
            </div>
          )}

          {/* Step 3: Website */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-brand-main mb-2">Website</h2>
                <p className="text-sm text-brand-dark/70 mb-6">Do you have a website people can visit to learn more? <span className="text-gray-500">(Optional)</span></p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-brand-dark">Website URL</label>
                <input
                  type="url"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main transition"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  placeholder="https://example.org"
                />
                <p className="text-xs text-gray-500 mt-1">Include the full URL starting with https://</p>
              </div>
            </div>
          )}

          {/* Step 4: Organization Details */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-brand-main mb-2">Organization Details</h2>
                <p className="text-sm text-brand-dark/70 mb-6">Help us understand your organization better.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-brand-dark">Organization Type <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ORG_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setOrgType(t)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition text-left ${
                        orgType === t
                          ? 'bg-brand-main text-white border-brand-main shadow-sm'
                          : 'bg-white border-gray-200 text-brand-dark hover:border-brand-main/50 hover:bg-brand-main/5'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {orgType === 'Other' && (
                  <input
                    className="w-full mt-2 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main transition"
                    placeholder="Describe your organization type"
                    value={customType}
                    onChange={e => setCustomType(e.target.value)}
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-brand-dark">Company/Registration Number <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main transition"
                  value={companyNumber}
                  onChange={e => setCompanyNumber(e.target.value)}
                  placeholder="e.g. 12345678"
                />
                <p className="text-xs text-gray-500 mt-1">Your official registration or company number</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-brand-dark">Tax ID / Charity Number <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main transition"
                  value={taxId}
                  onChange={e => setTaxId(e.target.value)}
                  placeholder="e.g. 1234567"
                />
                <p className="text-xs text-gray-500 mt-1">Tax ID, charity registration, or EIN</p>
              </div>
            </div>
          )}

          {/* Step 5: Safeguarding */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-brand-main mb-2">Safeguarding Policy</h2>
                <p className="text-sm text-brand-dark/70 mb-6">If your organization works with vulnerable people, upload your safeguarding policy. <span className="text-gray-500">(Optional)</span></p>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-brand-main/50 transition">
                <div className="text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <label className="mt-2 block text-sm font-medium text-brand-dark cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => setSafeguardingFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <span className="text-brand-main hover:underline">Upload safeguarding policy</span>
                    <span className="text-gray-500"> or drag and drop</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1">PDF, DOC, DOCX up to 10MB</p>
                  {safeguardingFile && (
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 bg-brand-main/10 text-brand-main rounded-lg text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {safeguardingFile.name}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="flex gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-xs text-blue-800">
                    <p className="font-semibold mb-1">Why is this important?</p>
                    <p>A safeguarding policy demonstrates your commitment to protecting vulnerable people. It builds trust with supporters and is often required for partnerships and funding.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Summary */}
          {step === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-brand-main mb-2">Summary & Description</h2>
                <p className="text-sm text-brand-dark/70 mb-6">Add a brief description of your organization to complete your profile.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-brand-dark">Organization Description <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-brand-main/30 focus:border-brand-main transition resize-none"
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell people what your organization does and stands for..."
                />
              </div>

              {/* Summary cards */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
                <h3 className="font-semibold text-sm text-brand-dark mb-3">Review Your Information</h3>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500">Name:</span>
                    <p className="font-medium text-brand-dark">{name || <em className="text-gray-400">Not provided</em>}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Type:</span>
                    <p className="font-medium text-brand-dark">{orgType === 'Other' ? customType : orgType || <em className="text-gray-400">Not selected</em>}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Logo:</span>
                    <p className="font-medium text-brand-dark">{logoFile ? '✓ Uploaded' : <em className="text-gray-400">No logo</em>}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Website:</span>
                    <p className="font-medium text-brand-dark truncate">{website || <em className="text-gray-400">None</em>}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Address:</span>
                    <p className="font-medium text-brand-dark">{addressLine1 || city || country ? '✓ Provided' : <em className="text-gray-400">Not provided</em>}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Safeguarding:</span>
                    <p className="font-medium text-brand-dark">{safeguardingFile ? '✓ Uploaded' : <em className="text-gray-400">Not uploaded</em>}</p>
                  </div>
                </div>
              </div>

              {/* Cost notice */}
              <div className="flex items-center gap-2 rounded-lg bg-brand-main/5 border border-brand-main/20 px-4 py-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-main shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <p className="text-xs text-brand-dark/80">
                  Creating an organization costs <span className="font-semibold text-brand-main">{ORG_CREATE_COST} credits</span>, deducted immediately on submission.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">Organization created successfully! Redirecting...</div>
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between gap-4 pt-6 border-t">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="px-6 py-2.5 rounded-lg border border-gray-300 text-brand-dark font-medium hover:bg-gray-50 transition text-sm"
              >
                Back
              </button>
            )}
            {step < 6 ? (
              <button
                type="submit"
                className="ml-auto px-6 py-2.5 rounded-lg bg-brand-main text-white font-semibold hover:bg-brand-dark transition text-sm shadow-sm"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="ml-auto px-6 py-2.5 rounded-lg bg-brand-main text-white font-semibold hover:bg-brand-dark disabled:opacity-60 transition text-sm shadow-sm"
              >
                {loading ? 'Creating...' : 'Create Organization'}
              </button>
            )}
          </div>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
