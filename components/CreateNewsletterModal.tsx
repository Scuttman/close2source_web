"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserIndividuals } from "@/lib/dal";
import { NewspaperIcon, UserCircleIcon, XMarkIcon, ArrowRightIcon, PlusCircleIcon } from "@heroicons/react/24/outline";

interface Props {
  userUid: string;
  onClose: () => void;
}

export default function CreateNewsletterModal({ userUid, onClose }: Props) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!userUid) return;
    setLoading(true);
    getUserIndividuals(userUid)
      .then(setProfiles)
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }, [userUid]);

  function handleCreate() {
    if (!selected) return;
    router.push(`/newsletter?id=${selected}`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden">
        {/* Header */}
        <div className="bg-black px-6 py-4 flex items-center gap-3">
          <NewspaperIcon className="w-5 h-5 text-orange-400" />
          <h2 className="text-white font-semibold text-lg flex-1">Create Newsletter</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-5">
            Generate a formatted newsletter from your individual profile — including your header image,
            introduction, projects, prayer requests, financial needs, ways to support, and contact details.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-main" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-6">
              <UserCircleIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm mb-4">You don't have an individual profile yet.</p>
              <p className="text-gray-400 text-xs mb-5">
                Create an individual profile first, then come back here to generate your newsletter.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { router.push("/individuals/register-ai"); onClose(); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-main text-white text-sm font-semibold rounded-lg hover:bg-brand-dark transition"
                >
                  Create Profile with AI
                </button>
                <button
                  onClick={() => { router.push("/individuals/create"); onClose(); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-brand-main border-2 border-brand-main text-sm font-semibold rounded-lg hover:bg-orange-50 transition"
                >
                  <PlusCircleIcon className="w-4 h-4" />
                  Create Manually
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Select a profile
              </p>
              <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                {profiles.map((profile) => {
                  const id = profile.individualId || profile.code || profile.id;
                  const isSelected = selected === id;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => setSelected(id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition ${
                        isSelected
                          ? "border-brand-main bg-orange-50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {profile.photoURL ? (
                        <img src={profile.photoURL} alt={profile.name} className="w-10 h-10 rounded-full object-cover shrink-0 border border-gray-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                          <UserCircleIcon className="w-6 h-6 text-orange-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{profile.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{id}</p>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-brand-main flex items-center justify-center shrink-0">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleCreate}
                disabled={!selected}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-main text-white text-sm font-semibold rounded-xl hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <NewspaperIcon className="w-4 h-4" />
                Generate Newsletter
                <ArrowRightIcon className="w-4 h-4 ml-1" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
