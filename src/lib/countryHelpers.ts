/**
 * Country center coordinates and helper functions for sensitive location privacy.
 * 
 * When a location is marked as sensitive, we display a country-level pin at the
 * geographic center of the country instead of the actual location coordinates.
 */

export interface CountryCenter {
  lat: number;
  lng: number;
  name: string;
  zoom?: number; // Default zoom level for country view
}

/**
 * Geographic centers of countries (focused on Africa).
 * Add more as needed.
 */
export const COUNTRY_CENTERS: Record<string, CountryCenter> = {
  // East Africa
  'Kenya': { lat: 0.0236, lng: 37.9062, name: 'Kenya', zoom: 6 },
 'Uganda': { lat: 1.3733, lng: 32.2903, name: 'Uganda', zoom: 7 },
  'Tanzania': { lat: -6.369, lng: 34.8888, name: 'Tanzania', zoom: 6 },
  'Rwanda': { lat: -1.9403, lng: 29.8739, name: 'Rwanda', zoom: 8 },
  'Burundi': { lat: -3.3731, lng: 29.9189, name: 'Burundi', zoom: 8 },
  'Ethiopia': { lat: 9.145, lng: 40.4897, name: 'Ethiopia', zoom: 6 },
  'Somalia': { lat: 5.1521, lng: 46.1996, name: 'Somalia', zoom: 6 },
  'South Sudan': { lat: 6.877, lng: 31.307, name: 'South Sudan', zoom: 6 },

  // West Africa
  'Nigeria': { lat: 9.082, lng: 8.6753, name: 'Nigeria', zoom: 6 },
  'Ghana': { lat: 7.9465, lng: -1.0232, name: 'Ghana', zoom: 7 },
  'Senegal': { lat: 14.4974, lng: -14.4524, name: 'Senegal', zoom: 7 },
  'Mali': { lat: 17.5707, lng: -3.9962, name: 'Mali', zoom: 6 },
  'Burkina Faso': { lat: 12.2383, lng: -1.5616, name: 'Burkina Faso', zoom: 7 },
  'Niger': { lat: 17.6078, lng: 8.0817, name: 'Niger', zoom: 6 },
  'Ivory Coast': { lat: 7.54, lng: -5.5471, name: 'Ivory Coast', zoom: 7 },
  'Liberia': { lat: 6.4281, lng: -9.4295, name: 'Liberia', zoom: 7 },
  'Sierra Leone': { lat: 8.4606, lng: -11.7799, name: 'Sierra Leone', zoom: 8 },
  'Guinea': { lat: 9.9456, lng: -9.6966, name: 'Guinea', zoom: 7 },
  'Togo': { lat: 8.6195, lng: 0.8248, name: 'Togo', zoom: 8 },
  'Benin': { lat: 9.3077, lng: 2.3158, name: 'Benin', zoom: 7 },

  // Southern Africa
  'South Africa': { lat: -30.5595, lng: 22.9375, name: 'South Africa', zoom: 6 },
  'Zimbabwe': { lat: -19.0154, lng: 29.1549, name: 'Zimbabwe', zoom: 7 },
  'Zambia': { lat: -13.1339, lng: 27.8493, name: 'Zambia', zoom: 6 },
  'Botswana': { lat: -22.3285, lng: 24.6849, name: 'Botswana', zoom: 6 },
  'Namibia': { lat: -22.9576, lng: 18.4904, name: 'Namibia', zoom: 6 },
  'Mozambique': { lat: -18.6657, lng: 35.5296, name: 'Mozambique', zoom: 6 },
  'Malawi': { lat: -13.2543, lng: 34.3015, name: 'Malawi', zoom: 7 },
  'Lesotho': { lat: -29.6100, lng: 28.2336, name: 'Lesotho', zoom: 8 },
  'Eswatini': { lat: -26.5225, lng: 31.4659, name: 'Eswatini', zoom: 9 },

  // Central Africa
  'Democratic Republic of the Congo': { lat: -4.0383, lng: 21.7587, name: 'DR Congo', zoom: 5 },
  'Congo': { lat: -0.228, lng: 15.8277, name: 'Congo', zoom: 6 },
  'Cameroon': { lat: 7.3697, lng: 12.3547, name: 'Cameroon', zoom: 6 },
  'Central African Republic': { lat: 6.6111, lng: 20.9394, name: 'CAR', zoom: 6 },
  'Gabon': { lat: -0.8037, lng: 11.6094, name: 'Gabon', zoom: 7 },
  'Equatorial Guinea': { lat: 1.6508, lng: 10.2679, name: 'Equatorial Guinea', zoom: 8 },
  'Chad': { lat: 15.4542, lng: 18.7322, name: 'Chad', zoom: 6 },

  // North Africa
  'Egypt': { lat: 26.8206, lng: 30.8025, name: 'Egypt', zoom: 6 },
  'Sudan': { lat: 12.8628, lng: 30.2176, name: 'Sudan', zoom: 6 },
  'Libya': { lat: 26.3351, lng: 17.2283, name: 'Libya', zoom: 6 },
  'Tunisia': { lat: 33.8869, lng: 9.5375, name: 'Tunisia', zoom: 7 },
  'Algeria': { lat: 28.0339, lng: 1.6596, name: 'Algeria', zoom: 5 },
  'Morocco': { lat: 31.7917, lng: -7.0926, name: 'Morocco', zoom: 6 },

  // Island Nations
  'Madagascar': { lat: -18.7669, lng: 46.8691, name: 'Madagascar', zoom: 6 },
  'Mauritius': { lat: -20.3484, lng: 57.5522, name: 'Mauritius', zoom: 10 },
  'Seychelles': { lat: -4.6796, lng: 55.4920, name: 'Seychelles', zoom: 11 },
  'Comoros': { lat: -11.8750, lng: 43.8722, name: 'Comoros', zoom: 10 },

  // Other regions (for non-African projects)
  'United Kingdom': { lat: 55.3781, lng: -3.4360, name: 'United Kingdom', zoom: 6 },
  'United States': { lat: 37.0902, lng: -95.7129, name: 'United States', zoom: 4 },
  'India': { lat: 20.5937, lng: 78.9629, name: 'India', zoom: 5 },
  'Brazil': { lat: -14.2350, lng: -51.9253, name: 'Brazil', zoom: 4 },
  'Australia': { lat: -25.2744, lng: 133.7751, name: 'Australia', zoom: 4 },
};

/**
 * Get the geographic center coordinates for a country.
 * Returns the center point for displaying a country-level map pin.
 * 
 * @param countryName - Name of the country (case-insensitive)
 * @returns CountryCenter object or null if country not found
 */
export function getCountryCenter(countryName: string): CountryCenter | null {
  if (!countryName) return null;
  
  // Normalize country name (trim, case-insensitive match)
  const normalized = countryName.trim();
  
  // Direct match
  if (COUNTRY_CENTERS[normalized]) {
    return COUNTRY_CENTERS[normalized];
  }
  
  // Case-insensitive match
  const key = Object.keys(COUNTRY_CENTERS).find(
    k => k.toLowerCase() === normalized.toLowerCase()
  );
  
  return key ? COUNTRY_CENTERS[key] : null;
}

/**
 * Check if a location should be displayed at country-level only.
 * 
 * @param location - Location object (OrgLocation or ProjectLocation)
 * @returns true if location is marked as sensitive
 */
export function isSensitiveLocation(location: any): boolean {
  return location?.sensitiveLocation === true;
}

/**
 * Get display coordinates for a location.
 * If sensitive, returns country center. Otherwise returns actual coordinates.
 * 
 * @param location - Location object with lat/lng and optional sensitiveLocation flag
 * @returns { lat, lng, zoom } object or null
 */
export function getDisplayCoordinates(location: any): { lat: number; lng: number; zoom?: number } | null {
  if (!location) return null;
  
  // If sensitive, use country center
  if (isSensitiveLocation(location) && location.country) {
    const center = getCountryCenter(location.country);
    if (center) {
      return { lat: center.lat, lng: center.lng, zoom: center.zoom || 6 };
    }
  }
  
  // Otherwise use actual coordinates
  if (typeof location.latitude === 'number' && typeof location.longitude === 'number') {
    return { lat: location.latitude, lng: location.longitude, zoom: 13 };
  }
  
  if (typeof location.lat === 'number' && typeof location.lng === 'number') {
    return { lat: location.lat, lng: location.lng, zoom: 13 };
  }
  
  return null;
}

/**
 * Get display address for a location.
 * If sensitive, only shows country name. Otherwise shows full address.
 * 
 * @param location - Location object
 * @returns Address string or null
 */
export function getDisplayAddress(location: any): string | null {
  if (!location) return null;
  
  // If sensitive, only show country
  if (isSensitiveLocation(location)) {
    return location.country || 'Protected Location';
  }
  
  // Otherwise show full address
  const parts: string[] = [];
  if (location.name) parts.push(location.name);
  if (location.town) parts.push(location.town);
  if (location.country) parts.push(location.country);
  
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Get list of all available countries for dropdown selection.
 * Sorted alphabetically.
 */
export function getAvailableCountries(): string[] {
  return Object.keys(COUNTRY_CENTERS).sort();
}

/**
 * Check if organization should be hidden from public search/discovery.
 */
export function isOrganizationHidden(org: any): boolean {
  return org?.hideFromSearch === true;
}
