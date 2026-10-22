import { weatherKind } from './Weather';

// Your own time and weather, for the bar clocks (the plaza outside shows
// Spain's, from the server). The browser asks once for your location; it's
// rounded to ~10 km, kept for a day, and only ever sent to Open-Meteo, from
// your browser. Without it: the Canary timezone gets Las Palmas, anything
// else Madrid. (A forum embed needs allow="geolocation" on its iframe.)
const STORAGE_KEY = 'localWeatherPlace';
const PLACE_MAX_AGE = 24 * 60 * 60 * 1000;
const REFRESH_MS = 15 * 60 * 1000;
const FALLBACKS = {
    'Atlantic/Canary': { lat: 28.1, lon: -15.4, name: 'Las Palmas' },
    default: { lat: 40.4, lon: -3.7, name: 'Madrid' }
};
const ICONS = { clear: '☀️', cloudy: '☁️', fog: '🌫️', drizzle: '🌦️', rain: '🌧️', snow: '🌨️', storm: '⛈️' };
const NIGHT_ICONS = { clear: '🌙', cloudy: '☁️' };

const localClock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function loadPlace() {
    try {
        const place = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (place && Date.now() - place.at < PLACE_MAX_AGE) return place;
    } catch {
        // No storage (private window): ask again.
    }
    return null;
}

function savePlace(place) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(place));
    } catch {
        // Not kept; asked again next visit.
    }
}

export class LocalWeather {
    constructor() {
        this.place = null;   // { lat, lon, name }
        this.current = null; // { code, temperature, isDay }
    }

    // After entering the bar: find the place, then keep the weather fresh.
    async start() {
        this.place = loadPlace() ?? await this.locate();
        await this.refresh();
        setInterval(() => this.refresh(), REFRESH_MS);
    }

    locate() {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const fallback = { ...(FALLBACKS[timezone] ?? FALLBACKS.default), at: Date.now() };
        if (!navigator.geolocation) return Promise.resolve(fallback);
        return new Promise(resolve => {
            navigator.geolocation.getCurrentPosition(
                ({ coords }) => {
                    const round = (value) => Math.round(value * 10) / 10;
                    const place = { lat: round(coords.latitude), lon: round(coords.longitude), name: 'Tu zona', at: Date.now() };
                    savePlace(place);
                    resolve(place);
                },
                () => resolve(fallback),
                { timeout: 15000, maximumAge: PLACE_MAX_AGE, enableHighAccuracy: false }
            );
        });
    }

    async refresh() {
        if (!this.place) return;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.place.lat}&longitude=${this.place.lon}`
            + '&current=temperature_2m,weather_code,is_day&timezone=auto';
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const { current } = await response.json();
            this.current = {
                code: Number(current?.weather_code) || 0,
                temperature: typeof current?.temperature_2m === 'number' ? current.temperature_2m : null,
                isDay: current?.is_day !== 0
            };
        } catch {
            // Keep the last one (or none: the clock shows Spain's).
        }
    }

    // { time, weather, place } for the clocks; `spain` (Weather) when we have
    // nothing of our own yet.
    label(spain) {
        const time = localClock.format(new Date());
        if (!this.current) {
            const fallback = spain.label();
            return { time, weather: fallback.weather, place: 'España' };
        }
        const kind = weatherKind(this.current.code);
        const icon = (!this.current.isDay && NIGHT_ICONS[kind]) || ICONS[kind];
        const temperature = this.current.temperature === null ? '' : ` ${Math.round(this.current.temperature)}°C`;
        return { time, weather: `${icon}${temperature}`, place: this.place?.name ?? '' };
    }
}
