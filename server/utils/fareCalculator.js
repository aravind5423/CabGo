'use strict';

const ORS_BASE_URL = 'https://api.openrouteservice.org';

function getApiKey() {
    const apiKey = process.env.OPENROUTESERVICE_API_KEY;

    if (!apiKey) {
        throw new Error(
            'OPENROUTESERVICE_API_KEY is missing from the .env file.'
        );
    }

    return apiKey;
}

// Send a request to the OpenRouteService API.
async function orsRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            Authorization: getApiKey(),
            ...(options.headers || {})
        },
        signal: AbortSignal.timeout(15000)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        console.error(
            '[OpenRouteService Error]',
            response.status,
            data
        );

        throw new Error(
            'OpenRouteService request failed. Check your API key and usage limits.'
        );
    }

    return data;
}

// Convert an address into geographic coordinates.
// OpenRouteService returns coordinates as [longitude, latitude].
async function geocodeAddress(address) {
    if (typeof address !== 'string' || !address.trim()) {
        throw new Error('A valid address is required.');
    }

    const url = new URL(`${ORS_BASE_URL}/geocode/search`);

    url.searchParams.set('text', address.trim());
    url.searchParams.set('size', '1');

    const data = await orsRequest(url.toString());

    const coordinates = data.features?.[0]?.geometry?.coordinates;

    if (
        !Array.isArray(coordinates) ||
        coordinates.length < 2 ||
        !Number.isFinite(coordinates[0]) ||
        !Number.isFinite(coordinates[1])
    ) {
        throw new Error(`Location not found: ${address}`);
    }

    return coordinates;
}

// Calculate the actual road distance between pickup and destination.
async function getRoadDistanceKm(pickup, destination) {
    if (
        typeof pickup !== 'string' ||
        typeof destination !== 'string' ||
        !pickup.trim() ||
        !destination.trim()
    ) {
        throw new Error(
            'Pickup and destination addresses are required.'
        );
    }

    // Find the coordinates of both addresses simultaneously.
    const [startCoordinates, endCoordinates] = await Promise.all([
        geocodeAddress(pickup),
        geocodeAddress(destination)
    ]);

    // Request a driving route between the two locations.
    const routeData = await orsRequest(
        `${ORS_BASE_URL}/v2/directions/driving-car`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                coordinates: [
                    startCoordinates,
                    endCoordinates
                ]
            })
        }
    );

    // The API returns the route distance in metres.
    const distanceMeters = routeData.routes?.[0]?.summary?.distance;

    if (
        !Number.isFinite(distanceMeters) ||
        distanceMeters <= 0
    ) {
        throw new Error(
            'No valid driving route was found between these locations.'
        );
    }

    // Convert metres to kilometres and round to one decimal place.
    return Number((distanceMeters / 1000).toFixed(1));
}

// Calculate the fare using the base fare and per-kilometre rate.
// Formula: Fare = Base fare + (Distance × Rate per kilometre).
function calculateFare(distanceKm, baseFare, perKmRate) {
    const distance = Number(distanceKm);
    const base = Number(baseFare);
    const rate = Number(perKmRate);

    if (!Number.isFinite(distance) || distance <= 0) {
        throw new Error('Distance must be greater than zero.');
    }

    if (!Number.isFinite(base) || base < 0) {
        throw new Error('Base fare must be zero or greater.');
    }

    if (!Number.isFinite(rate) || rate < 0) {
        throw new Error(
            'Per-kilometre rate must be zero or greater.'
        );
    }

    // Return the calculated fare rounded to two decimal places.
    return Number((base + distance * rate).toFixed(2));
}

// Export the functions so passenger.js can use them.
module.exports = {
    geocodeAddress,
    getRoadDistanceKm,
    calculateFare
};