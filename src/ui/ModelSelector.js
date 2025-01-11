// src/ui/ModelSelector.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export class ModelSelector {
    constructor() {
        this.selectedModel = 'pj';
        this.modelPreviews = new Map();
        this.onModelChangeCallbacks = new Set();
    }

    init() {
        const options = document.querySelectorAll('.model-option');
        
        options.forEach(option => {
            const modelId = option.dataset.model;
            const previewContainer = option.querySelector('.model-preview');
            
            if (previewContainer) {
                this.createModelPreview(modelId, previewContainer);
            }

            option.addEventListener('click', () => {
                console.log('Model selected:', modelId);
                options.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                this.selectedModel = modelId;
                
                // Notificar el cambio de modelo
                this.notifyModelChange(modelId);
            });
        });

        // Seleccionar el primer modelo por defecto
        if (options.length > 0) {
            this.selectedModel = options[0].dataset.model;
            options[0].classList.add('selected');
            console.log('Default model selected:', this.selectedModel);
        }
    }

    createModelPreview(modelId, container) {
        console.log('Creating preview for model:', modelId);
        
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
        console.log('Loading model for preview:', `/assets/models/${modelId}.glb`);
        
        loader.load(`/assets/models/${modelId}.glb`, 
            (gltf) => {
                console.log('Model loaded successfully:', modelId);
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
            if (preview) {
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
        console.log('Getting selected model:', this.selectedModel);
        return this.selectedModel;
    }

    // Métodos para manejar callbacks de cambio de modelo
    onModelChange(callback) {
        this.onModelChangeCallbacks.add(callback);
    }

    notifyModelChange(modelId) {
        this.onModelChangeCallbacks.forEach(callback => callback(modelId));
    }

    // Limpieza
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
}