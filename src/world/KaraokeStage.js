import * as THREE from 'three';

// The karaoke stage in front of each bar's projector screen (right wall):
// a low platform you jump onto (or F at the mic), a mic stand, and a stage
// light that comes on while anyone is up there. Lyrics come from the shared
// projector (karaoke videos). Being on stage is worked out from positions
// on every client, so there's no server state: VoiceChat makes a singer's
// voice fill the bar, and the light follows whoever is up. Room-local.
const STAGE = { minX: 11.6, maxX: 14.7, minZ: -2.6, maxZ: 2.6, height: 0.25 };
const MIC = { x: 12.4, z: 0 };
const LIGHT_STAND = { x: 11.1, z: 3.1, height: 3.4 };
const LIGHT_INTENSITY = 30;
const LIGHT_FADE = 6; // 1/s

export class KaraokeStage {
    constructor(room, collisionManager) {
        this.room = room;
        this.collisionManager = collisionManager;
        this.lit = 0;
    }

    create() {
        const group = new THREE.Group();
        group.name = 'KaraokeStage';

        const width = STAGE.maxX - STAGE.minX;
        const depth = STAGE.maxZ - STAGE.minZ;
        const platform = new THREE.Mesh(
            new THREE.BoxGeometry(width, STAGE.height, depth),
            new THREE.MeshStandardMaterial({ color: 0x2b1d14, roughness: 0.7 })
        );
        platform.position.set((STAGE.minX + STAGE.maxX) / 2, STAGE.height / 2, (STAGE.minZ + STAGE.maxZ) / 2);
        platform.receiveShadow = true;
        // A glowing strip along the front edge.
        this.edgeMaterial = new THREE.MeshStandardMaterial({ color: 0x220011, emissive: 0xff2d95, emissiveIntensity: 0.4 });
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, depth), this.edgeMaterial);
        edge.position.set(STAGE.minX - 0.01, STAGE.height - 0.04, platform.position.z);
        group.add(platform, edge);

        group.add(this.createMic());
        group.add(this.createLight());
        this.room.add(group);
        this.group = group;
        group.updateMatrixWorld(true);
        this.collisionManager.addBoxPlatform(platform);
    }

    createMic() {
        const metal = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.35 });
        const highlight = new THREE.MeshStandardMaterial({ color: 0x7fff7f, emissive: 0x2f2f2f });
        const mic = new THREE.Group();
        mic.position.set(MIC.x, STAGE.height, MIC.z);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.04, 20), metal);
        base.position.y = 0.02;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 8), metal);
        pole.position.y = 0.85;
        // Head tilted toward the singer, who stands on the wall side (+x)
        // facing the room.
        const head = new THREE.Group();
        head.position.set(0.08, 1.72, 0);
        head.rotation.z = -Math.PI / 3;
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.22, 10), metal);
        const grille = new THREE.Mesh(
            new THREE.SphereGeometry(0.055, 14, 10),
            new THREE.MeshStandardMaterial({ color: 0xb0b0b0, metalness: 0.9, roughness: 0.4 })
        );
        grille.position.y = 0.14;
        head.add(handle, grille);
        mic.add(base, pole, head);
        mic.traverse(child => {
            if (!child.isMesh) return;
            child.userData.originalMaterial = child.material;
            child.userData.highlightMaterial = highlight;
        });
        mic.userData = { type: 'karaokeMic', stage: this };
        this.mic = mic;
        return mic;
    }

    createLight() {
        const stand = new THREE.Group();
        stand.position.set(LIGHT_STAND.x, 0, LIGHT_STAND.z);
        const black = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.6 });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, LIGHT_STAND.height, 8), black);
        pole.position.y = LIGHT_STAND.height / 2;
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 16), black);
        foot.position.y = 0.02;
        const lamp = new THREE.Group();
        lamp.position.y = LIGHT_STAND.height;
        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.35, 16), black);
        can.rotation.x = Math.PI / 2;
        this.lensMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xfff2c0, emissiveIntensity: 0 });
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), this.lensMaterial);
        lens.position.z = 0.18;
        lamp.add(can, lens);
        stand.add(pole, foot, lamp);
        // Aim the lamp (its +z) at the singer: yaw, then pitch down. Done by
        // hand because lookAt needs world matrices that don't exist yet.
        const singer = new THREE.Vector3(MIC.x + 0.45, 1.8, MIC.z);
        const aim = singer.clone().sub(new THREE.Vector3(LIGHT_STAND.x, LIGHT_STAND.height, LIGHT_STAND.z));
        lamp.rotation.order = 'YXZ';
        lamp.rotation.y = Math.atan2(aim.x, aim.z);
        lamp.rotation.x = -Math.atan2(aim.y, Math.hypot(aim.x, aim.z));

        this.spot = new THREE.SpotLight(0xfff2c0, 0, 12, 0.38, 0.5, 1);
        this.spot.position.set(LIGHT_STAND.x, LIGHT_STAND.height, LIGHT_STAND.z);
        this.spot.target.position.copy(singer);
        const group = new THREE.Group();
        group.add(stand, this.spot, this.spot.target);
        return group;
    }

    // Is a world position standing on this stage?
    contains(worldPosition) {
        const local = this.room.toLocal(worldPosition);
        const feet = worldPosition.y - 1;
        return local.x > STAGE.minX && local.x < STAGE.maxX && local.z > STAGE.minZ && local.z < STAGE.maxZ
            && feet > STAGE.height - 0.1;
    }

    // Where F at the mic puts you: just behind the mic, facing the room.
    getMicSpot() {
        const position = this.room.toWorld(MIC.x + 0.45, 1 + STAGE.height, MIC.z);
        const facing = this.room.toWorld(0, 1 + STAGE.height, MIC.z);
        return { position, rotation: Math.atan2(facing.x - position.x, facing.z - position.z) };
    }

    update(deltaTime, occupied) {
        const target = occupied ? 1 : 0;
        this.lit += (target - this.lit) * Math.min(1, deltaTime * LIGHT_FADE);
        if (Math.abs(this.lit - target) < 0.001) this.lit = target;
        this.spot.intensity = LIGHT_INTENSITY * this.lit;
        this.lensMaterial.emissiveIntensity = 1.5 * this.lit;
        this.edgeMaterial.emissiveIntensity = 0.4 + 1.2 * this.lit;
    }
}
