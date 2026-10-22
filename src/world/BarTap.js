import * as THREE from 'three';
import { BAR_COUNTER_Z } from './RoomLayout';

// The beer tap on each bar's counter (room-local; the counter's top is at
// 1.3, its front edge 1 in front of BAR_COUNTER_Z). Click or F in front of
// it to order a drink (barTapInteraction → DrinkSync). Past the last stool
// (x 4), so F in front of it picks the tap and not a seat.
const TAP_POSITION = { x: 5, z: BAR_COUNTER_Z - 0.2 };
const COUNTER_TOP = 1.3;

export class BarTap {
    constructor(room) {
        this.room = room;
    }

    create() {
        const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 0.9, roughness: 0.2 });
        const highlight = new THREE.MeshStandardMaterial({ color: 0x7fff7f, emissive: 0x2f2f2f });
        const tap = new THREE.Group();
        tap.position.set(TAP_POSITION.x, COUNTER_TOP, TAP_POSITION.z);

        const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.25), chrome);
        base.position.y = 0.03;
        const column = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.45, 12), chrome);
        column.position.y = 0.28;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.12), chrome);
        head.position.y = 0.5;
        tap.add(base, column, head);
        // Three handles: beer, cider-ish, dark.
        [[-0.2, 0xffc107], [0, 0xd84315], [0.2, 0x3e2723]].forEach(([x, color]) => {
            const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 8), chrome);
            spout.position.set(x, 0.43, 0.06);
            const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.22, 10), new THREE.MeshStandardMaterial({ color }));
            handle.position.set(x, 0.65, 0);
            tap.add(spout, handle);
        });
        // A couple of glasses waiting on the drip tray.
        const glassMaterial = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, transparent: true, opacity: 0.35 });
        [0.5, 0.75].forEach(x => {
            const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.14, 12), glassMaterial);
            glass.position.set(x, 0.07, 0);
            tap.add(glass);
        });

        tap.traverse(child => {
            if (!child.isMesh) return;
            child.userData.originalMaterial = child.material;
            child.userData.highlightMaterial = highlight;
        });
        tap.userData = { type: 'barTap', tap: this };
        this.group = tap;
        this.room.add(tap);
    }
}
