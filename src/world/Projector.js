import * as THREE from 'three';
import { ceilingHeightAt } from './Roof';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer';
import { loadYouTubeApi, describeYouTubeError } from '../media/youtube';
import { ROOM_HALF_WIDTH, WALL_THICKNESS } from './RoomLayout';

// Screen on the room's right wall (room-local +x), 16:9.
const SCREEN_WIDTH = 10;
const SCREEN_HEIGHT = SCREEN_WIDTH * 9 / 16;
const SCREEN_X = ROOM_HALF_WIDTH - WALL_THICKNESS / 2 - 0.05;
const SCREEN_Y = 4.2;
const DEVICE_DISTANCE = 4; // the projector box in front of the screen
// The YouTube iframe is laid out at this CSS size and scaled into the scene.
const ELEMENT_WIDTH = 1280;
const ELEMENT_HEIGHT = 720;

const SYNC_INTERVAL = 2000; // ms between drift checks
const MAX_DRIFT = 1.5;      // seconds off the shared position before seeking
const VOLUME_INTERVAL = 200; // ms
// YouTube audio can't go through Web Audio (cross-origin iframe), so walls
// are imitated with volume only: stronger cuts than the radio's filter.
const VOLUME_REF_DISTANCE = 8;
const VOLUME_ROLLOFF = 1;
const OCCLUSION_VOLUME = { none: 1, doorOpen: 0.5, closed: 0.12 };

// A room's shared YouTube projector. The video is a real YouTube iframe
// positioned in 3D with CSS3DRenderer *behind* the WebGL canvas; a mesh that
// writes transparent pixels ("hole") shows it through, so walls and players
// in front still hide it. State comes from ProjectorSync.
export class Projector {
    constructor(room, serverClock, audioSettings) {
        this.room = room;
        this.serverClock = serverClock;
        this.audioSettings = audioSettings;
        this.state = null; // { videoId, startedAt, pausedAt } or null
        this.player = null;
        this.playerReady = false;
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
        this.playerElement = document.createElement('div');
        wrapper.appendChild(this.playerElement);
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
        ctx.fillText('Haz clic para poner un vídeo de YouTube', canvas.width / 2, 340);
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
        const previous = this.state;
        this.state = state;
        const active = Boolean(state);
        this.hole.visible = active;
        this.cssObject.visible = active;
        this.idleScreen.visible = !active;

        if (!active) {
            this.player?.stopVideo?.();
            return;
        }
        // Nobody in the room: remember the state, load it when someone enters.
        if (this.dormant) return;
        if (!this.player) {
            this.createPlayer(state.videoId);
        } else if (this.playerReady && previous?.videoId !== state.videoId) {
            this.player.loadVideoById({ videoId: state.videoId, startSeconds: this.expectedPosition() });
        }
        this.lastSync = 0; // re-sync on the next update
    }

    expectedPosition() {
        if (!this.state) return 0;
        if (this.state.pausedAt !== null) return this.state.pausedAt;
        return Math.max(0, (this.serverClock.now() - this.state.startedAt) / 1000);
    }

    async createPlayer(videoId) {
        this.player = { creating: true };
        try {
            const YT = await loadYouTubeApi();
            // YouTube only builds its iframe in an attached element, and the
            // CSS3D layer attaches ours on its next render.
            const attachDeadline = performance.now() + 15000;
            while (!this.playerElement.isConnected && performance.now() < attachDeadline) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            this.player = new YT.Player(this.playerElement, {
                width: ELEMENT_WIDTH,
                height: ELEMENT_HEIGHT,
                videoId,
                playerVars: {
                    autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0,
                    modestbranding: 1, playsinline: 1, iv_load_policy: 3,
                    start: Math.floor(this.expectedPosition())
                },
                events: {
                    onReady: () => {
                        this.playerReady = true;
                        this.player.setVolume(0);
                        // The room emptied while YouTube was loading.
                        if (this.dormant) {
                            this.player.stopVideo();
                            return;
                        }
                        // A different video may have been chosen while loading.
                        if (this.state && this.state.videoId !== videoId) {
                            this.player.loadVideoById({ videoId: this.state.videoId, startSeconds: this.expectedPosition() });
                        }
                        this.lastSync = 0;
                    },
                    onError: (event) => this.onError?.(describeYouTubeError(event.data))
                }
            });
        } catch (error) {
            console.error('Projector: YouTube unavailable', error);
            this.player = null;
            this.onError?.('no se ha podido cargar YouTube');
        }
    }

    // Keep everyone at the shared position: play/pause to match and seek
    // when drifting.
    sync() {
        const player = this.player;
        if (!this.state || !this.playerReady || !player.getPlayerState) return;
        const YTState = window.YT.PlayerState;
        const target = this.expectedPosition();
        const duration = player.getDuration?.() || 0;
        const playerState = player.getPlayerState();

        if (this.state.pausedAt !== null) {
            if (playerState !== YTState.PAUSED) player.pauseVideo();
            if (Math.abs(player.getCurrentTime() - target) > 0.5) player.seekTo(target, true);
            return;
        }
        if (duration > 0 && target >= duration) return; // finished: leave the last frame
        if (playerState !== YTState.PLAYING && playerState !== YTState.BUFFERING) player.playVideo();
        if (Math.abs(player.getCurrentTime() - target) > MAX_DRIFT) player.seekTo(target, true);
    }

    // Browsers may block the first autoplay with sound; any later click in the
    // page counts as a gesture, so retry then.
    kick() {
        if (this.state && this.state.pausedAt === null && this.playerReady && !this.dormant) this.player.playVideo();
    }

    // Empty room (Environment.updateDormancy): stop the video here (no
    // download, no decoding); on waking, jump back to the shared position.
    setDormant(dormant) {
        if (dormant === this.dormant) return;
        this.dormant = dormant;
        if (dormant) {
            if (this.playerReady) this.player.stopVideo();
            return;
        }
        if (!this.state) return;
        if (!this.player) {
            this.createPlayer(this.state.videoId);
        } else if (this.playerReady) {
            this.player.loadVideoById({ videoId: this.state.videoId, startSeconds: this.expectedPosition() });
        }
        this.lastSync = 0;
    }

    getWorldCenter() {
        return this.group.localToWorld(new THREE.Vector3(0, 0, 0));
    }

    update(listenerPosition, environment, world) {
        if (!this.state || !this.playerReady || !listenerPosition || this.dormant) return;
        const now = performance.now();
        if (now - this.lastSync > SYNC_INTERVAL) {
            this.lastSync = now;
            this.sync();
        }
        if (now - this.lastVolume > VOLUME_INTERVAL) {
            this.lastVolume = now;
            const distance = this.getWorldCenter().distanceTo(listenerPosition);
            let gain = VOLUME_REF_DISTANCE /
                (VOLUME_REF_DISTANCE + VOLUME_ROLLOFF * Math.max(0, distance - VOLUME_REF_DISTANCE));
            gain *= OCCLUSION_VOLUME[environment.getOcclusionLevel(this.room, world.getRoomAt(listenerPosition))];
            gain *= this.audioSettings?.get('video') ?? 1;
            this.player.unMute?.();
            this.player.setVolume?.(Math.round(gain * 100));
        }
    }
}
