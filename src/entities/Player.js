// src/entities/Player.js
import { Group, Vector3, AnimationMixer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';

export class Player {
    constructor(id, initialPosition, game) {
        this.id = id;
        this.game = game;
        this.position = initialPosition.clone();
        this.rotation = 0;
        this.mesh = new Group();
        this.username = null;
        this.isMoving = false;
        this.isSitting = false;

        this.selectedModel = id === 'local' ? 
            game.ui.modelSelector.getSelectedModel() : 'pj';
        console.log('Selected model in constructor:', this.selectedModel, 'for player:', id);
    
        this.animations = {
            mixer: null,
            actions: new Map(),
            current: null
        };
        game.scene.add(this.mesh);
        this.init();
    }

    async init() {
        await this.loadModel();
        this.setupAnimations();
    }

    setupAnimations() {
        // Iniciar con animación idle si está disponible
        const idleAction = this.animations.actions.get('idle');
        if (idleAction && !this.animations.current) {
            this.animations.current = idleAction;
            idleAction.play();
        }
    }

    async loadModel() {
        const loader = new GLTFLoader();
        try {
            console.log('Loading model for player:', this.id, 'Model:', this.selectedModel);
            const modelPath = `/assets/models/${this.selectedModel || 'pj'}.glb`;
            
            const gltf = await loader.loadAsync(modelPath);
            const model = gltf.scene;
            model.scale.set(0.8, 0.8, 0.8);
            model.position.y = -1.0;
            
            // Limpiar modelo anterior si existe
            while(this.mesh.children.length > 0) {
                this.mesh.remove(this.mesh.children[0]);
            }
            
            this.mesh.add(model);

            // Configurar animaciones
            this.animations.mixer = new THREE.AnimationMixer(model);

            gltf.animations.forEach((clip) => {
                console.log('Animación encontrada:', clip.name);
                const cleanName = clip.name.toLowerCase().trim();
                if (cleanName.includes('idle')) {
                    this.animations.actions.set('idle', this.animations.mixer.clipAction(clip));
                }
                else if (cleanName.includes('walk')) {
                    const action = this.animations.mixer.clipAction(clip);
                    action.setLoop(THREE.LoopRepeat);
                    this.animations.actions.set('walk', action);
                }
                else if (cleanName.includes('jump')) {
                    this.animations.actions.set('jump', this.animations.mixer.clipAction(clip));
                }
            });

            // Iniciar con animación idle
            if (this.animations.actions.get('idle')) {
                this.fadeToAction('idle');
            }

            console.log('Modelo cargado exitosamente');
        } catch (error) {
            console.error('Error loading model:', error);
            console.log('Ruta del modelo:', `/assets/models/${this.selectedModel || 'pj'}.glb`);
        }
    }

    update(deltaTime) {
        if (this.animations.mixer) {
            this.animations.mixer.update(deltaTime);
        }

        // Actualizar animaciones basadas en el estado
        if (this.isMoving && this.animations.actions.get('walk')) {
            this.fadeToAction('walk');
        } else if (this.isJumping && this.animations.actions.get('jump')) {
            this.fadeToAction('jump');
        } else if (this.animations.actions.get('idle')) {
            this.fadeToAction('idle');
        }

        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;
    }


    setUsername(username) {
        this.username = username;
        // Aquí irían las funciones para actualizar el texto 3D del nombre
    }

    cleanup() {
        if (this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }
        // Limpiar animaciones y otros recursos
        if (this.animations.mixer) {
            this.animations.mixer.stopAllAction();
        }
    }

    fadeToAction(actionName, duration = 0.2) {
        const newAction = this.animations.actions.get(actionName);
        if (!newAction || newAction === this.animations.current) return;

        if (this.animations.current) {
            this.animations.current.fadeOut(duration);
        }

        newAction.reset()
            .setEffectiveTimeScale(1)
            .setEffectiveWeight(1)
            .fadeIn(duration)
            .play();

        this.animations.current = newAction;
    }
}