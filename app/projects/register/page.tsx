"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "firebase/auth";
import { db, storage } from "../../../src/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, runTransaction, serverTimestamp, collection } from "firebase/firestore";
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
      const projectsCol = collection(db, "projects");
      for (let attempts = 0; attempts < 10 && !isUnique; attempts++) {
        projectId = generateProjectId();
        // Check if this projectId exists
        const q = await import("firebase/firestore").then(firestore => firestore.query);
        const where = await import("firebase/firestore").then(firestore => firestore.where);
        const getDocs = await import("firebase/firestore").then(firestore => firestore.getDocs);
        const qSnap = await getDocs(q(projectsCol, where("projectId", "==", projectId)));
        if (qSnap.empty) isUnique = true;
      }
      if (!isUnique) throw new Error("Could not generate a unique project ID. Please try again.");

      // Firestore transaction: create project, deduct credits
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("User profile not found.");
        const userData = userSnap.data();
        if ((userData.credits || 0) < 50) throw new Error("Not enough credits.");

        // Create project
        const newProjectRef = doc(projectsCol);
        transaction.set(newProjectRef, {
          name,
          description,
          coverPhotoUrl,
          users: [{ uid: user.uid, role: "Admin" }],
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          projectId,
          location: {
            country: country || null,
            town: town || null,
            latitude: latNum,
            longitude: lngNum,
            // convenience string for simple text search
            search: [country, town].filter(Boolean).join(" ").toLowerCase() || null,
          },
        });
        // Deduct credits
        transaction.update(userRef, { credits: (userData.credits || 0) - 50 });
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
          <h2 className="font-semibold mb-2">Review</h2>
          <div className="mb-2"><strong>Name:</strong> {name}</div>
          <div className="mb-2"><strong>Description:</strong> {description}</div>
          <div className="mb-4">
            <strong>Cover Photo:</strong> {coverPhoto ? coverPhoto.name : "None"}
          </div>
          <div className="mb-2"><strong>Country:</strong> {country || <em className="text-gray-400">(none)</em>}</div>
          <div className="mb-2"><strong>Town:</strong> {town || <em className="text-gray-400">(none)</em>}</div>
          <div className="mb-4"><strong>GPS:</strong> {latitude && longitude ? `${latitude}, ${longitude}` : <em className="text-gray-400">(none)</em>}</div>
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
