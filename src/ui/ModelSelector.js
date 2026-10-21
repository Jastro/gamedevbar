import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { loadProfile, saveModel } from '../core/PlayerProfile';

// Character tiles (the `.model-option` elements) with a live 3D preview each.
// Used by the start dialog and, after entering, by the customization menu.
export class ModelSelector {
    constructor() {
        this.selectedModel = null;
        this.modelPreviews = new Map();
        this.onModelChangeCallbacks = new Set();
        this.initialized = false;
        // Previews render only while their tiles are on screen.
        this.previewsActive = true;
        this.modelSelectedPromise = new Promise(resolve => {
            this.resolveModelSelection = resolve;
        });
    }

    // Creates the previews (one WebGL context each), so call it while the
    // tiles are visible, and only once.
    init() {
        if (this.initialized) return;
        this.initialized = true;
        const options = document.querySelectorAll('.model-option');

        options.forEach(option => {
            const modelId = option.dataset.model;
            const previewContainer = option.querySelector('.model-preview');

            if (previewContainer) {
                this.createModelPreview(modelId, previewContainer);
            }

            option.addEventListener('click', () => {
                if (modelId === this.selectedModel) return;
                this.setSelectedModel(modelId);
                this.notifyModelChange(modelId);
            });
        });

        // A model chosen before the tiles existed (direct join), else the saved one.
        const initial = this.selectedModel ?? loadProfile().model;
        if (initial) this.setSelectedModel(initial);
    }

    setSelectedModel(modelId) {
        this.selectedModel = modelId;
        saveModel(modelId);
        document.querySelectorAll('.model-option').forEach(option => {
            option.classList.toggle('selected', option.dataset.model === modelId);
        });
        if (this.resolveModelSelection) {
            this.resolveModelSelection(modelId);
            this.resolveModelSelection = null;
        }
    }

    setPreviewsActive(active) {
        this.previewsActive = active;
    }

    createModelPreview(modelId, container) {
        // Crear escena
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true 
        });
        
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);

        // Iluminación
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        scene.add(directionalLight);

        // Cargar modelo
        const loader = new GLTFLoader();
        
        loader.load(`/assets/models/${modelId}.glb`, 
            (gltf) => {
                const model = gltf.scene;
                model.scale.set(0.8, 0.8, 0.8);
                model.position.y = -1;
                scene.add(model);

                // Configurar animación idle
                const mixer = new THREE.AnimationMixer(model);
                const animations = gltf.animations;
                const idleAnim = animations.find(clip => clip.name.toLowerCase().includes('idle'));
                if (idleAnim) {
                    const action = mixer.clipAction(idleAnim);
                    action.play();
                }

                // Guardar referencias
                this.modelPreviews.set(modelId, {
                    scene,
                    camera,
                    renderer,
                    model,
                    mixer
                });
            },
            (progress) => {
                console.log(`Loading model ${modelId}: ${(progress.loaded / progress.total * 100)}%`);
            },
            (error) => {
                console.error('Error loading model:', error);
            }
        );

        // Posicionar cámara
        camera.position.set(0, 0, 3);
        camera.lookAt(0, 0, 0);

        // Animación
        const animate = () => {
            requestAnimationFrame(animate);
            
            const preview = this.modelPreviews.get(modelId);
            if (preview && this.previewsActive) {
                if (preview.model) {
                    preview.model.rotation.y += 0.01;
                }
                if (preview.mixer) {
                    preview.mixer.update(0.016);
                }
                preview.renderer.render(preview.scene, preview.camera);
            }
        };
        animate();
    }

    getSelectedModel() {
        return this.selectedModel;
    }

    async waitForModelSelection() {
        return this.modelSelectedPromise;
    }

    onModelChange(callback) {
        this.onModelChangeCallbacks.add(callback);
    }

    notifyModelChange(modelId) {
        this.onModelChangeCallbacks.forEach(callback => callback(modelId));
    }

    cleanup() {
        this.modelPreviews.forEach(preview => {
            if (preview.renderer) {
                preview.renderer.dispose();
            }
            if (preview.mixer) {
                preview.mixer.stopAllAction();
                preview.mixer.uncacheRoot(preview.model);
            }
        });
        this.modelPreviews.clear();
    }

    // Añadir método para verificar si hay un modelo seleccionado
    hasModelSelected() {
        return this.selectedModel !== null;
    }
}