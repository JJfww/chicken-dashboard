export async function onRequestGet(context) {
    try {
        // Lawrence, KS coordinates (66044)
        const latitude = 38.97;
        const longitude = -95.24;
        const userAgent = 'chicken-dashboard (contact: jennier.burnes@gmail.com)';

        // Fetch weather from the US National Weather Service (no API key needed)
        const pointsUrl = `https://api.weather.gov/points/${latitude},${longitude}`;
        const pointsData = await fetchJson(pointsUrl, userAgent);
        const stationsUrl = pointsData?.properties?.observationStations;

        if (!stationsUrl) {
            throw new Error('NWS points response missing observation stations URL');
        }

        const stationsData = await fetchJson(stationsUrl, userAgent);
        const stationId = stationsData?.features?.[0]?.properties?.stationIdentifier;

        if (!stationId) {
            throw new Error('NWS stations response missing station identifier');
        }

        const observationUrl = `https://api.weather.gov/stations/${stationId}/observations/latest`;
        const observationData = await fetchJson(observationUrl, userAgent);
        const observation = observationData?.properties;

        if (!observation) {
            throw new Error('NWS observation response missing properties');
        }

        const temperatureF = celsiusToFahrenheit(observation.temperature?.value);
        if (temperatureF === null) {
            throw new Error('NWS observation missing temperature');
        }

        const weather = {
            temperature: Math.round(temperatureF),
            humidity: normalizePercent(observation.relativeHumidity?.value),
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
