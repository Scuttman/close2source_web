"use client";
import { useState } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../src/lib/firebase';
import { MapPinIcon, PlusIcon, PencilIcon, TrashIcon, XMarkIcon, CheckIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

export interface OrgLocation {
  id: string;
  name: string;
  town?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  zoom?: number;
  description?: string;
  vision?: string;
  whatWeDo?: string;
}

interface Props {
  org: any;
  isOwner: boolean;
}

const emptyForm = (): Omit<OrgLocation, 'id'> => ({
  name: '',
  town: '',
  country: '',
  latitude: undefined,
  longitude: undefined,
  zoom: 13,
  description: '',
  vision: '',
  whatWeDo: '',
});

function nanoid8() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function LocationCard({
  loc,
  canEdit,
  onEdit,
  onDelete,
}: {
  loc: OrgLocation;
  canEdit: boolean;
  onEdit: (loc: OrgLocation) => void;
  onDelete: (loc: OrgLocation) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <MapPinIcon className="w-5 h-5 text-orange-600" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{loc.name}</p>
            {(loc.town || loc.country) && (
              <p className="text-xs text-gray-500 mt-0.5">
                {[loc.town, loc.country].filter(Boolean).join(', ')}
              </p>
            )}
            {loc.vision && (
              <p className="text-xs text-orange-700 mt-1 line-clamp-1 italic">Vision: {loc.vision}</p>
            )}
            {loc.whatWeDo && (
              <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{loc.whatWeDo}</p>
            )}
            {loc.description && (
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{loc.description}</p>
            )}
            {loc.latitude !== undefined && loc.longitude !== undefined && (
              <p className="text-[10px] text-gray-400 mt-1 font-mono">
                {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
              </p>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => onEdit(loc)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              title="Edit location"
            >
              <PencilIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(loc)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
              title="Delete location"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface FormState extends Omit<OrgLocation, 'id'> {
  id?: string;
}

export default function OrgLocationsTab({ org, isOwner }: Props) {
  const locations: OrgLocation[] = Array.isArray(org?.locations) ? org.locations : [];

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm());
    setGeocodeError('');
    setSearchInput('');
    setError('');
    setShowForm(true);
  }

  function openEdit(loc: OrgLocation) {
    setEditingId(loc.id);
    setForm({ ...loc });
    setGeocodeError('');
    setSearchInput('');
    setError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setError('');
    setGeocodeError('');
    setSearchInput('');
  }

  async function geocode(address: string) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) { setGeocodeError('Google Maps API key not configured'); return; }
    setGeocoding(true);
    setGeocodeError('');
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      );
      const data = await res.json();
      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        const { lat, lng } = result.geometry.location;
        let newTown = form.town || '';
        let newCountry = form.country || '';
        result.address_components.forEach((c: any) => {
          if (c.types.includes('locality') || c.types.includes('administrative_area_level_2')) newTown = c.long_name;
          if (c.types.includes('country')) newCountry = c.long_name;
        });
        setForm(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          zoom: 13,
          town: newTown,
          country: newCountry,
          name: prev.name || result.formatted_address.split(',')[0],
        }));
      } else {
        setGeocodeError('Location not found. Try a more specific address.');
      }
    } catch {
      setGeocodeError('Geocoding failed. Please try again.');
    } finally {
      setGeocoding(false);
    }
  }

  async function handleSave() {
    if (!form.name?.trim()) { setError('Location name is required.'); return; }
    if (!org?.id) return;
    setSaving(true);
    setError('');
    try {
      const orgRef = doc(db, 'organizations', org.id);
      if (editingId) {
        // Replace old entry with updated one
        const oldEntry = locations.find(l => l.id === editingId);
        if (oldEntry) await updateDoc(orgRef, { locations: arrayRemove(oldEntry) });
        const updated: OrgLocation = {
          id: editingId,
          name: form.name!.trim(),
          town: form.town?.trim() || undefined,
          country: form.country?.trim() || undefined,
          latitude: form.latitude !== undefined ? Number(form.latitude) : undefined,
          longitude: form.longitude !== undefined ? Number(form.longitude) : undefined,
          zoom: form.zoom ?? 13,
          description: form.description?.trim() || undefined,
          vision: form.vision?.trim() || undefined,
          whatWeDo: form.whatWeDo?.trim() || undefined,
        };
        // Remove undefined keys for Firestore
        const clean: any = Object.fromEntries(Object.entries(updated).filter(([, v]) => v !== undefined));
        await updateDoc(orgRef, { locations: arrayUnion(clean) });
      } else {
        const newLoc: OrgLocation = {
          id: nanoid8(),
          name: form.name!.trim(),
          town: form.town?.trim() || undefined,
          country: form.country?.trim() || undefined,
          latitude: form.latitude !== undefined ? Number(form.latitude) : undefined,
          longitude: form.longitude !== undefined ? Number(form.longitude) : undefined,
          zoom: form.zoom ?? 13,
          description: form.description?.trim() || undefined,
          vision: form.vision?.trim() || undefined,
          whatWeDo: form.whatWeDo?.trim() || undefined,
        };
        const clean: any = Object.fromEntries(Object.entries(newLoc).filter(([, v]) => v !== undefined));
        await updateDoc(orgRef, { locations: arrayUnion(clean) });
      }
      closeForm();
    } catch (e: any) {
      setError(e.message || 'Failed to save location.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(loc: OrgLocation) {
    if (!org?.id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'organizations', org.id), { locations: arrayRemove(loc) });
      setDeleteConfirm(null);
    } catch (e: any) {
      alert('Failed to delete: ' + (e.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <MapPinIcon className="w-5 h-5 text-orange-600" />
            Locations
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage the locations associated with this organisation. These can be selected when setting up project profiles.
          </p>
        </div>
        {isOwner && !showForm && (
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Location
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && isOwner && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800 text-sm">
              {editingId ? 'Edit Location' : 'New Location'}
            </h3>
            <button onClick={closeForm} className="p-1 rounded hover:bg-orange-100 text-gray-500">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Search / Geocode */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Search by address or place name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (searchInput.trim()) geocode(searchInput); }}}
                placeholder="e.g., Nairobi, Kenya"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none bg-white"
              />
              <button
                type="button"
                onClick={() => { if (searchInput.trim()) geocode(searchInput); }}
                disabled={geocoding || !searchInput.trim()}
                className="px-3 py-2 rounded-lg bg-white border border-orange-300 text-orange-700 text-sm font-medium hover:bg-orange-50 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                <GlobeAltIcon className="w-4 h-4" />
                {geocoding ? 'Searching…' : 'Geocode'}
              </button>
            </div>
            {geocodeError && <p className="text-xs text-red-600 mt-1">{geocodeError}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Location Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.name || ''}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Community Centre Blantyre"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none bg-white"
              />
            </div>
            {/* Town */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Town / City</label>
              <input
                type="text"
                value={form.town || ''}
                onChange={e => setForm(prev => ({ ...prev, town: e.target.value }))}
                placeholder="e.g., Blantyre"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none bg-white"
              />
            </div>
            {/* Country */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Country</label>
              <input
                type="text"
                value={form.country || ''}
                onChange={e => setForm(prev => ({ ...prev, country: e.target.value }))}
                placeholder="e.g., Malawi"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none bg-white"
              />
            </div>
            {/* Lat */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Latitude</label>
              <input
                type="number"
                value={form.latitude ?? ''}
                onChange={e => setForm(prev => ({ ...prev, latitude: e.target.value ? parseFloat(e.target.value) : undefined }))}
                placeholder="-13.9669"
                step="any"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none bg-white font-mono"
              />
            </div>
            {/* Lng */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Longitude</label>
              <input
                type="number"
                value={form.longitude ?? ''}
                onChange={e => setForm(prev => ({ ...prev, longitude: e.target.value ? parseFloat(e.target.value) : undefined }))}
                placeholder="33.7872"
                step="any"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none bg-white font-mono"
              />
            </div>
            {/* Vision */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Vision <span className="text-gray-400">(shown at top of project proposals)</span></label>
              <textarea
                value={form.vision || ''}
                onChange={e => setForm(prev => ({ ...prev, vision: e.target.value }))}
                placeholder="What does this location's work ultimately aim to achieve?"
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none bg-white resize-none"
              />
            </div>
            {/* What We Do */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">What We Do <span className="text-gray-400">(shown at top of project proposals)</span></label>
              <textarea
                value={form.whatWeDo || ''}
                onChange={e => setForm(prev => ({ ...prev, whatWeDo: e.target.value }))}
                placeholder="Describe the activities and work carried out at this location…"
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none bg-white resize-none"
              />
            </div>
            {/* Description */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Internal Notes (optional)</label>
              <textarea
                value={form.description || ''}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief internal notes about this location…"
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:outline-none bg-white resize-none"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={closeForm}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.name?.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              <CheckIcon className="w-4 h-4" />
              {saving ? 'Saving…' : editingId ? 'Update' : 'Add Location'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {locations.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {locations.map(loc => (
            <LocationCard
              key={loc.id}
              loc={loc}
              canEdit={isOwner}
              onEdit={openEdit}
              onDelete={loc => setDeleteConfirm(loc.id)}
            />
          ))}
        </div>
      ) : (
        !showForm && (
          <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <MapPinIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No locations added yet</p>
            {isOwner && (
              <p className="text-sm text-gray-400 mt-1">
                Add locations to make them available when registering projects.
              </p>
            )}
            {isOwner && (
              <button
                onClick={openAdd}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors mx-auto"
              >
                <PlusIcon className="w-4 h-4" />
                Add First Location
              </button>
            )}
          </div>
        )
      )}

      {/* Delete confirm overlay */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-gray-900 mb-2">Delete Location?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will remove the location from the organisation. Existing projects using it are not affected.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const loc = locations.find(l => l.id === deleteConfirm);
                  if (loc) handleDelete(loc);
                }}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
