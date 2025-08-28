"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../src/lib/firebase";
import { improveTextWithAI } from "../../../src/lib/ai";
import { getAuth } from "firebase/auth";
import { logCreditTransaction } from "../../../src/lib/credits";
  const auth = typeof window !== "undefined" ? getAuth() : null;

export default function ProjectDetail() {
  const params = useParams();
  const projectId = params.id as string;
  const [project, setProject] = useState<any>(null);
  const [desc, setDesc] = useState("");
  const [improving, setImproving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => {
    async function fetchProject() {
      setLoading(true);
      setError("");
      try {
        const docRef = doc(db, "projects", projectId);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          setError("Project not found.");
          setProject(null);
        } else {
          setProject(docSnap.data());
          setDesc(docSnap.data().description || "");
        }
      } catch (e: any) {
        setError(e.message || "Error loading project.");
      } finally {
        setLoading(false);
      }
    }
    if (projectId) fetchProject();
  }, [projectId]);

  if (loading) return <div className="max-w-4xl mx-auto mt-10">Loading...</div>;
  if (error) return <div className="max-w-4xl mx-auto mt-10 text-red-600">{error}</div>;

  if (!project) return null;

  return (
  <div className="max-w-[1200px] w-full mx-auto mt-10 bg-white rounded-xl shadow p-0 flex flex-col min-h-[70vh]">
      {/* Top row: name/desc left, image right */}
      <div className="flex flex-col md:flex-row items-center md:items-start px-8 py-6 border-b border-brand-main gap-6">
        <div className="flex-1 text-left">
          <h1 className="text-2xl font-bold text-brand-main mb-2">{project.name}</h1>
          <div className="mb-2">
            <textarea
              className="w-full border rounded px-3 py-2 text-brand-dark min-h-[80px]"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              disabled={improving}
            />
            <button
              className="mt-2 px-4 py-2 bg-brand-main text-white rounded hover:bg-brand-dark disabled:opacity-50"
              disabled={improving}
              onClick={async () => {
                setImproving(true);
                try {
                  // 1. Call AI service
                  const improved = await improveTextWithAI(desc);
                  setDesc(improved);
                  // 2. Update Firestore project description
                  await updateDoc(doc(db, "projects", projectId), { description: improved });
                  // 3. Deduct 2 credits from user and log transaction
                  if (auth?.currentUser) {
                    const userId = auth.currentUser.uid;
                    const userRef = doc(db, "users", userId);
                    const userSnap = await getDoc(userRef);
                    const currentCredits = userSnap.exists() ? userSnap.data().credits ?? 0 : 0;
                    if (currentCredits < 2) throw new Error("Not enough credits");
                    await updateDoc(userRef, { credits: currentCredits - 2 });
                    await logCreditTransaction(userId, "spend", 2, `AI improved project description for ${projectId}`);
                  }
                } catch (e: any) {
                  alert(e.message || "Failed to improve description");
                } finally {
                  setImproving(false);
                }
              }}
            >
              {improving ? "Improving..." : "Improve with AI (-2 Credits)"}
            </button>
          </div>
          <div className="mb-2">
            <span className="font-semibold">Project Code:</span> <span className="font-mono bg-gray-100 px-2 py-1 rounded text-brand-dark">{project.projectId}</span>
          </div>
          <div className="text-sm text-gray-500 mt-4">Created by: {project.createdBy}</div>
        </div>
        {project.coverPhotoUrl && (
          <img
            src={project.coverPhotoUrl}
            alt={project.name}
            className="w-48 h-48 object-cover rounded border border-brand-main"
            loading="lazy"
            decoding="async"
          />
        )}
      </div>
      {/* Panel area: left tabs, right content */}
      <div className="flex flex-1 min-h-0">
        {/* Left tabs */}
        <nav className="w-48 border-r border-brand-main bg-brand-main/5 flex flex-col py-6">
          <button className={`text-left px-6 py-3 font-semibold text-brand-main hover:bg-brand-main/10 transition ${activeTab === "home" ? "bg-brand-main/20" : ""}`} onClick={() => setActiveTab("home")}>Home</button>
          <button className={`text-left px-6 py-3 font-semibold text-brand-main hover:bg-brand-main/10 transition ${activeTab === "updates" ? "bg-brand-main/20" : ""}`} onClick={() => setActiveTab("updates")}>Updates</button>
          <button className={`text-left px-6 py-3 font-semibold text-brand-main hover:bg-brand-main/10 transition ${activeTab === "finance" ? "bg-brand-main/20" : ""}`} onClick={() => setActiveTab("finance")}>Finance</button>
        </nav>
        {/* Content area */}
        <div className="flex-1 p-8 min-w-0 flex flex-col">
          <div className="flex-1 min-w-0 w-full">
            {activeTab === "home" && (
              <div className="text-brand-dark w-full">Welcome to the project dashboard. Overview and stats will appear here.</div>
            )}
            {activeTab === "updates" && (
              <div className="text-brand-dark w-full">Project updates will appear here.</div>
            )}
            {activeTab === "finance" && (
              <div className="text-brand-dark w-full">Project finance details will appear here.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
