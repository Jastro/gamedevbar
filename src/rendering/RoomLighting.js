import * as THREE from 'three';
import { DEFAULT_LIGHTS } from '../world/LightSwitches';

// Turns each bar's light switches into lighting. The scene has one ambient
// and one directional light (from level.json), shared by both bars, so they
// follow the switches of the bar the local player is in (the street keeps
// the default). Disco is three colored point lights circling that bar's
// ceiling. They always exist (intensity 0 when off), so flipping a switch
// never changes the light count, which would recompile every material.

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

export class RoomLighting {
    constructor(game) {
        this.game = game;
        this.ambient = null;
        this.directional = null;
        this.time = 0;
        this.disco = [];
        this.discoLevel = 0;
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
    }

    update(deltaTime) {
        if (!this.base) return;
        const dt = Math.min(deltaTime, 0.1);
        this.time += dt;
        const { world, environment, players } = this.game;
        const position = players.localPlayer?.position;
        const room = position ? world.getRoomAt(position) : null;
        const state = room ? environment.getLights(room.id) : DEFAULT_LIGHTS;

        const level = state.normal ? LEVELS.normal : state.low ? LEVELS.low : LEVELS.off;
        const t = 1 - Math.exp(-FADE_RATE * dt);
        if (this.ambient) {
            const targetColor = level === LEVELS.normal ? this.base.ambientColor : new THREE.Color(level.ambientColor);
            this.ambient.color.lerp(targetColor, t);
            this.ambient.intensity += (this.base.ambient * level.ambient - this.ambient.intensity) * t;
        }
        if (this.directional) {
            this.directional.intensity += (this.base.directional * level.directional - this.directional.intensity) * t;
        }

        this.discoLevel += ((room && state.disco ? 1 : 0) - this.discoLevel) * t;
        this.disco.forEach((light, i) => {
            if (!room || this.discoLevel < 0.01) {
                light.intensity = 0;
                return;
            }
            const angle = this.time * DISCO_SPEED + (i * Math.PI * 2) / DISCO_LIGHTS;
            light.position.copy(room.toWorld(
                Math.cos(angle) * DISCO_RADIUS.x, DISCO_HEIGHT, Math.sin(angle * 1.3) * DISCO_RADIUS.z
            ));
            light.color.setHSL((this.time * 0.15 + i / DISCO_LIGHTS) % 1, 1, 0.5);
            const pulse = 0.6 + 0.4 * Math.sin(this.time * 7 + i * 2);
            light.intensity = DISCO_INTENSITY * this.discoLevel * pulse;
        });
    }
}
