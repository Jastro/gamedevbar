import * as THREE from 'three';
import { BAR_SHIFT } from '../world/RoomLayout';

export class Scene {
    constructor() {
        this.scene = new THREE.Scene();
        this.levelTemplate = null;
        this.isLoaded = false;
        this.load();
    }

    async load() {
        const loader = new THREE.ObjectLoader();
        
        try {
            const loadedScene = await new Promise((resolve, reject) => {
                loader.load('/level.json', resolve, undefined, reject);
            });

            // level.json holds one room ("Taberna") plus the global lights.
            // Lights go to the scene once; the rest is cloned per room.
            const template = loadedScene.getObjectByName('Taberna') ?? loadedScene;
            const lights = [];
            template.traverse((object) => {
                if (object.isLight) lights.push(object);
            });
            lights.forEach(light => this.scene.add(light));

            // World builds the walls (the front one with a doorway, all of
            // them with their finishes); these copies sat right on top of them.
            ['FrontWall', 'BackWall', 'LeftWall', 'RightWall'].forEach(name => template.getObjectByName(name)?.removeFromParent());
            // An old, empty "Bathroom" (an invisible toilet seat next to the
            // Vircon32); the real one is src/world/Bathroom.js.
            const oldBathroom = template.getObjectByName('Bathroom');
            if (oldBathroom) oldBathroom.removeFromParent();
            // A third copy of the counter and back shelf (World builds them,
            // with colliders); the stools follow the counter back.
            template.getObjectByName('BarArea')?.removeFromParent();
            const stools = template.getObjectByName('BarStools');
            if (stools) stools.position.z += BAR_SHIFT;

            this.levelTemplate = template;
            this.isLoaded = true;
        } catch (error) {
            console.error('Error loading scene:', error);
            // Crear una escena básica como fallback
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            this.scene.add(ambientLight);
            this.isLoaded = true;
        }
    }

    // Returns a fresh copy of the level geometry for one room.
    // clone() round-trips userData through JSON, so material references are
    // (re)created here, after cloning.
    createLevelInstance() {
        if (!this.levelTemplate) return null;

        const instance = this.levelTemplate.clone();
        instance.traverse((object) => {
            if (object.isMesh) {
                object.castShadow = true;
                object.receiveShadow = true;
            }

            // Procesar sillas y taburetes
            if (object.userData && object.userData.type === "seat") {
                const highlightMaterial = new THREE.MeshStandardMaterial({
                    color: 0x7fff7f,
                    emissive: 0x2f2f2f,
                });
                object.userData.highlightMaterial = highlightMaterial;

                // Guardar material original (hover highlight is per mesh,
                // see InteractionSystem.setHighlight)
                object.traverse((child) => {
                    if (child.isMesh) {
                        child.userData.originalMaterial = child.material;
                        child.userData.highlightMaterial = highlightMaterial;
                    }
                });
            }
        });
        return instance;
    }

    async waitForLoad() {
        if (!this.isLoaded) {
            await new Promise(resolve => {
                const checkLoaded = () => {
                    if (this.isLoaded) {
                        resolve();
                    } else {
                        setTimeout(checkLoaded, 100);
                    }
                };
                checkLoaded();
            });
        }
    }

    add(object) {
        if (!this.scene) {
            console.error('Scene not initialized');
            return;
        }
        this.scene.add(object);
    }

    remove(object) {
        if (!this.scene) {
            console.error('Scene not initialized');
            return;
        }
        this.scene.remove(object);
    }

    getScene() {
        return this.scene;
    }
}
