import * as THREE from 'three';
import { FRONT_DOOR, ROOM_HALF_DEPTH, WALL_THICKNESS } from './RoomLayout';

// The lights a room has; everything starts like the server's default.
export const LIGHT_TYPES = ['normal', 'low', 'disco'];
export const DEFAULT_LIGHTS = { normal: true, low: false, disco: false };
export const LIGHT_NAMES = { normal: 'luz normal', low: 'luz tenue', disco: 'luces de discoteca' };
const LIGHT_ICONS = { normal: '💡', low: '🕯️', disco: '🪩' };

// Room-local x of each plate on the inside of the front wall: normal and low
// to one side of the door, disco to the other.
const SWITCH_X = { normal: -(FRONT_DOOR.width / 2 + 0.6), low: -(FRONT_DOOR.width / 2 + 1.2), disco: FRONT_DOOR.width / 2 + 0.6 };
const SWITCH_Y = 1.5;
const PLATE_SIZE = { width: 0.3, height: 0.42, depth: 0.04 };
const ON_COLOR = 0x7fff7f;
const OFF_COLOR = 0x553333;

// Three wall switches by a room's door. Clicking or F (lightSwitchInteraction)
// asks the server to flip one; `setState` shows what's on.
export class LightSwitches {
    constructor(room) {
        this.room = room;
        this.state = { ...DEFAULT_LIGHTS };
        this.switches = new Map(); // light -> { group, toggle }
    }

    create() {
        const plateMaterial = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 });
        const highlightMaterial = new THREE.MeshStandardMaterial({ color: 0x7fff7f, emissive: 0x2f2f2f });
        // Just inside the front wall, facing into the room.
        const z = ROOM_HALF_DEPTH - WALL_THICKNESS / 2 - PLATE_SIZE.depth / 2 - 0.01;

        LIGHT_TYPES.forEach(light => {
            const group = new THREE.Group();
            group.position.set(SWITCH_X[light], SWITCH_Y, z);
            group.rotation.y = Math.PI;

            const plate = new THREE.Mesh(
                new THREE.BoxGeometry(PLATE_SIZE.width, PLATE_SIZE.height, PLATE_SIZE.depth),
                plateMaterial
            );
            plate.userData = { originalMaterial: plateMaterial, highlightMaterial };
            group.add(plate);

            // The rocker: lit green when on, dark red when off.
            const toggle = new THREE.Mesh(
                new THREE.BoxGeometry(0.12, 0.18, 0.03),
                new THREE.MeshBasicMaterial({ color: OFF_COLOR })
            );
            toggle.position.z = PLATE_SIZE.depth / 2 + 0.015;
            group.add(toggle);

            const icon = createIconSprite(LIGHT_ICONS[light]);
            icon.position.y = PLATE_SIZE.height / 2 + 0.16;
            group.add(icon);

            group.userData = { type: 'lightSwitch', switches: this, light };
            this.room.add(group);
            this.switches.set(light, { group, toggle });
        });
        this.setState(this.state);
    }

    setState(state) {
        this.state = { ...DEFAULT_LIGHTS, ...state };
        this.switches.forEach(({ toggle }, light) => {
            toggle.material.color.setHex(this.state[light] ? ON_COLOR : OFF_COLOR);
        });
    }

    distanceTo(worldPosition, light) {
        const center = this.switches.get(light).group.getWorldPosition(new THREE.Vector3());
        return Math.hypot(worldPosition.x - center.x, worldPosition.z - center.z);
    }
}

function createIconSprite(emoji) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.font = '48px "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 32, 36);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    sprite.scale.set(0.22, 0.22, 1);
    // A label, not a target: clicks go to the plate.
    sprite.raycast = () => {};
    return sprite;
}
