import * as THREE from 'three';
import { ROOM_HALF_WIDTH, ROOM_HALF_DEPTH } from './RoomLayout';

// One bar instance. Everything that belongs to the room is parented to `root`,
// so builders keep using the original local coordinates.
export class Room {
    constructor(definition, parent) {
        this.definition = definition;
        this.id = definition.id;
        this.name = definition.name;

        this.root = new THREE.Group();
        this.root.name = `Room_${definition.id}`;
        this.root.position.set(definition.origin.x, 0, definition.origin.z);
        this.root.rotation.y = definition.rotationY;
        this.root.userData.roomId = definition.id;
        parent.add(this.root);

        // Colliders are computed from world matrices as soon as children are
        // added, so the root transform must be resolved before building.
        this.root.updateMatrixWorld(true);
    }

    add(object) {
        this.root.add(object);
    }

    remove(object) {
        this.root.remove(object);
    }

    toWorld(x, y, z) {
        return this.root.localToWorld(new THREE.Vector3(x, y, z));
    }

    toLocal(worldPosition) {
        return this.root.worldToLocal(worldPosition.clone());
    }

    containsPoint(worldPosition) {
        const local = this.toLocal(worldPosition);
        return Math.abs(local.x) < ROOM_HALF_WIDTH && Math.abs(local.z) < ROOM_HALF_DEPTH;
    }
}
