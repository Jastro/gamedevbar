import * as THREE from 'three';

// Q and E rotate the camera, so interacting is F.
export const INTERACT_KEY = 'f';
// Things on another floor (the gallery 4 above) are out of F reach.
const MAX_LEVEL_DIFFERENCE = 3.5;
const INTERACTABLES_REFRESH = 2000; // ms
const FACING_BASE = 0.4; // see findNearby's score
const scratch = new THREE.Vector3();

function horizontalDistance(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
}

// UI that sits over the canvas: clicks there must not reach the 3D world.
const UI_ELEMENT_IDS = ['chat-box', 'chat-container', 'emotes-panel'];

// Mouse hover/click and the F key for everything clickable in the world.
// An object is interactable when an ancestor has `userData.type` matching a
// registered interaction (see src/interactions/). Each interaction is
//   { type, use(object), findNearby?(position) -> object, hint?(object) -> text }
// F near something + the on-screen hint: an interaction either has a custom
// findNearby(position) -> object, or a `range`, and then the nearest object
// of its type within that range (horizontal distance) is used. hint(object)
// gives the text. Over all types, the best candidate wins: near and in front
// of the player (so facing the radio behind a stool picks the radio).
export class InteractionSystem {
    constructor(game) {
        this.game = game;
        this.interactions = new Map();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.highlightedObject = null;
        this.hintText = null;
        this.hintElement = document.getElementById('interaction-hint');
    }

    register(interaction) {
        this.interactions.set(interaction.type, interaction);
    }

    attach() {
        window.addEventListener('mousemove', (e) => {
            this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
            this.updateHover();
        });
        window.addEventListener('click', (e) => this.handleClick(e));
        window.addEventListener('keydown', (e) => {
            if (this.game.chatActive || this.game.playMode || e.repeat || e.key.toLowerCase() !== INTERACT_KEY) return;
            const nearby = this.findNearby();
            if (nearby) nearby.interaction.use(nearby.object);
        });
    }

    // --- Hover / click ---------------------------------------------------------

    // Walks up from the hit mesh to the object carrying the interaction type.
    pickInteractable() {
        this.raycaster.setFromCamera(this.mouse, this.game.camera.getCamera());
        const intersects = this.raycaster.intersectObjects(this.game.scene.getScene().children, true);
        for (const intersect of intersects) {
            let object = intersect.object;
            while (object && !object.userData?.type) object = object.parent;
            if (object && this.interactions.has(object.userData.type)) return object;
        }
        return null;
    }

    updateHover() {
        if (this.game.chatActive || this.game.playMode || this.game.players.localPlayer?.isSitting) return;
        const object = this.pickInteractable();
        if (object === this.highlightedObject) return;
        this.setHighlight(this.highlightedObject, false);
        this.setHighlight(object, true);
        this.highlightedObject = object;
    }

    // Meshes opt in by storing originalMaterial/highlightMaterial in their userData.
    setHighlight(object, highlighted) {
        object?.traverse((child) => {
            const material = highlighted ? child.userData.highlightMaterial : child.userData.originalMaterial;
            if (child.isMesh && material) child.material = material;
        });
    }

    handleClick(event) {
        if (this.game.chatActive || this.game.playMode || !this.highlightedObject) return;
        // Like F: seated, you get up first (WASD).
        if (this.game.players.localPlayer?.isSitting) return;
        const clicked = document.elementFromPoint(event.clientX, event.clientY);
        // A panel's button over something clickable (e.g. Saludar over an
        // avatar) shouldn't click through to it.
        const onUi = UI_ELEMENT_IDS.some(id => document.getElementById(id)?.contains(clicked))
            || clicked?.closest?.('.floating-panel');
        if (onUi) return;

        this.interactions.get(this.highlightedObject.userData.type).use(this.highlightedObject);
    }

    // --- Proximity (F key + hint) ---------------------------------------------

    findNearby() {
        const player = this.game.players.localPlayer;
        if (!player || player.isSitting) return null;
        const position = player.position;
        const facingX = Math.sin(player.rotation);
        const facingZ = Math.cos(player.rotation);
        let best = null;
        const consider = (interaction, object) => {
            const target = object.getWorldPosition(scratch);
            const distance = horizontalDistance(position, target);
            const facing = distance > 0
                ? ((target.x - position.x) * facingX + (target.z - position.z) * facingZ) / distance
                : 1;
            // Distance, discounted up to 3.5x for things straight ahead.
            const score = distance / (FACING_BASE + Math.max(0, facing));
            if (!best || score < best.score) best = { interaction, object, score };
        };
        for (const interaction of this.interactions.values()) {
            if (!interaction.findNearby) continue;
            const object = interaction.findNearby(position);
            if (object) consider(interaction, object);
        }
        // Only things in the space you're in (a light switch is 0.6 away
        // from outside, through the wall).
        const world = this.game.world;
        const here = world.getRoomAt(position);
        for (const object of this.getInteractables()) {
            const interaction = this.interactions.get(object.userData.type);
            if (!interaction?.range || interaction.findNearby) continue;
            // Terrace furniture belongs to a bar but stands outside.
            const space = object.userData.outside ? null : world.getRoomForObject(object);
            if (space !== here) continue;
            // Not through the gallery's floor (above or below you).
            if (Math.abs(object.getWorldPosition(scratch).y - position.y) > MAX_LEVEL_DIFFERENCE) continue;
            // E.g. bathroom fixtures: only from inside the cubicle.
            if (interaction.canReach && !interaction.canReach(object, position)) continue;
            if (horizontalDistance(position, object.getWorldPosition(scratch)) <= interaction.range) {
                consider(interaction, object);
            }
        }
        return best;
    }

    // Every object carrying a registered `userData.type`, re-collected now
    // and then (the world is built once; this just keeps it cheap).
    getInteractables() {
        const now = performance.now();
        if (!this.interactables || now - this.interactablesAt > INTERACTABLES_REFRESH) {
            this.interactablesAt = now;
            this.interactables = [];
            this.game.scene.getScene().traverse(object => {
                if (object.userData?.type && this.interactions.has(object.userData.type)) this.interactables.push(object);
            });
        }
        return this.interactables;
    }

    update() {
        // Playing, driving or seated (clicks do nothing then): no hover
        // highlight (a driven car kept it).
        if (this.highlightedObject && (this.game.playMode || this.game.players.localPlayer?.isSitting)) {
            this.setHighlight(this.highlightedObject, false);
            this.highlightedObject = null;
        }
        let text = '';
        if (this.game.playMode) {
            text = this.game.playMode.hint;
        } else {
            const nearby = this.game.chatActive ? null : this.findNearby();
            text = nearby?.interaction.hint ? `${INTERACT_KEY.toUpperCase()} · ${nearby.interaction.hint(nearby.object)}` : '';
        }
        if (text === this.hintText || !this.hintElement) return;
        this.hintText = text;
        this.hintElement.textContent = text;
        this.hintElement.classList.toggle('hidden', !text);
    }
}
