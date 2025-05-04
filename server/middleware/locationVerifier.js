const axios = require('axios');
const NodeGeocoder = require('node-geocoder');

// Configure geocoder with your preferred service
const geocoder = NodeGeocoder({
  provider: process.env.GEOCODER_PROVIDER || 'openstreetmap',
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null
});

/**
 * Middleware to verify and enrich location data
 * - Verifies location data exists
 * - Reverse geocodes coordinates to get address
 * - Optionally verifies user is within allowed work locations
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const locationVerifier = async (req, res, next) => {
  try {
    const { latitude, longitude, accuracy } = req.body;

    // Check if location data exists (should be validated already by validateLocation)
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Location data is required',
      });
    }

    // Create location object
    const locationData = {
      coordinates: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      },
      accuracy: accuracy ? parseFloat(accuracy) : null,
      timestamp: new Date(),
    };

    // Reverse geocode to get address
    try {
      const geocodeResult = await geocoder.reverse({ 
        lat: latitude, 
        lon: longitude 
      });

      if (geocodeResult && geocodeResult.length > 0) {
        const addressData = geocodeResult[0];
        
        locationData.address = {
          formattedAddress: addressData.formattedAddress,
          street: addressData.streetName,
          city: addressData.city,
          state: addressData.state,
          zipcode: addressData.zipcode,
          country: addressData.country,
        };
      }
    } catch (geocodeError) {
      console.error('Geocoding error:', geocodeError);
      // Continue without address data if geocoding fails
      locationData.address = null;
      locationData.geocodeError = 'Address lookup failed';
    }

    // Optional: Check if location is within allowed work locations
    // This can be expanded based on business requirements
    if (req.user && req.user.workLocations && req.user.workLocations.length > 0) {
      let isWithinWorkLocation = false;
      
      // For each registered work location, check if user is within range
      for (const workLocation of req.user.workLocations) {
        const distance = calculateDistance(
          latitude, 
          longitude, 
          workLocation.latitude, 
          workLocation.longitude
        );
        
        // If within the allowed radius (in meters)
        if (distance <= workLocation.radius) {
          isWithinWorkLocation = true;
          locationData.workLocationId = workLocation._id;
          locationData.distanceFromWork = distance;
          break;
        }
      }
      
      // If location verification is enforced and user is not at a work location
      if (req.user.enforceLocationCheck && !isWithinWorkLocation) {
        return res.status(403).json({
          success: false,
          message: 'You are not at an approved work location',
          locationData
        });
      }
      
      locationData.isAtWorkLocation = isWithinWorkLocation;
    }

    // Add location data to request for controllers to use
    req.locationData = locationData;
    next();
  } catch (error) {
    console.error('Location verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Location verification failed',
      error: error.message
    });
  }
};

/**
 * Calculate distance between two points using Haversine formula
 * @param {Number} lat1 - Latitude of first point
 * @param {Number} lon1 - Longitude of first point
 * @param {Number} lat2 - Latitude of second point
 * @param {Number} lon2 - Longitude of second point
 * @returns {Number} - Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance; // in meters
}

module.exports = locationVerifier;