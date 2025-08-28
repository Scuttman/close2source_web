"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../src/lib/firebase";


export default function IndividualProfileById() {
  const searchParams = useSearchParams();
  const code = searchParams.get("id") || "";
  const [individual, setIndividual] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("home");

  useEffect(() => {
    async function fetchIndividual() {
      if (!code) return;
      setLoading(true);
      setError("");
      try {
        const q = query(collection(db, "individuals"), where("individualId", "==", code));
        const snap = await getDocs(q);
        if (snap.empty) {
          setError("No individual found for this code.");
          setIndividual(null);
        } else {
          setIndividual({ id: snap.docs[0].id, ...snap.docs[0].data() });
        }
      } catch (e: any) {
        setError(e.message || "Error loading individual.");
      } finally {
        setLoading(false);
      }
    }
    fetchIndividual();
  }, [code]);

  if (!code) return <div className="max-w-4xl mx-auto mt-10 text-red-600">No individual code provided.</div>;
  if (loading) return <div className="max-w-4xl mx-auto mt-10">Loading...</div>;
  if (error) return <div className="max-w-4xl mx-auto mt-10 text-red-600">{error}</div>;
  if (!individual) return null;

  return (
    <div className="max-w-[1200px] w-full mx-auto mt-10 bg-white rounded-xl shadow p-0 flex flex-col min-h-[70vh]">
      {/* Top row: name/desc left, image right */}
      <div className="flex flex-col md:flex-row items-center md:items-start px-8 py-6 border-b border-brand-main gap-6">
        <div className="flex-1 text-left">
          <h1 className="text-2xl font-bold text-brand-main mb-2">{individual.name}</h1>
          <div className="mb-2 text-brand-dark">{individual.bio}</div>
          <div className="mb-2">
            <span className="font-semibold">Profile Code:</span> <span className="font-mono bg-gray-100 px-2 py-1 rounded text-brand-dark">{individual.individualId}</span>
          </div>
          <div className="text-sm text-gray-500 mt-4">Joined: {individual.createdAt ? new Date(individual.createdAt.seconds * 1000).toLocaleDateString() : "Unknown"}</div>
        </div>
        {individual.photoUrl && (
          <img
            src={individual.photoUrl}
            alt={individual.name}
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
          <button className={`text-left px-6 py-3 font-semibold text-brand-main hover:bg-brand-main/10 transition ${activeTab === "connections" ? "bg-brand-main/20" : ""}`} onClick={() => setActiveTab("connections")}>Connections</button>
        </nav>
        {/* Content area */}
        <div className="flex-1 p-8 min-w-0 flex flex-col">
          <div className="flex-1 min-w-0 w-full">
            {activeTab === "home" && (
              <div className="text-brand-dark w-full">Welcome to the individual dashboard. Overview and stats will appear here.</div>
            )}
            {activeTab === "updates" && (
              <div className="text-brand-dark w-full">Individual updates will appear here.</div>
            )}
            {activeTab === "connections" && (
              <div className="text-brand-dark w-full">Connections and supporters will appear here.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
