import * as THREE from 'three';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer';

// Both screens are 16:9.
const SCREEN_WIDTH = 1.8;
const SCREEN_HEIGHT = SCREEN_WIDTH * 9 / 16;
const SCREEN_Y = 0.55;
const SCREEN_Z = 0.76;
// Idle screen canvas size.
const ELEMENT_WIDTH = 640;
const ELEMENT_HEIGHT = 360;

// The cabinets one room has. Placement is room-local, on the back wall right
// of the back bar (which spans x -6..6), facing into the room like the
// arcades at back-left.
// - vircon: the Vircon32 emulator (same origin: keyboard focus, audio tap,
//   spectating). Its id is the room id, as the server has always known it.
// - pokebonk: a web game from another site in a plain iframe. No spectating
//   (another site's canvas can't be captured), and its keys never reach us,
//   so play mode shows an exit button.
export const CABINETS = {
    vircon: {
        key: 'vircon', type: 'vircon', title: 'VIRCON32', position: { x: 12.5, y: 2, z: -9.05 },
        colors: { body: 0x1d1b4b, marquee: ['#3a1c71', '#d76d77', '#ffaf7b'], idle: '#8be9fd' },
        frame: { width: 640, height: 360 }, sameOrigin: true,
        source: (rom) => `/vircon32/index.html?rom=${encodeURIComponent(rom.url)}`
    },
    pokebonk: {
        key: 'pokebonk', type: 'webgame', title: 'POKEBONK', position: { x: 8.8, y: 2, z: -9.05 },
        colors: { body: 0x7a1f1f, marquee: ['#c22e28', '#ee8130', '#f7d02c'], idle: '#ffcb05' },
        // A 3D browser game: render it bigger, the CSS3D object scales it down.
        frame: { width: 1280, height: 720 }, sameOrigin: false,
        url: 'https://pokebonk.com/',
        source: () => 'https://pokebonk.com/'
    }
};
export const VIRCON_INTERACT_DISTANCE = 3;
// Play-mode camera: share of the view the screen takes, and height above it.
const PLAY_VIEW_FILL = 0.5;
const PLAY_VIEW_RISE = 0.3;
// Frame rate of the picture streamed to people watching.
const CAPTURE_FPS = 30;

// An arcade cabinet that plays a page on its screen (CABINETS above). Idle,
// its screen shows the logo and who is playing. For the local player, the
// page runs in an iframe placed on the screen with the CSS3D layer, the same
// technique as the projector (see Projector.js). State comes from VirconSync,
// keyed by `id`.
export class VirconCabinet {
    constructor(room, collisionManager, config = CABINETS.vircon) {
        this.room = room;
        this.collisionManager = collisionManager;
        this.config = config;
        this.id = config.key === 'vircon' ? room.id : `${room.id}-${config.key}`;
        this.occupant = null; // { playerId, playerName, romTitle, watchable } from the server
        this.iframe = null;
        this.capture = null; // canvas MediaStream while streaming to watchers
        this.remoteTexture = null; // a watcher's view of someone else's game
    }

    create() {
        this.group = new THREE.Group();
        this.group.name = 'VirconCabinet';
        const { position, colors, frame } = this.config;
        this.group.position.set(position.x, position.y, position.z);

        const bodyMaterial = new THREE.MeshStandardMaterial({ color: colors.body, roughness: 0.3, metalness: 0.6 });
        const highlightMaterial = new THREE.MeshStandardMaterial({ color: 0x7fff7f, emissive: 0x2f2f2f });
        const body = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1.5), bodyMaterial);
        body.userData = { originalMaterial: bodyMaterial, highlightMaterial };
        this.group.add(body);

        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.8), bodyMaterial);
        panel.position.set(0, -1, 0.3);
        panel.rotation.x = -Math.PI / 6;
        panel.userData = { originalMaterial: bodyMaterial, highlightMaterial };
        this.group.add(panel);

        const marquee = new THREE.Mesh(
            new THREE.PlaneGeometry(1.8, 0.45),
            new THREE.MeshBasicMaterial({ map: this.createMarqueeTexture() })
        );
        marquee.position.set(0, 1.65, SCREEN_Z);
        this.group.add(marquee);

        this.idleCanvas = document.createElement('canvas');
        this.idleCanvas.width = ELEMENT_WIDTH;
        this.idleCanvas.height = ELEMENT_HEIGHT;
        this.idleTexture = new THREE.CanvasTexture(this.idleCanvas);
        this.idleScreen = new THREE.Mesh(
            new THREE.PlaneGeometry(SCREEN_WIDTH, SCREEN_HEIGHT),
            new THREE.MeshBasicMaterial({ map: this.idleTexture })
        );
        this.idleScreen.position.set(0, SCREEN_Y, SCREEN_Z);
        this.group.add(this.idleScreen);

        // Transparent "hole" through which the emulator iframe behind the
        // WebGL canvas shows (only while the local player plays).
        const holeMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000, opacity: 0, blending: THREE.NoBlending, side: THREE.DoubleSide
        });
        holeMaterial.userData.outlineParameters = { visible: false };
        this.hole = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_WIDTH, SCREEN_HEIGHT), holeMaterial);
        this.hole.position.set(0, SCREEN_Y, SCREEN_Z + 0.002);
        this.hole.visible = false;
        this.group.add(this.hole);

        this.frameElement = document.createElement('div');
        this.frameElement.className = 'vircon-screen';
        this.frameElement.style.width = `${frame.width}px`;
        this.frameElement.style.height = `${frame.height}px`;
        this.cssObject = new CSS3DObject(this.frameElement);
        this.cssObject.position.set(0, SCREEN_Y, SCREEN_Z + 0.002);
        this.cssObject.scale.setScalar(SCREEN_WIDTH / frame.width);
        this.cssObject.visible = false;
        this.group.add(this.cssObject);

        this.group.userData = { type: this.config.type, cabinet: this };
        this.room.add(this.group);
        this.group.updateMatrixWorld(true);
        this.collisionManager?.addCollider(body);
        this.drawIdleScreen();
    }

    createMarqueeTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        const [left, middle, right] = this.config.colors.marquee;
        gradient.addColorStop(0, left);
        gradient.addColorStop(0.5, middle);
        gradient.addColorStop(1, right);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 76px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 8;
        ctx.fillText(this.config.title, canvas.width / 2, canvas.height / 2 + 4);
        return new THREE.CanvasTexture(canvas);
    }

    drawIdleScreen() {
        const ctx = this.idleCanvas.getContext('2d');
        ctx.fillStyle = '#05051a';
        ctx.fillRect(0, 0, ELEMENT_WIDTH, ELEMENT_HEIGHT);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = this.config.colors.idle;
        ctx.font = 'bold 56px monospace';
        ctx.fillText(this.config.title, ELEMENT_WIDTH / 2, 120);
        ctx.font = '26px monospace';
        if (this.occupant) {
            ctx.fillStyle = '#ffb347';
            ctx.fillText(`🎮 ${this.occupant.playerName ?? 'Alguien'}`, ELEMENT_WIDTH / 2, 215, 600);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(this.occupant.romTitle ?? '', ELEMENT_WIDTH / 2, 260, 600);
        } else {
            ctx.fillStyle = '#ffffff';
            ctx.fillText('Acércate y haz clic para jugar', ELEMENT_WIDTH / 2, 235, 600);
        }
        this.idleTexture.needsUpdate = true;
    }

    setOccupant(state) {
        this.occupant = state;
        this.drawIdleScreen();
    }

    get isPlayingLocally() {
        return Boolean(this.iframe);
    }

    // Loads the page (the emulator with that ROM, or the web game) on the
    // cabinet screen (local only).
    startLocal(rom) {
        this.stopLocal();
        this.iframe = document.createElement('iframe');
        this.iframe.src = this.config.source(rom);
        this.iframe.title = this.config.title;
        this.iframe.allow = 'autoplay; gamepad; fullscreen';
        this.frameElement.appendChild(this.iframe);
        this.hole.visible = true;
        this.cssObject.visible = true;
        this.idleScreen.visible = false;
        return this.iframe;
    }

    stopLocal() {
        this.capture?.getTracks().forEach(track => track.stop());
        this.capture = null;
        if (this.iframe) {
            this.iframe.remove();
            this.iframe = null;
        }
        this.hole.visible = false;
        this.cssObject.visible = false;
        this.idleScreen.visible = true;
    }

    // A web game needs the mouse: let clicks through to the iframe while
    // it's being played (see the .interactive CSS and VirconUI.beginPlay).
    setInteractive(interactive) {
        this.frameElement.classList.toggle('interactive', interactive);
    }

    // Gives the keyboard to the game (the iframe sits under the canvas and
    // can't be clicked, so focus is moved programmatically; same origin).
    focusGame() {
        if (!this.config.sameOrigin) {
            this.iframe?.focus();
            return;
        }
        try {
            this.iframe?.contentWindow?.focus();
            this.iframe?.contentDocument?.getElementById('canvas')?.focus();
        } catch {
            // Not loaded yet; VirconUI retries on vircon:ready.
        }
    }

    // The emulator page's audio tap ({ context, tap, output, stream }), once
    // SDL2 has created its AudioContext (see tools/vircon32/shell.html).
    getEmulatorAudio() {
        try {
            return this.iframe?.contentWindow?.virconAudio ?? null;
        } catch {
            return null;
        }
    }

    // Player side of spectating: the game's picture and sound as tracks
    // ({ video, audio }, audio null until the game's AudioContext exists),
    // or null while the emulator page isn't ready.
    getCaptureTracks() {
        let canvas = null;
        try {
            canvas = this.iframe?.contentDocument?.getElementById('canvas');
        } catch {
            return null;
        }
        if (!canvas?.captureStream) return null;
        if (!this.capture) this.capture = canvas.captureStream(CAPTURE_FPS);
        return {
            video: this.capture.getVideoTracks()[0] ?? null,
            audio: this.getEmulatorAudio()?.stream.getAudioTracks()[0] ?? null
        };
    }

    // Watcher side: someone else's live game on this screen, drawn in the
    // scene (so people in front of the cabinet still cover it).
    showRemoteVideo(video) {
        this.hideRemoteVideo();
        this.remoteTexture = new THREE.VideoTexture(video);
        this.remoteTexture.colorSpace = THREE.SRGBColorSpace;
        this.idleScreen.material.map = this.remoteTexture;
        this.idleScreen.material.needsUpdate = true;
    }

    hideRemoteVideo() {
        if (!this.remoteTexture) return;
        this.idleScreen.material.map = this.idleTexture;
        this.idleScreen.material.needsUpdate = true;
        this.remoteTexture.dispose();
        this.remoteTexture = null;
    }

    // The streamed game's sound comes from the screen.
    addScreenSound(sound) {
        sound.position.set(0, SCREEN_Y, SCREEN_Z);
        this.group.add(sound);
    }

    getScreenCenter() {
        return this.group.localToWorld(new THREE.Vector3(0, SCREEN_Y, SCREEN_Z));
    }

    // Where the camera sits while playing: locked, close, a little above the
    // screen so the cabinet and the avatar's head stay in view (the screen
    // takes about half the view for this camera's FOV and aspect), and where
    // the player stands.
    getViewpoints(camera) {
        const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
        const fitHeight = (SCREEN_HEIGHT / 2) / halfTan;
        const fitWidth = (SCREEN_WIDTH / 2) / (halfTan * camera.aspect);
        const distance = Math.max(fitHeight, fitWidth) / PLAY_VIEW_FILL;
        return {
            camera: this.group.localToWorld(new THREE.Vector3(0, SCREEN_Y + PLAY_VIEW_RISE, SCREEN_Z + distance)),
            screen: this.getScreenCenter(),
            stand: this.group.localToWorld(new THREE.Vector3(0, -1, 1.6))
        };
    }

    distanceTo(worldPosition) {
        const center = this.group.getWorldPosition(new THREE.Vector3());
        return Math.hypot(worldPosition.x - center.x, worldPosition.z - center.z);
    }
}
