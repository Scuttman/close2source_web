"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";

interface InteractiveMapPickerProps {
  lat: number;
  lng: number;
  zoom?: number;
  onLocationChange: (lat: number, lng: number) => void;
  onZoomChange?: (zoom: number) => void;
  className?: string;
}

// Extend Window interface to include google
declare global {
  interface Window {
    google: any;
    initGoogleMaps?: () => void;
  }
}

export const InteractiveMapPicker: React.FC<InteractiveMapPickerProps> = ({
  lat,
  lng,
  zoom = 13,
  onLocationChange,
  onZoomChange,
  className = ""
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentCoords, setCurrentCoords] = useState({ lat, lng });
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isUserInteractionRef = useRef(false);
  const initializedRef = useRef(false);

  // Load Google Maps script
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Google Maps API key not configured');
      return;
    }

    // Check if script already loaded
    if (window.google && window.google.maps) {
      setIsLoaded(true);
      return;
    }

    // Check if script is already being loaded
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      // Wait for it to load
      window.initGoogleMaps = () => {
        setIsLoaded(true);
      };
      return;
    }

    // Load the script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    
    window.initGoogleMaps = () => {
      setIsLoaded(true);
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup callback
      delete window.initGoogleMaps;
    };
  }, []);

  // Initialize map when loaded (only once)
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google || initializedRef.current) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat, lng },
      zoom: zoom,
      mapTypeControl: false, // We'll use custom control
      streetViewControl: false,
      fullscreenControl: false,
      mapTypeId: mapType,
    });

    mapInstanceRef.current = map;
    initializedRef.current = true;

    // Update coordinates when map moves
    const handleCenterChanged = () => {
      const center = map.getCenter();
      if (center) {
        const newLat = center.lat();
        const newLng = center.lng();
        setCurrentCoords({ lat: newLat, lng: newLng });
        
        // Mark as user interaction
        isUserInteractionRef.current = true;
        onLocationChange(newLat, newLng);
        
        // Reset flag after a short delay
        setTimeout(() => {
          isUserInteractionRef.current = false;
        }, 100);
      }
    };

    // Update zoom level when changed
    const handleZoomChanged = () => {
      const newZoom = map.getZoom();
      if (newZoom !== undefined) {
        setCurrentZoom(newZoom);
        if (onZoomChange) {
          onZoomChange(newZoom);
        }
      }
    };

    // Listen for center changes (after user stops dragging)
    map.addListener('idle', handleCenterChanged);
    map.addListener('zoom_changed', handleZoomChanged);

    return () => {
      if (window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(map);
      }
      initializedRef.current = false;
    };
  }, [isLoaded]); // Only depend on isLoaded

  // Update map center when props change externally (not from user interaction)
  useEffect(() => {
    if (mapInstanceRef.current && window.google && !isUserInteractionRef.current) {
      const currentCenter = mapInstanceRef.current.getCenter();
      if (currentCenter) {
        const currentLat = currentCenter.lat();
        const currentLng = currentCenter.lng();
        
        // Only update if the coordinates have actually changed significantly
        const latDiff = Math.abs(currentLat - lat);
        const lngDiff = Math.abs(currentLng - lng);
        
        if (latDiff > 0.00001 || lngDiff > 0.00001) {
          mapInstanceRef.current.setCenter({ lat, lng });
          setCurrentCoords({ lat, lng });
        }
      }
    }
  }, [lat, lng]);

  // Update map type when changed
  useEffect(() => {
    if (mapInstanceRef.current && window.google) {
      mapInstanceRef.current.setMapTypeId(mapType);
    }
  }, [mapType]);

  if (!isLoaded) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`} style={{ height: 400 }}>
        <div className="text-gray-600">Loading map...</div>
      </div>
    );
  }

  return (
    <div className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-white' : className}`}>
      {/* Map Container */}
      <div ref={mapRef} style={{ height: isFullscreen ? '100vh' : 400, width: '100%' }} className="rounded-lg" />
      
      {/* Center Pin Overlay */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-lg"
          style={{ marginTop: -40 }}
        >
          <path
            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
            fill="#EA580C"
            stroke="white"
            strokeWidth="1"
          />
        </svg>
      </div>

      {/* Coordinates Display */}
      <div className="absolute bottom-4 left-4 bg-white px-3 py-2 rounded-lg shadow-md text-sm font-mono space-y-1">
        <div className="text-gray-600">
          <span className="font-semibold">Lat:</span> {currentCoords.lat.toFixed(6)}
        </div>
        <div className="text-gray-600">
          <span className="font-semibold">Lng:</span> {currentCoords.lng.toFixed(6)}
        </div>
        <div className="text-gray-600">
          <span className="font-semibold">Zoom:</span> {currentZoom}
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-4 left-4 bg-orange-600 text-white px-3 py-2 rounded-lg shadow-md text-sm max-w-xs">
        <p className="font-medium">🗺️ Drag map to position pin over location</p>
      </div>

      {/* Fullscreen Button */}
      <div className="absolute bottom-4 right-4">
        <button
          onClick={() => {
            setIsFullscreen(!isFullscreen);
            // Re-center map after fullscreen toggle
            setTimeout(() => {
              if (mapInstanceRef.current && window.google) {
                window.google.maps.event.trigger(mapInstanceRef.current, 'resize');
                mapInstanceRef.current.setCenter({ lat: currentCoords.lat, lng: currentCoords.lng });
              }
            }, 100);
          }}
          className="bg-white hover:bg-gray-100 text-gray-700 p-3 rounded-lg shadow-md transition-colors"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>
      </div>

      {/* Map Type Toggle */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md overflow-hidden">
        <button
          onClick={() => setMapType('roadmap')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            mapType === 'roadmap'
              ? 'bg-orange-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          Map
        </button>
        <button
          onClick={() => setMapType('satellite')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            mapType === 'satellite'
              ? 'bg-orange-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100'
          }`}
        >
          Satellite
        </button>
      </div>
    </div>
  );
};

export default InteractiveMapPicker;
