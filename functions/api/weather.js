export async function onRequestGet(context) {
    try {
        // Lawrence, KS coordinates (66044)
        const latitude = 38.97;
        const longitude = -95.24;
        const userAgent = 'chicken-dashboard (contact: jennifer.burnes@gmail.com)';

        // Fetch weather from the US National Weather Service (no API key needed)
        const pointsUrl = `https://api.weather.gov/points/${latitude},${longitude}`;
        const pointsData = await fetchJson(pointsUrl, userAgent);
        const stationsUrl = pointsData?.properties?.observationStations;

        if (!stationsUrl) {
            throw new Error('NWS points response missing observation stations URL');
        }

        const stationsData = await fetchJson(stationsUrl, userAgent);
        const stations = stationsData?.features || [];

        if (stations.length === 0) {
            throw new Error('NWS stations response missing stations');
        }

        // Try multiple stations until we find one with valid temperature
        let observation = null;
        let temperatureF = null;

        for (const station of stations.slice(0, 5)) {
            const stationId = station?.properties?.stationIdentifier;
            if (!stationId) continue;

            try {
                const observationUrl = `https://api.weather.gov/stations/${stationId}/observations/latest`;
                const observationData = await fetchJson(observationUrl, userAgent);
                const obs = observationData?.properties;

                if (obs?.temperature?.value !== null && typeof obs?.temperature?.value === 'number') {
                    observation = obs;
                    temperatureF = celsiusToFahrenheit(obs.temperature.value);
                    break;
                }
            } catch (e) {
                // Try next station
                continue;
            }
        }

        if (temperatureF === null) {
            throw new Error('No station with valid temperature found');
        }

        // Wind speed comes in km/h, convert to mph
        // Fall back to wind gust if wind speed is unavailable
        const windSpeedKmh = observation.windSpeed?.value ?? observation.windGust?.value;
        const windSpeedMph = typeof windSpeedKmh === 'number' ? Math.round(windSpeedKmh * 0.621371) : null;

        const weather = {
            temperature: Math.round(temperatureF),
            humidity: normalizePercent(observation.relativeHumidity?.value),
            wind: windSpeedMph,
            description: observation.textDescription || 'Unknown',
            weatherCode: null
        };

        return new Response(JSON.stringify(weather), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=600' // Cache for 10 minutes
            }
        });
    } catch (error) {
        console.error('Error fetching current weather:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

async function fetchJson(url, userAgent) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': userAgent,
            'Accept': 'application/geo+json'
        }
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`NWS API error: ${response.status} ${errorBody}`);
    }

    return response.json();
}

function celsiusToFahrenheit(value) {
    if (typeof value !== 'number') {
        return null;
    }

    return (value * 9) / 5 + 32;
}

function normalizePercent(value) {
    if (typeof value === 'number') {
        return Math.round(value);
    }

    return null;
}
