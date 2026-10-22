// Real weather in Madrid, shared by everyone (src/world/Weather.js draws
// it). Open-Meteo is free and needs no key; we ask every 10 minutes and keep
// the last good answer if a request fails.
const URL = 'https://api.open-meteo.com/v1/forecast?latitude=40.4168&longitude=-3.7038'
    + '&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m'
    + '&daily=sunrise,sunset&forecast_days=1&timezone=Europe%2FMadrid';
const REFRESH_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 10000;

// "2026-10-22T08:23" (Madrid local) → minutes after midnight.
function minutesOfDay(isoLocal) {
    const match = /T(\d{2}):(\d{2})/.exec(String(isoLocal ?? ''));
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function parse(json) {
    const current = json?.current ?? {};
    const number = (value, fallback) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
    return {
        code: number(current.weather_code, 0),
        temperature: number(current.temperature_2m, null),
        cloudCover: number(current.cloud_cover, 0),
        wind: number(current.wind_speed_10m, 0),
        sunrise: minutesOfDay(json?.daily?.sunrise?.[0]) ?? 8 * 60,
        sunset: minutesOfDay(json?.daily?.sunset?.[0]) ?? 20 * 60,
        updatedAt: Date.now()
    };
}

function registerWeather(hub) {
    // Clear sky with typical Madrid sun times until the first answer.
    let state = { code: 0, temperature: null, cloudCover: 0, wind: 0, sunrise: 8 * 60, sunset: 20 * 60, updatedAt: 0 };

    const refresh = async () => {
        try {
            const response = await fetch(URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            state = parse(await response.json());
            hub.broadcastAll({ type: 'weatherState', ...state });
        } catch (error) {
            console.warn('Weather refresh failed, keeping the last state:', error.message);
        }
    };
    refresh();
    setInterval(refresh, REFRESH_MS).unref();

    hub.onJoin(({ ws }) => hub.send(ws, { type: 'weatherState', ...state }));
}

module.exports = { registerWeather };
