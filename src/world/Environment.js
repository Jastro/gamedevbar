import * as THREE from 'three';
import { LightSwitches, DEFAULT_LIGHTS } from './LightSwitches';
import { Car } from './Car';
import { Bathroom } from './Bathroom';
import { GraffitiWall, WALLS } from './GraffitiWall';
import { Bar } from './Bar';
import { BarTap } from './BarTap';
import { Dartboard } from './Dartboard';
import { KaraokeStage } from './KaraokeStage';
import { WallClock } from './WallClock';
import { SlotMachine } from './SlotMachine';
import { Foosball } from './Foosball';
import { Furniture } from './Furniture';
import { Radio } from './Radio';
import { Paintings } from './Paintings';
import { ArcadePong } from './ArcadePong';
import { ArcadeSnake } from './ArcadeSnake';
import { Door, DOOR_INTERACT_DISTANCE } from './Door';
import { Projector } from './Projector';
import { PresenceBoard } from './PresenceBoard';
import { CeilingFixtures } from './CeilingFixtures';
import { UpperFloor } from './UpperFloor';
import { VirconCabinet, CABINETS } from './VirconCabinet';
import { DEFAULT_ROOM_ID } from './RoomLayout';

// Props and interactive objects. Every room gets its own full set, built in
// room-local coordinates (see RoomLayout.js).
// Empty rooms stop their streams after this long (see updateDormancy).
const EMPTY_ROOM_DELAY = 30000; // ms
const DORMANCY_INTERVAL = 1000; // ms between checks
const EAR_HEIGHT = 0.6; // above the player's position: about the head

export class Environment {
    constructor(scene, world, serverClock, audioSettings) {
        this.scene = scene;
        this.world = world;
        this.serverClock = serverClock;
        this.audioSettings = audioSettings;
        this.rooms = new Map();  // roomId -> { room, bar, furniture, radio, paintings, arcadePong, arcadeSnake, door, projector, presenceBoard, vircon }
        this.doors = new Map();  // doorId -> Door
    }

    create() {
        this.world.rooms.forEach(room => {
            const hasPaintings = room.definition.paintings !== false;
            const contents = {
                room,
                bar: new Bar(room, room.definition.barSign),
                barTap: new BarTap(room),
                dartboard: new Dartboard(room),
                karaoke: new KaraokeStage(room, this.world.collisionManager),
                clock: new WallClock(room),
                slotMachine: new SlotMachine(room),
                foosball: new Foosball(room, this.world.collisionManager),
                furniture: new Furniture(room, this.world.collisionManager),
                radio: new Radio(room),
                paintings: hasPaintings ? new Paintings(room) : null,
                arcadePong: new ArcadePong(room),
                arcadeSnake: new ArcadeSnake(room),
                door: new Door(room, this.world.collisionManager),
                projector: new Projector(room, this.serverClock, this.audioSettings),
                presenceBoard: new PresenceBoard(room),
                vircon: new VirconCabinet(room, this.world.collisionManager, CABINETS.vircon),
                pokebonk: new VirconCabinet(room, this.world.collisionManager, CABINETS.pokebonk),
                lightSwitches: new LightSwitches(room),
                fixtures: new CeilingFixtures(room),
                upperFloor: null, // after the furniture (it adds tables up there)
                bathroom: new Bathroom(room, this.world.collisionManager, this.world)
            };

            contents.bar.create();
            contents.barTap.create();
            contents.dartboard.create();
            contents.karaoke.create();
            contents.clock.create();
            contents.slotMachine.create();
            contents.foosball.create();
            contents.furniture.create();
            contents.radio.create();
            if (contents.paintings) contents.paintings.create();
            // Against the back wall (cabinets are 1.6 deep).
            contents.arcadeSnake.create({ x: -12, y: 2, z: -9.05 });
            contents.arcadePong.create({ x: -7.5, y: 2, z: -9.05 });
            contents.door.create();
            contents.projector.create();
            contents.presenceBoard.create();
            contents.vircon.create();
            contents.pokebonk.create();
            contents.lightSwitches.create();
            contents.fixtures.create();
            contents.upperFloor = new UpperFloor(room, this.world, contents.furniture);
            contents.upperFloor.create();
            contents.bathroom.create();
            contents.graffiti = WALLS.map((_, index) => new GraffitiWall(contents.bathroom, index));
            contents.graffiti.forEach(wall => wall.create());
            if (contents.paintings) this.loadPaintings(contents.paintings);

            this.rooms.set(room.id, contents);
            this.doors.set(contents.door.id, contents.door);
        });

        // The plaza's car (world coordinates, not part of a room).
        this.car = new Car(this.world.scene, this.world.collisionManager);
        this.car.create();

        // Gamedev room shortcuts, kept for code that predates multiple rooms.
        const main = this.rooms.get(DEFAULT_ROOM_ID);
        this.radio = main.radio;
        this.arcadePong = main.arcadePong;
        this.arcadeSnake = main.arcadeSnake;
    }

    loadPaintings(paintings) {
        const paintingsInfo = paintings.getPaintingsInfo();
        paintingsInfo.forEach((painting, index) => {
            const imageUrl = `/paintings/imagen${index + 1}.jpg`;
            paintings.loadImage(painting.id, imageUrl);
        });
    }

    // Where sounds are heard from: the player's head for distance (the
    // camera may be far behind), the camera's turn for left and right. Every
    // AudioListener hangs from it (they all drive the one shared context).
    get ear() {
        if (!this.earObject) {
            this.earObject = new THREE.Object3D();
            this.earObject.name = 'Ear';
            this.world.scene.add(this.earObject);
        }
        return this.earObject;
    }

    updateEar(playerPosition) {
        if (!this.earCamera) return;
        if (playerPosition) {
            this.ear.position.copy(playerPosition);
            this.ear.position.y += EAR_HEIGHT;
        } else {
            this.earCamera.getWorldPosition(this.ear.position);
        }
        this.earCamera.getWorldQuaternion(this.ear.quaternion);
    }

    initializeAudio(camera) {
        if (this.audioListener) return;
        this.earCamera = camera;
        this.audioListener = new THREE.AudioListener();
        this.ear.add(this.audioListener);
        this.rooms.forEach(({ radio }) => radio.initializeAudio(this.audioListener, this.audioSettings));
    }

    // A room nobody has been inside for EMPTY_ROOM_DELAY stops streaming here
    // (radio download, projector video); it resumes, live, as soon as anyone
    // (us or someone else) is inside again. Shared choices stay on the server.
    // players: everyone here, local player included (anything with a position).
    updateDormancy(players) {
        const now = performance.now();
        if (now - (this.lastDormancyCheck ?? 0) < DORMANCY_INTERVAL) return;
        this.lastDormancyCheck = now;
        const occupied = new Set();
        for (const player of players) {
            const room = this.world.getRoomAt(player.position);
            if (room) occupied.add(room.id);
        }
        this.rooms.forEach((contents, roomId) => {
            if (occupied.has(roomId) || contents.lastOccupied === undefined) contents.lastOccupied = now;
            const dormant = now - contents.lastOccupied >= EMPTY_ROOM_DELAY;
            contents.radio.setDormant(dormant);
            contents.projector.setDormant(dormant);
        });
    }

    update(deltaTime, listenerPosition) {
        this.updateEar(listenerPosition);
        this.car?.update(deltaTime);
        this.doors.forEach(door => door.update(deltaTime));
        if (listenerPosition) this.updateAudioOcclusion(listenerPosition);
        this.rooms.forEach(({ projector }) => projector.update(listenerPosition, this, this.world));
        this.rooms.forEach(({ room, fixtures }) => fixtures.update(deltaTime, this.getLights(room.id)));
    }

    // Occlusion between two spaces (a Room, or null for outside): clear in
    // the same space, else muffled unless every door in between is open.
    getOcclusionLevel(sourceRoom, listenerRoom) {
        if (sourceRoom === listenerRoom) return 'none';
        const doorsInBetween = [sourceRoom, listenerRoom]
            .filter(Boolean)
            .map(room => this.rooms.get(room.id).door);
        return doorsInBetween.every(door => door.isOpen) ? 'doorOpen' : 'closed';
    }

    updateAudioOcclusion(listenerPosition) {
        const listenerRoom = this.world.getRoomAt(listenerPosition);
        this.rooms.forEach(({ room, radio }) => {
            const level = this.getOcclusionLevel(room, listenerRoom);
            radio.setOcclusion(level);
            radio.updateAudibility(level);
        });
    }

    // The room whose karaoke stage a world position is standing on, or null.
    getStageRoom(worldPosition) {
        for (const { room, karaoke } of this.rooms.values()) {
            if (karaoke.contains(worldPosition)) return room;
        }
        return null;
    }

    // Stage lights: on while anyone (local or remote) is up there.
    updateStages(deltaTime, players) {
        const positions = [...players].map(player => player.position);
        this.rooms.forEach(({ karaoke }) => {
            karaoke.update(deltaTime, positions.some(position => karaoke.contains(position)));
        });
    }

    getDoor(doorId) {
        return this.doors.get(doorId);
    }

    getBathrooms() {
        return [...this.rooms.values()].map(({ bathroom }) => bathroom);
    }

    // The bathroom a world position is inside, or null.
    getBathroomAt(worldPosition) {
        if (!worldPosition) return null;
        return this.getBathrooms().find(bathroom => bathroom.containsPoint(worldPosition)) ?? null;
    }

    // Every page-playing cabinet (Vircon32, Pokebonk) in every room.
    getCabinets() {
        const cabinets = [];
        this.rooms.forEach(({ vircon, pokebonk }) => cabinets.push(vircon, pokebonk));
        return cabinets;
    }

    // By the id the server knows it by (see VirconCabinet.id).
    getCabinet(cabinetId) {
        return this.getCabinets().find(cabinet => cabinet.id === cabinetId) ?? null;
    }

    // Room lights (LightsSync → here → switches; RoomLighting reads them).
    setLights(roomId, state) {
        this.rooms.get(roomId)?.lightSwitches.setState(state);
    }

    getLights(roomId) {
        return this.rooms.get(roomId)?.lightSwitches.state ?? DEFAULT_LIGHTS;
    }

    setDoorState(doorId, isOpen, instant = false) {
        const door = this.doors.get(doorId);
        if (door) door.setOpen(isOpen, instant);
    }

    getNearestDoor(worldPosition, maxDistance = DOOR_INTERACT_DISTANCE) {
        let nearest = null;
        let nearestDistance = maxDistance;
        this.doors.forEach(door => {
            const distance = door.distanceTo(worldPosition);
            if (distance <= nearestDistance) {
                nearest = door;
                nearestDistance = distance;
            }
        });
        return nearest;
    }

    isPlayingArcade(playerId) {
        for (const { arcadePong } of this.rooms.values()) {
            if (arcadePong.isPlayingGame(playerId)) return true;
        }
        return false;
    }

    updateSnakeHighScores(scores) {
        this.rooms.forEach(({ arcadeSnake }) => arcadeSnake.updateHighScores(scores));
    }
}
