import * as THREE from 'three';
import { SLOTS, getItem } from './catalog';

// Puts an appearance on a loaded character model: accessories on bones (so
// they follow the animations), the color tint and the size.
//
// Anchors are points in avatar space (the player mesh: center at y 0, feet
// at -1, facing +z) measured on the six characters, which share one rig.
// They're turned into bone-local transforms once per model, in the rest pose
// right after loading, and cached, so changing a hat later doesn't depend on
// the pose the animation happens to be in.

const BASE_MODEL_SCALE = 0.8; // Player.loadModel's scale
const DEFAULT_HEAD = { skullTop: 0.53, faceZ: 0.52, eyeY: 0.14 };
// Per character (built-in hair, combs and hats raise the top).
const HEADS = {
    pj: { skullTop: 0.53, faceZ: 0.52 },
    pj2: { skullTop: 0.98, faceZ: 0.55 }, // tall chicken head (the comb sits above)
    pj3: { skullTop: 0.62, faceZ: 0.53 },
    pj4: { skullTop: 0.53, faceZ: 0.5 },
    pj5: { skullTop: 0.62, faceZ: 0.52 },
    pj6: { skullTop: 0.72, faceZ: 0.55 } // on the brim of the built-in Santa hat
};
const HAND_GRIP = new THREE.Vector3(0, -0.05, 0.03); // palm, from the HandR bone
// How far a tint pulls the texture toward its color (1 = full multiply,
// which turned faces solid blue).
const TINT_STRENGTH = 0.6;
const WHITE = new THREE.Color(0xffffff);

const anchorCache = new Map(); // modelId -> { head, face, hand } bone-local transforms

function headFor(modelId) {
    return { ...DEFAULT_HEAD, ...HEADS[modelId] };
}

// Bone-local position/rotation/scale that puts an avatar-space point (and
// the avatar's orientation and scale) on that bone.
function boneLocal(bone, avatar, avatarPoint) {
    avatar.updateMatrixWorld(true);
    const world = avatar.localToWorld(avatarPoint.clone());
    const position = bone.worldToLocal(world);
    const boneQuaternion = bone.getWorldQuaternion(new THREE.Quaternion());
    const avatarQuaternion = avatar.getWorldQuaternion(new THREE.Quaternion());
    const quaternion = boneQuaternion.invert().multiply(avatarQuaternion);
    const scale = avatar.getWorldScale(new THREE.Vector3()).x / bone.getWorldScale(new THREE.Vector3()).x;
    return { bone: bone.name, position, quaternion, scale };
}

// Call right after loading, before any animation runs (rest pose).
export function prepareAnchors(model, avatar, modelId) {
    if (anchorCache.has(modelId)) return;
    const head = model.getObjectByName('Head');
    const hand = model.getObjectByName('HandR');
    if (!head || !hand) return;
    const saved = model.scale.clone();
    model.scale.setScalar(BASE_MODEL_SCALE);
    avatar.updateMatrixWorld(true);
    const { skullTop, faceZ, eyeY } = headFor(modelId);
    const handPoint = avatar.worldToLocal(hand.getWorldPosition(new THREE.Vector3())).add(HAND_GRIP);
    anchorCache.set(modelId, {
        head: boneLocal(head, avatar, new THREE.Vector3(0, skullTop, 0.02)),
        face: boneLocal(head, avatar, new THREE.Vector3(0, eyeY, faceZ)),
        hand: boneLocal(hand, avatar, handPoint)
    });
    model.scale.copy(saved);
    avatar.updateMatrixWorld(true);
}

// Replaces the model's accessories and applies tint and size.
export function applyAppearance(model, modelId, appearance) {
    if (!model) return;
    const anchors = anchorCache.get(modelId);
    model.traverse(object => {
        if (object.userData.isAccessory) object.userData.remove = true;
    });
    const stale = [];
    model.traverse(object => object.userData.remove && stale.push(object));
    stale.forEach(object => object.removeFromParent());

    if (anchors) {
        Object.keys(SLOTS).forEach(slot => {
            const item = getItem(appearance[slot]);
            if (!item) return;
            const anchor = anchors[slot];
            const bone = model.getObjectByName(anchor.bone);
            if (!bone) return;
            const accessory = item.build();
            accessory.userData.isAccessory = true;
            accessory.position.copy(anchor.position);
            accessory.quaternion.copy(anchor.quaternion);
            accessory.scale.setScalar(anchor.scale);
            accessory.traverse(child => {
                child.castShadow = true;
                // Not a click target (clicks go through to the world).
                if (child.isMesh) child.raycast = () => {};
            });
            bone.add(accessory);
        });
    }

    applyTint(model, appearance.tint);
    model.scale.setScalar(BASE_MODEL_SCALE * (appearance.scale ?? 1));
}

function applyTint(model, tint) {
    model.traverse(object => {
        if (!object.isMesh) return;
        let parent = object;
        while (parent && !parent.userData.isAccessory) parent = parent.parent;
        if (parent) return; // accessories keep their colors
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => {
            if (!material?.color) return;
            if (!material.userData.baseColor) material.userData.baseColor = material.color.clone();
            material.color.copy(material.userData.baseColor);
            if (tint) material.color.multiply(WHITE.clone().lerp(new THREE.Color(tint), TINT_STRENGTH));
        });
    });
}
