// Weather data fetcher utility for Open-Meteo API
// Fetches daily weather aggregates for a given date

export async function fetchDailyWeather(date) {
    try {
        // Lawrence, KS coordinates (66044)
        const latitude = 38.97;
        const longitude = -95.24;

        // Fetch daily weather aggregates from Open-Meteo
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,pressure_msl_mean,relativehumidity_2m_mean,weathercode,daylight_duration&temperature_unit=fahrenheit&windspeed_unit=mph&precipitation_unit=inch&timezone=America/Chicago&start_date=${date}&end_date=${date}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Open-Meteo API error: ${response.status}`);
        }

        const data = await response.json();

        // Weather code descriptions (same as in weather.js)
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

        // Extract daily data (Open-Meteo returns arrays, take first element)
        const daily = data.daily;
        const weatherCode = daily.weathercode[0];
        const conditions = weatherDescriptions[weatherCode] || 'Unknown';

        // Convert daylight duration from seconds to hours
        const daylightHours = daily.daylight_duration[0] / 3600;

        return {
            temp_high_f: Math.round(daily.temperature_2m_max[0] * 10) / 10,
            temp_low_f: Math.round(daily.temperature_2m_min[0] * 10) / 10,
            humidity: Math.round(daily.relativehumidity_2m_mean[0]),
            wind_max_mph: Math.round(daily.windspeed_10m_max[0] * 10) / 10,
            precipitation_inches: Math.round(daily.precipitation_sum[0] * 100) / 100,
            pressure_mb: Math.round(daily.pressure_msl_mean[0] * 10) / 10,
            conditions: conditions,
            daylight_hours: Math.round(daylightHours * 100) / 100
        };
    } catch (error) {
        console.error('Error fetching weather data:', error);
        throw error;
    }
}
