// Rain, made in code: a soft, low bed (brown-ish noise that swells slowly)
// with drops on top (short low taps: a few cycles of an upward chirp plus a
// dull patter of noise; kept low and short, high sines sounded like chimes). Many quiet drops and a few louder ones,
// different in each ear. The loop wraps seamlessly (drops wrap round the end,
// the bed crossfades its tail into its head).
// Pure: returns sample arrays, so it can also be rendered outside the browser.

const DROPS_PER_SECOND = 40;
const BED_LEVEL = 0.13;
const DROP_LEVEL = 0.55;
const PEAK = 0.9;

// Small deterministic generator, so both ears differ but every client sounds alike.
function random(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function renderChannel(rate, seconds, seed) {
    const length = Math.floor(rate * seconds);
    const data = new Float32Array(length);
    const rand = random(seed);

    // Bed: white noise through two one-pole low-passes (soft, no hiss), with
    // a slow swell. Rendered with an extra tail that's crossfaded over the
    // start so the loop has no seam.
    const fade = Math.floor(rate * 0.5);
    const bed = new Float32Array(length + fade);
    const k1 = 1 - Math.exp((-2 * Math.PI * 900) / rate);
    const k2 = 1 - Math.exp((-2 * Math.PI * 350) / rate);
    let a = 0;
    let b = 0;
    const swellRate = (2 * Math.PI) / seconds; // one swell per loop: seamless
    const swellPhase = rand() * Math.PI * 2;
    for (let i = 0; i < bed.length; i++) {
        a += k1 * (rand() * 2 - 1 - a);
        b += k2 * (a - b);
        const swell = 0.8 + 0.2 * Math.sin(swellPhase + (i / rate) * swellRate);
        bed[i] = b * 6 * swell; // the filters take most of the level away
    }
    for (let i = 0; i < length; i++) data[i] = bed[i] * BED_LEVEL;
    for (let i = 0; i < fade; i++) {
        const t = i / fade;
        data[i] = (bed[i] * t + bed[length + i] * (1 - t)) * BED_LEVEL;
    }

    // Drops: a short, low "plip" (a few cycles of an upward chirp, so it's a
    // soft tap rather than a ringing tone) plus a little dull patter of
    // low-passed noise. Low on purpose: high, long sines sounded like chimes.
    const count = Math.floor(DROPS_PER_SECOND * seconds);
    const kPatter = 1 - Math.exp((-2 * Math.PI * 1200) / rate);
    for (let n = 0; n < count; n++) {
        const start = Math.floor(rand() * length);
        const size = rand();
        const amplitude = DROP_LEVEL * (0.1 + 0.9 * size * size * size); // mostly small
        const base = 380 + rand() * 650 - size * 150;  // bigger drops are lower
        const rise = 1.12 + rand() * 0.25;             // a short upward chirp
        const duration = Math.floor(rate * (0.008 + 0.014 * size + rand() * 0.006));
        let phase = rand() * Math.PI * 2;
        let patter = 0;
        for (let j = 0; j < duration; j++) {
            const t = j / duration;
            const frequency = base * (1 + (rise - 1) * t);
            phase += (2 * Math.PI * frequency) / rate;
            const envelope = Math.min(1, j / (rate * 0.003)) * Math.pow(1 - t, 3); // 3 ms attack: no click
            patter += kPatter * (rand() * 2 - 1 - patter);
            const sample = (Math.sin(phase) * 0.7 + patter * 2.2) * envelope * amplitude;
            data[(start + j) % length] += sample;
        }
    }

    // Gentle smoothing of the very top end.
    let last = 0;
    const k3 = 1 - Math.exp((-2 * Math.PI * 2500) / rate);
    for (let i = 0; i < length; i++) {
        last += k3 * (data[i] - last);
        data[i] = last;
    }
    return data;
}

// [left, right] sample arrays, peak-normalized.
export function renderRain(rate, seconds = 6) {
    const channels = [renderChannel(rate, seconds, 1013), renderChannel(rate, seconds, 7919)];
    let peak = 0;
    channels.forEach(data => data.forEach(value => { peak = Math.max(peak, Math.abs(value)); }));
    const scale = peak > 0 ? PEAK / peak : 1;
    channels.forEach(data => { for (let i = 0; i < data.length; i++) data[i] *= scale; });
    return channels;
}
