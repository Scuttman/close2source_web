"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../src/lib/firebase";

export default function ProjectProfileByCode() {
  const searchParams = useSearchParams();
  const code = searchParams.get("id") || "";
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => {
    async function fetchProject() {
      if (!code) return;
      setLoading(true);
      setError("");
      try {
        const q = query(collection(db, "projects"), where("projectId", "==", code));
        const snap = await getDocs(q);
        if (snap.empty) {
          setError("No project found for this code.");
          setProject(null);
        } else {
          setProject({ id: snap.docs[0].id, ...snap.docs[0].data() });
        }
      } catch (e: any) {
        setError(e.message || "Error loading project.");
      } finally {
        setLoading(false);
      }
    }
    fetchProject();
  }, [code]);

  if (!code) return <div className="max-w-4xl mx-auto mt-10 text-red-600">No project code provided.</div>;
  if (loading) return <div className="max-w-4xl mx-auto mt-10">Loading...</div>;
  if (error) return <div className="max-w-4xl mx-auto mt-10 text-red-600">{error}</div>;
  if (!project) return null;

  return (
    <div className="max-w-[1200px] w-full mx-auto mt-10 bg-white rounded-xl shadow p-0 flex flex-col min-h-[70vh]">
      {/* Top row: name/desc left, image right */}
      <div className="flex flex-col md:flex-row items-center md:items-start px-8 py-6 border-b border-brand-main gap-6">
        <div className="flex-1 text-left">
          <h1 className="text-2xl font-bold text-brand-main mb-2">{project.name}</h1>
          <div className="mb-2 text-brand-dark">{project.description}</div>
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
