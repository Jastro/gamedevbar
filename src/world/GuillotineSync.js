import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { PLAZA_CENTER, bearing } from './RoomLayout';
import { loadModelFile, lerpAngle } from '../entities/Player';
import { prepareAnchors, applyAppearance } from '../appearance/Accessories';
import { normalizeAppearance } from '../appearance/catalog';
import { playSynth } from '../audio/synth';
import GUILLOTINE from '../../server/shared/guillotine.json';

// The plaza's guillotine (server: server/features/police.js decides who and
// when; shared layout in server/shared/guillotine.json). Everyone draws the
// same show from the server's timestamps:
// - arrested (policeArrest): that player's controls lock and they walk
//   behind Agente Porras to the guillotine;
// - execution (guillotine): they stand in it, last words, the blade drops at
//   bladeAt, their avatar loses its head and a copy of the head (same model,
//   hat and all) falls and rolls to where the server said, for 10 s; then
//   they fade out and wake up in a random bar's toilet;
// - heads (guillotineState on join) stay where they stopped for 24 h, with
//   a trail of blood, and a pool under the guillotine while any head's there.
const WOOD = 0x5b3a21;
const BLADE_REST = 3.6;   // bottom of the blade, up
const BLADE_DOWN = 0.74;  // at the neck
const BLADE_FALL_MS = 250;
const BLADE_RISE_MS = 2000;
const HEAD_FALL_MS = 400;
const FADE_MS = 1000;     // #fade-overlay's transition, then the toilet
const TOILET_SPOT = { x: -12.8, z: 7.5 };  // bathroom-local, in front of the toilet
const HEAD_LIFETIME_MS = 24 * 60 * 60 * 1000;
const FOLLOW = { distance: 1.1, rate: 8 };
// A spotlight on a post beside it, aimed at it: the guillotine and a quarter
// more around (about 1.9 across), soft and warm; lit at night (Weather).
const SPOT = { post: { x: 2.4, z: 2.2 }, height: 6, aim: { x: 0, y: 1.2, z: 0 }, reach: 1.9, intensity: 22, color: 0xfff1d6 };

// A repeatable 0..1 from a string (blood drops look the same for everyone).
function seeded(text) {
    let h = 2166136261;
    for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return () => {
        h = Math.imul(h ^ (h >>> 15), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
}

export class GuillotineSync {
    constructor(game) {
        this.game = game;
        this.yaw = GUILLOTINE.bearing;
        const out = bearing(this.yaw);
        this.origin = new THREE.Vector3(PLAZA_CENTER.x + out.x * GUILLOTINE.distance, 0, PLAZA_CENTER.z + out.z * GUILLOTINE.distance);
        this.heads = new Map(); // id -> { head, holder, radius, blood }
        this.execution = null;
        this.lastBladeAt = -Infinity;
        this.arrested = false;
        this.escortMoving = false;
        this.loader = new GLTFLoader();
    }

    get localPlayer() {
        return this.game.players.localPlayer;
    }

    get now() {
        return this.game.serverClock.now();
    }

    // Guillotine-local (x right, z toward the plaza's center) to world.
    toWorld(x, y, z) {
        const cos = Math.cos(this.yaw);
        const sin = Math.sin(this.yaw);
        return new THREE.Vector3(this.origin.x + x * cos + z * sin, y, this.origin.z - x * sin + z * cos);
    }

    create() {
        const group = new THREE.Group();
        group.position.copy(this.origin);
        group.rotation.y = this.yaw;
        this.group = group;
        this.game.scene.getScene().add(group);
        const wood = new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.85 });
        // Bright steel: a strongly metallic one has nothing to reflect here
        // and came out black.
        const metal = new THREE.MeshStandardMaterial({ color: 0xdfe5ea, metalness: 0.25, roughness: 0.3, side: THREE.DoubleSide });
        const box = (w, h, d, material, x, y, z) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            group.add(mesh);
            return mesh;
        };
        box(2, 0.1, 1.4, wood, 0, 0.05, 0);
        const posts = [-0.72, 0.72].map(x => box(0.18, 4.3, 0.18, wood, x, 2.15, 0));
        box(1.8, 0.25, 0.32, wood, 0, 4.42, 0);
        this.addSign(group);

        // The blade: a slanted edge under a heavy block, sliding between the posts.
        this.blade = new THREE.Group();
        const shape = new THREE.Shape([
            new THREE.Vector2(-0.62, 0), new THREE.Vector2(0.62, 0.32), new THREE.Vector2(0.62, 0.5), new THREE.Vector2(-0.62, 0.5)
        ]);
        const edge = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false }).translate(0, 0, -0.015), metal);
        const weight = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.24, 0.12), wood);
        weight.position.y = 0.62;
        this.blade.add(edge, weight);
        this.blade.position.y = BLADE_REST;
        group.add(this.blade);

        // A basket beside it (decoration: the heads roll off anyway).
        const wicker = new THREE.MeshStandardMaterial({ color: 0x9c6b30, roughness: 0.9, side: THREE.DoubleSide });
        const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.45, 16, 1, true), wicker);
        basket.position.set(-1.1, 0.23, 0.55);
        group.add(basket);

        this.bloodMaterial = new THREE.MeshStandardMaterial({
            // Matte: a glossy one caught the light and looked white.
            color: 0x6e0808, roughness: 0.7, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2
        });
        this.bloodMaterial.userData.outlineParameters = { visible: false };
        this.pool = new THREE.Mesh(this.bloodShape('pool', 0.6, 14, 0.9), this.bloodMaterial);
        this.pool.position.set(0, 0.012, 0.25);
        this.pool.visible = false;
        group.add(this.pool);

        this.addSpot(group, wood);

        group.traverse(child => { child.raycast = () => {}; });
        group.updateMatrixWorld(true);
        // People and cars bump into the posts (not the low base).
        const collisions = this.game.world.collisionManager;
        [...posts, this.spotPost].forEach(post => {
            const blocker = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.3, 0.3), new THREE.MeshBasicMaterial({ visible: false }));
            blocker.position.copy(post.position);
            group.add(blocker);
            blocker.updateMatrixWorld(true);
            collisions.addCollider(blocker);
        });
    }

    addSpot(group, wood) {
        const { post, height, aim, reach, intensity, color } = SPOT;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, height, 10), new THREE.MeshStandardMaterial({ color: 0x2f3337, metalness: 0.5, roughness: 0.5 }));
        pole.position.set(post.x, height / 2, post.z);
        group.add(pole);
        this.spotPost = pole;
        // The lamp head at the top, tipped toward the guillotine.
        const from = new THREE.Vector3(post.x, height, post.z);
        const to = new THREE.Vector3(aim.x, aim.y, aim.z);
        const head = new THREE.Group();
        head.position.copy(from);
        group.add(head);
        group.updateMatrixWorld(true);
        head.lookAt(to.clone().applyMatrix4(group.matrixWorld)); // lookAt takes world space
        const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.4, 14).rotateX(Math.PI / 2), wood);
        this.spotGlass = new THREE.MeshStandardMaterial({ color: 0x555555, emissive: color, emissiveIntensity: 0 });
        const glass = new THREE.Mesh(new THREE.CircleGeometry(0.15, 14), this.spotGlass);
        glass.position.z = 0.205;
        head.add(housing, glass);
        const distance = from.distanceTo(to);
        // Always in the scene (lit at night only): switching a light on and
        // off makes every material recompile once.
        this.spot = new THREE.SpotLight(color, 0, distance + 4, Math.atan(reach / distance), 0.4, 1);
        this.spot.position.copy(from);
        this.spot.target.position.copy(to);
        group.add(this.spot, this.spot.target);
    }

    // 0 by day, 1 at night (Weather, like the street lamps).
    setNight(night) {
        if (!this.spot) return;
        this.spot.intensity = SPOT.intensity * night;
        this.spotGlass.emissiveIntensity = 1.5 * night;
    }

    addSign(group) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        context.fillStyle = '#2b1a0e';
        context.fillRect(0, 0, 512, 64);
        context.fillStyle = '#f2c14e';
        context.font = 'bold 40px Georgia, serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('GUILLOTINA MUNICIPAL', 256, 34);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.21), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 }));
        sign.position.set(0, 4.42, 0.165);
        group.add(sign);
    }

    // A flat splat: a blob of overlapping circles round the middle.
    bloodShape(seed, size, blobs, spread) {
        const random = seeded(seed);
        const pieces = Array.from({ length: blobs }, (_, i) => {
            const radius = size * (i === 0 ? 1 : 0.25 + random() * 0.5);
            const angle = random() * Math.PI * 2;
            const distance = i === 0 ? 0 : size * spread * (0.4 + random() * 0.8);
            return new THREE.CircleGeometry(radius, 14).rotateX(-Math.PI / 2)
                .translate(Math.sin(angle) * distance, 0, Math.cos(angle) * distance);
        });
        return mergePieces(pieces);
    }

    bind() {
        const { network } = this.game;
        network.on('policeArrest', (data) => {
            if (data.targetId !== this.localPlayer?.id) return;
            this.arrested = true;
            this.game.gestureSync?.stop();
            if (this.localPlayer.isSitting) this.localPlayer.standUp();
            this.say('🚓 Detenido. El Agente Porras te lleva a la guillotina… (no puedes moverte)');
        });
        network.on('guillotine', (data) => this.startExecution(data));
        network.on('policeRelease', (data) => this.release(data.targetId));
        network.on('guillotineState', (data) => {
            const heads = Array.isArray(data.heads) ? data.heads : [];
            const ids = new Set(heads.map(head => head.id));
            [...this.heads.keys()].filter(id => !ids.has(id)).forEach(id => this.removeHead(id));
            heads.forEach(head => this.addHead(head));
            if (data.execution) this.startExecution(data.execution);
        });
    }

    say(message) {
        this.game.ui.chat?.addMessage({ type: 'system', message });
    }

    startExecution(data) {
        if (!data?.head || typeof data.bladeAt !== 'number') return;
        this.execution = data;
        this.lastBladeAt = data.bladeAt;
        this.dropped = false;
        if (data.targetId === this.localPlayer?.id) this.arrested = true;
    }

    victim() {
        return this.execution ? this.game.players.players.get(this.execution.targetId) : null;
    }

    release(targetId) {
        const player = this.game.players.players.get(targetId);
        if (player) player.headBowed = false;
        if (player && player !== this.localPlayer) player.headless = false;
        if (this.execution?.targetId === targetId) this.execution = null;
        // Ours, if the timeline didn't get to it (we joined late, a slow tab).
        if (targetId === this.localPlayer?.id && this.arrested && !this.respawning) this.respawn();
    }

    update() {
        const now = this.now;
        this.updateBlade(now);
        if (this.execution) this.updateExecution(now);
        else if (this.arrested && !this.respawning) this.followPoliceman();
        this.heads.forEach(entry => this.placeHead(entry, now));
        if (now - (this.lastPrune ?? 0) > 5000) {
            this.lastPrune = now;
            [...this.heads.values()].filter(({ head }) => now - head.droppedAt > HEAD_LIFETIME_MS).forEach(({ head }) => this.removeHead(head.id));
        }
        this.pool.visible = this.heads.size > 0;
    }

    updateBlade(now) {
        const t = now - this.lastBladeAt;
        let y = BLADE_REST;
        if (t >= 0 && t < BLADE_FALL_MS) y = BLADE_REST - (BLADE_REST - BLADE_DOWN) * (t / BLADE_FALL_MS) ** 2;
        else if (t >= BLADE_FALL_MS && t < GUILLOTINE.respawnMs) y = BLADE_DOWN;
        else if (t >= GUILLOTINE.respawnMs && t < GUILLOTINE.respawnMs + BLADE_RISE_MS) {
            y = BLADE_DOWN + (BLADE_REST - BLADE_DOWN) * ((t - GUILLOTINE.respawnMs) / BLADE_RISE_MS);
        }
        this.blade.position.y = y;
    }

    updateExecution(now) {
        const { targetId, bladeAt, head } = this.execution;
        const mine = targetId === this.localPlayer?.id;
        // Head bowed through the guillotine, face to the floor, until the blade.
        const victim = this.victim();
        if (victim) victim.headBowed = now < bladeAt;
        // We hold ourselves in the guillotine (everyone sees our position).
        if (mine && !this.respawning) {
            const player = this.localPlayer;
            player.position.copy(this.toWorld(GUILLOTINE.victimSpot.x, 1, GUILLOTINE.victimSpot.z));
            player.rotation = this.yaw;
            this.escortMoving = false;
        }
        if (!this.dropped && now >= bladeAt) {
            this.dropped = true;
            if (victim) victim.headless = true;
            this.addHead(head);
            const listener = this.game.environment.audioListener;
            if (listener) {
                playSynth(listener, this.blade, new THREE.Vector3(0, 0, 0), 'dart', 14);
                playSynth(listener, this.group, new THREE.Vector3(0, 0.5, 0.4), 'squelch', 10);
            }
        }
        if (mine && !this.respawning && now >= bladeAt + GUILLOTINE.rollMs) this.respawn();
    }

    // Arrested, before the execution: a step behind the policeman.
    followPoliceman() {
        const cop = this.game.police?.npc;
        const player = this.localPlayer;
        if (!cop || !player) return;
        const yaw = cop.mesh.rotation.y;
        const target = cop.position.clone().add(new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).multiplyScalar(FOLLOW.distance));
        const before = player.position.clone();
        const t = 1 - Math.exp(-FOLLOW.rate * 0.016);
        player.position.x += (target.x - player.position.x) * t;
        player.position.z += (target.z - player.position.z) * t;
        player.position.y = 1;
        player.rotation = lerpAngle(player.rotation, yaw, t);
        this.escortMoving = player.position.distanceTo(before) > 0.005;
    }

    // Fade out, wake up in a random bar's toilet, head back on.
    respawn() {
        this.respawning = true;
        const fade = document.getElementById('fade-overlay');
        fade?.classList.add('visible');
        setTimeout(() => {
            const player = this.localPlayer;
            const bathrooms = this.game.environment.getBathrooms();
            const bathroom = bathrooms[Math.floor(Math.random() * bathrooms.length)];
            if (player && bathroom) {
                player.position.copy(bathroom.worldPoint(TOILET_SPOT.x, 1, TOILET_SPOT.z));
                const ahead = bathroom.worldPoint(TOILET_SPOT.x + 1, 1, TOILET_SPOT.z);
                player.rotation = Math.atan2(ahead.x - player.position.x, ahead.z - player.position.z);
                this.game.camera.rotation.horizontal = player.rotation + Math.PI;
                player.headless = false;
                player.headBowed = false;
                const room = this.game.world.getRoomAt(player.position);
                this.say(`🚽 Te despiertas en el baño de ${room?.name ?? 'algún bar'}, con un dolor de cuello tremendo.`);
            }
            this.arrested = false;
            this.escortMoving = false;
            this.respawning = false;
            if (this.execution?.targetId === player?.id) this.execution = null;
            setTimeout(() => fade?.classList.remove('visible'), 300);
        }, FADE_MS);
    }

    // --- Heads ---------------------------------------------------------------

    addHead(head) {
        if (!head?.id || this.heads.has(head.id)) return;
        const entry = { head, holder: new THREE.Group(), radius: GUILLOTINE.headRadius };
        entry.holder.visible = false; // until the model's in
        this.game.scene.getScene().add(entry.holder);
        entry.blood = this.createTrail(head);
        this.heads.set(head.id, entry);
        this.buildHead(entry);
    }

    removeHead(id) {
        const entry = this.heads.get(id);
        if (!entry) return;
        entry.holder.removeFromParent();
        entry.blood.removeFromParent();
        entry.blood.geometry.dispose();
        this.heads.delete(id);
    }

    // Their avatar, everything but the head shrunk to a point: the head,
    // with its hat and face items, is all that's left.
    async buildHead(entry) {
        const { head } = entry;
        const modelId = typeof head.modelId === 'string' ? head.modelId : 'pj';
        try {
            const gltf = await this.loader.parseAsync(await loadModelFile(`/assets/models/${modelId}.glb`), '/assets/models/');
            if (!this.heads.has(head.id)) return;
            const model = gltf.scene;
            const avatar = new THREE.Group();
            model.scale.setScalar(0.8);
            model.position.y = -1;
            avatar.add(model);
            prepareAnchors(model, avatar, modelId);
            const appearance = normalizeAppearance(head.appearance ?? {});
            applyAppearance(model, modelId, appearance);
            const bone = (name) => model.getObjectByName(name);
            ['HandL', 'HandR', 'FootL', 'FootR'].forEach(name => bone(name)?.scale.setScalar(1e-3));
            bone('Body')?.scale.setScalar(1e-3);
            bone('Head')?.scale.setScalar(1e3);
            avatar.updateMatrixWorld(true);
            const neck = bone('Head')?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3();
            const size = appearance.scale ?? 1;
            entry.radius = GUILLOTINE.headRadius * size;
            // The head's middle on the holder's origin.
            avatar.position.set(-neck.x, -(neck.y + 0.38 * size), -neck.z);
            avatar.traverse(child => { child.raycast = () => {}; });
            entry.holder.add(avatar);
            entry.holder.visible = true;
        } catch (error) {
            console.warn('Could not build a guillotined head', error);
        }
    }

    // Where a head is at `now`: hidden before the blade, falling, rolling
    // (slowing down) to `to`, then still. The same for everyone.
    placeHead(entry, now) {
        const { head, holder, radius } = entry;
        const t = now - head.droppedAt;
        const shown = t >= 0;
        entry.blood.visible = shown;
        if (!shown) {
            holder.visible = false;
            return;
        }
        if (holder.children.length) holder.visible = true;
        const from = head.from;
        const dx = head.to.x - from.x;
        const dz = head.to.z - from.z;
        const distance = Math.max(0.01, Math.hypot(dx, dz));
        const dirX = dx / distance;
        const dirZ = dz / distance;
        const nudge = Math.min(0.3, distance);
        let along;
        let y;
        let angle;
        if (t < HEAD_FALL_MS) {
            const u = t / HEAD_FALL_MS;
            along = nudge * u;
            y = from.y + (radius - from.y) * u * u;
            angle = 0.6 * u;
        } else {
            const u = Math.min(1, (t - HEAD_FALL_MS) / (GUILLOTINE.rollMs - HEAD_FALL_MS));
            const eased = 1 - (1 - u) ** 3;
            along = nudge + (distance - nudge) * eased;
            y = radius;
            angle = 0.6 + (along - nudge) / radius;
        }
        holder.position.set(from.x + dirX * along, y, from.z + dirZ * along);
        // Rolling about the horizontal axis across its path, from how it was
        // cut: facing out of the guillotine, bowed face down.
        const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(dirZ, 0, -dirX), angle);
        const bowed = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)), Math.PI / 2);
        holder.quaternion.copy(roll).multiply(bowed).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw));
    }

    // Drops along the head's path and a puddle where it stops.
    createTrail(head) {
        const random = seeded(head.id);
        const dx = head.to.x - head.from.x;
        const dz = head.to.z - head.from.z;
        const distance = Math.hypot(dx, dz);
        const pieces = [];
        for (let s = 0.4; s < distance - 0.2; s += 0.3 + random() * 0.25) {
            const side = (random() - 0.5) * 0.25;
            const x = head.from.x + (dx / distance) * s + (dz / distance) * side;
            const z = head.from.z + (dz / distance) * s - (dx / distance) * side;
            pieces.push(new THREE.CircleGeometry(0.05 + random() * 0.09, 10).rotateX(-Math.PI / 2).translate(x, 0, z));
        }
        const puddle = this.bloodShape(`${head.id}:puddle`, 0.32, 6, 0.8).translate(head.to.x, 0, head.to.z);
        const mesh = new THREE.Mesh(mergePieces([...pieces, puddle]), this.bloodMaterial);
        mesh.position.y = 0.013;
        mesh.raycast = () => {};
        mesh.visible = false;
        this.game.scene.getScene().add(mesh);
        return mesh;
    }
}

// Circles of different segment counts into one geometry (all non-indexed).
function mergePieces(geometries) {
    const flat = geometries.map(geometry => (geometry.index ? geometry.toNonIndexed() : geometry));
    const positions = [];
    const normals = [];
    flat.forEach(geometry => {
        positions.push(...geometry.attributes.position.array);
        normals.push(...geometry.attributes.normal.array);
    });
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return merged;
}
