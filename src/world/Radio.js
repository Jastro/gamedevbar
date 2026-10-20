import * as THREE from 'three';
import { OcclusionChain } from '../audio/Occlusion';
import { getStation } from '../audio/radioStations';

const RADIO_VOLUME = 0.5;
const RETRY_DELAY = 5000; // ms before reconnecting a dropped live stream
const INDICATOR_ON = 0x32CD32;
const INDICATOR_OFF = 0x696969;

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
        this.serverClock = null;
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
    initializeAudio(listener, serverClock) {
        if (this.sound) return;
        this.audioListener = listener;
        this.serverClock = serverClock;

        this.element = new Audio();
        // Required for Web Audio to get the samples of a cross-origin stream.
        this.element.crossOrigin = 'anonymous';
        this.element.preload = 'none';
        this.element.addEventListener('error', () => this.scheduleRetry());
        this.element.addEventListener('ended', () => this.scheduleRetry());
        this.element.addEventListener('loadedmetadata', () => this.alignLoop());

        this.sound = new THREE.PositionalAudio(listener);
        this.sound.setVolume(this.mutedLocally ? 0 : RADIO_VOLUME);
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

    playCurrent() {
        if (!this.element) return;
        clearTimeout(this.retryTimer);
        const station = this.station;
        if (!station) {
            this.element.pause();
            this.element.removeAttribute('src');
            this.element.load();
            return;
        }
        this.element.loop = Boolean(station.loop);
        this.element.src = station.url;
        this.element.play().catch(error => console.warn(`Radio: can't play ${station.id}`, error));
    }

    // Taberna FM is a file, not a broadcast: start it where the server clock
    // says, so the whole bar hears the same bit of the song.
    alignLoop() {
        const duration = this.element.duration;
        if (!this.station?.loop || !Number.isFinite(duration) || duration <= 0) return;
        this.element.currentTime = (this.serverClock.now() / 1000) % duration;
    }

    // Live streams drop now and then; reconnect to the same station.
    scheduleRetry() {
        if (!this.station || this.station.loop) return;
        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => this.playCurrent(), RETRY_DELAY);
    }

    // Per player: only this listener stops hearing it.
    setMutedLocally(muted) {
        this.mutedLocally = muted;
        this.sound?.setVolume(muted ? 0 : RADIO_VOLUME);
    }

    updateIndicator() {
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
