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

// Calculate the fare using base fare, per-kilometre rate, and per-minute rate.
// Formula: estimatedFare = base_fare + (km × per_km_rate) + (min × per_minute_rate)
function calculateFare(distanceKm, baseFare, perKmRate, durationMinutes = 0, perMinuteRate = 0) {
    const distance = Number(distanceKm);
    const base = Number(baseFare);
    const kmRate = Number(perKmRate);
    const duration = Number(durationMinutes || 0);
    const minRate = Number(perMinuteRate || 0);

    if (!Number.isFinite(distance) || distance <= 0) {
        throw new Error('Distance must be greater than zero.');
    }

    if (!Number.isFinite(base) || base < 0) {
        throw new Error('Base fare must be zero or greater.');
    }

    if (!Number.isFinite(kmRate) || kmRate < 0) {
        throw new Error('Per-kilometre rate must be zero or greater.');
    }

    if (!Number.isFinite(duration) || duration < 0) {
        throw new Error('Duration minutes must be zero or greater.');
    }

    if (!Number.isFinite(minRate) || minRate < 0) {
        throw new Error('Per-minute rate must be zero or greater.');
    }

    // Return the calculated fare rounded to two decimal places.
    const total = base + (distance * kmRate) + (duration * minRate);
    return Number(total.toFixed(2));
}

// Calculate fare directly using active rules from the database
async function estimateTripFare(pool, vehicleType, distanceKm, durationMinutes = 0) {
    const [rules] = await pool.execute(
        `SELECT base_fare, per_km_rate, per_minute_rate, cancellation_fee
         FROM fare_rules
         WHERE vehicle_type = ? AND status = 'active'
         LIMIT 1`,
        [vehicleType]
    );

    if (rules.length === 0) {
        // Fallback default rates if DB record missing
        const defaults = {
            sedan: { base: 100, km: 18, min: 2.0 },
            suv: { base: 150, km: 25, min: 3.0 },
            hatchback: { base: 80, km: 14, min: 1.5 },
            auto: { base: 40, km: 10, min: 1.0 },
            bike: { base: 25, km: 7, min: 0.75 }
        };
        const def = defaults[vehicleType] || defaults.sedan;
        return calculateFare(distanceKm, def.base, def.km, durationMinutes, def.min);
    }

    const rule = rules[0];
    return calculateFare(
        distanceKm,
        parseFloat(rule.base_fare),
        parseFloat(rule.per_km_rate),
        durationMinutes,
        parseFloat(rule.per_minute_rate)
    );
}

// Export the functions for use across passenger, driver, and admin modules
module.exports = {
    geocodeAddress,
    getRoadDistanceKm,
    calculateFare,
    estimateTripFare
};