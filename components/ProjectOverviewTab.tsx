"use client";
import { useEffect, useState } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../src/lib/firebase';
import { improveTextWithAI } from '../src/lib/ai';
import { logCreditTransaction } from '../src/lib/credits';
import MapPreview from './MapPreview';

interface ProjectOverviewTabProps {
  project: any;
  projectId: string;
  setProject: React.Dispatch<React.SetStateAction<any>>;
  isProjectCreator: boolean;
  currentUser: any; // Firebase User | null
}

export default function ProjectOverviewTab({ project, projectId, setProject, isProjectCreator, currentUser }: ProjectOverviewTabProps) {
  const [desc, setDesc] = useState(project?.description || '');
  const [improving, setImproving] = useState(false);
  const [showLocationEditor, setShowLocationEditor] = useState(false);
  const [locCountry, setLocCountry] = useState('');
  const [locTown, setLocTown] = useState('');
  const [locLat, setLocLat] = useState('');
  const [locLng, setLocLng] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [geoParams, setGeoParams] = useState<{ lat:number; lng:number; zoom:number }|null>(null);

  useEffect(()=>{ setDesc(project?.description || ''); }, [project?.description]);

  function getMapParams(loc: any): { lat: number; lng: number; zoom: number } | null {
    if (!loc) return null;
    const hasCoords = typeof loc.latitude === 'number' && typeof loc.longitude === 'number';
    if (hasCoords) return { lat: loc.latitude, lng: loc.longitude, zoom: 13 };
    const countryCenters: Record<string, { lat: number; lng: number; zoom: number }> = {
      kenya: { lat: -0.0236, lng: 37.9062, zoom: 5 },
      uganda: { lat: 1.3733, lng: 32.2903, zoom: 5 },
      tanzania: { lat: -6.3690, lng: 34.8888, zoom: 5 },
      ghana: { lat: 7.9465, lng: -1.0232, zoom: 5 },
      nigeria: { lat: 9.0820, lng: 8.6753, zoom: 5 },
      rwanda: { lat: -1.9403, lng: 29.8739, zoom: 6 },
      ethiopia: { lat: 9.145, lng: 40.4897, zoom: 5 },
      malawi: { lat: -13.2543, lng: 34.3015, zoom: 6 },
      "united kingdom": { lat: 54.8, lng: -4.6, zoom: 5 },
      uk: { lat: 54.8, lng: -4.6, zoom: 5 },
      england: { lat: 52.3555, lng: -1.1743, zoom: 6 },
    };
    const countryKey = (loc.country || '').toLowerCase();
    if (countryKey && countryCenters[countryKey]) {
      const base = countryCenters[countryKey];
      const hasTown = !!loc.town;
      const townKey = (loc.town || '').toLowerCase();
      const townCenters: Record<string, { lat: number; lng: number; zoom: number }> = {
        blantyre: { lat: -15.7861, lng: 35.0058, zoom: 11 },
        chichester: { lat: 50.8367, lng: -0.7792, zoom: 12 },
      };
      if (townKey && townCenters[townKey]) return townCenters[townKey];
      return { lat: base.lat, lng: base.lng, zoom: hasTown ? Math.min(base.zoom + 1, 8) : base.zoom };
    }
    return null;
  }
  const mapParams = project ? getMapParams(project.location) : null;

  useEffect(()=>{
    if(!project) return;
    const loc = project.location;
    if(!loc) return;
    if(mapParams) { setGeoParams(null); return; }
    if(!(loc.country || loc.town)) return;
    const q = [loc.town, loc.country].filter(Boolean).join(', ');
    let aborted = false;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language':'en' } })
      .then(r=>r.json())
      .then(d=>{
        if(aborted) return;
        if(Array.isArray(d) && d[0]){
          const lat = parseFloat(d[0].lat); const lng = parseFloat(d[0].lon);
          if(!isNaN(lat) && !isNaN(lng)) setGeoParams({ lat, lng, zoom: loc.town? 12 : 5 });
        }
      })
      .catch(()=>{});
    return ()=>{aborted = true};
  },[project?.location, mapParams]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <div className="bg-white rounded-xl border border-brand-main/10 p-5 shadow-sm">
            <div className="mb-3">
              <label className="block text-xs font-semibold text-brand-main mb-1">Description</label>
              <textarea className="w-full border rounded px-3 py-2 text-brand-dark min-h-[80px]" value={desc} onChange={e=>setDesc(e.target.value)} disabled={improving} />
              <button className="mt-2 px-4 py-2 bg-brand-main text-white rounded hover:bg-brand-dark disabled:opacity-50" disabled={improving} onClick={async()=>{
                setImproving(true);
                try {
                  const improved = await improveTextWithAI(desc);
                  setDesc(improved);
                  await updateDoc(doc(db,'projects', projectId), { description: improved });
                  setProject((prev:any)=> ({ ...prev, description: improved }));
                  if(currentUser){
                    const userId = currentUser.uid;
                    const userRef = doc(db,'users', userId);
                    const userSnap = await getDoc(userRef);
                    const currentCredits = userSnap.exists()? userSnap.data().credits ?? 0 : 0;
                    if(currentCredits < 2) throw new Error('Not enough credits');
                    await updateDoc(userRef,{ credits: currentCredits - 2 });
                    await logCreditTransaction(userId,'spend',2,`AI improved project description for ${projectId}`);
                  }
                } catch(e:any){ alert(e.message || 'Failed to improve description'); }
                finally { setImproving(false); }
              }}>{improving? 'Improving...' : 'Improve with AI (-2 Credits)'}</button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 text-sm text-brand-dark">
              <div><span className="font-semibold">Project Code:</span> <span className="font-mono bg-gray-100 px-2 py-1 rounded">{project.projectId}</span></div>
              <div><span className="font-semibold">Created by:</span> {project.createdBy}</div>
            </div>
            {project.location && (
              <div className="mt-4 text-sm space-y-1">
                <div><span className="font-semibold">Location:</span> {project.location.town || project.location.country ? `${project.location.town ? project.location.town + ', ' : ''}${project.location.country || ''}` : <em className="text-gray-400">(not set)</em>}</div>
                {(project.location.latitude || project.location.longitude) && (
                  <div><span className="font-semibold">GPS:</span> {project.location.latitude ?? '?'} , {project.location.longitude ?? '?'}</div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4 w-full lg:w-80">
          {project.coverPhotoUrl && (
            <img src={project.coverPhotoUrl} alt={project.name} className="w-full aspect-square object-cover rounded-xl border border-brand-main/20 shadow-sm" />
          )}
          {project.location && (project.location.latitude || project.location.longitude) && (
            <MapPreview lat={project.location.latitude} lng={project.location.longitude} className="w-full" />
          )}
        </div>
      </div>
      <div>
        {(mapParams || geoParams) ? (
          <div className="bg-white rounded-xl border border-brand-main/10 p-5 shadow-sm inline-block">
            <h2 className="text-lg font-semibold text-brand-main mb-2">Project Location Map</h2>
            <MapPreview lat={(mapParams||geoParams)!.lat} lng={(mapParams||geoParams)!.lng} zoom={(mapParams||geoParams)!.zoom} className="w-full max-w-md" />
            {(!project.location?.latitude && !project.location?.longitude) && (
              <p className="text-xs text-gray-500 mt-2">Approximate location (no precise GPS pin set{geoParams && !mapParams ? '; geocoded' : ''}).</p>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-dashed border-brand-main/40 bg-brand-main/5 text-sm text-gray-600 max-w-md space-y-3">
            <div>
              <div className="font-semibold text-brand-main mb-1">Location not set</div>
              {project.location && (project.location.country || project.location.town) ? (
                <p>A location is partially specified ({project.location.town ? `${project.location.town}, `: ''}{project.location.country || ''}) but we can't show a map yet. Add GPS coordinates or a supported country to enable the map.</p>
              ) : (
                <p>Add a country / town and optional GPS coordinates to show a project map.</p>
              )}
            </div>
            {isProjectCreator && !showLocationEditor && (
              <button
                type="button"
                onClick={() => {
                  setShowLocationEditor(true);
                  const existing = project.location || {};
                  setLocCountry(existing.country || "");
                  setLocTown(existing.town || "");
                  setLocLat(existing.latitude != null ? String(existing.latitude) : "");
                  setLocLng(existing.longitude != null ? String(existing.longitude) : "");
                }}
                className="px-3 py-2 rounded bg-brand-main text-white font-semibold text-xs hover:bg-brand-dark"
              >Add Location</button>
            )}
            {isProjectCreator && showLocationEditor && (
              <form
                onSubmit={async e => {
                  e.preventDefault();
                  setLocationError("");
                  setSavingLocation(true);
                  try {
                    const country = locCountry.trim();
                    const town = locTown.trim();
                    if (!country && !town) throw new Error('Enter at least a country or town');
                    const newLoc: any = { country: country || undefined, town: town || undefined };
                    if (locLat.trim()) {
                      const v = parseFloat(locLat);
                      if (isNaN(v) || v < -90 || v > 90) throw new Error('Latitude must be between -90 and 90');
                      newLoc.latitude = v;
                    }
                    if (locLng.trim()) {
                      const v2 = parseFloat(locLng);
                      if (isNaN(v2) || v2 < -180 || v2 > 180) throw new Error('Longitude must be between -180 and 180');
                      newLoc.longitude = v2;
                    }
                    await updateDoc(doc(db, 'projects', projectId), { location: newLoc });
                    setProject((prev: any) => ({ ...prev, location: newLoc }));
                    setShowLocationEditor(false);
                  } catch (err: any) {
                    setLocationError(err.message || 'Failed to save location');
                  } finally {
                    setSavingLocation(false);
                  }
                }}
                className="space-y-3 bg-white/60 p-3 rounded border border-brand-main/20"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-semibold text-brand-main mb-1">Country</label>
                    <input value={locCountry} onChange={e=>setLocCountry(e.target.value)} placeholder="e.g. Malawi" className="w-full border rounded px-2 py-1 text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-semibold text-brand-main mb-1">Town</label>
                    <input value={locTown} onChange={e=>setLocTown(e.target.value)} placeholder="e.g. Blantyre" className="w-full border rounded px-2 py-1 text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-semibold text-brand-main mb-1">Latitude (optional)</label>
                    <input value={locLat} onChange={e=>setLocLat(e.target.value)} placeholder="-15.7861" className="w-full border rounded px-2 py-1 text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide font-semibold text-brand-main mb-1">Longitude (optional)</label>
                    <input value={locLng} onChange={e=>setLocLng(e.target.value)} placeholder="35.0058" className="w-full border rounded px-2 py-1 text-xs" />
                  </div>
                </div>
                {locationError && <div className="text-xs text-red-600">{locationError}</div>}
                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={savingLocation} className="px-3 py-1.5 rounded bg-brand-main text-white text-xs font-semibold disabled:opacity-50">{savingLocation? 'Saving...' : 'Save Location'}</button>
                  <button type="button" disabled={savingLocation} onClick={()=> setShowLocationEditor(false)} className="px-3 py-1.5 rounded bg-gray-200 text-gray-700 text-xs font-semibold">Cancel</button>
                </div>
                <p className="text-[10px] text-gray-500">Enter coordinates for precise map pin; otherwise country/town gives approximate map.</p>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
