"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuth } from "firebase/auth";
import { storage } from "../../../src/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { resizeImageFile, IMAGE_MAX_BANNER } from "../../../src/lib/imageResize";
import { getProjectByCode, createProjectWithCredits, getOrgByCode } from '@/lib/dal';
import { generateCode } from '../../../src/lib/codes';
import PageShell from "../../../components/PageShell";

export default function RegisterProjectPage() {
  return (
    <Suspense fallback={<PageShell title={<span>Register Project</span>} contentClassName="p-6 md:p-8"><div className="text-center py-20 text-gray-400">Loading...</div></PageShell>}>
      <RegisterProject />
    </Suspense>
  );
}

function RegisterProject() {
  const searchParams = useSearchParams();
  const orgIdParam = searchParams.get('org');
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [vision, setVision] = useState("");
  const [projectSummary, setProjectSummary] = useState("");
  const [projectImpact, setProjectImpact] = useState("");
  const [totalBudget, setTotalBudget] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [coverPhoto, setCoverPhoto] = useState<File | null>(null);
  const [country, setCountry] = useState("");
  const [town, setTown] = useState("");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [showOnOrgOverview, setShowOnOrgOverview] = useState<boolean>(true);
  const [publicVisible, setPublicVisible] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [org, setOrg] = useState<any>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  const router = useRouter();

  const totalSteps = 8;
  const handleNext = () => setStep((s) => Math.min(s + 1, totalSteps));
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  // Load org data if org param provided
  useEffect(() => {
    if (!orgIdParam) return;
    let cancelled = false;
    setOrgLoading(true);
    (async () => {
      try {
        const orgData = await getOrgByCode(orgIdParam);
        if (!cancelled && orgData) setOrg(orgData);
      } catch {}
      if (!cancelled) setOrgLoading(false);
    })();
    return () => { cancelled = true; };
  }, [orgIdParam]);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("You must be logged in.");
      if (!name || !description) throw new Error("Name and description are required.");
      const latNum = latitude ? parseFloat(latitude) : null;
      const lngNum = longitude ? parseFloat(longitude) : null;
      if ((latitude && isNaN(latNum!)) || (longitude && isNaN(lngNum!))) {
        throw new Error("Latitude/Longitude must be valid numbers.");
      }

      // Upload cover photo if provided
      let coverPhotoUrl: string | null = null;
      if (coverPhoto) {
        const resized = await resizeImageFile(coverPhoto, IMAGE_MAX_BANNER);
        const photoRef = ref(storage, `projects/${user.uid}_${Date.now()}`);
        await uploadBytes(photoRef, resized);
        coverPhotoUrl = await getDownloadURL(photoRef);
      }

      // Generate a unique project code with proper P prefix
      let projectId = "";
      let isUnique = false;
      for (let attempts = 0; attempts < 10 && !isUnique; attempts++) {
        projectId = generateCode('project');
        const existing = await getProjectByCode(projectId);
        if (!existing) isUnique = true;
      }
      if (!isUnique) throw new Error("Could not generate a unique project ID. Please try again.");

      // Build location name from country/town
      const locationName = [town, country].filter(Boolean).join(', ') || null;
      const budgetNum = totalBudget ? parseFloat(totalBudget) : null;

      // Create project and deduct credits via DAL
      await createProjectWithCredits({
        uid: user.uid,
        projectData: {
          name,
          nameLower: name.toLowerCase(),
          description,
          coverPhotoUrl,
          users: [{ uid: user.uid, role: "Admin" }],
          createdBy: user.uid,
          projectId,
          showOnOrganizationOverview: !!showOnOrgOverview,
          publicVisible: publicVisible !== false,
          status: 'draft' as const,
          visibility: 'public' as const,

          // Organization linkage
          ...(org ? {
            organizationId: org.orgId,
            organizationName: org.name || null,
            organizationLogoUrl: org.logoUrl || null,
            originatingOrganizationId: org.orgId,
            originatingOrganizationDbId: org.id,
          } : {}),

          // Project details
          vision: vision || null,
          projectSummary: projectSummary || null,
          projectImpact: projectImpact || null,
          totalBudget: budgetNum,
          currency: currency || 'GBP',

          // Location
          locationName,
          location: {
            country: country || null,
            town: town || null,
            latitude: latNum,
            longitude: lngNum,
            search: [country, town].filter(Boolean).join(" ").toLowerCase() || null,
          },
        },
      });

      // Navigate to the new project profile
      router.push(`/projects/${projectId}/profile`);
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const stepLabel = (n: number) => {
    switch (n) {
      case 1: return 'Name';
      case 2: return 'Description';
      case 3: return 'Vision & Summary';
      case 4: return 'Impact & Budget';
      case 5: return 'Cover Photo';
      case 6: return 'Location';
      case 7: return 'Visibility';
      case 8: return 'Review';
      default: return '';
    }
  };

  return (
    <PageShell title={<span>Register Project</span>} contentClassName="p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Register a New Project</h1>

        {/* Org badge */}
        {org && (
          <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
            {org.logoUrl && <img src={org.logoUrl} alt="" className="w-5 h-5 rounded-full object-cover" />}
            <span>Creating under <strong>{org.name}</strong></span>
          </div>
        )}
        {orgIdParam && orgLoading && (
          <div className="mb-4 text-sm text-gray-400">Loading organisation...</div>
        )}

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Step {step} of {totalSteps}: {stepLabel(step)}</span>
            <span>{Math.round((step / totalSteps) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div className="bg-orange-500 h-1.5 rounded-full transition-all" style={{ width: `${(step / totalSteps) * 100}%` }} />
          </div>
        </div>

        {/* Step 1: Name */}
        {step === 1 && (
          <div>
            <label className="block mb-2 font-semibold">Project Name <span className="text-red-500">*</span></label>
            <input
              className="w-full border rounded-lg p-3 mb-4 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name"
            />
            <div className="flex justify-end">
              <button className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 transition" onClick={handleNext} disabled={!name}>
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Description */}
        {step === 2 && (
          <div>
            <label className="block mb-2 font-semibold">Description <span className="text-red-500">*</span></label>
            <p className="text-sm text-gray-500 mb-2">A brief overview of what the project is about.</p>
            <textarea
              className="w-full border rounded-lg p-3 mb-4 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your project..."
              rows={5}
            />
            <div className="flex justify-between">
              <button className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition" onClick={handleBack}>Back</button>
              <button className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 transition" onClick={handleNext} disabled={!description}>Next</button>
            </div>
          </div>
        )}

        {/* Step 3: Vision & Summary */}
        {step === 3 && (
          <div>
            <label className="block mb-2 font-semibold">Vision</label>
            <p className="text-sm text-gray-500 mb-2">What is the long-term vision for this project? (Optional)</p>
            <textarea
              className="w-full border rounded-lg p-3 mb-4 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={vision}
              onChange={(e) => setVision(e.target.value)}
              placeholder="Our vision is to..."
              rows={3}
            />
            <label className="block mb-2 font-semibold">Project Summary</label>
            <p className="text-sm text-gray-500 mb-2">A detailed summary of the project, its objectives, and approach. (Optional)</p>
            <textarea
              className="w-full border rounded-lg p-3 mb-4 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={projectSummary}
              onChange={(e) => setProjectSummary(e.target.value)}
              placeholder="This project aims to..."
              rows={5}
            />
            <div className="flex justify-between">
              <button className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition" onClick={handleBack}>Back</button>
              <button className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition" onClick={handleNext}>Next</button>
            </div>
          </div>
        )}

        {/* Step 4: Impact & Budget */}
        {step === 4 && (
          <div>
            <label className="block mb-2 font-semibold">Expected Impact</label>
            <p className="text-sm text-gray-500 mb-2">What impact will the project have on the community? (Optional)</p>
            <textarea
              className="w-full border rounded-lg p-3 mb-4 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={projectImpact}
              onChange={(e) => setProjectImpact(e.target.value)}
              placeholder="The project will impact..."
              rows={4}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block mb-2 font-semibold">Total Budget</label>
                <p className="text-sm text-gray-500 mb-2">Estimated total budget. (Optional)</p>
                <input
                  type="number"
                  className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  value={totalBudget}
                  onChange={(e) => setTotalBudget(e.target.value)}
                  placeholder="e.g. 50000"
                />
              </div>
              <div>
                <label className="block mb-2 font-semibold">Currency</label>
                <p className="text-sm text-gray-500 mb-2">&nbsp;</p>
                <select
                  className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="GBP">GBP (£)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="ZAR">ZAR (R)</option>
                  <option value="KES">KES (KSh)</option>
                  <option value="UGX">UGX (USh)</option>
                  <option value="TZS">TZS (TSh)</option>
                  <option value="NGN">NGN (₦)</option>
                  <option value="GHS">GHS (₵)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="AUD">AUD (A$)</option>
                  <option value="CAD">CAD (C$)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-between">
              <button className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition" onClick={handleBack}>Back</button>
              <button className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition" onClick={handleNext}>Next</button>
            </div>
          </div>
        )}

        {/* Step 5: Cover Photo */}
        {step === 5 && (
          <div>
            <label className="block mb-2 font-semibold">Cover Photo</label>
            <p className="text-sm text-gray-500 mb-3">Upload an image to represent your project. (Optional — you can add this later on the project page.)</p>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverPhoto(e.target.files?.[0] || null)}
              className="mb-4 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
            />
            {coverPhoto && (
              <div className="mb-4 text-sm text-green-600 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                {coverPhoto.name}
              </div>
            )}
            <div className="flex justify-between">
              <button className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition" onClick={handleBack}>Back</button>
              <button className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition" onClick={handleNext}>Next</button>
            </div>
          </div>
        )}

        {/* Step 6: Location */}
        {step === 6 && (
          <div>
            <h2 className="font-semibold mb-4">Location (Optional)</h2>
            <label className="block mb-1 font-medium">Country</label>
            <input
              className="w-full border rounded-lg p-3 mb-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. Kenya"
            />
            <label className="block mb-1 font-medium">Town / City</label>
            <input
              className="w-full border rounded-lg p-3 mb-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              value={town}
              onChange={(e) => setTown(e.target.value)}
              placeholder="e.g. Eldoret"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 font-medium">Latitude</label>
                <input
                  className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="e.g. -0.5143"
                />
              </div>
              <div>
                <label className="block mb-1 font-medium">Longitude</label>
                <input
                  className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="e.g. 35.2698"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">Provide either country/town for general location or GPS coordinates for map pin (all optional).</p>
            <div className="flex justify-between mt-6">
              <button className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition" onClick={handleBack}>Back</button>
              <button className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition" onClick={handleNext}>Next</button>
            </div>
          </div>
        )}

        {/* Step 7: Visibility */}
        {step === 7 && (
          <div>
            <h2 className="font-semibold mb-4">Visibility</h2>
            <div className="space-y-4">
              {org && (
                <div className="border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-1">Organisation Visibility</h3>
                  <p className="text-[11px] text-gray-600 mb-2">Feature this project on {org.name}&apos;s Overview tab. Useful for flagship initiatives.</p>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={showOnOrgOverview} onChange={e => setShowOnOrgOverview(e.target.checked)} className="rounded border-gray-300 text-orange-600 focus:ring-orange-500" />
                    Show on Organisation Overview
                  </label>
                </div>
              )}
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-semibold mb-1">Public Visibility</h3>
                <p className="text-[11px] text-gray-600 mb-2">Control whether this project appears in public project exploration lists and searches. Hidden projects are only accessible via direct link or from within the organisation.</p>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={publicVisible} onChange={e => setPublicVisible(e.target.checked)} className="rounded border-gray-300 text-orange-600 focus:ring-orange-500" />
                  Publicly Listed
                </label>
                {!publicVisible && <div className="mt-1 text-[11px] text-amber-600">Hidden: users need a direct link or organisation access.</div>}
              </div>
            </div>
            <div className="flex justify-between mt-6">
              <button className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition" onClick={handleBack}>Back</button>
              <button className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition" onClick={handleNext}>Next</button>
            </div>
          </div>
        )}

        {/* Step 8: Review */}
        {step === 8 && (
          <div>
            <h2 className="font-semibold mb-4">Review Your Project</h2>
            <div className="space-y-3 bg-gray-50 rounded-lg p-5 mb-6">
              <div><span className="text-sm text-gray-500">Name:</span> <span className="font-medium">{name}</span></div>
              <div><span className="text-sm text-gray-500">Description:</span> <span className="text-sm">{description.length > 120 ? description.slice(0, 120) + '...' : description}</span></div>
              {vision && <div><span className="text-sm text-gray-500">Vision:</span> <span className="text-sm">{vision.length > 80 ? vision.slice(0, 80) + '...' : vision}</span></div>}
              {projectSummary && <div><span className="text-sm text-gray-500">Summary:</span> <span className="text-sm">{projectSummary.length > 80 ? projectSummary.slice(0, 80) + '...' : projectSummary}</span></div>}
              {projectImpact && <div><span className="text-sm text-gray-500">Impact:</span> <span className="text-sm">{projectImpact.length > 80 ? projectImpact.slice(0, 80) + '...' : projectImpact}</span></div>}
              {totalBudget && <div><span className="text-sm text-gray-500">Budget:</span> <span className="font-medium">{currency} {parseFloat(totalBudget).toLocaleString()}</span></div>}
              <div><span className="text-sm text-gray-500">Cover Photo:</span> <span className="text-sm">{coverPhoto ? coverPhoto.name : <em className="text-gray-400">None (can add later)</em>}</span></div>
              <div><span className="text-sm text-gray-500">Location:</span> <span className="text-sm">{[town, country].filter(Boolean).join(', ') || <em className="text-gray-400">Not specified</em>}</span></div>
              {org && <div><span className="text-sm text-gray-500">Organisation:</span> <span className="font-medium">{org.name}</span></div>}
              <div><span className="text-sm text-gray-500">Publicly Listed:</span> <span className="text-sm">{publicVisible ? 'Yes' : 'No'}</span></div>
            </div>
            <p className="text-sm text-gray-500 mb-4">You can edit all details on the project page after creation. This costs <strong>50 credits</strong>.</p>
            <div className="flex justify-between">
              <button className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition" onClick={handleBack}>Back</button>
              <button
                className="px-6 py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 transition"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Project (50 Credits)"}
              </button>
            </div>
          </div>
        )}

        {error && <div className="text-red-600 mt-4 text-sm bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}
      </div>
    </PageShell>
  );
}
