import * as THREE from 'three';
import { STICKERS, DEFAULT_STICKER, stickerTexture } from '../stickers/StickerArt';
import { loadSticker, saveSticker, stickerOwnerKey } from '../core/PlayerProfile';
import { playSynth } from '../audio/synth';

// Stickers (server: server/features/stickers.js). Right click → 🎨 Pegatina
// sticks the one picked in the 👤 menu where the click aimed: any wall,
// floor or piece of furniture within reach of your avatar (not doors, cars
// or people: they move). One each: a new one replaces your previous one, at
// most one every 10 s, and each lasts 24 h. A sticker is a flat square a
// hair off the surface, upright on walls and facing whoever stuck it on
// floors and tables; it takes the light of the space it's in.
const REACH = 3.5;          // from the avatar's head to the spot
const HEAD_HEIGHT = 0.6;    // above the player's position
const SIZE = 0.7;
const SURFACE_OFFSET = 0.012;
const COOLDOWN = 10000;     // ms (the server's too)
const UNSTICKABLE = new Set(['door', 'bathroomDoor', 'drivableCar', 'car']);
const GEOMETRY = new THREE.PlaneGeometry(SIZE, SIZE);

export class StickerSync {
    constructor(game) {
        this.game = game;
        this.stickers = new Map(); // id -> mesh
        this.raycaster = new THREE.Raycaster();
        this.lastPlaced = 0;
        const saved = loadSticker();
        this.selected = STICKERS.some(sticker => sticker.id === saved) ? saved : DEFAULT_STICKER;
    }

    select(stickerId) {
        if (!STICKERS.some(sticker => sticker.id === stickerId)) return;
        this.selected = stickerId;
        saveSticker(stickerId);
    }

    bind() {
        const { network } = this.game;
        network.on('stickerStates', (data) => {
            [...this.stickers.keys()].forEach(id => this.remove(id));
            (Array.isArray(data.stickers) ? data.stickers : []).forEach(sticker => this.add(sticker, false));
        });
        network.on('stickerPlaced', (data) => this.add(data, true));
        network.on('stickerRemoved', (data) => this.remove(data.id));
        network.on('stickerCooldown', (data) => {
            this.say(`🎨 Espera ${Math.ceil((Number(data.wait) || COOLDOWN) / 1000)} s para otra pegatina.`);
        });
    }

    say(message) {
        this.game.ui.chat?.addMessage({ type: 'system', message });
    }

    // From the radial menu, with the right click's screen position.
    place(screenX, screenY) {
        const player = this.game.players.localPlayer;
        if (!player) return;
        const wait = COOLDOWN - (performance.now() - this.lastPlaced);
        if (wait > 0) {
            this.say(`🎨 Espera ${Math.ceil(wait / 1000)} s para otra pegatina.`);
            return;
        }
        const aim = this.aim(screenX, screenY, player);
        if (aim.error) {
            this.say(aim.error);
            return;
        }
        this.lastPlaced = performance.now();
        const round = (value) => Math.round(value * 1000) / 1000;
        const { point, normal, up } = aim;
        this.game.network.send('stickerPlace', {
            stickerId: this.selected,
            ownerKey: stickerOwnerKey(),
            x: round(point.x), y: round(point.y), z: round(point.z),
            nx: round(normal.x), ny: round(normal.y), nz: round(normal.z),
            ux: round(up.x), uy: round(up.y), uz: round(up.z)
        });
    }

    // Where the click aims: the first visible surface under the cursor.
    aim(screenX, screenY, player) {
        const camera = this.game.camera.getCamera();
        const ndc = new THREE.Vector2((screenX / window.innerWidth) * 2 - 1, -(screenY / window.innerHeight) * 2 + 1);
        this.raycaster.setFromCamera(ndc, camera);
        const playerMeshes = new Set([...this.game.players.players.values()].map(other => other.mesh).filter(Boolean));
        const hits = this.raycaster.intersectObjects(this.game.scene.getScene().children, true);
        const hit = hits.find(candidate => this.isSurface(candidate, playerMeshes));
        if (!hit) return { error: '🎨 Apunta a una pared, al suelo o a un mueble cerca de ti.' };
        if (this.movingThing(hit.object)) return { error: '🎨 Ahí no se puede pegar: se mueve.' };
        const head = player.position.clone();
        head.y += HEAD_HEIGHT;
        if (hit.point.distanceTo(head) > REACH) return { error: '🎨 Demasiado lejos: acércate más.' };

        const normal = hit.face.normal.clone()
            .applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
        if (normal.dot(this.raycaster.ray.direction) > 0) normal.negate();
        // Upright on walls; on floors and tables, its top away from the camera.
        const up = Math.abs(normal.y) < 0.8
            ? new THREE.Vector3(0, 1, 0)
            : this.raycaster.ray.direction.clone().setY(0);
        up.addScaledVector(normal, -up.dot(normal));
        if (up.lengthSq() < 1e-4) up.set(0, 0, 1).addScaledVector(normal, -normal.z);
        up.normalize();
        return { point: hit.point, normal, up };
    }

    // A hit worth sticking to (or at least stopping at): a visible, solid mesh
    // that isn't someone's avatar.
    isSurface(hit, playerMeshes) {
        const { object } = hit;
        if (!object.isMesh || !hit.face) return false;
        const material = Array.isArray(object.material) ? object.material[hit.face.materialIndex] : object.material;
        if (!material || material.visible === false || material.colorWrite === false) return false;
        if (material.transparent && material.opacity < 0.3) return false;
        for (let node = object; node; node = node.parent) {
            if (!node.visible || playerMeshes.has(node)) return false;
        }
        return true;
    }

    movingThing(object) {
        for (let node = object; node; node = node.parent) {
            if (UNSTICKABLE.has(node.userData?.type)) return true;
        }
        return false;
    }

    add({ id, stickerId, position, normal, up }, fresh) {
        if (!Array.isArray(position) || !Array.isArray(normal) || !Array.isArray(up)) return;
        this.remove(id);
        const n = new THREE.Vector3(...normal).normalize();
        const u = new THREE.Vector3(...up);
        u.addScaledVector(n, -u.dot(n));
        if (u.lengthSq() < 1e-4) return;
        u.normalize();
        const right = new THREE.Vector3().crossVectors(u, n).normalize();
        const material = new THREE.MeshStandardMaterial({
            map: stickerTexture(stickerId),
            transparent: true,
            alphaTest: 0.02,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -4,
            polygonOffsetUnits: -4,
            roughness: 0.75
        });
        const mesh = new THREE.Mesh(GEOMETRY, material);
        mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, u, n));
        mesh.position.set(...position).addScaledVector(n, SURFACE_OFFSET);
        mesh.raycast = () => {};
        mesh.renderOrder = 2;
        mesh.name = `Sticker_${stickerId}`;
        this.game.scene.getScene().add(mesh);
        this.stickers.set(id, mesh);
        const listener = this.game.environment.audioListener;
        if (fresh && listener) playSynth(listener, mesh, new THREE.Vector3(0, 0, 0.2), 'spray', 3);
    }

    remove(id) {
        const mesh = this.stickers.get(id);
        if (!mesh) return;
        this.stickers.delete(id);
        mesh.removeFromParent();
        mesh.material.dispose();
    }
}
