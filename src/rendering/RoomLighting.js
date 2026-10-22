import * as THREE from 'three';
import { DEFAULT_LIGHTS } from '../world/LightSwitches';

// Turns each bar's light switches into lighting. The scene has one ambient
// and one directional light (from level.json), shared by both bars, so they
// follow the switches of the bar the local player is in (outside keeps
// the default). Disco is three colored point lights circling that bar's
// ceiling. They always exist (intensity 0 when off), so flipping a switch
// never changes the light count, which would recompile every material.
// Because those two lights follow where you are, the other spaces need help
// to look right through an open door: a bar you're not in gets two door
// lights inside (its switches, only while its door is open), and while
// you're inside, the plaza's and roads' own materials are dimmed to the sky's light.

const LEVELS = {
    // Base light when only normal is on, or normal and low together.
    normal: { ambientColor: 0xffffff, ambient: 1, directional: 1 },
    // Low alone: warm and dim (factors of the level.json intensities).
    low: { ambientColor: 0xffb070, ambient: 0.3, directional: 0.1 },
    // Everything off: almost dark (disco alone looks like a club).
    off: { ambientColor: 0x30304a, ambient: 0.08, directional: 0 }
};
const FADE_RATE = 5; // 1/s: how fast lights follow a switch
const DISCO_LIGHTS = 3;
const DISCO_HEIGHT = 6;
const DISCO_RADIUS = { x: 8, z: 5 }; // room-local ellipse they circle
const DISCO_SPEED = 0.8; // rad/s
const DISCO_INTENSITY = 14;
const DISCO_DISTANCE = 22;
// Each bar's light seen from outside (room-local spots, intensity by switch).
const DOOR_LIGHTS = [{ x: 0, y: 5.5, z: 4 }, { x: 0, y: 5.5, z: -4 }];
const DOOR_LIGHT_INTENSITY = { normal: 9, low: 3, off: 0 };
const DOOR_LIGHT_DISTANCE = 18;
const LEVEL_COLORS = Object.fromEntries(Object.entries(LEVELS).map(([name, level]) => [name, new THREE.Color(level.ambientColor)]));
const scratch = new THREE.Vector3();

export class RoomLighting {
    constructor(game) {
        this.game = game;
        this.ambient = null;
        this.directional = null;
        this.time = 0;
        this.disco = [];
        this.discoLevel = 0;
        this.doorLights = new Map(); // roomId -> PointLight[]
        this.outdoorMaterials = [];
        this.outdoorDim = 1;
    }

    // After the level has loaded (its lights are in the scene).
    init() {
        const scene = this.game.scene.getScene();
        scene.traverse(object => {
            if (object.isAmbientLight && !this.ambient) this.ambient = object;
            if (object.isDirectionalLight && !this.directional) this.directional = object;
        });
        this.base = {
            ambient: this.ambient?.intensity ?? 0,
            ambientColor: this.ambient?.color.clone() ?? new THREE.Color(0xffffff),
            directional: this.directional?.intensity ?? 0
        };
        for (let i = 0; i < DISCO_LIGHTS; i++) {
            const light = new THREE.PointLight(0xffffff, 0, DISCO_DISTANCE, 1);
            scene.add(light);
            this.disco.push(light);
        }
        this.game.environment.rooms.forEach(({ room }) => {
            this.doorLights.set(room.id, DOOR_LIGHTS.map(({ x, y, z }) => {
                const light = new THREE.PointLight(0xfff0d8, 0, DOOR_LIGHT_DISTANCE, 1);
                light.position.set(x, y, z);
                room.add(light);
                return light;
            }));
        });
        this.collectOutdoorMaterials();
    }

    // Lit materials that only exist outside (plaza, roads, car, lamp posts). Room walls
    // are shared by both faces, so they stay as they are.
    collectOutdoorMaterials() {
        const groups = [this.game.world.outdoors?.group, this.game.environment.car?.group, this.game.weather?.lampGroup];
        const materials = new Set();
        groups.filter(Boolean).forEach(group => group.traverse(object => {
            if (!object.isMesh) return;
            [object.material, object.userData.originalMaterial].flat().forEach(material => {
                if (material?.color && !material.isMeshBasicMaterial) materials.add(material);
            });
        }));
        this.outdoorMaterials = [...materials].map(material => ({ material, base: material.color.clone() }));
    }

    // A bar you're not in, seen through its open door: lit by its switches
    // (a little less by day, when it's bright outside anyway).
    updateDoorLights(currentRoom, t) {
        const { environment } = this.game;
        const daylight = this.game.weather?.daylight() ?? 1;
        this.doorLights.forEach((lights, roomId) => {
            const contents = environment.rooms.get(roomId);
            const state = environment.getLights(roomId);
            const levelName = state.normal ? 'normal' : state.low ? 'low' : 'off';
            const on = contents.room !== currentRoom && contents.door.isOpen;
            const target = on ? DOOR_LIGHT_INTENSITY[levelName] * (1 - 0.6 * daylight) : 0;
            lights.forEach(light => { light.intensity += (target - light.intensity) * t; });
        });
    }

    update(deltaTime) {
        if (!this.base) return;
        const dt = Math.min(deltaTime, 0.1);
        this.time += dt;
        const { world, environment, players } = this.game;
        const position = players.localPlayer?.position;
        const room = position ? world.getRoomAt(position) : null;
        // Inside a bathroom its own switch rules (and there's no disco in there).
        const bathroom = position ? environment.getBathroomAt(position) : null;
        const state = bathroom
            ? { normal: bathroom.state.lightOn, low: false, disco: false }
            : room ? environment.getLights(room.id) : DEFAULT_LIGHTS;

        let levelName = state.normal ? 'normal' : state.low ? 'low' : 'off';
        let level = LEVELS[levelName];
        let outdoorColor = null;
        // Outside, the sky lights you (night, clouds, lightning).
        const outdoor = !room && !bathroom ? this.game.weather?.outdoorLight() : null;
        if (outdoor) {
            levelName = 'outdoor';
            level = { ambient: outdoor.ambient, directional: outdoor.directional };
            outdoorColor = outdoor.color;
        }
        // Lightning is instant; everything else fades.
        const t = outdoor && this.game.weather.flash > 0 ? 1 : 1 - Math.exp(-FADE_RATE * dt);
        if (this.ambient) {
            const targetColor = outdoorColor ?? (levelName === 'normal' ? this.base.ambientColor : LEVEL_COLORS[levelName]);
            this.ambient.color.lerp(targetColor, t);
            this.ambient.intensity += (this.base.ambient * level.ambient - this.ambient.intensity) * t;
        }
        if (this.directional) {
            this.directional.intensity += (this.base.directional * level.directional - this.directional.intensity) * t;
        }

        this.updateDoorLights(room, t);
        // Inside: the outside (seen through the door) gets the sky's light, not the bar's.
        const sky = room ? this.game.weather?.outdoorLight() : null;
        const dim = sky ? THREE.MathUtils.clamp(sky.ambient / Math.max(0.05, level.ambient), 0.15, 1.3) : 1;
        this.outdoorDim += (dim - this.outdoorDim) * t;
        if (Math.abs(this.outdoorDim - (this.appliedDim ?? -1)) > 0.01) {
            this.appliedDim = this.outdoorDim;
            this.outdoorMaterials.forEach(({ material, base }) => material.color.copy(base).multiplyScalar(this.outdoorDim));
        }

        this.discoLevel += ((room && state.disco ? 1 : 0) - this.discoLevel) * t;
        this.disco.forEach((light, i) => {
            if (!room || this.discoLevel < 0.01) {
                light.intensity = 0;
                return;
            }
            const angle = this.time * DISCO_SPEED + (i * Math.PI * 2) / DISCO_LIGHTS;
            scratch.set(Math.cos(angle) * DISCO_RADIUS.x, DISCO_HEIGHT, Math.sin(angle * 1.3) * DISCO_RADIUS.z);
            light.position.copy(room.root.localToWorld(scratch));
            light.color.setHSL((this.time * 0.15 + i / DISCO_LIGHTS) % 1, 1, 0.5);
            const pulse = 0.6 + 0.4 * Math.sin(this.time * 7 + i * 2);
            light.intensity = DISCO_INTENSITY * this.discoLevel * pulse;
        });
    }
}
