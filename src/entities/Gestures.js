import * as THREE from 'three';
import { playSynth, playTones } from '../audio/synth';

// Procedural gestures (right click → Animaciones), played on the rig's own
// bones: CORE (moves everything), Body, Head, and the floating HandL/HandR.
// Poses are written in avatar space, the player mesh's frame at size 1
// (+z forward, +y up, feet at y -1, hands rest at x ±0.4 / y -0.52, the big
// head reaches y +1.1), and converted to each bone's space every frame, so
// one gesture fits every character and size. They're applied after the walk
// / idle animation (Player.update) and fade in and out.
const FADE = 0.25; // s
const BONES = ['CORE', 'Body', 'Head', 'HandL', 'HandR'];

// pose(t) → { core: {pos, rot}, body: {rot}, head: {rot}, handL: {pos, rot?}, handR: {pos, rot?}, root: {pos, rot} }
// pos are avatar-space points (hands) or offsets (core, root); rot are
// avatar-space Euler angles [x, y, z] added on top of the animation.
const wave = (t, hz, phase = 0) => Math.sin(t * hz * Math.PI * 2 + phase);

export const GESTURES = {
    dance: {
        label: 'Baile sexy', icon: '💃', duration: 10, loop: true, standing: true,
        pose(t) {
            const sway = wave(t, 0.8);
            const slide = (offset) => 0.95 - 1.35 * (0.5 + 0.5 * wave(t, 0.4, offset)); // hands down the body
            return {
                core: { pos: [0.1 * sway, 0.05 * Math.abs(wave(t, 1.6)), 0], rot: [0, 0.35 * sway, 0.12 * sway] },
                head: { rot: [0.05, -0.2 * sway, -0.15 * sway] },
                handL: { pos: [-0.45 - 0.05 * sway, slide(0), 0.2] },
                handR: { pos: [0.45 - 0.05 * sway, slide(Math.PI), 0.2] }
            };
        }
    },
    pushups: {
        label: 'Flexiones', icon: '💪', duration: 10, loop: true, standing: true,
        pose(t) {
            const up = 0.5 + 0.5 * wave(t, 0.7);
            return {
                // Face down along +z, lifted onto the hands; the whole body goes up and down.
                root: { pos: [0, 0.62 + 0.22 * up, -1.0], rot: [Math.PI / 2 - 0.12, 0, 0] },
                handL: { pos: [-0.38, -0.96, 0.15] },
                handR: { pos: [0.38, -0.96, 0.15] }
            };
        }
    },
    jerk: {
        label: 'Paja', icon: '✊', duration: 4.2,
        pose(t) {
            // Faster and faster, then the finish (and a sigh of relief).
            const done = THREE.MathUtils.smoothstep(t, 3.2, 3.5);
            const stroke = wave(t, 2.6 + t * 0.6) * (1 - done);
            return {
                core: { pos: [0, 0, 0], rot: [0.08 - 0.12 * done, 0, 0] },
                head: { rot: [-0.3 - 0.05 * wave(t, 1.5) - 0.2 * done, 0, 0] },
                // In front of the belly (bulky characters reach ~0.6 forward),
                // a sideways fist tilting with each stroke.
                handR: { pos: [0.06, -0.62 + 0.08 * stroke, 0.66], rot: [0.35 * stroke, 0, 1.4] },
                handL: { pos: [-0.42, -0.5, 0.05] }
            };
        },
        effect: { at: 3.3, kind: 'finish' }
    },
    kiss: {
        label: 'Beso', icon: '😘', duration: 2.2,
        pose(t) {
            const toMouth = THREE.MathUtils.smoothstep(t, 0, 0.6) * (1 - THREE.MathUtils.smoothstep(t, 0.8, 1.2));
            const blow = THREE.MathUtils.smoothstep(t, 0.8, 1.2) * (1 - THREE.MathUtils.smoothstep(t, 1.6, 2.1));
            const hand = new THREE.Vector3(0.4, -0.52, 0)
                .lerp(new THREE.Vector3(0.06, 0.2, 0.74), toMouth)
                .lerp(new THREE.Vector3(0.25, 0.45, 1.1), blow);
            return {
                head: { rot: [0.15 * toMouth - 0.1 * blow, 0, 0] },
                // Fingers to the lips, then the palm flips out toward everyone.
                handR: { pos: hand.toArray(), rot: [-1.3 * toMouth + 0.9 * blow, 0, -0.4 * toMouth + 0.3 * blow] }
            };
        },
        effect: { at: 0.95, kind: 'hearts' }
    },
    spit: {
        label: 'Escupir', icon: '💦', duration: 1.8,
        pose(t) {
            const back = THREE.MathUtils.smoothstep(t, 0, 0.55);
            const snap = THREE.MathUtils.smoothstep(t, 0.55, 0.75);
            const lean = -0.35 * back * (1 - snap) + 0.3 * snap * (1 - THREE.MathUtils.smoothstep(t, 1.1, 1.6));
            return {
                core: { pos: [0, 0, 0], rot: [lean * 0.4, 0, 0] },
                head: { rot: [lean, 0, 0] }
            };
        },
        effect: { at: 0.7, kind: 'spit' }
    },
    cheer: {
        label: 'Animar', icon: '🙌', duration: 3,
        pose(t) {
            return {
                core: { pos: [0, 0.08 * Math.abs(wave(t, 1.5)), 0], rot: [0, 0, 0] },
                head: { rot: [-0.15, 0, 0] },
                handL: { pos: [-0.55, 1.0 + 0.18 * wave(t, 1.5), 0.15] },
                handR: { pos: [0.55, 1.0 + 0.18 * wave(t, 1.5, Math.PI), 0.15] }
            };
        },
        effect: { at: 0.2, kind: 'cheer' }
    },
    toast: {
        label: 'Brindar', icon: '🍻', duration: 2.8, item: 'beer',
        pose(t) {
            const raise = THREE.MathUtils.smoothstep(t, 0, 0.5);
            const clink = THREE.MathUtils.smoothstep(t, 0.6, 0.8) * (1 - THREE.MathUtils.smoothstep(t, 0.9, 1.2));
            const drink = THREE.MathUtils.smoothstep(t, 1.4, 1.8) * (1 - THREE.MathUtils.smoothstep(t, 2.3, 2.7));
            const hand = new THREE.Vector3(0.4, -0.52, 0)
                .lerp(new THREE.Vector3(0.3, 0.75, 0.55), raise)
                .add(new THREE.Vector3(-0.08, 0.05, 0.3).multiplyScalar(clink))
                .lerp(new THREE.Vector3(0.08, 0.2, 0.74), drink);
            return {
                head: { rot: [-0.25 * drink, 0, 0] },
                // Raised a little tilted, a forward clink, then tipped toward the mouth.
                handR: { pos: hand.toArray(), rot: [0.35 * clink - 1.3 * drink, 0, -0.2 * raise] }
            };
        },
        effect: { at: 0.8, kind: 'clink' }
    }
};

export const GESTURE_IDS = Object.keys(GESTURES);

// --- Applying ------------------------------------------------------------------

const scratch = {
    point: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    parentQuaternion: new THREE.Quaternion(),
    meshQuaternion: new THREE.Quaternion(),
    euler: new THREE.Euler(0, 0, 0, 'YXZ'),
    delta: new THREE.Quaternion()
};

// An avatar-space point → world (the model is scaled around its own origin).
function avatarToWorld(player, [x, y, z]) {
    const model = player.model;
    const size = model.scale.x / player.baseModelScale;
    const origin = model.position;
    scratch.point.set(origin.x + (x - origin.x) * size, origin.y + (y - origin.y) * size, origin.z + (z - origin.z) * size);
    return player.mesh.localToWorld(scratch.point);
}

// Adds an avatar-space rotation to a bone, weighted.
function rotateBone(player, bone, [x, y, z], weight) {
    scratch.euler.set(x * weight, y * weight, z * weight);
    scratch.delta.setFromEuler(scratch.euler);
    player.mesh.getWorldQuaternion(scratch.meshQuaternion);
    bone.parent.getWorldQuaternion(scratch.parentQuaternion);
    bone.getWorldQuaternion(scratch.quaternion);
    // world' = mesh * delta * mesh⁻¹ * world, then back to the parent's space.
    const world = scratch.meshQuaternion.clone().multiply(scratch.delta)
        .multiply(scratch.meshQuaternion.clone().invert()).multiply(scratch.quaternion);
    bone.quaternion.copy(scratch.parentQuaternion.invert().multiply(world));
    bone.updateMatrixWorld(true);
}

// Moves a bone toward an avatar-space point (hands), weighted.
function placeBone(player, bone, point, weight) {
    const world = avatarToWorld(player, point);
    const local = bone.parent.worldToLocal(world.clone());
    bone.position.lerp(local, weight);
    bone.updateMatrixWorld(true);
}

// Offsets a bone by an avatar-space vector, weighted.
function shiftBone(player, bone, [x, y, z], weight) {
    const from = avatarToWorld(player, [0, 0, 0]).clone();
    const to = avatarToWorld(player, [x * weight, y * weight, z * weight]).clone();
    const world = bone.getWorldPosition(new THREE.Vector3()).add(to.sub(from));
    bone.position.copy(bone.parent.worldToLocal(world));
    bone.updateMatrixWorld(true);
}

// Bones the animation clip doesn't key keep whatever we set last frame, so
// before posing, put those back to their base (bones the mixer just wrote
// are taken as the new base).
function prepareBones(gesture, bones) {
    gesture.bases ??= new Map();
    bones.forEach(bone => {
        const base = gesture.bases.get(bone);
        if (!base) {
            gesture.bases.set(bone, { position: bone.position.clone(), quaternion: bone.quaternion.clone() });
            return;
        }
        if (base.lastPosition && bone.position.equals(base.lastPosition)) bone.position.copy(base.position);
        else base.position.copy(bone.position);
        if (base.lastQuaternion && bone.quaternion.equals(base.lastQuaternion)) bone.quaternion.copy(base.quaternion);
        else base.quaternion.copy(bone.quaternion);
    });
}

function rememberBones(gesture, bones) {
    bones.forEach(bone => {
        const base = gesture.bases.get(bone);
        base.lastPosition = bone.position.clone();
        base.lastQuaternion = bone.quaternion.clone();
    });
}

function restoreBones(gesture) {
    gesture.bases?.forEach((base, bone) => {
        if (base.lastPosition && bone.position.equals(base.lastPosition)) bone.position.copy(base.position);
        if (base.lastQuaternion && bone.quaternion.equals(base.lastQuaternion)) bone.quaternion.copy(base.quaternion);
    });
}

// One frame of the player's current gesture (Player.update, after the mixer
// and the mesh's own transform). Returns false once it has finished.
export function applyGesture(player, deltaTime) {
    const gesture = player.gesture;
    const def = GESTURES[gesture?.name];
    const model = player.model;
    // The character was swapped mid-gesture: the old model is gone.
    if (!def || !model || (gesture.model && gesture.model !== model)) return false;
    if (!gesture.rest) gesture.rest = { position: model.position.clone(), rotation: model.rotation.clone() };

    gesture.time += deltaTime;
    if (gesture.time >= def.duration) gesture.stopping = true;
    if (gesture.stopping) {
        gesture.fadeOut = (gesture.fadeOut ?? 0) + deltaTime;
        if (gesture.fadeOut >= FADE) {
            model.position.copy(gesture.rest.position);
            model.rotation.copy(gesture.rest.rotation);
            restoreBones(gesture);
            return false;
        }
    }
    const weight = Math.min(1, gesture.time / FADE) * (gesture.stopping ? 1 - gesture.fadeOut / FADE : 1);
    const pose = def.pose(def.loop ? gesture.time : Math.min(gesture.time, def.duration));

    // The whole model first (push-ups), then the bones in hierarchy order.
    model.position.copy(gesture.rest.position);
    model.rotation.copy(gesture.rest.rotation);
    if (pose.root) {
        const [px, py, pz] = pose.root.pos;
        model.position.add(new THREE.Vector3(px, py, pz).multiplyScalar(weight * model.scale.x / player.baseModelScale));
        model.rotation.x += pose.root.rot[0] * weight;
    }
    player.mesh.updateMatrixWorld(true);

    const bones = BONES.map(name => model.getObjectByName(name)).filter(Boolean);
    prepareBones(gesture, bones);
    player.mesh.updateMatrixWorld(true);
    const bone = (name) => model.getObjectByName(name);
    const core = bone('CORE');
    if (core && pose.core) {
        shiftBone(player, core, pose.core.pos, weight);
        rotateBone(player, core, pose.core.rot, weight);
    }
    const body = bone('Body');
    if (body && pose.body) rotateBone(player, body, pose.body.rot, weight);
    const head = bone('Head');
    if (head && pose.head) rotateBone(player, head, pose.head.rot, weight);
    const handL = bone('HandL');
    const handR = bone('HandR');
    [[handL, pose.handL], [handR, pose.handR]].forEach(([hand, target]) => {
        if (!hand || !target) return;
        placeBone(player, hand, target.pos, weight);
        if (target.rot) rotateBone(player, hand, target.rot, weight);
    });
    rememberBones(gesture, bones);

    if (def.effect && !gesture.effectDone && gesture.time >= def.effect.at) {
        gesture.effectDone = true;
        spawnEffect(player, def.effect.kind);
    }
    return true;
}

// --- Effects (hearts, spit, the finish, cheers, the clink) ------------------

const effects = [];
let heartTexture = null;

function emojiTexture(emoji) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = '52px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 32, 36);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function spawnEffect(player, kind) {
    const scene = player.mesh.parent;
    if (!scene) return;
    const listener = window.game?.environment.audioListener;
    const mouth = avatarToWorld(player, [0, 0.15, 0.65]).clone();
    const forward = new THREE.Vector3(Math.sin(player.rotation), 0, Math.cos(player.rotation));

    if (kind === 'hearts') {
        heartTexture ??= emojiTexture('❤️');
        for (let i = 0; i < 3; i++) {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTexture, transparent: true, depthWrite: false }));
            sprite.scale.setScalar(0.3);
            sprite.position.copy(mouth);
            scene.add(sprite);
            effects.push({
                object: sprite, life: 1.6, age: -i * 0.15,
                velocity: forward.clone().multiplyScalar(1.2).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.8, 0)),
                gravity: -0.3, fade: true
            });
        }
        if (listener) playTones(listener, player.mesh, new THREE.Vector3(0, 0.2, 0.5), [[1568, 0, 0.08], [2093, 0.08, 0.12]], 0.12, 2);
    } else if (kind === 'spit') {
        spawnDroplets(scene, mouth, forward, { color: 0xd6f0ff, count: 6, speed: 2.6, lift: 1 });
        if (listener) playSynth(listener, player.mesh, new THREE.Vector3(0, 0.2, 0.5), 'spit', 2);
    } else if (kind === 'finish') {
        const hand = player.model.getObjectByName('HandR');
        const from = hand ? hand.getWorldPosition(new THREE.Vector3()) : mouth;
        spawnDroplets(scene, from, forward, { color: 0xf4f1e8, count: 9, speed: 3.2, lift: 1.4 });
        if (listener) playSynth(listener, player.mesh, new THREE.Vector3(0, -0.6, 0.6), 'squelch', 2);
    } else if (kind === 'cheer') {
        if (listener) playTones(listener, player.mesh, new THREE.Vector3(0, 0.5, 0), [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.3, 0.25]], 0.1, 3);
    } else if (kind === 'clink') {
        if (listener) playTones(listener, player.mesh, new THREE.Vector3(0.3, 0.75, 0.6), [[2637, 0, 0.18], [3136, 0.02, 0.25]], 0.12, 3);
    }
}

// Drops flying out of `from` that splat on the floor (spit, the finish).
function spawnDroplets(scene, from, forward, { color, count, speed, lift }) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
    for (let i = 0; i < count; i++) {
        const drop = new THREE.Mesh(new THREE.SphereGeometry(0.025 + Math.random() * 0.02, 6, 4), material);
        drop.position.copy(from);
        scene.add(drop);
        effects.push({
            object: drop, life: 2.6, age: 0, geometry: drop.geometry,
            velocity: forward.clone().multiplyScalar(speed + Math.random()).add(new THREE.Vector3((Math.random() - 0.5) * 0.5, lift + Math.random() * 0.5, 0)),
            gravity: -9, splat: true
        });
    }
    effects.push({ material, life: 2.8, age: 0 });
}

// Per frame (Game.update): moves and removes the effects.
export function updateGestureEffects(deltaTime) {
    for (let i = effects.length - 1; i >= 0; i--) {
        const effect = effects[i];
        effect.age += deltaTime;
        const { object } = effect;
        if (object && effect.age > 0) {
            effect.velocity.y += effect.gravity * deltaTime;
            object.position.addScaledVector(effect.velocity, deltaTime);
            if (effect.fade) object.material.opacity = Math.max(0, 1 - effect.age / effect.life);
            // Spit lands and stops.
            if (effect.splat && object.position.y <= 0.02) {
                object.position.y = 0.02;
                object.scale.set(2.2, 0.15, 2.2);
                effect.velocity.set(0, 0, 0);
                effect.gravity = 0;
            }
        }
        if (effect.age >= effect.life) {
            object?.removeFromParent();
            effect.geometry?.dispose();
            if (effect.fade) object.material.dispose();
            effect.material?.dispose();
            effects.splice(i, 1);
        }
    }
}

