"use client";
import { useState } from "react";
import { updateIndividual } from '@/lib/dal';
import { MapPinIcon, BuildingOfficeIcon, UserGroupIcon, PencilIcon, CheckIcon } from "@heroicons/react/24/outline";

interface IndividualOverviewTabProps {
  individual: any;
  canEdit?: boolean;
}

export default function IndividualOverviewTab({ individual, canEdit = false }: IndividualOverviewTabProps) {
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState<any>({});

  const toggleEdit = (section: string) => {
    if (editMode[section]) {
      // Cancel edit
      setEditMode({ ...editMode, [section]: false });
      setEditValues({ ...editValues, [section]: undefined });
    } else {
      // Start edit
      setEditMode({ ...editMode, [section]: true });
      const currentValue = individual?.[section] || "";
      setEditValues({ ...editValues, [section]: currentValue });
    }
  };

  const saveField = async (field: string) => {
    if (!individual?.id) return;
    setSaving(true);
    try {
      const value = editValues[field];
      await updateIndividual(individual.id, { [field]: value || "" } as any);
      setEditMode({ ...editMode, [field]: false });
    } catch (error) {
      console.error("Error saving field:", error);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const profileType = individual?.profileType || individual?.type || "missionary";
  const isMissionary = profileType === "missionary" || profileType === "volunteer";
  const isFamily = individual?.isFamily === true;

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Left Column — Our Story */}
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm h-full">
          {/* Name + type badges + Family toggle */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-brand-dark mb-2">{individual?.name || "Unknown"}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {isFamily && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-50 rounded-full text-sm font-medium text-brand-main">
                    <UserGroupIcon className="w-4 h-4" />
                    Family
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
                  {isMissionary ? "Missionary/Volunteer" : profileType}
                </span>
              </div>
            </div>
            {canEdit && (
              <button
                onClick={() => {
                  const newIsFamily = !isFamily;
                  updateIndividual(individual.id, { isFamily: newIsFamily } as any).catch(console.error);
                }}
                className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition shrink-0"
              >
                {isFamily ? "Mark as Individual" : "Mark as Family"}
              </button>
            )}
          </div>

          {/* Bio / Our Story */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Our Story</h3>
            {canEdit && (
              <button
                onClick={() => (editMode.bio ? saveField("bio") : toggleEdit("bio"))}
                disabled={saving}
                className="p-1.5 text-gray-500 hover:text-brand-main transition"
              >
                {editMode.bio ? <CheckIcon className="w-4 h-4" /> : <PencilIcon className="w-4 h-4" />}
              </button>
            )}
          </div>

          {editMode.bio ? (
            <textarea
              rows={6}
              value={editValues.bio || ""}
              onChange={(e) => setEditValues({ ...editValues, bio: e.target.value })}
              placeholder="Share your story, calling, and mission..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-main resize-none"
            />
          ) : (
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
              {individual?.bio || (canEdit ? "Click the edit icon to share your story." : "No story shared yet.")}
            </p>
          )}
        </div>
      </div>

      {/* Right Column — Sidebar Cards (2-col grid on mobile, sidebar on lg+) */}
      <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-col lg:w-72 xl:w-80 lg:shrink-0 lg:gap-4">

        {/* Where We Serve */}
        <div className="bg-white rounded-lg shadow-md p-3 lg:p-6">
          <div className="flex items-center justify-between mb-2 lg:mb-4">
            <h2 className="text-xs lg:text-lg font-bold flex items-center gap-1 lg:gap-2">
              <MapPinIcon className="w-4 h-4 text-orange-600 shrink-0" />
              Where We Serve
            </h2>
            {canEdit && (
              <button
                onClick={() => (editMode.serviceLocation ? saveField("serviceLocation") : toggleEdit("serviceLocation"))}
                disabled={saving}
                className="p-2 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 shadow-sm border border-gray-200"
                title="Edit service location"
              >
                {editMode.serviceLocation ? (
                  <CheckIcon className="w-4 h-4 text-orange-600" />
                ) : (
                  <PencilIcon className="w-4 h-4 text-orange-600" />
                )}
              </button>
            )}
          </div>
          {editMode.serviceLocation ? (
            <input
              type="text"
              value={editValues.serviceLocation || ""}
              onChange={(e) => setEditValues({ ...editValues, serviceLocation: e.target.value })}
              placeholder="e.g., Rural Uganda, Southeast Asia"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-main"
            />
          ) : (
            <p className="text-gray-700 text-sm">
              {individual?.serviceLocation || (canEdit ? "Click edit to add your service location." : "Not specified")}
            </p>
          )}
        </div>

        {/* Organization */}
        <div className="bg-white rounded-lg shadow-md p-3 lg:p-6">
          <div className="flex items-center justify-between mb-2 lg:mb-4">
            <h2 className="text-xs lg:text-lg font-bold flex items-center gap-1 lg:gap-2">
              <BuildingOfficeIcon className="w-4 h-4 text-orange-600 shrink-0" />
              Organization
            </h2>
            {canEdit && (
              <button
                onClick={() => (editMode.organization ? saveField("organization") : toggleEdit("organization"))}
                disabled={saving}
                className="p-2 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50 shadow-sm border border-gray-200"
                title="Edit organization"
              >
                {editMode.organization ? (
                  <CheckIcon className="w-4 h-4 text-orange-600" />
                ) : (
                  <PencilIcon className="w-4 h-4 text-orange-600" />
                )}
              </button>
            )}
          </div>
          {editMode.organization ? (
            <input
              type="text"
              value={editValues.organization || ""}
              onChange={(e) => setEditValues({ ...editValues, organization: e.target.value })}
              placeholder="e.g., Mission Organization, Church Sending Body"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-main"
            />
          ) : (
            <p className="text-gray-700 text-sm">
              {individual?.organization || (canEdit ? "Click edit to add your organization." : "Not specified")}
            </p>
          )}
        </div>

        {/* Quick Stats */}
        {(individual?.yearsInService || individual?.supporters?.length > 0) && (
          <div className="col-span-2 bg-white rounded-lg shadow-md p-3 lg:p-6">
            <div className="grid grid-cols-2 gap-4">
              {individual?.yearsInService && (
                <div className="text-center">
                  <div className="text-2xl lg:text-3xl font-bold text-brand-main">{individual.yearsInService}</div>
                  <div className="text-xs text-gray-600 mt-1">Years in Service</div>
                </div>
              )}
              {individual?.supporters?.length > 0 && (
                <div className="text-center">
                  <div className="text-3xl font-bold text-brand-main">{individual.supporters.length}</div>
                  <div className="text-xs text-gray-600 mt-1">Prayer Partners</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
