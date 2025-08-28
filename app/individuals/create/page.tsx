"use client";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

const CreateIndividualProfileForm = dynamic(() => import("./form"), { ssr: false });

export default function CreateProfileEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get("type");

  if (type === "fundraising" || type === "personal") {
    return <CreateIndividualProfileForm />;
  }

  return (
    <div className="max-w-xl mx-auto mt-16 bg-white rounded-xl shadow p-8 flex flex-col items-center">
      <h1 className="text-2xl font-bold text-brand-main mb-4">Create Your Profile</h1>
      <p className="mb-8 text-brand-dark text-center">Choose the type of profile you want to create:</p>
      <div className="flex flex-col gap-4 w-full">
        <button
          className="w-full px-6 py-4 rounded bg-brand-main text-white font-semibold text-lg hover:bg-brand-main/90 transition"
          onClick={() => router.push("/individuals/create?type=fundraising")}
        >
          Fundraising Profile
        </button>
        <button
          className="w-full px-6 py-4 rounded bg-brand-main/80 text-brand-main font-semibold text-lg border border-brand-main hover:bg-brand-main/10 transition"
          onClick={() => router.push("/individuals/create?type=personal")}
        >
          Personal Updates Profile
        </button>
      </div>
    </div>
  );
}
