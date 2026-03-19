"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import { storage } from "../../../src/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getProjectByCode, createProjectWithCredits } from '@/lib/dal';
import PageShell from "../../../components/PageShell";

export default function RegisterProject() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverPhoto, setCoverPhoto] = useState<File | null>(null);
  const [country, setCountry] = useState("");
  const [town, setTown] = useState("");
  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [showOnOrgOverview, setShowOnOrgOverview] = useState<boolean>(true);
  const [publicVisible, setPublicVisible] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleNext = () => setStep((s) => s + 1);
  const handleBack = () => setStep((s) => s - 1);

  // Helper to generate a random 7-letter uppercase string
  function generateProjectId() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let id = "";
    for (let i = 0; i < 7; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("You must be logged in.");
      if (!name || !description || !coverPhoto) throw new Error("All fields required.");
      const latNum = latitude ? parseFloat(latitude) : null;
      const lngNum = longitude ? parseFloat(longitude) : null;
      if ((latitude && isNaN(latNum!)) || (longitude && isNaN(lngNum!))) {
        throw new Error("Latitude/Longitude must be valid numbers.");
      }

      // Upload cover photo to 'projects/' folder
      const photoRef = ref(storage, `projects/${user.uid}_${Date.now()}`);
      await uploadBytes(photoRef, coverPhoto);
      const coverPhotoUrl = await getDownloadURL(photoRef);

      // Generate a unique 7-letter projectId
      let projectId = "";
      let isUnique = false;
      for (let attempts = 0; attempts < 10 && !isUnique; attempts++) {
        projectId = generateProjectId();
        const existing = await getProjectByCode(projectId);
        if (!existing) isUnique = true;
      }
      if (!isUnique) throw new Error("Could not generate a unique project ID. Please try again.");

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
          location: {
            country: country || null,
            town: town || null,
            latitude: latNum,
            longitude: lngNum,
            search: [country, town].filter(Boolean).join(" ").toLowerCase() || null,
          },
        },
      });
  router.push("/");
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell title={<span>Register Project</span>} contentClassName="p-6 md:p-8">
      <h1 className="text-2xl font-bold mb-4">Register a New Project</h1>
      {step === 1 && (
        <div>
          <label className="block mb-2 font-semibold">Project Name</label>
          <input
            className="w-full border rounded p-2 mb-4"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter project name"
          />
          <button className="btn-primary" onClick={handleNext} disabled={!name}>
            Next
          </button>
        </div>
      )}
      {step === 2 && (
        <div>
          <label className="block mb-2 font-semibold">Description</label>
          <textarea
            className="w-full border rounded p-2 mb-4"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your project"
            rows={4}
          />
          <div className="flex justify-between">
            <button className="btn-secondary" onClick={handleBack}>
              Back
            </button>
            <button className="btn-primary" onClick={handleNext} disabled={!description}>
              Next
            </button>
          </div>
        </div>
      )}
  {step === 3 && (
        <div>
          <label className="block mb-2 font-semibold">Cover Photo</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setCoverPhoto(e.target.files?.[0] || null)}
            className="mb-4"
          />
          <div className="flex justify-between">
            <button className="btn-secondary" onClick={handleBack}>
              Back
            </button>
            <button className="btn-primary" onClick={handleNext} disabled={!coverPhoto}>
              Next
            </button>
          </div>
        </div>
      )}
  {step === 4 && (
        <div>
          <h2 className="font-semibold mb-4">Location (Optional)</h2>
          <label className="block mb-1 font-medium">Country</label>
          <input
            className="w-full border rounded p-2 mb-3"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. Kenya"
          />
          <label className="block mb-1 font-medium">Town / City</label>
            <input
              className="w-full border rounded p-2 mb-3"
              value={town}
              onChange={(e) => setTown(e.target.value)}
              placeholder="e.g. Eldoret"
            />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 font-medium">Latitude</label>
              <input
                className="w-full border rounded p-2"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g. -0.5143"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">Longitude</label>
              <input
                className="w-full border rounded p-2"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g. 35.2698"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">Provide either country/town for general location or GPS coordinates for map pin (all optional).</p>
          <div className="flex justify-between mt-6">
            <button className="btn-secondary" onClick={handleBack}>Back</button>
            <button className="btn-primary" onClick={handleNext}>Next</button>
          </div>
        </div>
      )}
      {step === 5 && (
        <div>
          <h2 className="font-semibold mb-4">Visibility</h2>
          <div className="space-y-4">
            <div className="border rounded p-4">
              <h3 className="text-sm font-semibold mb-1">Organization Visibility</h3>
              <p className="text-[11px] text-gray-600 mb-2">Feature this project on its organization's Overview tab (if applicable). Useful for flagship initiatives.</p>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={showOnOrgOverview} onChange={e=> setShowOnOrgOverview(e.target.checked)} />
                Show on Organization Overview
              </label>
            </div>
            <div className="border rounded p-4">
              <h3 className="text-sm font-semibold mb-1">Public Visibility</h3>
              <p className="text-[11px] text-gray-600 mb-2">Control whether this project appears in public project exploration lists and searches. Hidden projects are only accessible via direct link or from within the organization.</p>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={publicVisible} onChange={e=> setPublicVisible(e.target.checked)} />
                Publicly Listed
              </label>
              {!publicVisible && <div className='mt-1 text-[11px] text-amber-600'>Hidden: users need a direct link or organization access.</div>}
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <button className="btn-secondary" onClick={handleBack}>Back</button>
            <button className="btn-primary" onClick={handleNext}>Next</button>
          </div>
        </div>
      )}
      {step === 6 && (
        <div>
          <h2 className="font-semibold mb-2">Review</h2>
          <div className="mb-2"><strong>Name:</strong> {name}</div>
          <div className="mb-2"><strong>Description:</strong> {description}</div>
          <div className="mb-4">
            <strong>Cover Photo:</strong> {coverPhoto ? coverPhoto.name : "None"}
          </div>
          <div className="mb-2"><strong>Country:</strong> {country || <em className="text-gray-400">(none)</em>}</div>
          <div className="mb-2"><strong>Town:</strong> {town || <em className="text-gray-400">(none)</em>}</div>
          <div className="mb-4"><strong>GPS:</strong> {latitude && longitude ? `${latitude}, ${longitude}` : <em className="text-gray-400">(none)</em>}</div>
          <div className='mb-2'><strong>Show on Org Overview:</strong> {showOnOrgOverview? 'Yes':'No'}</div>
          <div className='mb-4'><strong>Publicly Listed:</strong> {publicVisible? 'Yes':'No'}</div>
          <div className="flex justify-between">
            <button className="btn-secondary" onClick={handleBack}>
              Back
            </button>
            <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
              {loading ? "Submitting..." : "Submit"}
            </button>
          </div>
        </div>
      )}
      {error && <div className="text-red-600 mt-4">{error}</div>}
    </PageShell>
  );
}
