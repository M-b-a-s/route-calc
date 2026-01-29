// server.js - full updated version (keep your existing requires and dotenv)

// ... existing requires at top
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = 5000;



const cors = require('cors');
app.use(cors({ origin: 'http://localhost:3000' }));


app.use(express.json());
app.use(express.urlencoded({ extended: true }))

// Helper: Geocode address → {lat, lng}
async function geocodeAddress(address) {
  if (!address || typeof address !== 'string' || address.trim() === '') {
    throw new Error('Invalid address');
  }

  const url = `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(address)}.json?key=${process.env.TOMTOM_API_KEY}&limit=1&countrySet=NG`; // Bias to Nigeria

  try {
    const response = await axios.get(url);
    const results = response.data.results;

    if (!results || results.length === 0) {
      throw new Error(`No location found for address: ${address}`);
    }

    const best = results[0]; // First = best match
    return {
      lat: best.position.lat,
      lng: best.position.lon,
      formattedAddress: best.address.freeformAddress || address, // For debugging / logging
    };
  } catch (error) {
    console.error(`Geocoding failed for "${address}":`, error.response?.data || error.message);
    throw new Error(`Geocoding failed: ${error.message}`);
  }
}

// Existing TomTom Routing function (updated slightly for better error handling)
async function getTomTomRoute(pickup, destination) {
  const params = new URLSearchParams({
    key: process.env.TOMTOM_API_KEY,
    travelMode: 'truck',
    vehicleCommercial: 'true',
  });

  const url = `https://api.tomtom.com/routing/1/calculateRoute/${pickup.lat},${pickup.lng}:${destination.lat},${destination.lng}/json?${params.toString()}`;

  try {
    const response = await axios.get(url);
    if (!response.data.routes || response.data.routes.length === 0) {
      throw new Error('No route found');
    }

    const route = response.data.routes[0];
    const leg = route.legs[0];

    return {
      distanceKm: route.summary.lengthInMeters / 1000,
      etaMinutes: route.summary.travelTimeInSeconds / 60,
      routePoints: leg.points || [], // array of {latitude, longitude}
    };
  } catch (error) {
    console.error('Routing error:', error.response?.data || error.message);
    throw error;
  }
}

// New / updated endpoint - now accepts addresses instead of coords
app.post('/calculate-route', async (req, res) => {
  const { pickupAddress, destinationAddress } = req.body;

  if (!pickupAddress || !destinationAddress) {
    return res.status(400).json({ error: 'Missing pickupAddress or destinationAddress' });
  }

  try {
    // Step 1: Geocode both addresses
    const pickup = await geocodeAddress(pickupAddress);
    const destination = await geocodeAddress(destinationAddress);

    console.log(`Geocoded: ${pickupAddress} → ${pickup.lat}, ${pickup.lng}`);
    console.log(`Geocoded: ${destinationAddress} → ${destination.lat}, ${destination.lng}`);

    // Step 2: Get route using coordinates
    const route = await getTomTomRoute(pickup, destination);

    const approxCost = route.distanceKm * 100; // Your mock rate

    res.json({
  routePoints: route.routePoints,
  distanceKm: route.distanceKm,
  etaMinutes: route.etaMinutes,
  approxCost,
  pickupFormatted: pickup.formattedAddress,
  destinationFormatted: destination.formattedAddress,
  // NEW: Add these so frontend can use them for map center & markers
  pickupLat: pickup.lat,
  pickupLng: pickup.lng,
  destinationLat: destination.lat,
  destinationLng: destination.lng,
});
  } catch (error) {
    console.error('Full error:', error);
    res.status(400).json({
      error: error.message || 'Failed to calculate route',
      details: error.message.includes('Geocoding') ? 'Invalid address(es)' : 'Routing issue',
    });
  }
});

app.listen(port, () => {
  console.log(`Route calculator running on http://localhost:${port}`);
});