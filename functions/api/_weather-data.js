// Weather data fetcher utility for the US National Weather Service
// Aggregates daily observations for a given date

const WEATHER_USER_AGENT = 'chicken-dashboard (contact: jennier.burnes@gmail.com)';
const LATITUDE = 38.97;
const LONGITUDE = -95.24;
const TIME_ZONE = 'America/Chicago';

export async function fetchDailyWeather(date) {
    try {
        const pointsUrl = `https://api.weather.gov/points/${LATITUDE},${LONGITUDE}`;
        const pointsData = await fetchJson(pointsUrl, WEATHER_USER_AGENT);
        const stationsUrl = pointsData?.properties?.observationStations;

        if (!stationsUrl) {
            throw new Error('NWS points response missing observation stations URL');
        }

        const stationsData = await fetchJson(stationsUrl, WEATHER_USER_AGENT);
        const stationId = stationsData?.features?.[0]?.properties?.stationIdentifier;

        if (!stationId) {
            throw new Error('NWS stations response missing station identifier');
        }

        const range = buildDateRange(date, TIME_ZONE);
        const observationsUrl = `https://api.weather.gov/stations/${stationId}/observations?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`;
        const observationsData = await fetchJson(observationsUrl, WEATHER_USER_AGENT);
        const observations = observationsData?.features || [];

        if (!observations.length) {
            throw new Error(`No NWS observations found for ${date}`);
        }

        return summarizeObservations(observations, date);
    } catch (error) {
        console.error('Error fetching daily NWS weather data:', error);
        throw error;
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

function summarizeObservations(observations, date) {
    const temperaturesF = [];
    const humidities = [];
    const windSpeedsMph = [];
    const pressuresInHg = [];
    let precipitationHourTotal = 0;
    let precipitation3HourTotal = 0;
    let precipitation6HourTotal = 0;
    let hasHourPrecip = false;
    let has3HourPrecip = false;
    let has6HourPrecip = false;
    let latestObservation = null;

    for (const observation of observations) {
        const properties = observation?.properties;
        if (!properties) {
            continue;
        }

        if (properties.timestamp) {
            const timestamp = new Date(properties.timestamp);
            if (!latestObservation || timestamp > latestObservation.timestamp) {
                latestObservation = {
                    timestamp: timestamp,
                    description: properties.textDescription || null
                };
            }
        }

        const tempF = celsiusToFahrenheit(properties.temperature?.value);
        if (typeof tempF === 'number') {
            temperaturesF.push(tempF);
        }

        if (typeof properties.relativeHumidity?.value === 'number') {
            humidities.push(properties.relativeHumidity.value);
        }

        const windSpeed = properties.windSpeed?.value;
        const windGust = properties.windGust?.value;
        const windUnit = properties.windSpeed?.unitCode || properties.windGust?.unitCode;
        const maxWind = maxNumber(windSpeed, windGust);

        if (typeof maxWind === 'number') {
            const windMph = convertWindToMph(maxWind, windUnit);
            if (windMph !== null) {
                windSpeedsMph.push(windMph);
            }
        }

        const pressurePa = typeof properties.seaLevelPressure?.value === 'number'
            ? properties.seaLevelPressure.value
            : properties.barometricPressure?.value;

        if (typeof pressurePa === 'number') {
            pressuresInHg.push(pressurePa * 0.00029529983071445);
        }

        if (typeof properties.precipitationLastHour?.value === 'number') {
            hasHourPrecip = true;
            precipitationHourTotal += properties.precipitationLastHour.value;
        } else if (typeof properties.precipitationLast3Hours?.value === 'number') {
            has3HourPrecip = true;
            precipitation3HourTotal += properties.precipitationLast3Hours.value;
        } else if (typeof properties.precipitationLast6Hours?.value === 'number') {
            has6HourPrecip = true;
            precipitation6HourTotal += properties.precipitationLast6Hours.value;
        }
    }

    if (!temperaturesF.length) {
        throw new Error('NWS observations missing temperature data');
    }

    if (!humidities.length) {
        throw new Error('NWS observations missing humidity data');
    }

    if (!pressuresInHg.length) {
        throw new Error('NWS observations missing pressure data');
    }

    const tempHighF = Math.max(...temperaturesF);
    const tempLowF = Math.min(...temperaturesF);
    const humidityAvg = average(humidities);
    const windMaxMph = windSpeedsMph.length ? Math.max(...windSpeedsMph) : 0;
    const precipitationMm = hasHourPrecip
        ? precipitationHourTotal
        : (has3HourPrecip ? precipitation3HourTotal : (has6HourPrecip ? precipitation6HourTotal : 0));
    const pressureAvgInHg = average(pressuresInHg);
    const daylightHours = calculateDaylightHours(date, LATITUDE);

    return {
        temp_high_f: roundToDecimal(tempHighF, 1),
        temp_low_f: roundToDecimal(tempLowF, 1),
        humidity: Math.round(humidityAvg),
        wind_max_mph: roundToDecimal(windMaxMph, 1),
        precipitation_inches: roundToDecimal(precipitationMm / 25.4, 2),
        pressure_inhg: roundToDecimal(pressureAvgInHg, 2),
        conditions: latestObservation?.description || 'Unknown',
        daylight_hours: roundToDecimal(daylightHours, 2)
    };
}

function buildDateRange(dateString, timeZone) {
    const noonUtc = new Date(`${dateString}T12:00:00Z`);
    const offsetMinutes = getTimeZoneOffsetMinutes(noonUtc, timeZone);
    const offset = formatOffset(offsetMinutes);

    return {
        start: `${dateString}T00:00:00${offset}`,
        end: `${dateString}T23:59:59${offset}`
    };
}

function getTimeZoneOffsetMinutes(date, timeZone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone,
        timeZoneName: 'shortOffset'
    });
    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find(part => part.type === 'timeZoneName')?.value || 'GMT';
    const match = offsetPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);

    if (!match) {
        return 0;
    }

    const sign = match[1] === '-' ? -1 : 1;
    const hours = parseInt(match[2], 10);
    const minutes = match[3] ? parseInt(match[3], 10) : 0;

    return sign * (hours * 60 + minutes);
}

function formatOffset(minutes) {
    const sign = minutes < 0 ? '-' : '+';
    const absMinutes = Math.abs(minutes);
    const hours = String(Math.floor(absMinutes / 60)).padStart(2, '0');
    const mins = String(absMinutes % 60).padStart(2, '0');

    return `${sign}${hours}:${mins}`;
}

function calculateDaylightHours(dateString, latitude) {
    const dayOfYear = getDayOfYear(dateString);
    const latitudeRad = degreesToRadians(latitude);
    const declination = 0.409 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
    const sunAltitude = degreesToRadians(-0.833);

    const cosOmega = (Math.sin(sunAltitude) - Math.sin(latitudeRad) * Math.sin(declination)) /
        (Math.cos(latitudeRad) * Math.cos(declination));

    if (cosOmega >= 1) {
        return 0;
    }

    if (cosOmega <= -1) {
        return 24;
    }

    const omega = Math.acos(cosOmega);
    return (24 / Math.PI) * omega;
}

function getDayOfYear(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const start = new Date(Date.UTC(year, 0, 1));

    return Math.floor((date - start) / 86400000) + 1;
}

function degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180;
}

function celsiusToFahrenheit(value) {
    if (typeof value !== 'number') {
        return null;
    }

    return (value * 9) / 5 + 32;
}

function metersPerSecondToMph(value) {
    if (typeof value !== 'number') {
        return null;
    }

    return value * 2.2369362921;
}

function convertWindToMph(value, unitCode) {
    if (typeof value !== 'number') {
        return null;
    }

    // Parse the NWS unit code
    // Common formats: "wmoUnit:km_h-1", "wmoUnit:m_s-1", "unit:m_s-1", "unit:km_h-1"
    if (!unitCode) {
        // Default to km/h as that's what NWS currently uses
        return value * 0.621371;
    }

    const unitStr = unitCode.toLowerCase();

    if (unitStr.includes('km') || unitStr.includes('kmh')) {
        // km/h to mph
        return value * 0.621371;
    } else if (unitStr.includes('m_s') || unitStr.includes('ms-1')) {
        // m/s to mph
        return value * 2.2369362921;
    } else if (unitStr.includes('mph') || unitStr.includes('mi_h')) {
        // Already in mph
        return value;
    } else if (unitStr.includes('kt') || unitStr.includes('knot')) {
        // Knots to mph
        return value * 1.15078;
    } else {
        // Unknown unit, default to km/h (most common from NWS)
        console.warn(`Unknown wind unit: ${unitCode}, defaulting to km/h conversion`);
        return value * 0.621371;
    }
}

function maxNumber(...values) {
    const numericValues = values.filter(value => typeof value === 'number');
    if (!numericValues.length) {
        return null;
    }

    return Math.max(...numericValues);
}

function average(values) {
    if (!values.length) {
        return null;
    }

    const total = values.reduce((sum, value) => sum + value, 0);
    return total / values.length;
}

function roundToDecimal(value, decimals) {
    if (typeof value !== 'number') {
        return 0;
    }

    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}
