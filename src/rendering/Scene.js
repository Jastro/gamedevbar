import * as THREE from 'three';

export class Scene {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene = null;
        this.seats = new Map();
        this.load();
    }

    async load() {
        const loader = new THREE.ObjectLoader();
        
        try {
            this.scene = await new Promise((resolve, reject) => {
                loader.load('level.json', 
                    (loadedScene) => {
                        // Procesar la escena cargada
                        loadedScene.traverse((object) => {
                            if (object.isMesh) {
                                object.castShadow = true;
                                object.receiveShadow = true;
                            }

                            // Procesar sillas y taburetes
                            if (object.userData && object.userData.type === "seat") {
                                this.seats.set(object.id, object);

                                if (!object.userData.highlightMaterial) {
                                    object.userData.highlightMaterial = new THREE.MeshStandardMaterial({
                                        color: 0x7fff7f,
                                        emissive: 0x2f2f2f,
                                    });
                                }

                                // Guardar material original
                                if (!object.userData.originalMaterial) {
                                    object.traverse((child) => {
                                        if (child.isMesh) {
                                            child.userData.originalMaterial = child.material;
                                        }
                                    });
                                }
                            }
                        });
                        resolve(loadedScene);
                    },
                    undefined,
                    reject
                );
            });
        } catch (error) {
            console.error('Error loading scene:', error);
            // Crear una escena básica como fallback
            this.scene = new THREE.Scene();
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            this.scene.add(ambientLight);
        }
    }

    getSeats() {
        return this.seats;
    }

    add(object) {
        this.scene.add(object);
    }

    remove(object) {
        this.scene.remove(object);
    }

    getScene() {
        return this.scene;
    }
}