require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const port = 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }))

const cors = require('cors');
app.use(cors({ origin: 'http://localhost:3000' }));

async function getTomTomRoute(pickup, destination) {
  const params = new URLSearchParams({
    key: process.env.TOMTOM_API_KEY,
    travelMode: 'truck',
    vehicleCommercial: 'true',
    // Add this line to request FULL geometry (optional but recommended)
    instructionsType: 'text',          // or 'none' if you don't need turn-by-turn
    // sectionType: 'traffic',         // optional, if you want traffic sections
  });

  const url = `https://api.tomtom.com/routing/1/calculateRoute/${pickup.lat},${pickup.lng}:${destination.lat},${destination.lng}/json?${params.toString()}`;

  try {
    const response = await axios.get(url);
    
    if (!response.data.routes || response.data.routes.length === 0) {
      throw new Error('No route found');
    }

    const route = response.data.routes[0];
    const leg = route.legs[0];  // Usually the only leg for direct origin-destination

    // Option A: Use points array (array of {latitude, longitude})
    const points = leg.points || [];  // This is [{latitude: ..., longitude: ...}, ...]

    // Option B: If you prefer encoded string later (see below)
    // const encodedPolyline = leg.polyline || '';  // Not always present

    return {
      distanceKm: route.summary.lengthInMeters / 1000,
      etaMinutes: route.summary.travelTimeInSeconds / 60,
      routePoints: points,               // ← Change to this (array format)
      // polyline: encodedPolyline       // only if you enable encoded below
    };
  } catch (error) {
    console.error('TomTom error details:', error.response?.data || error.message);
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
  routePoints: route.routePoints,     // array of {latitude, longitude}
  distanceKm: route.distanceKm,
  etaMinutes: route.etaMinutes,
  approxCost
});
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
})