/**
 * Service to handle location-related operations like reverse geocoding.
 */

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    // Using Nominatim (OpenStreetMap) for reverse geocoding
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'NexusAid-Crisis-Response-App'
      }
    });

    if (!response.ok) throw new Error('Geocoding service unavailable');

    const data = await response.json();
    
    // Construct a readable address from the components
    if (data.display_name) {
      return data.display_name;
    }
    
    // Fallback if display_name is missing
    const addr = data.address || {};
    const parts = [
      addr.road || addr.pedestrian || addr.suburb,
      addr.city || addr.town || addr.village,
      addr.state || addr.county,
      addr.country
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(', ') : `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}
