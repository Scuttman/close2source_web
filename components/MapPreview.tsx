"use client";
import React from "react";

interface MapPreviewProps {
  lat: number;
  lng: number;
  className?: string;
  zoom?: number; // approximate; OSM embed uses bbox so we'll derive
}

// Lightweight OSM iframe preview without extra dependencies
export const MapPreview: React.FC<MapPreviewProps> = ({ lat, lng, className = "", zoom = 13 }) => {
  if (isNaN(lat) || isNaN(lng)) return null;
  // Derive a small bbox around the point; adjust span based on rough zoom scale
  // Smaller span for higher zoom
  const span = zoom >= 13 ? 0.02 : 0.05;
  const minLat = lat - span;
  const maxLat = lat + span;
  const minLng = lng - span;
  const maxLng = lng + span;
  const bbox = `${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}`;
  const marker = `${lat}%2C${lng}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
  const link = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
  return (
    <div className={`rounded overflow-hidden border border-brand-main/40 bg-white ${className}`}>      
      <iframe
        title="Location Map"
        src={src}
        className="w-full" 
        style={{ height: 220 }}
        loading="lazy"
      />
      <div className="text-xs px-2 py-1 bg-brand-main/5 text-brand-dark text-right">
        <a href={link} target="_blank" rel="noopener noreferrer" className="underline">Open full map</a>
      </div>
    </div>
  );
};

export default MapPreview;
