import * as THREE from 'three';
import { DEFAULT_LIGHTS } from '../world/LightSwitches';
import { ROOM_HALF_WIDTH, ROOM_HALF_DEPTH } from '../world/RoomLayout';
import { BATHROOM_BOUNDS, LAMP_RANGE, WALL_HEIGHT as BATHROOM_HEIGHT } from '../world/Bathroom';
import { regionUniforms, installRegionLights, REGION_MAX } from './RegionLights';

// Turns each bar's light switches into lighting. The scene has one ambient
// and one directional light (from level.json), shared by both bars, so they
// follow the switches of the bar the local player is in (outside keeps
// the default). Disco is three colored point lights circling that bar's
// ceiling. They always exist (intensity 0 when off), so flipping a switch
// never changes the light count, which would recompile every material.
// Because those two lights follow where you are, every lit material also
// gets each space's own ambient and directional light (RegionLights): through
// an open door, a bar looks lit by its switches and the outside by the sky,
// from wherever you look.

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
// A bathroom as a region: its box, room-local.
const BATHROOM_REGION = {
    x: (BATHROOM_BOUNDS.minX + BATHROOM_BOUNDS.maxX) / 2,
    z: (BATHROOM_BOUNDS.minZ + BATHROOM_BOUNDS.maxZ) / 2,
    halfX: (BATHROOM_BOUNDS.maxX - BATHROOM_BOUNDS.minX) / 2,
    halfZ: (BATHROOM_BOUNDS.maxZ - BATHROOM_BOUNDS.minZ) / 2
};
const LEVEL_COLORS = Object.fromEntries(Object.entries(LEVELS).map(([name, level]) => [name, new THREE.Color(level.ambientColor)]));
const scratch = new THREE.Vector3();
const ZERO = new THREE.Vector3();
const BLACK = new THREE.Color(0, 0, 0);

export class RoomLighting {
    constructor(game) {
        this.game = game;
        this.ambient = null;
        this.directional = null;
        this.time = 0;
        this.disco = [];
        this.discoLevel = 0;
        this.regionLights = new Map(); // region key -> { ambient, directional } (faded)
        // Before the first frame: every lit material compiles with it.
        installRegionLights(game.renderer.renderer);
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
            directional: this.directional?.intensity ?? 0,
            directionalColor: this.directional?.color.clone() ?? new THREE.Color(0xffffff)
        };
        for (let i = 0; i < DISCO_LIGHTS; i++) {
            const light = new THREE.PointLight(0xffffff, 0, DISCO_DISTANCE, 1);
            scene.add(light);
            this.disco.push(light);
        }
    }

    // A level's light (absolute, as the shader's light uniforms hold it).
    levelLight(level, ambientColor) {
        return {
            ambient: ambientColor.clone().multiplyScalar(this.base.ambient * level.ambient),
            directional: this.base.directionalColor.clone().multiplyScalar(this.base.directional * level.directional)
        };
    }

    switchLight(state) {
        const levelName = state.normal ? 'normal' : state.low ? 'low' : 'off';
        const color = levelName === 'normal' ? this.base.ambientColor : LEVEL_COLORS[levelName];
        return this.levelLight(LEVELS[levelName], color);
    }

    // Eases a region's light toward its target (t: this frame's fade).
    fadeRegion(key, target, t) {
        let light = this.regionLights.get(key);
        if (!light) {
            light = { ambient: target.ambient.clone(), directional: target.directional.clone() };
            this.regionLights.set(key, light);
        }
        light.ambient.lerp(target.ambient, t);
        light.directional.lerp(target.directional, t);
        return light;
    }

    // Every space's light into the shader uniforms: bathrooms first (they
    // sit inside their bar), then the bars, and the outside.
    updateRegions(t, tOutdoor) {
        const { environment } = this.game;
        const regions = [];
        environment.rooms.forEach(({ room, bathroom }) => {
            if (bathroom) {
                regions.push({
                    key: `${room.id}:bathroom`,
                    center: room.toWorld(BATHROOM_REGION.x, 0, BATHROOM_REGION.z),
                    yaw: room.root.rotation.y,
                    halfX: BATHROOM_REGION.halfX,
                    halfZ: BATHROOM_REGION.halfZ,
                    // Under its ceiling: the bar's walls above it are the bar's.
                    maxY: BATHROOM_HEIGHT,
                    light: this.switchLight({ normal: bathroom.state.lightOn, low: false }),
                    lamp: bathroom.lampLight
                });
            }
        });
        environment.rooms.forEach(({ room }) => {
            regions.push({
                key: room.id,
                center: room.root.position,
                yaw: room.root.rotation.y,
                halfX: ROOM_HALF_WIDTH,
                halfZ: ROOM_HALF_DEPTH,
                light: this.switchLight(environment.getLights(room.id))
            });
        });
        const count = Math.min(regions.length, REGION_MAX);
        regionUniforms.regionCount.value = count;
        for (let i = 0; i < count; i++) {
            const region = regions[i];
            const light = this.fadeRegion(region.key, region.light, t);
            regionUniforms.regionBoxes.value[i].set(region.center.x, region.center.z, Math.cos(region.yaw), Math.sin(region.yaw));
            regionUniforms.regionHalf.value[i].set(region.halfX, region.halfZ, -1000, region.maxY ?? 1000);
            regionUniforms.regionAmbient.value[i].copy(light.ambient);
            regionUniforms.regionDirectional.value[i].copy(light.directional);
            regionUniforms.regionLampPosition.value[i].copy(region.lamp?.position ?? ZERO);
            regionUniforms.regionLampColor.value[i].copy(region.lamp?.color ?? BLACK);
        }
        regionUniforms.regionLampRange.value = LAMP_RANGE;
        const sky = this.game.weather?.outdoorLight();
        const outdoorTarget = sky
            ? this.levelLight(sky, sky.color)
            : this.levelLight(LEVELS.normal, this.base.ambientColor);
        const outdoor = this.fadeRegion('outdoor', outdoorTarget, tOutdoor);
        regionUniforms.outdoorAmbient.value.copy(outdoor.ambient);
        regionUniforms.outdoorDirectional.value.copy(outdoor.directional);
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

        const fade = 1 - Math.exp(-FADE_RATE * dt);
        this.updateRegions(fade, this.game.weather?.flash > 0 ? 1 : fade);

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
