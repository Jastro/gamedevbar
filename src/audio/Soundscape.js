import * as THREE from 'three';

// The world's background sound, all made in code (no files):
// - birds by day and crickets at night, everywhere outside (much fainter
//   from inside a bar; birds hush in the rain);
// - a murmur of voices outside each bar's door that grows with how many
//   people are inside (none for the bar you're in: you hear them for real).
const LOOP_SECONDS = 8;
const VOLUME = { birds: 0.18, crickets: 0.12, murmur: 0.4 };
const INSIDE_FACTOR = 0.12;
const RAIN_FACTOR = { birds: 0.25, crickets: 0.6 };
const CROWD_FULL = 6;        // people inside for the loudest murmur
const COUNT_INTERVAL = 1000; // ms between headcounts
const FADE_RATE = 1.5;       // 1/s

export class Soundscape {
    constructor(game) {
        this.game = game;
        this.ready = false;
        this.levels = { birds: 0, crickets: 0 };
        this.counts = new Map(); // roomId -> people inside
        this.lastCount = 0;
    }

    // Once audio exists (the first click).
    create(listener) {
        const context = listener.context;
        this.birds = this.loop(listener, createBirds(context));
        this.crickets = this.loop(listener, createCrickets(context));
        const murmurBuffer = createMurmur(context);
        this.murmurs = new Map();
        this.game.world.rooms.forEach(room => {
            const sound = new THREE.PositionalAudio(listener);
            sound.setBuffer(murmurBuffer);
            sound.setLoop(true);
            sound.setRefDistance(4);
            sound.setRolloffFactor(1.4);
            sound.setVolume(0);
            const lowpass = context.createBiquadFilter();
            lowpass.type = 'lowpass';
            lowpass.frequency.value = 1700;
            sound.setFilter(lowpass);
            // Just outside the entrance.
            sound.position.copy(room.toWorld(0, 1.8, 11));
            this.game.scene.getScene().add(sound);
            this.murmurs.set(room.id, { sound, level: 0 });
        });
        this.ready = true;
    }

    loop(listener, buffer) {
        const sound = new THREE.Audio(listener);
        sound.setBuffer(buffer);
        sound.setLoop(true);
        sound.setVolume(0);
        return sound;
    }

    update(deltaTime) {
        const listener = this.game.environment.audioListener;
        if (!listener) return;
        if (!this.ready) this.create(listener);
        if (listener.context.state !== 'running') return;
        const dt = Math.min(deltaTime, 0.1);
        const t = 1 - Math.exp(-FADE_RATE * dt);
        const { weather, world, players } = this.game;
        const player = players.localPlayer;
        const here = player ? world.getRoomAt(player.position) : null;
        const day = weather?.daylight() ?? 1;
        const raining = ['rain', 'drizzle', 'storm'].includes(weather?.kind);
        const place = here ? INSIDE_FACTOR : 1;

        const targets = {
            birds: VOLUME.birds * day * place * (raining ? RAIN_FACTOR.birds : 1),
            crickets: VOLUME.crickets * (1 - day) * place * (raining ? RAIN_FACTOR.crickets : 1)
        };
        Object.entries(targets).forEach(([name, target]) => {
            this.levels[name] += (target - this.levels[name]) * t;
            this.setLevel(this[name], this.levels[name]);
        });

        this.countPeople();
        this.murmurs.forEach((entry, roomId) => {
            const crowd = Math.min(1, (this.counts.get(roomId) ?? 0) / CROWD_FULL);
            const target = here?.id === roomId ? 0 : VOLUME.murmur * crowd;
            entry.level += (target - entry.level) * t;
            this.setLevel(entry.sound, entry.level);
        });
    }

    setLevel(sound, level) {
        if (level > 0.002 && !sound.isPlaying) sound.play();
        if (level <= 0.002 && sound.isPlaying) sound.stop();
        sound.setVolume(level);
    }

    countPeople() {
        const now = performance.now();
        if (now - this.lastCount < COUNT_INTERVAL) return;
        this.lastCount = now;
        this.counts.clear();
        this.game.players.players.forEach(player => {
            const room = this.game.world.getRoomAt(player.position);
            if (room) this.counts.set(room.id, (this.counts.get(room.id) ?? 0) + 1);
        });
    }
}

function buffer(context, fill) {
    const rate = context.sampleRate;
    const length = Math.floor(rate * LOOP_SECONDS);
    const result = context.createBuffer(1, length, rate);
    fill(result.getChannelData(0), rate, length);
    return result;
}

// Events wrap round the end, so the loops have no seam.
function addAt(data, length, start, samples, sample) {
    for (let j = 0; j < samples; j++) data[(start + j) % length] += sample(j);
}

// Bursts of 2-5 quick chirps (sines sweeping up or down), now and then.
function createBirds(context) {
    return buffer(context, (data, rate, length) => {
        for (let burst = 0; burst < LOOP_SECONDS * 1.2; burst++) {
            let start = Math.floor(Math.random() * length);
            const notes = 2 + Math.floor(Math.random() * 4);
            const base = 2600 + Math.random() * 2200;
            const sweep = (Math.random() < 0.5 ? -1 : 1) * (600 + Math.random() * 1400);
            const amplitude = 0.12 + Math.random() * 0.15;
            for (let n = 0; n < notes; n++) {
                const duration = Math.floor(rate * (0.05 + Math.random() * 0.08));
                let phase = 0;
                addAt(data, length, start, duration, (j) => {
                    const t = j / duration;
                    phase += (2 * Math.PI * (base + sweep * t)) / rate;
                    return Math.sin(phase) * amplitude * Math.sin(Math.PI * t);
                });
                start += duration + Math.floor(rate * (0.03 + Math.random() * 0.08));
            }
        }
    });
}

// Two crickets: a high tone in trills of three quick pulses.
function createCrickets(context) {
    return buffer(context, (data, rate, length) => {
        [[4400, 0.65, 0.18], [4850, 0.83, 0.12]].forEach(([frequency, every, amplitude]) => {
            for (let time = Math.random() * every; time < LOOP_SECONDS; time += every * (0.9 + Math.random() * 0.2)) {
                for (let pulse = 0; pulse < 3; pulse++) {
                    const start = Math.floor((time + pulse * 0.035) * rate);
                    const duration = Math.floor(rate * 0.022);
                    addAt(data, length, start, duration, (j) => Math.sin((2 * Math.PI * frequency * j) / rate) * amplitude * Math.sin((Math.PI * j) / duration));
                }
            }
        });
    });
}

// Several "voices": noise in syllables (4-7 a second) at different pitches,
// so it reads as people talking but no words.
function createMurmur(context) {
    return buffer(context, (data, rate, length) => {
        for (let voice = 0; voice < 6; voice++) {
            const formant = 350 + Math.random() * 700;
            let low = 0;
            let band = 0;
            let time = Math.random() * 0.5;
            while (time < LOOP_SECONDS) {
                const syllable = 0.1 + Math.random() * 0.15;
                const start = Math.floor(time * rate);
                const duration = Math.floor(syllable * rate);
                const amplitude = 0.08 + Math.random() * 0.06;
                // A crude resonant filter on the noise, at this voice's formant.
                const f = 2 * Math.sin((Math.PI * formant) / rate);
                addAt(data, length, start, duration, (j) => {
                    const noise = Math.random() * 2 - 1;
                    low += f * band;
                    band += f * (noise - low - 0.6 * band);
                    return band * amplitude * Math.sin((Math.PI * j) / duration);
                });
                // Pauses between phrases.
                time += syllable + (Math.random() < 0.15 ? 0.4 + Math.random() * 0.8 : 0.02);
            }
        }
    });
}
