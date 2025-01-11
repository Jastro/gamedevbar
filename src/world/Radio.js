// src/world/Radio.js
import * as THREE from 'three';

export class Radio {
    constructor(scene) {
        this.scene = scene;
        this.audioListener = null;
        this.sound = null;
        this.radio = null;
        this.isInitialized = false;
    }

    create() {
        this.createRadioModel();
    }

    initializeAudio() {
        if (this.isInitialized) return;
        
        this.setupAudio();
        this.isInitialized = true;
    }

    handleClick() {
        if (!this.sound) return;
        
        if (this.userData.isPlaying) {
            this.sound.pause();
            if (this.indicator) {
                this.indicator.material.emissive.setHex(0x696969);
                this.indicator.material.color.setHex(0x696969);
                this.indicator.material.emissiveIntensity = 0.1;
            }
        } else {
            this.sound.play();
            if (this.indicator) {
                this.indicator.material.emissive.setHex(this.userData.originalIndicatorColor);
                this.indicator.material.color.setHex(this.userData.originalIndicatorColor);
                this.indicator.material.emissiveIntensity = 0.5;
            }
        }
        
        this.userData.isPlaying = !this.userData.isPlaying;
    }

    createRadioModel() {
        const radioGroup = new THREE.Group();

        // Cuerpo principal de la radio
        const bodyGeometry = new THREE.BoxGeometry(1, 0.5, 0.4);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x964B00,
            roughness: 0.7,
            metalness: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        radioGroup.add(body);

        // Panel frontal
        const panelGeometry = new THREE.BoxGeometry(0.95, 0.45, 0.01);
        const panelMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2F4F4F,
            roughness: 0.5,
            metalness: 0.5
        });
        const panel = new THREE.Mesh(panelGeometry, panelMaterial);
        panel.position.z = 0.2;
        radioGroup.add(panel);

        // Altavoz
        const speakerGeometry = new THREE.CircleGeometry(0.15, 32);
        const speakerMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x696969,
            roughness: 1,
            metalness: 0
        });
        const speaker = new THREE.Mesh(speakerGeometry, speakerMaterial);
        speaker.position.z = 0.201;
        speaker.position.x = -0.25;
        radioGroup.add(speaker);

        // Perilla de volumen
        const knobGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.02, 32);
        const knobMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xC0C0C0,
            roughness: 0.3,
            metalness: 0.8
        });
        const knob = new THREE.Mesh(knobGeometry, knobMaterial);
        knob.rotation.x = Math.PI / 2;
        knob.position.set(0.25, 0, 0.201);
        radioGroup.add(knob);

        // Luz indicadora
        const indicatorGeometry = new THREE.CircleGeometry(0.03, 32);
        const indicatorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x32CD32,
            emissive: 0x32CD32,
            emissiveIntensity: 0.5
        });
        const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        indicator.position.set(0.25, 0.15, 0.201);
        radioGroup.add(indicator);

        // Posicionar la radio
        radioGroup.position.set(-5, 1.5, -3);

        // Añadir propiedades para interactividad
        radioGroup.userData = {
            type: "radio",
            isPlaying: true,
            indicator: indicator,
            originalIndicatorColor: 0x32CD32,
            originalMaterial: bodyMaterial,
            highlightMaterial: new THREE.MeshStandardMaterial({
                color: 0xB87333,
                roughness: 0.7,
                metalness: 0.5,
                emissive: 0x331100,
                emissiveIntensity: 0.2
            })
        };

        this.radio = radioGroup;
        this.scene.add(radioGroup);
    }

    setupAudio() {
        // Configurar el audio
        this.audioListener = new THREE.AudioListener();
        // Asumiendo que tenemos acceso a la cámara a través de una referencia global
        if (window.game && window.game.camera) {
            window.game.camera.getCamera().add(this.audioListener);
        }

        this.sound = new THREE.PositionalAudio(this.audioListener);
        
        const audioLoader = new THREE.AudioLoader();
        audioLoader.load('assets/sound/ElFary_LaMandanga.mp3', (buffer) => {
            this.sound.setBuffer(buffer);
            this.sound.setLoop(true);
            this.sound.setVolume(0.5);
            this.sound.play();
        });

        if (this.radio) {
            this.radio.add(this.sound);
            this.radio.userData.sound = this.sound;
        }
    }

    toggleSound() {
        if (!this.sound) return;

        if (this.radio.userData.isPlaying) {
            this.sound.pause();
            if (this.radio.userData.indicator) {
                this.radio.userData.indicator.material.emissive.setHex(0x696969);
                this.radio.userData.indicator.material.color.setHex(0x696969);
                this.radio.userData.indicator.material.emissiveIntensity = 0.1;
            }
        } else {
            this.sound.play();
            if (this.radio.userData.indicator) {
                this.radio.userData.indicator.material.emissive.setHex(this.radio.userData.originalIndicatorColor);
                this.radio.userData.indicator.material.color.setHex(this.radio.userData.originalIndicatorColor);
                this.radio.userData.indicator.material.emissiveIntensity = 0.5;
            }
        }
        
        this.radio.userData.isPlaying = !this.radio.userData.isPlaying;
    }

    cleanup() {
        if (this.sound) {
            this.sound.stop();
        }
        if (this.radio) {
            this.scene.remove(this.radio);
        }
    }
}