"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../src/lib/firebase";

// This page now only resolves a short project code (projectId field) and redirects
// to the canonical project route /projects/[firestoreDocId]. If not found, an
// error message is displayed. Keeping it lean avoids duplicating the full
// project UI logic which already lives in the main project page.
export default function ProjectCodeRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = (searchParams.get("id") || "").trim();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const redirectedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function resolveAndRedirect() {
      if (!code || redirectedRef.current) return;
      setLoading(true);
      setError("");
      try {
        const q = query(collection(db, "projects"), where("projectId", "==", code));
        const snap = await getDocs(q);
        if (cancelled) return;
        if (snap.empty) {
          setError("No project found for this code.");
        } else {
          const docId = snap.docs[0].id;
          redirectedRef.current = true;
          // Use replace so the short URL doesn't stay in history before canonical.
          router.replace(`/projects/${docId}`);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Error resolving project code.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    resolveAndRedirect();
    return () => { cancelled = true; };
  }, [code, router]);

  if (!code) {
    return <div className="max-w-2xl mx-auto mt-10 text-red-600">No project code provided.</div>;
  }

  if (error) {
    return <div className="max-w-2xl mx-auto mt-10 text-red-600">{error}</div>;
  }

  // While loading or after triggering redirect show a lightweight message.
  return (
    <div className="max-w-2xl mx-auto mt-10 text-brand-dark">
      {loading ? "Looking up project..." : "Redirecting..."}
    </div>
  );
}
