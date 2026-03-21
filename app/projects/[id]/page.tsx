"use client";
import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useRouter } from 'next/navigation';

export default function ProjectDetail() {
  const params = useParams();
  const router = useRouter();
  const routeParam = params.id as string;

  useEffect(() => {
    if (routeParam) {
      router.replace(`/projects/${routeParam}/profile`);
    }
  }, [routeParam, router]);

  return null;
}
