"use client";
import { useState } from 'react';
import InteractiveMapPicker from './InteractiveMapPicker';
import AITextarea from './AITextarea';
import { MapPinIcon, XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import type { OrgLocation } from './OrgLocationsTab';

export interface LocationEditorValues {
  locationId?: string;
  locationName?: string;
  locationDescription?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    zoom?: number;
    town?: string;
    country?: string;
    name?: string;
  };
}

interface Props {
  initial: LocationEditorValues;
  saving: boolean;
  onSave: (vals: LocationEditorValues) => void;
  onClose: () => void;
  /** Organisation locations available to pick from */
  orgLocations?: OrgLocation[];
}

export default function LocationEditorModal({ initial, saving, onSave, onClose, orgLocations = [] }: Props) {
  const [selectedLocationId, setSelectedLocationId] = useState(initial.locationId ?? '');
  const [locationName, setLocationName] = useState(initial.locationName ?? '');
  const [locationDescription, setLocationDescription] = useState(initial.locationDescription ?? '');

  // Map lat/lng as actual numbers (drive the map position)
  const [mapLat, setMapLat] = useState<number | null>(initial.location?.latitude ?? null);
  const [mapLng, setMapLng] = useState<number | null>(initial.location?.longitude ?? null);
  const [zoom, setZoom] = useState(initial.location?.zoom ?? 13);

  // Separate string state for the text inputs — clearing these does NOT hide the map
  const [latStr, setLatStr] = useState(initial.location?.latitude?.toString() ?? '');
  const [lngStr, setLngStr] = useState(initial.location?.longitude?.toString() ?? '');

  const [town, setTown] = useState(initial.location?.town ?? '');
  const [country, setCountry] = useState(initial.location?.country ?? '');
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');

  const mapVisible = mapLat !== null && mapLng !== null;

  async function geocode(address: string) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) { setGeocodeError('Google Maps API key not configured'); return; }
    setGeocoding(true);
    setGeocodeError(null);
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      );
      const data = await res.json();
      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        const { lat, lng } = result.geometry.location;
        let newTown = town;
        let newCountry = country;
        result.address_components.forEach((c: any) => {
          if (c.types.includes('locality') || c.types.includes('administrative_area_level_2')) newTown = c.long_name;
          if (c.types.includes('country')) newCountry = c.long_name;
        });
        setMapLat(lat);
        setMapLng(lng);
        setLatStr(lat.toFixed(6));
        setLngStr(lng.toFixed(6));
        setTown(newTown);
        setCountry(newCountry);
      } else {
        setGeocodeError('Location not found. Try a more specific address.');
      }
    } catch {
      setGeocodeError('Geocoding failed. Please try again.');
    } finally {
      setGeocoding(false);
    }
  }

  function handleLatChange(v: string) {
    setLatStr(v);
    const n = parseFloat(v);
    // Only update the map position when the value is a valid number — clears/partials leave map in place
    if (!isNaN(n) && n >= -90 && n <= 90) setMapLat(n);
  }

  function handleLngChange(v: string) {
    setLngStr(v);
    const n = parseFloat(v);
    if (!isNaN(n) && n >= -180 && n <= 180) setMapLng(n);
  }

  function handleSave() {
    const loc = mapVisible
      ? { latitude: mapLat!, longitude: mapLng!, zoom, town: town || undefined, country: country || undefined }
      : town || country
        ? { town: town || undefined, country: country || undefined }
        : undefined;
    onSave({
      locationId: selectedLocationId || undefined,
      locationName: locationName || undefined,
      locationDescription: locationDescription || undefined,
      location: loc,
    });
  }

  /** When user picks an org location, pre-fill the form fields from it */
  function applyOrgLocation(loc: OrgLocation) {
    setSelectedLocationId(loc.id);
    setLocationName(loc.name);
    if (loc.town) setTown(loc.town);
    if (loc.country) setCountry(loc.country);
    if (loc.latitude !== undefined && loc.longitude !== undefined) {
      setMapLat(loc.latitude);
      setMapLng(loc.longitude);
      setLatStr(loc.latitude.toFixed(6));
      setLngStr(loc.longitude.toFixed(6));
      if (loc.zoom) setZoom(loc.zoom);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white" style={{ overscrollBehavior: 'contain' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white flex-shrink-0 shadow-sm">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <MapPinIcon className="w-5 h-5 text-orange-600" />
          Edit Location
        </h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6 space-y-6">

          {/* Org Locations Picker — only shown when the org has saved locations */}
          {orgLocations.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <MapPinIcon className="w-4 h-4 text-orange-600" />
                Select from Organisation Locations
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {orgLocations.map(loc => {
                  const active = selectedLocationId === loc.id;
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => applyOrgLocation(loc)}
                      className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all ${
                        active
                          ? 'bg-orange-600 text-white border-orange-600 shadow-md'
                          : 'bg-white border-gray-200 hover:border-orange-400 hover:bg-orange-50'
                      }`}
                    >
                      <MapPinIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${active ? 'text-white' : 'text-orange-500'}`} />
                      <div className="min-w-0">
                        <p className={`text-sm font-medium truncate ${active ? 'text-white' : 'text-gray-900'}`}>{loc.name}</p>
                        {(loc.town || loc.country) && (
                          <p className={`text-xs truncate ${active ? 'text-orange-200' : 'text-gray-500'}`}>
                            {[loc.town, loc.country].filter(Boolean).join(', ')}
                          </p>
                        )}
                        {active && (
                          <span className="flex items-center gap-0.5 text-[10px] text-orange-200 mt-0.5">
                            <CheckCircleIcon className="w-3 h-3" /> Selected
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
                {/* Custom / manual option */}
                <button
                  type="button"
                  onClick={() => { setSelectedLocationId(''); setLocationName(''); setTown(''); setCountry(''); setMapLat(null); setMapLng(null); setLatStr(''); setLngStr(''); }}
                  className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all ${
                    selectedLocationId === ''
                      ? 'bg-gray-700 text-white border-gray-700'
                      : 'bg-white border-gray-200 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <XMarkIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${selectedLocationId === '' ? 'text-white' : 'text-gray-400'}`} />
                  <p className={`text-sm font-medium ${selectedLocationId === '' ? 'text-white' : 'text-gray-600'}`}>Custom / Manual</p>
                </button>
              </div>
              {selectedLocationId && (() => {
                const sel = orgLocations.find(l => l.id === selectedLocationId);
                return sel && (sel.vision || sel.whatWeDo) ? (
                  <div className="mt-3 pt-3 border-t border-orange-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {sel.vision && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-700 mb-0.5">Vision</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{sel.vision}</p>
                      </div>
                    )}
                    {sel.whatWeDo && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-700 mb-0.5">What We Do</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{sel.whatWeDo}</p>
                      </div>
                    )}
                  </div>
                ) : null;
              })()}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left column — map + GPS */}
          <div className="flex flex-col gap-4">
            {/* Place search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search by Place Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && searchInput.trim()) geocode(searchInput); }}
                  placeholder="e.g., Nairobi, Kenya or specific address…"
                  className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                />
                <button
                  type="button"
                  onClick={() => { if (searchInput.trim()) geocode(searchInput); }}
                  disabled={geocoding}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap transition-colors"
                >
                  {geocoding ? 'Searching…' : 'Search'}
                </button>
              </div>
              {geocodeError && <p className="text-sm text-red-600 mt-1">{geocodeError}</p>}
            </div>

            {/* Map or placeholder */}
            {mapVisible ? (
              <div style={{ minHeight: 420 }}>
                <InteractiveMapPicker
                  lat={mapLat!}
                  lng={mapLng!}
                  zoom={zoom}
                  onLocationChange={(lat, lng) => {
                    setMapLat(lat);
                    setMapLng(lng);
                    setLatStr(lat.toFixed(6));
                    setLngStr(lng.toFixed(6));
                  }}
                  onZoomChange={setZoom}
                  className="w-full h-full rounded-lg overflow-hidden"
                />
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-10 flex flex-col items-center justify-center gap-4 text-center"
                style={{ minHeight: 320 }}
              >
                <MapPinIcon className="w-12 h-12 text-gray-300" />
                <p className="text-gray-500 text-sm">Search for a place above or enter GPS coordinates below</p>
                <button
                  type="button"
                  onClick={() => {
                    setMapLat(-1.2921);
                    setMapLng(36.8219);
                    setLatStr('-1.292100');
                    setLngStr('36.821900');
                  }}
                  className="px-5 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
                >
                  Load Map
                </button>
              </div>
            )}

            {/* Manual GPS inputs — always visible, clearing them does NOT hide the map */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={latStr}
                  onChange={e => handleLatChange(e.target.value)}
                  placeholder="-1.2921"
                  className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={lngStr}
                  onChange={e => handleLngChange(e.target.value)}
                  placeholder="36.8219"
                  className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Right column — text fields */}
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location Name</label>
              <input
                type="text"
                value={locationName}
                onChange={e => setLocationName(e.target.value)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="e.g., Community Centre, Main Office…"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <AITextarea
                value={locationDescription}
                onChange={setLocationDescription}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500"
                placeholder="Describe this location…"
                rows={6}
                aiContext="a project location description"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Town / City</label>
                <input
                  type="text"
                  value={town}
                  onChange={e => setTown(e.target.value)}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g., Nairobi"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g., Kenya"
                />
              </div>
            </div>
          </div>

        </div>
        </div>
      </div>
    </div>
  );
}
