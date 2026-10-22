import * as THREE from 'three';
import { Config } from './Config';
import { InteractionSystem } from './InteractionSystem';
import { Scene } from '../rendering/Scene';
import { Renderer } from '../rendering/Renderer';
import { Camera } from '../rendering/Camera';
import { WebSocketManager } from '@network/WebSocketManager';
import { PlayerManager } from '../entities/PlayerManager';
import { World } from '../world/World';
import { Environment } from '../world/Environment';
import { DoorSync } from '../world/DoorSync';
import { RadioSync } from '../world/RadioSync';
import { ProjectorSync } from '../world/ProjectorSync';
import { VirconSync } from '../world/VirconSync';
import { LightsSync } from '../world/LightsSync';
import { RoomLighting } from '../rendering/RoomLighting';
import { createLightSwitchInteraction } from '../interactions/lightSwitchInteraction';
import { createWebGameInteraction } from '../interactions/webGameInteraction';
import { createCarInteraction } from '../interactions/carInteraction';
import { CarSync } from '../world/CarSync';
import { BathroomSync } from '../world/BathroomSync';
import { createBathroomInteractions } from '../interactions/bathroomInteraction';
import { DrinkSync } from '../bar/DrinkSync';
import { createBarTapInteraction } from '../interactions/barTapInteraction';
import { DartsSync } from '../bar/DartsSync';
import { GraffitiSync } from '../world/GraffitiSync';
import { Weather } from '../world/Weather';
import { SlotSync } from '../bar/SlotSync';
import { createSlotInteraction } from '../interactions/slotInteraction';
import { FoosballSync } from '../world/FoosballSync';
import { createFoosballInteraction } from '../interactions/foosballInteraction';
import { createDartsInteraction } from '../interactions/dartsInteraction';
import { createKaraokeInteraction } from '../interactions/karaokeInteraction';
import { VirconSpectating } from '../vircon/VirconSpectating';
import { ServerClock } from '../network/ServerClock';
import { AudioSettings } from '../audio/AudioSettings';
import { SoccerGame } from '../world/SoccerGame';
import { getRoomDefinition, getRoomIdFromPath } from '../world/RoomLayout';
import { loadProfile, saveName, randomModel, placeholderName } from './PlayerProfile';
import { LoadingScreen } from '../ui/LoadingScreen';
import { CustomizeUI } from '../ui/CustomizeUI';
import { ControlsHelpUI } from '../ui/ControlsHelpUI';
import { VoiceChat } from '../voice/VoiceChat';
import { ChatUI } from '@/ui/ChatUI';
import { ModelSelector } from '../ui/ModelSelector';
import { RoomSelector } from '../ui/RoomSelector';
import { StartScreen } from '../ui/StartScreen';
import { VoiceUI } from '../ui/VoiceUI';
import { VoiceSettingsUI } from '../ui/VoiceSettingsUI';
import { RadioUI } from '../ui/RadioUI';
import { ProjectorUI } from '../ui/ProjectorUI';
import { VirconUI } from '../ui/VirconUI';
import { createDoorInteraction } from '../interactions/doorInteraction';
import { createSeatInteraction } from '../interactions/seatInteraction';
import { createRadioInteraction } from '../interactions/radioInteraction';
import { createArcadeInteraction, bindArcadeNetwork } from '../interactions/arcadeInteraction';
import { createProjectorInteraction } from '../interactions/projectorInteraction';
import { createVirconInteraction } from '../interactions/virconInteraction';

// Composition root: builds every system, wires them together and runs the
// main loop. Systems reach each other through this object (also window.game).
export class Game {
    constructor() {
        // Asignar la instancia del juego a window.game primero
        window.game = this;

        this.config = new Config();
        this.scene = new Scene();
        this.camera = new Camera(this.scene.getScene());
        this.renderer = new Renderer(this.scene, this.camera);
        this.world = new World(this.scene);
        this.serverClock = new ServerClock();
        this.audioSettings = new AudioSettings();
        this.environment = new Environment(this.scene, this.world, this.serverClock, this.audioSettings);
        this.soccerGame = new SoccerGame(this.scene.getScene(), this.world);

        // Inicializar UI antes que network
        this.ui = {
            chat: new ChatUI(),
            modelSelector: new ModelSelector(),
            roomSelector: new RoomSelector()
        };

        this.network = new WebSocketManager();
        this.players = new PlayerManager(this);
        this.voice = new VoiceChat(this);
        this.ui.voice = new VoiceUI(this.voice, this.ui.chat);
        this.ui.voiceSettings = new VoiceSettingsUI(this.voice, this.audioSettings);
        this.doorSync = new DoorSync(this);
        this.radioSync = new RadioSync(this);
        this.projectorSync = new ProjectorSync(this);
        this.virconSync = new VirconSync(this);
        this.lightsSync = new LightsSync(this);
        this.carSync = new CarSync(this);
        this.bathroomSync = new BathroomSync(this);
        this.drinkSync = new DrinkSync(this);
        this.dartsSync = new DartsSync(this);
        this.graffitiSync = new GraffitiSync(this);
        this.weather = new Weather(this);
        this.slotSync = new SlotSync(this);
        this.foosballSync = new FoosballSync(this);
        this.lighting = new RoomLighting(this);
        this.virconSpectating = new VirconSpectating(this);
        // Set while the local player is at an arcade screen ({ hint }): movement
        // and world clicks are off, the camera is fixed.
        this.playMode = null;
        this.ui.radio = new RadioUI(this);
        this.ui.projector = new ProjectorUI(this);
        this.ui.vircon = new VirconUI(this);
        this.ui.customize = new CustomizeUI(this);
        this.ui.controlsHelp = new ControlsHelpUI();

        this.interactions = new InteractionSystem(this);
        this.interactions.register(createSeatInteraction(this));
        this.interactions.register(createRadioInteraction(this));
        this.interactions.register(createArcadeInteraction(this));
        this.interactions.register(createDoorInteraction(this));
        this.interactions.register(createProjectorInteraction(this));
        this.interactions.register(createVirconInteraction(this));
        this.interactions.register(createLightSwitchInteraction(this));
        this.interactions.register(createWebGameInteraction(this));
        this.interactions.register(createCarInteraction(this));
        this.interactions.register(createBarTapInteraction(this));
        this.interactions.register(createDartsInteraction(this));
        this.interactions.register(createKaraokeInteraction(this));
        this.interactions.register(createSlotInteraction(this));
        this.interactions.register(createFoosballInteraction(this));
        createBathroomInteractions(this).forEach(interaction => this.interactions.register(interaction));

        this.clock = new THREE.Clock();

        // `/gamedev`-style links skip the start dialog (forum embeds);
        // anything else shows it.
        const directRoomId = getRoomIdFromPath(window.location.pathname);
        this.directJoin = Boolean(directRoomId);
        if (this.directJoin) {
            this.joinDirectly(directRoomId);
        } else {
            this.startScreen = new StartScreen({
                modelSelector: this.ui.modelSelector,
                roomSelector: this.ui.roomSelector,
                onStart: (choice) => this.start(choice)
            });
            this.startScreen.init();
        }
    }

    // Into the bar with the remembered identity, or a random character and a
    // placeholder nick on the first visit (both remembered from then on).
    // When the forum provides the username, it replaces the nick here.
    joinDirectly(roomId) {
        document.getElementById('username-dialog')?.classList.add('hidden');
        this.loadingScreen = new LoadingScreen();
        this.loadingScreen.show(getRoomDefinition(roomId).name);

        const profile = loadProfile();
        this.ui.modelSelector.setSelectedModel(profile.model ?? randomModel());
        const username = profile.name ?? placeholderName();
        saveName(username);

        document.getElementById('chat-container')?.classList.remove('hidden');
        document.getElementById('chat-box')?.classList.remove('hidden');
        this.start({ username, roomId });
    }

    // The local avatar is loaded and in the scene.
    handleLocalPlayerReady() {
        this.loadingScreen?.hide();
        this.loadingScreen = null;
        if (this.directJoin) this.ui.customize.maybeAskOnFirstVisit();
    }

    // Typing (chat, or any text field/dropdown in a panel) suspends movement
    // and world keys.
    get chatActive() {
        const focused = document.activeElement?.tagName;
        return this.ui.chat.isChatActive() || ['INPUT', 'TEXTAREA', 'SELECT'].includes(focused);
    }

    async start({ username, roomId }) {
        this.username = username;
        this.selectedRoomId = roomId;
        // Same view on entry in every room: camera on the entrance side, facing the bar.
        this.camera.rotation.horizontal = getRoomDefinition(roomId).rotationY;
        this.camera.defaultHorizontal = this.camera.rotation.horizontal;

        await this.init();
        // The window may have been resized (or been 0x0) since the page loaded.
        this.handleResize();
        this.setupInput();
        this.animate();

        this.environment.initializeAudio(this.camera.getCamera());
        // A saved open-mic choice reopens the mic on entry.
        if (this.voice.mode === 'open') await this.voice.setMode('open');
        this.ui.voice.updateButton();
        this.ui.voice.showIntro();
    }

    async init() {
        this.renderer.init();
        await this.scene.waitForLoad();
        this.network.connect();
        this.world.create();
        this.environment.create();
        this.weather.create();
        this.lighting.init();
        this.radioSync.applyDefaults();
        this.camera.setOccluderProvider(() => this.world.getCameraOccluders());
        this.bindNetwork();
        await this.soccerGame.init();
    }

    // Network → systems wiring that doesn't belong to a single system.
    bindNetwork() {
        this.network.on('init', (data) => this.serverClock.sync(data.serverTime));
        this.doorSync.bind();
        this.radioSync.bind();
        this.projectorSync.bind();
        this.virconSync.bind();
        this.lightsSync.bind();
        this.carSync.bind();
        this.bathroomSync.bind();
        this.drinkSync.bind();
        this.dartsSync.bind();
        this.graffitiSync.bind();
        this.weather.bind();
        this.slotSync.bind();
        this.foosballSync.bind();
        this.virconSpectating.bind();
        bindArcadeNetwork(this);

        this.network.on('userChat', (data) => this.ui.chat.addMessage({
            userId: data.userId,
            username: data.username,
            message: data.message,
            isEmote: data.isEmote,
            isTaberna: data.isTaberna,
            emoji: data.emoji,
            timestamp: data.timestamp
        }));

        // Escuchar eventos del juego de fútbol
        this.network.on('startSoccerGame', (data) => {
            this.soccerGame.startGame(this.players.players);
            this.ui.chat.addMessage({
                type: 'system',
                message: `¡${this.players.players.get(data.initiatorId)?.username} ha iniciado un partido de fútbol!`
            });
        });
    }

    setupInput() {
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('contextmenu', (e) => e.preventDefault());
        this.interactions.attach();

        window.addEventListener('keydown', (e) => this.ui.voice.handleKey(e, true, this.chatActive));
        window.addEventListener('keyup', (e) => this.ui.voice.handleKey(e, false, this.chatActive));
        // A right click on the 3D view (a drag still rotates): emoji menu.
        this.camera.onRightClick = (e) => {
            if (this.playMode || this.chatActive) return;
            this.ui.chat.emotesUI?.openAt(e.clientX, e.clientY);
        };
        // R: reset the camera (zoom, angle, pan).
        window.addEventListener('keydown', (e) => {
            if (this.chatActive || e.repeat || e.key.toLowerCase() !== 'r') return;
            this.camera.reset();
        });
        // A projector whose autoplay with sound was blocked starts on the next click.
        document.addEventListener('pointerdown', () => {
            this.environment.rooms.forEach(({ projector }) => projector.kick());
        });
        // Without the start dialog's click (direct links) the browser keeps
        // audio off until the first interaction. Not every event counts as
        // one (a touch pointerdown, Escape), so keep trying until it runs.
        const unlockEvents = ['pointerdown', 'pointerup', 'click', 'touchend', 'keydown'];
        const unlockAudio = async () => {
            const context = this.environment.audioListener?.context;
            if (!context) return;
            try {
                await context.resume();
            } catch {
                // Not a qualifying gesture; the next event retries.
            }
            this.environment.rooms.forEach(({ radio }) => radio.kick());
            if (context.state === 'running') {
                unlockEvents.forEach(type => window.removeEventListener(type, unlockAudio, true));
            }
        };
        unlockEvents.forEach(type => window.addEventListener(type, unlockAudio, true));
        // Releasing the key in another window never reaches us.
        window.addEventListener('blur', () => this.voice.stopTalking());
    }

    handleResize() {
        this.camera.updateAspect(window.innerWidth / window.innerHeight);
        this.renderer.updateSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const deltaTime = this.clock.getDelta();
        this.update(deltaTime);
        this.render();
    }

    update(deltaTime) {
        const playerPosition = this.players.localPlayer?.position;

        this.players.update(deltaTime);
        this.world.update(deltaTime);
        this.soccerGame.update(deltaTime);
        this.environment.update(deltaTime, playerPosition);
        this.environment.updateDormancy(this.players.players.values());
        this.environment.updateStages(deltaTime, this.players.players.values());
        this.lighting.update(deltaTime);
        this.bathroomSync.update(deltaTime);
        this.drinkSync.update();
        this.dartsSync.update(deltaTime);
        this.graffitiSync.update();
        this.weather.update(deltaTime);
        this.slotSync.update(deltaTime);
        this.foosballSync.update(deltaTime);
        const clockLabel = this.weather.label();
        this.environment.rooms.forEach(({ clock }) => clock.update(clockLabel));
        this.voice.update(playerPosition);
        this.ui.vircon.update();
        this.virconSpectating.update(playerPosition);
        this.interactions.update();
        this.environment.rooms.forEach(({ presenceBoard }) => presenceBoard.update(this));

        this.camera.update(deltaTime, this.chatActive);
        // Actualizar posición de la cámara para seguir al jugador local
        if (this.players.localPlayer) {
            this.camera.updatePosition(this.players.localPlayer.mesh.position);
        }
    }

    render() {
        this.renderer.render();
    }
}
