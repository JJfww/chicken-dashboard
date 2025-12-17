export async function onRequestGet(context) {
    try {
        // Lawrence, KS coordinates (66044)
        const latitude = 38.97;
        const longitude = -95.24;

        // Fetch weather from Open-Meteo API (free, no API key needed)
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code&temperature_unit=fahrenheit&timezone=America/Chicago`;

        const response = await fetch(url);
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

        const weatherCode = data.current.weather_code;
        const description = weatherDescriptions[weatherCode] || 'Unknown';

        const weather = {
            temperature: Math.round(data.current.temperature_2m),
            humidity: data.current.relative_humidity_2m,
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
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
