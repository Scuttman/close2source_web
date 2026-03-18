"use client";
import React, { useEffect, useRef, useState } from "react";

interface OrgProjectsMapProps {
	projects: any[];
	className?: string;
}

declare global {
	interface Window {
		google: any;
		initGoogleMaps?: () => void;
	}
}

export default function OrgProjectsMap({ projects, className = "" }: OrgProjectsMapProps) {
	const mapRef = useRef<HTMLDivElement>(null);
	const mapInstanceRef = useRef<any>(null);
	const markersRef = useRef<any[]>([]);
	const infoWindowRef = useRef<any>(null);
	const initDoneRef = useRef(false);
	const [isLoaded, setIsLoaded] = useState(false);

	const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

	// Filter to only projects with valid lat/lng
	const mapped = projects.filter(
		p => p.location?.latitude != null && p.location?.longitude != null
	);

	// Load / detect Google Maps script
	useEffect(() => {
		if (typeof window === "undefined") return;

		if (window.google?.maps) {
			setIsLoaded(true);
			return;
		}

		const existing = document.querySelector('script[src*="maps.googleapis.com"]');
		if (existing) {
			const check = setInterval(() => {
				if (window.google?.maps) { setIsLoaded(true); clearInterval(check); }
			}, 100);
			return () => clearInterval(check);
		}

		if (!apiKey) return;

		const script = document.createElement("script");
		script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
		script.async = true;
		script.defer = true;
		script.onload = () => setIsLoaded(true);
		document.head.appendChild(script);
	}, [apiKey]);

	// Build/rebuild map whenever data or load state changes
	useEffect(() => {
		if (!isLoaded || !mapRef.current || !window.google) return;

		// Clear old markers & info window
		markersRef.current.forEach(m => m.setMap(null));
		markersRef.current = [];
		if (infoWindowRef.current) { infoWindowRef.current.close(); infoWindowRef.current = null; }

		// Create or reuse map instance
		if (!mapInstanceRef.current || !initDoneRef.current) {
			mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
				zoom: 4,
				center: { lat: 20, lng: 0 },
				mapTypeControl: false,
				streetViewControl: false,
				fullscreenControl: false,
				zoomControl: true,
			});
			initDoneRef.current = true;
		}

		const map = mapInstanceRef.current;
		const infoWindow = new window.google.maps.InfoWindow();
		infoWindowRef.current = infoWindow;

		if (mapped.length === 0) return;

		const bounds = new window.google.maps.LatLngBounds();

		mapped.forEach(p => {
			const position = { lat: p.location.latitude, lng: p.location.longitude };
			const marker = new window.google.maps.Marker({
				position,
				map,
				title: p.name,
				icon: {
					path: window.google.maps.SymbolPath.CIRCLE,
					scale: 8,
					fillColor: "#EA580C",
					fillOpacity: 1,
					strokeColor: "#ffffff",
					strokeWeight: 2,
				},
			});

			marker.addListener("click", () => {
				const href = `/projects/${p.projectId || p.id}/proposal`;
				infoWindow.setContent(
					`<div style="font-size:12px;max-width:180px">
						<div style="font-weight:600;margin-bottom:2px">${p.name}</div>
						${p.locationName ? `<div style="color:#6b7280;margin-bottom:4px">${p.locationName}</div>` : ""}
						<a href="${href}" style="color:#ea580c;text-decoration:underline;font-size:11px">View project →</a>
					</div>`
				);
				infoWindow.open(map, marker);
			});

			markersRef.current.push(marker);
			bounds.extend(position);
		});

		if (mapped.length === 1) {
			map.setCenter(bounds.getCenter());
			map.setZoom(10);
		} else {
			map.fitBounds(bounds, 32 /* padding px */);
		}
	}, [isLoaded, mapped.length, projects]);

	if (!apiKey) {
		return (
			<div className={`rounded-lg border border-brand-main/10 bg-gray-50 flex items-center justify-center text-xs text-gray-400 ${className}`}>
				Map unavailable
			</div>
		);
	}

	if (!isLoaded) {
		return (
			<div className={`rounded-lg border border-brand-main/10 bg-gray-100 flex items-center justify-center text-xs text-gray-500 animate-pulse ${className}`}>
				Loading map…
			</div>
		);
	}

	if (mapped.length === 0) {
		return (
			<div className={`rounded-lg border border-brand-main/10 bg-gray-50 flex flex-col items-center justify-center gap-1 text-center px-3 ${className}`}>
				<svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
				<span className="text-[11px] text-gray-400">No project locations set</span>
			</div>
		);
	}

	return (
		<div className={`rounded-lg overflow-hidden border border-brand-main/10 ${className}`}>
			<div ref={mapRef} className="w-full h-full" />
		</div>
	);
}
