import * as THREE from 'three';

// UI that sits over the canvas: clicks there must not reach the 3D world.
const UI_ELEMENT_IDS = ['chat-box', 'chat-container', 'emotes-panel'];

// Mouse hover/click and the E key for everything clickable in the world.
// An object is interactable when an ancestor has `userData.type` matching a
// registered interaction (see src/interactions/). Each interaction is
//   { type, use(object), findNearby?(position) -> object, hint?(object) -> text }
// findNearby/hint opt the type into "press E near it" plus the on-screen hint.
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
            if (this.game.chatActive || e.repeat || e.key.toLowerCase() !== 'e') return;
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
        if (this.game.chatActive) return;
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
        if (this.game.chatActive || !this.highlightedObject) return;
        const clicked = document.elementFromPoint(event.clientX, event.clientY);
        const onUi = UI_ELEMENT_IDS.some(id => document.getElementById(id)?.contains(clicked));
        if (onUi) return;

        this.interactions.get(this.highlightedObject.userData.type).use(this.highlightedObject);
    }

    // --- Proximity (E key + hint) ---------------------------------------------

    findNearby() {
        const player = this.game.players.localPlayer;
        if (!player || player.isSitting) return null;
        for (const interaction of this.interactions.values()) {
            const object = interaction.findNearby?.(player.position);
            if (object) return { interaction, object };
        }
        return null;
    }

    update() {
        const nearby = this.game.chatActive ? null : this.findNearby();
        const text = nearby?.interaction.hint ? `E · ${nearby.interaction.hint(nearby.object)}` : '';
        if (text === this.hintText || !this.hintElement) return;
        this.hintText = text;
        this.hintElement.textContent = text;
        this.hintElement.classList.toggle('hidden', !text);
    }
}
