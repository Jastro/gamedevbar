import * as THREE from 'three';

// Short sound effects made from filtered noise, so they need no audio
// files: a trickle, a flush, running water, a spray hiss. Each is played
// once as a PositionalAudio at a spot in the world and then removed.

const buffers = new WeakMap(); // AudioContext -> Map(key -> AudioBuffer)

// Noise shaped by envelope(t, duration) (0..1), cached per context and key.
function noiseBuffer(context, key, duration, envelope) {
    if (!buffers.has(context)) buffers.set(context, new Map());
    const cache = buffers.get(context);
    if (cache.has(key)) return cache.get(key);
    const length = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * envelope(i / context.sampleRate, duration);
    }
    cache.set(key, buffer);
    return buffer;
}

const fade = (t, duration, attack, release) => Math.min(1, t / attack) * Math.min(1, (duration - t) / release);

const RECIPES = {
    // A wobbling trickle.
    pee: {
        duration: 4,
        envelope: (t, d) => fade(t, d, 0.3, 0.6) * (0.7 + 0.3 * Math.sin(t * 38) * Math.sin(t * 5)),
        filter: { type: 'bandpass', from: 2400, to: 1600, q: 2.5 },
        volume: 0.5
    },
    // A roaring whoosh that drains away.
    flush: {
        duration: 2.8,
        envelope: (t, d) => fade(t, d, 0.05, 1.4),
        filter: { type: 'lowpass', from: 5000, to: 250, q: 0.8 },
        volume: 0.9
    },
    wash: {
        duration: 2.4,
        envelope: (t, d) => fade(t, d, 0.15, 0.5) * (0.85 + 0.15 * Math.sin(t * 23)),
        filter: { type: 'bandpass', from: 1400, to: 1200, q: 0.9 },
        volume: 0.45
    },
    spray: {
        duration: 0.9,
        envelope: (t, d) => fade(t, d, 0.02, 0.2),
        filter: { type: 'highpass', from: 5000, to: 4000, q: 0.7 },
        volume: 0.5
    }
};

// Plays a recipe at `position` inside `parent` (an object in the scene).
export function playSynth(listener, parent, position, name, refDistance = 3) {
    const recipe = RECIPES[name];
    if (!listener || !recipe) return;
    const context = listener.context;
    const sound = new THREE.PositionalAudio(listener);
    sound.setBuffer(noiseBuffer(context, name, recipe.duration, recipe.envelope));
    sound.setRefDistance(refDistance);
    sound.setVolume(recipe.volume);
    const filter = context.createBiquadFilter();
    filter.type = recipe.filter.type;
    filter.Q.value = recipe.filter.q;
    filter.frequency.setValueAtTime(recipe.filter.from, context.currentTime);
    filter.frequency.exponentialRampToValueAtTime(recipe.filter.to, context.currentTime + recipe.duration);
    sound.setFilter(filter);
    sound.position.copy(position);
    parent.add(sound);
    sound.play();
    setTimeout(() => {
        release(sound);
        filter.disconnect();
    }, recipe.duration * 1000 + 300);
}

// Stops a one-shot and unhooks every node it created.
function release(sound) {
    if (sound.isPlaying) sound.stop();
    sound.disconnect();
    sound.panner.disconnect();
    sound.gain.disconnect();
    sound.removeFromParent();
}

// Plays a loaded sound file at `position` (e.g. the fart samples).
const fileBuffers = new Map(); // url -> Promise<AudioBuffer>
export function playFile(listener, parent, position, url, volume = 0.8, refDistance = 3) {
    if (!listener) return;
    if (!fileBuffers.has(url)) fileBuffers.set(url, new THREE.AudioLoader().loadAsync(url));
    fileBuffers.get(url).then(buffer => {
        const sound = new THREE.PositionalAudio(listener);
        sound.setBuffer(buffer);
        sound.setRefDistance(refDistance);
        sound.setVolume(volume);
        sound.position.copy(position);
        parent.add(sound);
        sound.play();
        setTimeout(() => release(sound), buffer.duration * 1000 + 300);
    }).catch(() => {});
}
