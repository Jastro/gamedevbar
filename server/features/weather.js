// The weather outside the bars: Spain's in general, shared by everyone
// (src/world/Weather.js draws it). One Open-Meteo request (free, no key)
// every 10 minutes covers 8 cities across the peninsula; the street shows
// what most of them have. Day and night follow Madrid's sun. The last good
// answer stays if a request fails. (Each player's own local weather is for
// the bar clocks and is fetched in their browser: src/world/LocalWeather.js.)
const CITIES = [
    ['Madrid', 40.42, -3.70], ['Barcelona', 41.39, 2.17], ['Sevilla', 37.39, -5.98],
    ['Valencia', 39.47, -0.38], ['Bilbao', 43.26, -2.93], ['A Coruña', 43.37, -8.40],
    ['Zaragoza', 41.65, -0.89], ['Málaga', 36.72, -4.42]
];
const URL = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${CITIES.map(c => c[1]).join(',')}&longitude=${CITIES.map(c => c[2]).join(',')}`
    + '&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m'
    + '&daily=sunrise,sunset&forecast_days=1&timezone=Europe%2FMadrid';
const REFRESH_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 10000;
const MIN_WET_CITIES = 3; // this many with rain/snow/storm → it rains outside
const MIN_FOG_CITIES = 3;

// WMO codes → what the street shows (same groups as weatherKind in Weather.js).
function kindOf(code) {
    if (code >= 95) return 'storm';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if (code >= 51 && code <= 57) return 'drizzle';
    if (code === 45 || code === 48) return 'fog';
    return 'dry';
}
// A representative code per kind.
const KIND_CODE = { storm: 95, snow: 73, rain: 63, drizzle: 53, fog: 45 };

// "2026-10-22T08:23" (Madrid local) → minutes after midnight.
function minutesOfDay(isoLocal) {
    const match = /T(\d{2}):(\d{2})/.exec(String(isoLocal ?? ''));
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

const number = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const average = (values) => {
    const valid = values.filter(value => value !== null);
    return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};

// Many locations' answers → one "Spain in general".
function combine(answers) {
    const current = answers.map(answer => answer?.current ?? {});
    const kinds = current.map(c => kindOf(number(c.weather_code) ?? 0));
    const count = (kind) => kinds.filter(k => k === kind).length;
    const wet = ['storm', 'snow', 'rain', 'drizzle'];
    const wetCount = wet.reduce((sum, kind) => sum + count(kind), 0);
    const cloudCover = Math.round(average(current.map(c => number(c.cloud_cover))) ?? 0);
    let code;
    if (wetCount >= MIN_WET_CITIES) {
        // The most common wet kind; storms win ties (they're the fun ones).
        code = KIND_CODE[wet.reduce((best, kind) => (count(kind) > count(best) ? kind : best), 'storm')];
    } else if (count('fog') >= MIN_FOG_CITIES) {
        code = KIND_CODE.fog;
    } else {
        code = cloudCover >= 70 ? 3 : cloudCover >= 35 ? 2 : cloudCover >= 15 ? 1 : 0;
    }
    const madrid = answers[0] ?? {};
    const temperature = average(current.map(c => number(c.temperature_2m)));
    return {
        code,
        temperature: temperature === null ? null : Math.round(temperature * 10) / 10,
        cloudCover,
        wind: Math.round((average(current.map(c => number(c.wind_speed_10m))) ?? 0) * 10) / 10,
        sunrise: minutesOfDay(madrid.daily?.sunrise?.[0]) ?? 8 * 60,
        sunset: minutesOfDay(madrid.daily?.sunset?.[0]) ?? 20 * 60,
        wetCities: wetCount,
        updatedAt: Date.now()
    };
}

function registerWeather(hub) {
    // Clear sky with typical Madrid sun times until the first answer.
    let state = { code: 0, temperature: null, cloudCover: 0, wind: 0, sunrise: 8 * 60, sunset: 20 * 60, wetCities: 0, updatedAt: 0 };

    const refresh = async () => {
        try {
            const response = await fetch(URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const json = await response.json();
            state = combine(Array.isArray(json) ? json : [json]);
            hub.broadcastAll({ type: 'weatherState', ...state });
        } catch (error) {
            console.warn('Weather refresh failed, keeping the last state:', error.message);
        }
    };
    refresh();
    setInterval(refresh, REFRESH_MS).unref();

    hub.onJoin(({ ws }) => hub.send(ws, { type: 'weatherState', ...state }));
}

module.exports = { registerWeather, combine };
