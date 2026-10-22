import * as THREE from 'three';
import { ROOMS, ROOM_HALF_WIDTH, ROOM_HALF_DEPTH } from './RoomLayout';
import { playSynth } from '../audio/synth';

// Real time and weather in Madrid (server: server/features/weather.js).
// The sky follows the real sun (sunrise/sunset from the forecast, with a
// twilight blend) and the clouds; outside, the light follows the
// sky and the lamp posts by the roads come on at night. Rain, snow, fog and
// storms only happen outside the bars (they have no roof, but nobody wants
// rain on the counter), and fog only while you're outside.
const TWILIGHT = 45; // minutes on each side of sunrise/sunset
const SKY = {
    night: new THREE.Color(0x0b1026),
    twilight: new THREE.Color(0xd9825b),
    clear: new THREE.Color(0x87b8e8),
    overcast: new THREE.Color(0x8b939b),
    flash: new THREE.Color(0xdfe6ff)
};
const RAIN_DROPS = 1400;
const SNOW_FLAKES = 900;
const PRECIPITATION_TOP = 14;
// Rain and snow fill a box this big (half width) around the camera, wrapping
// as it moves, so the whole map can have weather with a few thousand drops.
const PRECIPITATION_HALF = 24;
// Light count is costly (every material), so only every other lamp has one.
const LAMP_LIGHT_EVERY = 2;
const LAMP_HEIGHT = 5;
const LAMP_INTENSITY = 14;
const LAMP_DISTANCE = 26;
const RAIN_VOLUME = { outside: 0.35, inside: 0.06 };

// WMO weather codes → what we draw.
export function weatherKind(code) {
    if (code >= 95) return 'storm';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if (code >= 51 && code <= 57) return 'drizzle';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 2) return 'cloudy';
    return 'clear';
}

const ICONS = { clear: '☀️', cloudy: '☁️', fog: '🌫️', drizzle: '🌦️', rain: '🌧️', snow: '🌨️', storm: '⛈️' };
const NIGHT_ICONS = { clear: '🌙', cloudy: '☁️' };

const madridClock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

export class Weather {
    constructor(game) {
        this.game = game;
        this.state = { code: 0, temperature: null, cloudCover: 0, wind: 0, sunrise: 8 * 60, sunset: 20 * 60 };
        this.sky = new THREE.Color(SKY.clear);
        this.flash = 0;
        this.nextLightning = 5;
        this.outside = false;
    }

    // After the world exists (the outdoors are in the scene).
    create() {
        const scene = this.game.scene.getScene();
        scene.background = this.sky;
        this.fog = new THREE.Fog(0x9aa3ab, 4, 32);
        this.createLamps(scene);
        this.createRain(scene);
        this.createSnow(scene);
    }

    bind() {
        this.game.network.on('weatherState', (data) => {
            this.state = {
                code: Number(data.code) || 0,
                temperature: typeof data.temperature === 'number' ? data.temperature : null,
                cloudCover: Number(data.cloudCover) || 0,
                wind: Number(data.wind) || 0,
                sunrise: Number.isFinite(data.sunrise) ? data.sunrise : 8 * 60,
                sunset: Number.isFinite(data.sunset) ? data.sunset : 20 * 60
            };
        });
    }

    // --- Time ------------------------------------------------------------------

    // Madrid "HH:MM" and minutes after midnight, from the server's clock.
    madridTime() {
        const parts = madridClock.formatToParts(new Date(this.game.serverClock.now()));
        const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
        const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
        return { text: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, minutes: hour * 60 + minute };
    }

    // 0 at night, 1 in daylight, blended through twilight.
    daylight(minutes = this.madridTime().minutes) {
        const { sunrise, sunset } = this.state;
        const ramp = (value) => THREE.MathUtils.smoothstep(value, -TWILIGHT, TWILIGHT);
        return Math.min(ramp(minutes - sunrise), ramp(sunset - minutes));
    }

    get kind() {
        return weatherKind(this.state.code);
    }

    // "21:43 · 🌧️ 14°C" for the bar clocks.
    label() {
        const { text, minutes } = this.madridTime();
        const night = this.daylight(minutes) < 0.5;
        const icon = (night && NIGHT_ICONS[this.kind]) || ICONS[this.kind];
        const temperature = this.state.temperature === null ? '' : ` ${Math.round(this.state.temperature)}°C`;
        return { time: text, weather: `${icon}${temperature}` };
    }

    // What RoomLighting applies outside: factors of the level's lights.
    outdoorLight() {
        const day = this.daylight();
        const clouds = THREE.MathUtils.clamp(this.state.cloudCover / 100, 0, 1);
        const gloom = ['rain', 'storm', 'fog', 'drizzle'].includes(this.kind) ? 0.15 : 0;
        const dayLevel = 1 - 0.2 * clouds - gloom;
        return {
            ambient: THREE.MathUtils.lerp(0.35, dayLevel, day) + this.flash * 1.5,
            directional: THREE.MathUtils.lerp(0.05, dayLevel, day) + this.flash,
            color: new THREE.Color(0x6c7cff).lerp(new THREE.Color(0xffffff), day)
        };
    }

    // --- Pieces ------------------------------------------------------------

    createLamps(scene) {
        const pole = new THREE.MeshStandardMaterial({ color: 0x2f3337, metalness: 0.6, roughness: 0.5 });
        this.bulbMaterial = new THREE.MeshStandardMaterial({ color: 0x555555, emissive: 0xffd590, emissiveIntensity: 0 });
        this.lampGroup = new THREE.Group(); // RoomLighting dims it with the outdoors
        scene.add(this.lampGroup);
        this.lampLights = [];
        this.game.world.outdoors.getLampSpots().forEach(({ x, z }, index) => {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, LAMP_HEIGHT, 10), pole);
            post.position.set(x, LAMP_HEIGHT / 2, z);
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), this.bulbMaterial);
            head.position.set(x, LAMP_HEIGHT + 0.1, z);
            this.lampGroup.add(post, head);
            post.updateMatrixWorld(true);
            this.game.world.collisionManager.addCollider(post);
            if (index % LAMP_LIGHT_EVERY !== 0) return;
            const light = new THREE.PointLight(0xffd590, 0, LAMP_DISTANCE, 1);
            light.position.set(x, LAMP_HEIGHT, z);
            scene.add(light);
            this.lampLights.push(light);
        });
    }

    createRain(scene) {
        const positions = new Float32Array(RAIN_DROPS * 6);
        this.rainDrops = [];
        for (let i = 0; i < RAIN_DROPS; i++) {
            this.rainDrops.push({
                x: THREE.MathUtils.randFloat(-PRECIPITATION_HALF, PRECIPITATION_HALF),
                y: Math.random() * PRECIPITATION_TOP,
                z: THREE.MathUtils.randFloat(-PRECIPITATION_HALF, PRECIPITATION_HALF),
                speed: THREE.MathUtils.randFloat(11, 15)
            });
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.rain = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xaec2d6, transparent: true, opacity: 0.55 }));
        this.rain.frustumCulled = false;
        this.rain.visible = false;
        this.rain.raycast = () => {};
        scene.add(this.rain);
    }

    createSnow(scene) {
        const positions = new Float32Array(SNOW_FLAKES * 3);
        this.flakes = [];
        for (let i = 0; i < SNOW_FLAKES; i++) {
            this.flakes.push({
                x: THREE.MathUtils.randFloat(-PRECIPITATION_HALF, PRECIPITATION_HALF),
                y: Math.random() * PRECIPITATION_TOP,
                z: THREE.MathUtils.randFloat(-PRECIPITATION_HALF, PRECIPITATION_HALF),
                phase: Math.random() * Math.PI * 2
            });
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        // A soft round flake (plain points are squares).
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.7)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);
        this.snow = new THREE.Points(geometry, new THREE.PointsMaterial({
            size: 0.09, map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false
        }));
        this.snow.frustumCulled = false;
        this.snow.visible = false;
        this.snow.raycast = () => {};
        scene.add(this.snow);
    }

    // A looping hiss, built once the audio listener exists.
    ensureRainSound() {
        const listener = this.game.environment.audioListener;
        if (this.rainSound || !listener) return;
        const context = listener.context;
        const length = context.sampleRate * 2;
        const buffer = context.createBuffer(1, length, context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
        this.rainSound = new THREE.Audio(listener);
        this.rainSound.setBuffer(buffer);
        this.rainSound.setLoop(true);
        this.rainSound.setVolume(0);
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1600;
        this.rainSound.setFilter(filter);
    }

    // --- Per frame -----------------------------------------------------------

    update(deltaTime) {
        if (!this.rain) return;
        const dt = Math.min(deltaTime, 0.1);
        const { world, players, scene } = this.game;
        const position = players.localPlayer?.position;
        this.outside = Boolean(position) && !world.getRoomAt(position);
        const kind = this.kind;
        const day = this.daylight();

        // Lightning: a flash now and then, thunder a moment later.
        this.flash = Math.max(0, this.flash - dt * 4);
        if (kind === 'storm') {
            this.nextLightning -= dt;
            if (this.nextLightning <= 0) {
                this.nextLightning = THREE.MathUtils.randFloat(8, 20);
                this.flash = 1;
                const camera = this.game.camera.getCamera();
                const listener = this.game.environment.audioListener;
                setTimeout(() => playSynth(listener, camera, new THREE.Vector3(0, 0, -2), 'thunder', 5), 700);
            }
        }

        // Sky.
        const clouds = THREE.MathUtils.clamp(this.state.cloudCover / 100, 0, 1);
        const daySky = SKY.clear.clone().lerp(SKY.overcast, Math.max(clouds, kind === 'clear' ? 0 : 0.6));
        const twilight = Math.max(0, 1 - Math.abs(day - 0.5) * 2) * (1 - clouds * 0.7);
        this.sky.copy(SKY.night).lerp(daySky, day).lerp(SKY.twilight, twilight * 0.6).lerp(SKY.flash, this.flash * 0.8);
        scene.getScene().fog = this.outside && kind === 'fog' ? this.fog : null;
        if (this.fog) this.fog.color.copy(this.sky).lerp(new THREE.Color(0x9aa3ab), 0.5);

        // Lamps.
        const night = 1 - day;
        this.lampLights.forEach(light => { light.intensity = LAMP_INTENSITY * night; });
        this.bulbMaterial.emissiveIntensity = 1.5 * night;

        // Rain and snow.
        const raining = kind === 'rain' || kind === 'drizzle' || kind === 'storm';
        this.rain.visible = raining;
        if (raining) this.updateRain(dt, kind === 'drizzle' ? 0.35 : 1);
        this.snow.visible = kind === 'snow';
        if (this.snow.visible) this.updateSnow(dt);

        this.ensureRainSound();
        if (this.rainSound) {
            const strength = raining ? (kind === 'drizzle' ? 0.4 : 1) : 0;
            const volume = strength * (this.outside ? RAIN_VOLUME.outside : RAIN_VOLUME.inside);
            if (volume > 0 && !this.rainSound.isPlaying && this.rainSound.context.state === 'running') this.rainSound.play();
            if (volume === 0 && this.rainSound.isPlaying) this.rainSound.stop();
            this.rainSound.setVolume(volume);
        }
    }

    // A drop's world x/z: its own spot, wrapped into the box around the camera.
    wrapAround(value, center) {
        const size = PRECIPITATION_HALF * 2;
        return center + ((((value - center + PRECIPITATION_HALF) % size) + size) % size) - PRECIPITATION_HALF;
    }

    // Inside any bar (plus a little, for the walls)? Rooms never move, so
    // their transforms come straight from the layout.
    insideBar(x, z) {
        this.roomFrames ??= ROOMS.map(room => ({ ...room.origin, cos: Math.cos(room.rotationY), sin: Math.sin(room.rotationY) }));
        return this.roomFrames.some(({ x: ox, z: oz, cos, sin }) => {
            const dx = x - ox;
            const dz = z - oz;
            return Math.abs(dx * cos - dz * sin) < ROOM_HALF_WIDTH + 0.3 && Math.abs(dx * sin + dz * cos) < ROOM_HALF_DEPTH + 0.3;
        });
    }

    updateRain(dt, density) {
        const positions = this.rain.geometry.attributes.position.array;
        const count = Math.floor(RAIN_DROPS * density);
        const slant = this.state.wind * 0.02;
        const center = this.game.camera.getCamera().position;
        for (let i = 0; i < RAIN_DROPS; i++) {
            const drop = this.rainDrops[i];
            drop.y -= drop.speed * dt;
            if (drop.y < 0) drop.y += PRECIPITATION_TOP;
            const x = this.wrapAround(drop.x, center.x);
            const z = this.wrapAround(drop.z, center.z);
            const visible = i < count && !this.insideBar(x, z);
            const o = i * 6;
            positions[o] = x;
            positions[o + 1] = visible ? drop.y : -100;
            positions[o + 2] = z;
            positions[o + 3] = x + slant;
            positions[o + 4] = visible ? drop.y + 0.45 : -100;
            positions[o + 5] = z;
        }
        this.rain.geometry.attributes.position.needsUpdate = true;
    }

    updateSnow(dt) {
        const positions = this.snow.geometry.attributes.position.array;
        const time = performance.now() / 1000;
        const center = this.game.camera.getCamera().position;
        this.flakes.forEach((flake, i) => {
            flake.y -= 1.3 * dt;
            if (flake.y < 0) flake.y += PRECIPITATION_TOP;
            const x = this.wrapAround(flake.x, center.x) + Math.sin(time * 0.8 + flake.phase) * 0.4;
            const z = this.wrapAround(flake.z, center.z) + Math.cos(time * 0.6 + flake.phase) * 0.3;
            positions[i * 3] = x;
            positions[i * 3 + 1] = this.insideBar(x, z) ? -100 : flake.y;
            positions[i * 3 + 2] = z;
        });
        this.snow.geometry.attributes.position.needsUpdate = true;
    }
}
