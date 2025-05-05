const axios = require('axios');

/**
 * Location object structure
 * @typedef {Object} Location
 * @property {Number} latitude - Latitude coordinate
 * @property {Number} longitude - Longitude coordinate
 * @property {String} [address] - Human-readable address (if reverse geocoded)
 * @property {Date} timestamp - When the location was captured
 * @property {Number} [accuracy] - Accuracy of location in meters (if available)
 */

/**
 * Calculate distance between two coordinates in meters
 * @param {Number} lat1 - Latitude of first point
 * @param {Number} lon1 - Longitude of first point
 * @param {Number} lat2 - Latitude of second point
 * @param {Number} lon2 - Longitude of second point
 * @returns {Number} Distance in meters
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  // Haversine formula to calculate distance between two points
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
};

/**
 * Verify if user is within acceptable distance of a required location
 * @param {Location} currentLocation - User's current location
 * @param {Location} requiredLocation - Required check-in location
 * @param {Number} maxDistance - Maximum allowed distance in meters
 * @returns {Boolean} Whether user is within acceptable distance
 */
const verifyLocationProximity = (currentLocation, requiredLocation, maxDistance = 100) => {
  if (!currentLocation || !requiredLocation) return false;
  
  const distance = calculateDistance(
    currentLocation.latitude,
    currentLocation.longitude,
    requiredLocation.latitude,
    requiredLocation.longitude
  );
  
  return distance <= maxDistance;
};

/**
 * Reverse geocode coordinates to get human-readable address
 * @param {Number} latitude - Latitude coordinate
 * @param {Number} longitude - Longitude coordinate
 * @returns {Promise<String>} Human-readable address
 */
const reverseGeocode = async (latitude, longitude) => {
  try {
    // Using OpenStreetMap Nominatim API (free, but with usage limits)
    // Consider using Google Maps Geocoding API for production with API key
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'EmployeeShiftTracker/1.0' // Required by Nominatim
        }
      }
    );
    
    if (response.data && response.data.display_name) {
      return response.data.display_name;
    }
    
    return 'Unknown location';
  } catch (error) {
    console.error('Reverse geocoding error:', error.message);
    return 'Error getting address';
  }
};

/**
 * Format location data with address
 * @param {Number} latitude - Latitude coordinate
 * @param {Number} longitude - Longitude coordinate
 * @param {Number} [accuracy] - Location accuracy in meters
 * @returns {Promise<Location>} Complete location object with address
 */
const formatLocation = async (latitude, longitude, accuracy = null) => {
  const timestamp = new Date();
  
  try {
    const address = await reverseGeocode(latitude, longitude);
    
    return {
      latitude,
      longitude,
      address,
      timestamp,
      accuracy
    };
  } catch (error) {
    // Return location without address if geocoding fails
    return {
      latitude,
      longitude,
      address: 'Address unavailable',
      timestamp,
      accuracy
    };
  }
};

module.exports = {
  calculateDistance,
  verifyLocationProximity,
  reverseGeocode,
  formatLocation
};