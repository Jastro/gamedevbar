import * as THREE from 'three';
import { ceilingHeightAt } from './Roof';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer';
import { createScreenPlayer, providerFamily } from '../media/ScreenPlayers';
import { ROOM_HALF_WIDTH, WALL_THICKNESS } from './RoomLayout';

// Screen on the room's right wall (room-local +x), 16:9.
const SCREEN_WIDTH = 10;
const SCREEN_HEIGHT = SCREEN_WIDTH * 9 / 16;
const SCREEN_X = ROOM_HALF_WIDTH - WALL_THICKNESS / 2 - 0.05;
const SCREEN_Y = 4.2;
const DEVICE_DISTANCE = 4; // the projector box in front of the screen
// The video iframe is laid out at this CSS size and scaled into the scene.
const ELEMENT_WIDTH = 1280;
const ELEMENT_HEIGHT = 720;

const SYNC_INTERVAL = 2000; // ms between drift checks
const MAX_DRIFT = 1.5;      // seconds off the shared position before seeking
const VOLUME_INTERVAL = 200; // ms
// Iframe audio (YouTube, Twitch) can't go through Web Audio (cross-origin),
// so walls are imitated with volume only: stronger cuts than the radio's filter.
const VOLUME_REF_DISTANCE = 8;
const VOLUME_ROLLOFF = 1;
const OCCLUSION_VOLUME = { none: 1, doorOpen: 0.4, closed: 0.08 };

// Shared state → the media to show. Older states have no provider (YouTube).
function stateMedia(state) {
    return { provider: state.provider ?? 'youtube', videoId: state.videoId };
}

function sameMedia(a, b) {
    return Boolean(a && b) && a.provider === b.provider && a.videoId === b.videoId;
}

function flatDistance(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
}

// A room's shared projector (YouTube or Twitch). The video is the real embed
// iframe positioned in 3D with CSS3DRenderer *behind* the WebGL canvas; a mesh that
// writes transparent pixels ("hole") shows it through, so walls and players
// in front still hide it. State comes from ProjectorSync.
export class Projector {
    constructor(room, serverClock, audioSettings) {
        this.room = room;
        this.serverClock = serverClock;
        this.audioSettings = audioSettings;
        this.state = null; // { provider, videoId, startedAt, pausedAt } or null
        this.player = null; // a ScreenPlayer (src/media/ScreenPlayers.js)
        this.dormant = false; // room empty a while: video stopped locally
        this.lastSync = 0;
        this.lastVolume = 0;
        this.onError = null;
    }

    create() {
        this.group = new THREE.Group();
        this.group.name = 'Projector';
        this.group.position.set(SCREEN_X, SCREEN_Y, 0);
        this.group.rotation.y = -Math.PI / 2; // face into the room (-x)
        this.group.userData = { type: 'projector', projector: this };

        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(SCREEN_WIDTH + 0.3, SCREEN_HEIGHT + 0.3, 0.06),
            new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.6 })
        );
        frame.position.z = -0.04;
        this.group.add(frame);

        this.idleScreen = new THREE.Mesh(
            new THREE.PlaneGeometry(SCREEN_WIDTH, SCREEN_HEIGHT),
            new THREE.MeshBasicMaterial({ map: this.createIdleTexture() })
        );
        this.idleScreen.position.z = 0.001;
        this.group.add(this.idleScreen);

        // Writes alpha 0 so the iframe behind the canvas shows through.
        const holeMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            opacity: 0,
            blending: THREE.NoBlending,
            side: THREE.DoubleSide
        });
        holeMaterial.userData.outlineParameters = { visible: false };
        this.hole = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_WIDTH, SCREEN_HEIGHT), holeMaterial);
        this.hole.position.z = 0.002;
        this.hole.visible = false;
        this.group.add(this.hole);

        const wrapper = document.createElement('div');
        wrapper.className = 'projector-video';
        wrapper.style.width = `${ELEMENT_WIDTH}px`;
        wrapper.style.height = `${ELEMENT_HEIGHT}px`;
        this.playerElement = wrapper;
        this.cssObject = new CSS3DObject(wrapper);
        this.cssObject.scale.setScalar(SCREEN_WIDTH / ELEMENT_WIDTH);
        this.cssObject.visible = false;
        this.group.add(this.cssObject);

        this.createDevice();
        this.room.add(this.group);
    }

    createIdleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 576;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#20232a');
        gradient.addColorStop(1, '#101114');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#dc5a0b';
        ctx.font = 'bold 72px Arial';
        ctx.fillText('📽️ Proyector', canvas.width / 2, 250);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = '36px Arial';
        ctx.fillText('Haz clic para poner YouTube o Twitch', canvas.width / 2, 340);
        return new THREE.CanvasTexture(canvas);
    }

    // The projector box hanging from the ceiling in front of the screen.
    createDevice() {
        const device = new THREE.Group();
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.3, 0.6),
            new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.5 })
        );
        device.add(body);
        const lens = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.12, 0.12, 20),
            new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.3 })
        );
        lens.rotation.x = Math.PI / 2;
        lens.position.z = 0.34;
        device.add(lens);
        // In the screen's frame: 4 units in front of it (room-local z 0, where
        // the ceiling is highest), its pole up to the ceiling.
        device.position.set(0, 2.4, DEVICE_DISTANCE);
        const top = ceilingHeightAt(0) - SCREEN_Y - device.position.y;
        const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, top - 0.15, 8),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        pole.position.y = 0.15 + (top - 0.15) / 2;
        device.add(pole);
        device.rotation.y = Math.PI; // lens towards the screen
        this.group.add(device);
    }

    // --- Shared state ------------------------------------------------------

    applyState(state) {
        this.state = state;
        const active = Boolean(state);
        this.hole.visible = active;
        this.cssObject.visible = active;
        this.idleScreen.visible = !active;

        if (!active) {
            // Turned off: drop the embed (no stream left buffering).
            this.player?.destroy();
            this.player = null;
            return;
        }
        // Nobody in the room: remember the state, load it when someone enters.
        if (this.dormant) return;
        this.showMedia();
        this.lastSync = 0; // re-sync on the next update
    }

    // Make the player show the current state's media: a new player for a new
    // provider (YouTube <-> Twitch), else load it into the one we have when
    // it changed (or always, `reload`, when waking up after being stopped).
    // Not ready yet: onReady loads the latest media.
    showMedia(reload = false) {
        const media = stateMedia(this.state);
        if (!this.player || providerFamily(media.provider) !== this.player.family) {
            this.createPlayer(media);
        } else if (this.player.ready && (reload || !sameMedia(this.player.media, media))) {
            this.player.load(media, this.expectedPosition());
        }
    }

    expectedPosition() {
        if (!this.state) return 0;
        if (this.state.pausedAt !== null) return this.state.pausedAt;
        return Math.max(0, (this.serverClock.now() - this.state.startedAt) / 1000);
    }

    createPlayer(media) {
        this.player?.destroy();
        const player = createScreenPlayer(media, this.playerElement, {
            width: ELEMENT_WIDTH,
            height: ELEMENT_HEIGHT,
            onReady: () => {
                if (this.player !== player) return;
                // The room emptied while loading.
                if (this.dormant || !this.state) {
                    player.stop();
                    return;
                }
                // Something else was chosen while loading.
                const media = stateMedia(this.state);
                if (!sameMedia(player.media, media)) {
                    if (providerFamily(media.provider) === player.family) player.load(media, this.expectedPosition());
                    else this.createPlayer(media);
                }
                this.lastSync = 0;
            },
            onError: (reason) => this.player === player && this.onError?.(reason)
        });
        this.player = player;
        player.create(media, this.expectedPosition()).catch((error) => {
            console.error('Projector: player unavailable', error);
            if (this.player !== player) return;
            player.destroy();
            this.player = null;
            this.onError?.(providerFamily(media.provider) === 'twitch'
                ? 'no se ha podido cargar Twitch'
                : 'no se ha podido cargar YouTube');
        });
    }

    // Keep everyone at the shared position: play/pause to match and seek
    // when drifting. Live streams can't seek: they only follow play/pause.
    sync() {
        const player = this.player;
        if (!this.state || !player?.ready) return;
        const target = this.expectedPosition();

        if (this.state.pausedAt !== null) {
            if (!player.isPaused()) player.pause();
            if (player.seekable && Math.abs(player.getCurrentTime() - target) > 0.5) player.seek(target);
            return;
        }
        if (player.seekable) {
            const duration = player.getDuration();
            if (duration > 0 && target >= duration) return; // finished: leave the last frame
        }
        if (!player.isPlaying()) player.play();
        if (player.seekable && Math.abs(player.getCurrentTime() - target) > MAX_DRIFT) player.seek(target);
    }

    // Browsers may block the first autoplay with sound; any later click in the
    // page counts as a gesture, so retry then.
    kick() {
        if (this.state && this.state.pausedAt === null && this.player?.ready && !this.dormant) this.player.kick();
    }

    // Empty room (Environment.updateDormancy): stop the video here (no
    // download, no decoding); on waking, jump back to the shared position.
    setDormant(dormant) {
        if (dormant === this.dormant) return;
        this.dormant = dormant;
        if (dormant) {
            if (this.player?.ready) this.player.stop();
            return;
        }
        if (!this.state) return;
        this.showMedia(true);
        this.lastSync = 0;
    }

    getWorldCenter() {
        return this.group.localToWorld(new THREE.Vector3(0, 0, 0));
    }

    // "Tocar la pantalla": the embed takes the mouse (to accept Twitch's or
    // YouTube's own prompts: mature content, unmute, start watching).
    setInteractive(interactive) {
        this.playerElement.classList.toggle('interactive', interactive);
    }

    // A camera straight in front of the screen, close enough to fill most of
    // the view (like the arcade cabinets' play view).
    getViewpoint(camera) {
        const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
        const fitHeight = (SCREEN_HEIGHT / 2) / halfTan;
        const fitWidth = (SCREEN_WIDTH / 2) / (halfTan * camera.aspect);
        const distance = Math.max(fitHeight, fitWidth) / 0.92;
        return {
            position: this.group.localToWorld(new THREE.Vector3(0, 0, distance)),
            lookAt: this.getWorldCenter()
        };
    }

    // How far the sound travels to the listener. Outside the room it goes out
    // through the door (and in through the listener's bar's door), not
    // through the wall: next to the screen's wall, outside or in the bar next
    // door, it's far.
    soundPathLength(listenerPosition, environment, world) {
        const screen = this.getWorldCenter();
        const listenerRoom = world.getRoomAt(listenerPosition);
        if (listenerRoom === this.room) return screen.distanceTo(listenerPosition);
        const ownDoor = environment.rooms.get(this.room.id)?.door?.getWorldPosition();
        if (!ownDoor) return screen.distanceTo(listenerPosition);
        let length = flatDistance(screen, ownDoor);
        const listenerDoor = listenerRoom && environment.rooms.get(listenerRoom.id)?.door?.getWorldPosition();
        if (listenerDoor) length += flatDistance(ownDoor, listenerDoor) + flatDistance(listenerDoor, listenerPosition);
        else length += flatDistance(ownDoor, listenerPosition);
        return length;
    }

    update(listenerPosition, environment, world) {
        if (!this.state || !this.player?.ready || !listenerPosition || this.dormant) return;
        const now = performance.now();
        if (now - this.lastSync > SYNC_INTERVAL) {
            this.lastSync = now;
            this.sync();
        }
        if (now - this.lastVolume > VOLUME_INTERVAL) {
            this.lastVolume = now;
            const distance = this.soundPathLength(listenerPosition, environment, world);
            let gain = VOLUME_REF_DISTANCE /
                (VOLUME_REF_DISTANCE + VOLUME_ROLLOFF * Math.max(0, distance - VOLUME_REF_DISTANCE));
            gain *= OCCLUSION_VOLUME[environment.getOcclusionLevel(this.room, world.getRoomAt(listenerPosition))];
            gain *= this.audioSettings?.get('video') ?? 1;
            this.player.setVolume(gain);
        }
    }
}
