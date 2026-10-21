import * as THREE from 'three';
import { OcclusionChain, OCCLUSION_LEVELS } from '../audio/Occlusion';
import { getStation } from '../audio/radioStations';

const RADIO_VOLUME = 0.5;
const RETRY_DELAY = 5000; // ms before reconnecting a dropped live stream

// Below this effective gain (-40 dB: distance x walls x volume x slider) the
// radio can't be heard, so the stream stops downloading. It must stay that
// quiet for a while first, so walking past a door doesn't restart it.
const INAUDIBLE_GAIN = 0.01;
const INAUDIBLE_DELAY = 3000; // ms
const AUDIBILITY_INTERVAL = 250; // ms between checks
const INDICATOR_ON = 0x32CD32;
const INDICATOR_OFF = 0x696969;
// Station name floating above the radio, always facing the camera.
const LABEL_WIDTH = 512;
const LABEL_HEIGHT = 96;
const LABEL_HEIGHT_ABOVE = 0.85;
const LABEL_SCALE = 3; // world units wide, readable from across the bar

// A room's radio: a positional speaker on the bar that plays the room's
// shared station (set through RadioSync). Live streams play through a media
// element routed into Web Audio, so distance and wall muffling still apply.
export class Radio {
    constructor(scene) {
        this.scene = scene;
        this.audioListener = null;
        this.sound = null;
        this.element = null;
        this.radio = null;
        this.stationId = null;
        this.mutedLocally = false;
        this.settings = null;    // AudioSettings (radio slider)
        this.suspended = false;  // stream stopped because nobody here can hear it
        this.dormant = false;    // stream stopped because the room has been empty a while
        this.quietSince = null;
        this.lastAudibilityCheck = 0;
    }

    create() {
        this.createRadioModel();
    }

    createRadioModel() {
        const radioGroup = new THREE.Group();

        // Cuerpo principal de la radio
        const bodyGeometry = new THREE.BoxGeometry(1, 0.5, 0.4);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x964B00,
            roughness: 0.7,
            metalness: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        radioGroup.add(body);

        // Panel frontal
        const panelGeometry = new THREE.BoxGeometry(0.95, 0.45, 0.01);
        const panelMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2F4F4F,
            roughness: 0.5,
            metalness: 0.5
        });
        const panel = new THREE.Mesh(panelGeometry, panelMaterial);
        panel.position.z = 0.2;
        radioGroup.add(panel);

        // Altavoz
        const speakerGeometry = new THREE.CircleGeometry(0.15, 32);
        const speakerMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x696969,
            roughness: 1,
            metalness: 0
        });
        const speaker = new THREE.Mesh(speakerGeometry, speakerMaterial);
        speaker.position.z = 0.201;
        speaker.position.x = -0.25;
        radioGroup.add(speaker);

        // Perilla de volumen
        const knobGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 32);
        const knobMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xC0C0C0,
            roughness: 0.3,
            metalness: 0.8
        });
        const knob = new THREE.Mesh(knobGeometry, knobMaterial);
        knob.rotation.x = Math.PI / 2;
        knob.position.set(0.25, 0, 0.201);
        radioGroup.add(knob);

        // Luz indicadora
        const indicatorGeometry = new THREE.CircleGeometry(0.03, 32);
        const indicatorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x32CD32,
            emissive: 0x32CD32,
            emissiveIntensity: 0.5
        });
        const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        indicator.position.set(0.25, 0.15, 0.201);
        radioGroup.add(indicator);

        // Posicionar la radio
        radioGroup.position.set(-5, 1.5, -3);

        this.createLabel(radioGroup);

        // Añadir propiedades para interactividad
        this.indicator = indicator;
        radioGroup.userData = {
            type: "radio",
            radio: this,
            originalMaterial: bodyMaterial,
            highlightMaterial: new THREE.MeshStandardMaterial({
                color: 0xB87333,
                roughness: 0.7,
                metalness: 0.5,
                emissive: 0x331100,
                emissiveIntensity: 0.2
            })
        };

        this.radio = radioGroup;
        this.scene.add(radioGroup);
    }

    // Called once the player has entered (audio needs that click).
    initializeAudio(listener, settings) {
        if (this.sound) return;
        this.audioListener = listener;
        this.settings = settings;
        settings?.on('change', ({ category }) => category === 'radio' && this.applyVolume());

        this.element = new Audio();
        // Required for Web Audio to get the samples of a cross-origin stream.
        this.element.crossOrigin = 'anonymous';
        this.element.preload = 'none';
        this.element.addEventListener('error', () => this.scheduleRetry());
        this.element.addEventListener('ended', () => this.scheduleRetry());

        this.sound = new THREE.PositionalAudio(listener);
        this.applyVolume();
        // Heard through a wall, the music loses its highs and some volume on
        // top of distance attenuation (see setOcclusion).
        this.occlusionChain = new OcclusionChain(listener.context);
        this.sound.setFilters(this.occlusionChain.nodes);
        this.sound.setMediaElementSource(this.element);
        this.radio.add(this.sound);

        this.playCurrent();
    }

    // stationId: an id from radioStations.js, or null for off.
    setStation(stationId) {
        if (stationId === this.stationId) return;
        this.stationId = getStation(stationId) ? stationId : null;
        this.updateIndicator();
        this.playCurrent();
    }

    get station() {
        return getStation(this.stationId);
    }

    // Empty room (Environment.updateDormancy): stop downloading; back to the
    // live broadcast when someone walks in.
    setDormant(dormant) {
        if (dormant === this.dormant) return;
        this.dormant = dormant;
        this.playCurrent();
    }

    // (Re)connects to the live stream, or stops downloading when off,
    // inaudible or dormant.
    playCurrent() {
        if (!this.element) return;
        clearTimeout(this.retryTimer);
        const station = this.station;
        if (!station || this.suspended || this.dormant) {
            this.element.pause();
            this.element.removeAttribute('src');
            this.element.load();
            return;
        }
        // Setting src again joins the broadcast at its live point.
        this.element.src = station.url;
        this.element.play().catch(error => console.warn(`Radio: can't play ${station.id}`, error));
    }

    // Before any click or key press the browser refuses to play (autoplay
    // policy); called on the first interaction to start it then.
    kick() {
        if (this.element?.paused && this.station && !this.suspended && !this.dormant) this.playCurrent();
    }

    // Live streams drop now and then; reconnect to the same station.
    scheduleRetry() {
        if (!this.station || this.suspended || this.dormant) return;
        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => this.playCurrent(), RETRY_DELAY);
    }

    // Per player: only this listener stops hearing it.
    setMutedLocally(muted) {
        this.mutedLocally = muted;
        this.applyVolume();
    }

    get volume() {
        if (this.mutedLocally) return 0;
        return RADIO_VOLUME * (this.settings?.get('radio') ?? 1);
    }

    applyVolume() {
        this.sound?.setVolume(this.volume);
    }

    // What this listener would actually hear, as a gain: the panner's inverse
    // distance falloff x the wall/door muffling x volume. Suspends the stream
    // once it has been inaudible for INAUDIBLE_DELAY, resumes (live) as soon
    // as it isn't.
    updateAudibility(occlusionLevel) {
        if (!this.sound || !this.station) return;
        const now = performance.now();
        if (now - this.lastAudibilityCheck < AUDIBILITY_INTERVAL) return;
        this.lastAudibilityCheck = now;

        const gain = this.estimateGain(occlusionLevel);
        if (gain >= INAUDIBLE_GAIN) {
            this.firstCheckDone = true;
            this.quietSince = null;
            if (this.suspended) {
                this.suspended = false;
                this.playCurrent();
            }
            return;
        }
        // The very first check decides at once, so a radio nobody can hear
        // never starts downloading.
        if (this.quietSince === null) this.quietSince = this.firstCheckDone ? now : now - INAUDIBLE_DELAY;
        if (!this.suspended && now - this.quietSince >= INAUDIBLE_DELAY) {
            this.suspended = true;
            this.playCurrent();
        }
        this.firstCheckDone = true;
    }

    estimateGain(occlusionLevel) {
        const listenerPosition = this.audioListener.getWorldPosition(new THREE.Vector3());
        const distance = this.sound.getWorldPosition(new THREE.Vector3()).distanceTo(listenerPosition);
        // Same formula as the PannerNode's 'inverse' model.
        const ref = this.sound.getRefDistance();
        const rolloff = this.sound.getRolloffFactor();
        const distanceGain = ref / (ref + rolloff * (Math.max(distance, ref) - ref));
        return distanceGain * (OCCLUSION_LEVELS[occlusionLevel]?.gain ?? 1) * this.volume;
    }

    createLabel(radioGroup) {
        this.labelCanvas = document.createElement('canvas');
        this.labelCanvas.width = LABEL_WIDTH;
        this.labelCanvas.height = LABEL_HEIGHT;
        this.labelTexture = new THREE.CanvasTexture(this.labelCanvas);
        this.labelTexture.colorSpace = THREE.SRGBColorSpace;
        const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.labelTexture, transparent: true }));
        label.position.set(0, LABEL_HEIGHT_ABOVE, 0);
        label.scale.set(LABEL_SCALE, LABEL_SCALE * LABEL_HEIGHT / LABEL_WIDTH, 1);
        // Just a sign: its (mostly transparent) quad mustn't catch clicks
        // meant for things behind it, like the Pong cabinet.
        label.raycast = () => {};
        radioGroup.add(label);
        this.drawLabel();
    }

    // "📻 Rock FM" (or "Radio apagada"), so everyone knows what's on.
    drawLabel() {
        const ctx = this.labelCanvas?.getContext('2d');
        if (!ctx) return;
        const text = this.station ? `📻 ${this.station.name}` : '📻 Radio apagada';
        ctx.clearRect(0, 0, LABEL_WIDTH, LABEL_HEIGHT);
        ctx.font = 'bold 44px "Segoe UI", sans-serif';
        const width = Math.min(LABEL_WIDTH - 8, ctx.measureText(text).width + 48);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.beginPath();
        ctx.roundRect((LABEL_WIDTH - width) / 2, 8, width, LABEL_HEIGHT - 16, 24);
        ctx.fill();
        ctx.fillStyle = this.station ? '#ffd27f' : '#aaaaaa';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, LABEL_WIDTH / 2, LABEL_HEIGHT / 2, LABEL_WIDTH - 40);
        this.labelTexture.needsUpdate = true;
    }

    updateIndicator() {
        this.drawLabel();
        const color = this.stationId ? INDICATOR_ON : INDICATOR_OFF;
        this.indicator.material.color.setHex(color);
        this.indicator.material.emissive.setHex(color);
        this.indicator.material.emissiveIntensity = this.stationId ? 0.5 : 0.1;
    }

    // level: see OCCLUSION_LEVELS in src/audio/Occlusion.js.
    setOcclusion(level) {
        this.occlusionChain?.setLevel(level);
    }

    get occlusion() {
        return this.occlusionChain?.level;
    }

    cleanup() {
        clearTimeout(this.retryTimer);
        this.element?.pause();
        if (this.radio) {
            this.scene.remove(this.radio);
        }
    }
}
