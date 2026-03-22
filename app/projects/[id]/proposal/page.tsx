"use client";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";

export default function ProjectProposalRedirect() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    if (id) {
      // Preserve any query string so showcase/pin links still work
      const qs = window.location.search;
      router.replace(`/projects/${id}/profile${qs}`);
    }
  }, [id, router]);

  return null;
}
