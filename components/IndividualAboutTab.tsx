"use client";
import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../src/lib/firebase";
import { LightBulbIcon, SparklesIcon, PencilIcon, CheckIcon } from "@heroicons/react/24/outline";

interface IndividualAboutTabProps {
  individual: any;
  canEdit?: boolean;
}

export default function IndividualAboutTab({ individual, canEdit = false }: IndividualAboutTabProps) {
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState<any>({});

  const toggleEdit = (section: string) => {
    if (editMode[section]) {
      setEditMode({ ...editMode, [section]: false });
      setEditValues({ ...editValues, [section]: undefined });
    } else {
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
      await updateDoc(doc(db, "individuals", individual.id), { [field]: value || "" });
      setEditMode({ ...editMode, [field]: false });
    } catch (error) {
      console.error("Error saving field:", error);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveFocusAreas = async () => {
    if (!individual?.id) return;
    setSaving(true);
    try {
      const areas = editValues.focusAreas || [];
      await updateDoc(doc(db, "individuals", individual.id), { focusAreas: areas });
      setEditMode({ ...editMode, focusAreas: false });
    } catch (error) {
      console.error("Error saving focus areas:", error);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const focusAreas = individual?.focusAreas || [];
  const [newFocusArea, setNewFocusArea] = useState("");

  return (
    <div className="space-y-6">
      {/* Vision */}
      <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl border border-orange-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <LightBulbIcon className="w-5 h-5 text-brand-main" />
            <h2 className="text-lg font-semibold text-brand-dark">Our Vision</h2>
          </div>
          {canEdit && (
            <button
              onClick={() => (editMode.vision ? saveField("vision") : toggleEdit("vision"))}
              disabled={saving}
              className="p-1.5 text-gray-600 hover:text-brand-main transition"
            >
              {editMode.vision ? <CheckIcon className="w-4 h-4" /> : <PencilIcon className="w-4 h-4" />}
            </button>
          )}
        </div>

        {editMode.vision ? (
          <textarea
            value={editValues.vision || ""}
            onChange={(e) => setEditValues({ ...editValues, vision: e.target.value })}
            placeholder="What is God calling you to do? What change do you hope to see?"
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-main min-h-[120px]"
          />
        ) : (
          <div className="text-gray-700 whitespace-pre-line font-medium">
            {individual?.vision || (canEdit ? "Click the edit icon to share your vision" : "No vision statement yet")}
          </div>
        )}
      </div>

      {/* Focus Areas */}
      <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-brand-main" />
            <h2 className="text-lg font-semibold text-brand-dark">Focus Areas</h2>
          </div>
          {canEdit && (
            <button
              onClick={() => {
                if (editMode.focusAreas) {
                  saveFocusAreas();
                } else {
                  toggleEdit("focusAreas");
                  setEditValues({ ...editValues, focusAreas: [...focusAreas] });
                }
              }}
              disabled={saving}
              className="p-1.5 text-gray-600 hover:text-brand-main transition"
            >
              {editMode.focusAreas ? <CheckIcon className="w-4 h-4" /> : <PencilIcon className="w-4 h-4" />}
            </button>
          )}
        </div>

        {editMode.focusAreas ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newFocusArea}
                onChange={(e) => setNewFocusArea(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && newFocusArea.trim()) {
                    const updated = [...(editValues.focusAreas || []), newFocusArea.trim()];
                    setEditValues({ ...editValues, focusAreas: updated });
                    setNewFocusArea("");
                  }
                }}
                placeholder="e.g., Children's Ministry, Medical Care, Church Planting"
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-brand-main"
              />
              <button
                onClick={() => {
                  if (newFocusArea.trim()) {
                    const updated = [...(editValues.focusAreas || []), newFocusArea.trim()];
                    setEditValues({ ...editValues, focusAreas: updated });
                    setNewFocusArea("");
                  }
                }}
                className="px-4 py-2 bg-brand-main text-white rounded-lg hover:bg-brand-main/90 transition"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {(editValues.focusAreas || []).map((area: string, index: number) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-brand-dark rounded-full text-sm"
                >
                  {area}
                  <button
                    onClick={() => {
                      const updated = editValues.focusAreas.filter((_: any, i: number) => i !== index);
                      setEditValues({ ...editValues, focusAreas: updated });
                    }}
                    className="ml-1 text-gray-600 hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {focusAreas.length === 0 ? (
              <p className="text-gray-500 text-sm">
                {canEdit ? "Click the edit icon to add focus areas" : "No focus areas specified"}
              </p>
            ) : (
              focusAreas.map((area: string, index: number) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1.5 bg-orange-100 text-brand-dark rounded-full text-sm font-medium"
                >
                  {area}
                </span>
              ))
            )}
          </div>
        )}
      </div>

      {/* Ministry Description */}
      <div className="bg-white rounded-xl border border-brand-main/10 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-brand-dark">What We Do</h2>
          {canEdit && (
            <button
              onClick={() => (editMode.ministryDescription ? saveField("ministryDescription") : toggleEdit("ministryDescription"))}
              disabled={saving}
              className="p-1.5 text-gray-600 hover:text-brand-main transition"
            >
              {editMode.ministryDescription ? <CheckIcon className="w-4 h-4" /> : <PencilIcon className="w-4 h-4" />}
            </button>
          )}
        </div>

        {editMode.ministryDescription ? (
          <textarea
            value={editValues.ministryDescription || ""}
            onChange={(e) => setEditValues({ ...editValues, ministryDescription: e.target.value })}
            placeholder="Describe your day-to-day ministry activities and how you serve..."
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-main min-h-[120px]"
          />
        ) : (
          <div className="text-gray-700 whitespace-pre-line">
            {individual?.ministryDescription || (canEdit ? "Click the edit icon to describe your ministry" : "No description available")}
          </div>
        )}
      </div>
    </div>
  );
}
