require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }))

async function getTomTomRoute(pickup, destination) {
  // Build query string with truck-aware params
  const params = new URLSearchParams({
    key: process.env.TOMTOM_API_KEY,
    travelMode: 'truck',              // ← This is the key one for truck routing
    vehicleCommercial: 'true',        // Marks as commercial vehicle
    instructionsTyoe: 'text',
    // Optional but recommended for realism (add these later when form sends them)
    // vehicleWeight: '15000',        // example: 15 tons in kg
    // vehicleLength: '12',           // example: standard container/trailer length
    // vehicleHeight: '4',            // example
    // vehicleWidth: '2.5',
    // vehicleLoadType: 'OTHER_GENERAL_CARGO',  // or OTHER_HAZMAT_GENERAL etc.
  });

  const url = `https://api.tomtom.com/routing/1/calculateRoute/${pickup.lat},${pickup.lng}:${destination.lat},${destination.lng}/json?${params.toString()}`;

  try {
    const response = await axios.get(url);
    
    // Safety check in case no routes returned
    if (!response.data.routes || response.data.routes.length === 0) {
      throw new Error('No route found');
    }

    const route = response.data.routes[0]; // Best/fastest route by default

    return {
      distanceKm: route.summary.lengthInMeters / 1000,
      etaMinutes: route.summary.travelTimeInSeconds / 60,
      polyline: route.sections?.[0]?.polyline || ''  // Encoded polyline (TomTom format)
    };
  } catch (error) {
    console.error('TomTom error details:', error.response?.data || error.message);
    if (error.response?.data?.detailedError) {
      console.error('TomTom detailed error:', error.response.data.detailedError);
    }
    return null;
  }
}

app.post('/calculate-route', async (req, res) => {
  const { pickup, destination } = req.body;
  
  if (!pickup || !destination) {
    return res.status(400).json({ error: 'Missing locations' });
  }
  
  const route = await getTomTomRoute(pickup, destination);
  
  if (!route) {
    return res.status(500).json({ error: 'Failed to get route from TomTom' });
  }
  
  const approxCost = route.distanceKm * 100; // Mock cost: 100 Naira/km
  
  res.json({
    routePolyline: route.polyline,
    distanceKm: route.distanceKm,
    etaMinutes: route.etaMinutes,
    approxCost
  });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
})