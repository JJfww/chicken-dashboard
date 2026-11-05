// One-time script to backfill missing weather_logs from Open-Meteo archive API
// Usage: node scripts/backfill-weather.js [START_DATE END_DATE] > backfill.sql
// Existing dates are left alone (INSERT OR IGNORE), so overlapping ranges are safe.

const START_DATE = process.argv[2] || '2025-12-22';
const END_DATE = process.argv[3] || '2026-03-02';
const LAT = 38.97;
const LON = -95.24;

// WMO Weather interpretation codes -> human-readable conditions
const WMO_CODES = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Light rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Light snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with light hail',
  99: 'Thunderstorm with heavy hail',
};

async function main() {
  const params = new URLSearchParams({
    latitude: LAT,
    longitude: LON,
    start_date: START_DATE,
    end_date: END_DATE,
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'wind_speed_10m_max',
      'relative_humidity_2m_mean',
      'surface_pressure_mean',
      'weather_code',
      'daylight_duration',
    ].join(','),
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: 'America/Chicago',
  });

  const url = `https://archive-api.open-meteo.com/v1/archive?${params}`;
  console.error(`Fetching: ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`API error: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const data = await res.json();
  const d = data.daily;

  let generated = 0;
  for (let i = 0; i < d.time.length; i++) {
    const date = d.time[i];
    // The archive lags a few days behind; skip days it hasn't filled in yet.
    if (d.temperature_2m_max[i] == null) continue;
    const tempHigh = d.temperature_2m_max[i];
    const tempLow = d.temperature_2m_min[i];
    const precip = d.precipitation_sum[i] ?? 0;
    const windMax = d.wind_speed_10m_max[i];
    const humidity = d.relative_humidity_2m_mean[i];
    // Convert hPa to inHg (1 hPa = 0.02953 inHg)
    const pressureInHg = d.surface_pressure_mean[i] != null
      ? (d.surface_pressure_mean[i] * 0.02953).toFixed(2)
      : null;
    const conditions = WMO_CODES[d.weather_code[i]] || 'Unknown';
    // Convert daylight seconds to hours
    const daylightHours = d.daylight_duration[i] != null
      ? (d.daylight_duration[i] / 3600).toFixed(1)
      : null;

    const vals = [
      `'${date}'`,
      tempHigh != null ? Math.round(tempHigh) : 'NULL',
      tempLow != null ? Math.round(tempLow) : 'NULL',
      humidity != null ? Math.round(humidity) : 'NULL',
      windMax != null ? Math.round(windMax) : 'NULL',
      precip != null ? precip.toFixed(2) : 'NULL',
      pressureInHg ?? 'NULL',
      `'${conditions.replace(/'/g, "''")}'`,
      daylightHours ?? 'NULL',
    ];

    console.log(
      `INSERT OR IGNORE INTO weather_logs (date, temp_high_f, temp_low_f, humidity, wind_max_mph, precipitation_inches, pressure_inhg, conditions, daylight_hours) VALUES (${vals.join(', ')});`
    );
    generated++;
  }

  console.error(`Generated ${generated} INSERT statements.`);
}

main();
