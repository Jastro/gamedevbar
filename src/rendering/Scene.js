import * as THREE from 'three';

export class Scene {
    constructor() {
        this.scene = new THREE.Scene();
        this.seats = new Map();
        this.isLoaded = false;
        this.load();
    }

    async load() {
        const loader = new THREE.ObjectLoader();
        
        try {
            const loadedScene = await new Promise((resolve, reject) => {
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

            // Transferir objetos de la escena cargada a la escena principal
            while(loadedScene.children.length > 0) {
                this.scene.add(loadedScene.children[0]);
            }
            this.isLoaded = true;
        } catch (error) {
            console.error('Error loading scene:', error);
            // Crear una escena básica como fallback
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            this.scene.add(ambientLight);
            this.isLoaded = true;
        }
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

    getSeats() {
        return this.seats;
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