"use client";
import React, { useEffect, useRef, useState } from "react";

interface MapPreviewProps {
  lat: number;
  lng: number;
  className?: string;
  zoom?: number;
}

// Extend Window interface
declare global {
  interface Window {
    google: any;
    initGoogleMapsPreview?: () => void;
  }
}

// Google Maps JavaScript API preview with map type control
export const MapPreview: React.FC<MapPreviewProps> = ({ lat, lng, className = "", zoom = 13 }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const initializedRef = useRef(false);

  if (isNaN(lat) || isNaN(lng)) return null;
  
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.warn('Google Maps API key not configured');
    return (
      <div className={`rounded overflow-hidden border border-gray-300 bg-gray-50 flex items-center justify-center ${className}`} style={{ height: 220 }}>
        <p className="text-sm text-gray-500">Map unavailable</p>
      </div>
    );
  }

  // Load Google Maps script
  useEffect(() => {
    // Check if script already loaded
    if (window.google && window.google.maps) {
      setIsLoaded(true);
      return;
    }

    // Check if script is already being loaded
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      // Wait for it to load
      const checkLoaded = setInterval(() => {
        if (window.google && window.google.maps) {
          setIsLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 100);
      return () => clearInterval(checkLoaded);
    }

    // No script present — inject it now
    const callbackName = 'initGoogleMapsPreview';
    window[callbackName] = () => setIsLoaded(true);
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      delete window[callbackName];
    };
  }, []);

  // Initialize map when loaded (only once)
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google || initializedRef.current) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat, lng },
      zoom: zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      mapTypeId: mapType,
      disableDefaultUI: false,
    });

    // Add marker at the location
    new window.google.maps.Marker({
      position: { lat, lng },
      map: map,
      title: "Project Location",
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: "#EA580C",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      }
    });

    mapInstanceRef.current = map;
    initializedRef.current = true;

    return () => {
      if (window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(map);
      }
      initializedRef.current = false;
    };
  }, [isLoaded, lat, lng, zoom]);

  // Update map type when changed
  useEffect(() => {
    if (mapInstanceRef.current && window.google) {
      mapInstanceRef.current.setMapTypeId(mapType);
    }
  }, [mapType]);

  if (!isLoaded) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`} style={{ height: 220 }}>
        <div className="text-gray-600 text-sm">Loading map...</div>
      </div>
    );
  }
  
  const link = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  
  return (
    <div className={`rounded overflow-hidden border border-brand-main/40 bg-white ${className}`}>      
      <div className="relative">
        <div ref={mapRef} style={{ height: 220, width: '100%' }} />
        
        {/* Map Type Toggle */}
        <div className="absolute top-2 right-2 bg-white rounded-lg shadow-md overflow-hidden">
          <button
            onClick={() => setMapType('roadmap')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              mapType === 'roadmap'
                ? 'bg-orange-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Map
          </button>
          <button
            onClick={() => setMapType('satellite')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              mapType === 'satellite'
                ? 'bg-orange-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Satellite
          </button>
        </div>
      </div>
      <div className="text-xs px-2 py-1 bg-brand-main/5 text-brand-dark text-right">
        <a href={link} target="_blank" rel="noopener noreferrer" className="underline">Open in Google Maps</a>
      </div>
    </div>
  );
};

export default MapPreview;
