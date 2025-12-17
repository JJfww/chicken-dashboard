export async function onRequestGet(context) {
    try {
        // Lawrence, KS coordinates (66044)
        const latitude = 38.97;
        const longitude = -95.24;

        // Fetch weather from Open-Meteo API (free, no API key needed)
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.set('latitude', latitude);
        url.searchParams.set('longitude', longitude);
        url.searchParams.set('current_weather', 'true');
        url.searchParams.set('hourly', 'relativehumidity_2m');
        url.searchParams.set('temperature_unit', 'fahrenheit');
        url.searchParams.set('timezone', 'America/Chicago');
        url.searchParams.set('forecast_days', '1');

        const response = await fetch(url.toString());
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Open-Meteo API error: ${response.status} ${errorBody}`);
        }

        const data = await response.json();

        // Map weather codes to descriptions
        const weatherDescriptions = {
            0: 'Clear sky',
            1: 'Mainly clear',
            2: 'Partly cloudy',
            3: 'Overcast',
            45: 'Foggy',
            48: 'Foggy',
            51: 'Light drizzle',
            53: 'Drizzle',
            55: 'Heavy drizzle',
            61: 'Light rain',
            63: 'Rain',
            65: 'Heavy rain',
            71: 'Light snow',
            73: 'Snow',
            75: 'Heavy snow',
            77: 'Snow grains',
            80: 'Light showers',
            81: 'Showers',
            82: 'Heavy showers',
            85: 'Light snow showers',
            86: 'Snow showers',
            95: 'Thunderstorm',
            96: 'Thunderstorm with hail',
            99: 'Thunderstorm with hail'
        };

        if (!data.current_weather || !data.hourly) {
            throw new Error('Open-Meteo response missing current weather data');
        }

        const weatherCode = data.current_weather.weathercode;
        const description = weatherDescriptions[weatherCode] || 'Unknown';
        const humidity = getHumidityForCurrentTime(data);

        const weather = {
            temperature: Math.round(data.current_weather.temperature),
            humidity: typeof humidity === 'number' ? Math.round(humidity) : null,
            description: description,
            weatherCode: weatherCode
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

function getHumidityForCurrentTime(data) {
    const times = data.hourly.time || [];
    const humidities = data.hourly.relativehumidity_2m || [];
    const currentTime = data.current_weather.time;

    const index = times.indexOf(currentTime);
    if (index >= 0 && typeof humidities[index] === 'number') {
        return humidities[index];
    }

    const fallbackHumidity = humidities.find(value => typeof value === 'number');
    if (typeof fallbackHumidity === 'number') {
        return fallbackHumidity;
    }

    return null;
}
