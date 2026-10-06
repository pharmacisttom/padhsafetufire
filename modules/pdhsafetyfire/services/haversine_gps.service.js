// Haversine GPS Distance & Geofence Verification Service

export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (
    lat1 === null || lat1 === undefined ||
    lon1 === null || lon1 === undefined ||
    lat2 === null || lat2 === undefined ||
    lon2 === null || lon2 === undefined
  ) {
    return null;
  }

  const R = 6371000; // Earth's radius in meters
  const toRad = deg => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Return distance rounded to 2 decimal places
}

export function verifyLocation(checkinLat, checkinLon, checkinAccuracy, targetLat, targetLon, geofenceRadius = 30, requiredAccuracy = 30) {
  if (checkinLat === null || checkinLat === undefined || checkinLon === null || checkinLon === undefined) {
    return {
      distanceMeters: null,
      status: 'UNAVAILABLE',
      isInside: false,
      message: 'Geolocation signal unavailable'
    };
  }

  const lat1 = Number(checkinLat);
  const lon1 = Number(checkinLon);
  const lat2 = Number(targetLat);
  const lon2 = Number(targetLon);
  const accuracy = Number(checkinAccuracy || 0);

  if (isNaN(lat1) || isNaN(lon1) || lat1 < -90 || lat1 > 90 || lon1 < -180 || lon1 > 180) {
    return {
      distanceMeters: null,
      status: 'UNAVAILABLE',
      isInside: false,
      message: 'Invalid coordinate parameters'
    };
  }

  const distanceMeters = calculateHaversineDistance(lat1, lon1, lat2, lon2);

  if (distanceMeters <= geofenceRadius) {
    if (accuracy <= requiredAccuracy) {
      return {
        distanceMeters,
        status: 'VERIFIED',
        isInside: true,
        message: 'Location verified inside geofence'
      };
    } else {
      return {
        distanceMeters,
        status: 'APPROXIMATE',
        isInside: true,
        message: 'Inside geofence, but GPS accuracy is low'
      };
    }
  } else {
    return {
      distanceMeters,
      status: 'OUTSIDE_GEOFENCE',
      isInside: false,
      message: `Outside geofence area by ${Math.round(distanceMeters - geofenceRadius)}m`
    };
  }
}
