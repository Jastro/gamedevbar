// src/entities/Player.js
import { Group, Vector3, AnimationMixer, CanvasTexture, SpriteMaterial, Sprite } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';
import { DEFAULT_APPEARANCE, normalizeAppearance } from '../appearance/catalog';
import { prepareAnchors, applyAppearance, disposeTree } from '../appearance/Accessories';
import { GESTURES, applyGesture } from './Gestures';

// Moves angle `from` toward `to` by fraction t (0..1) the short way round.
// Seated pose: feet forward and up (legs sticking out from the seat), soles
// tilted forward. Avatar-space offset per foot, and the tilt about the foot
// bone's own X axis.
const SIT_FOOT_OFFSET = new THREE.Vector3(0, 0.22, 0.34);
const SIT_FOOT_TILT = -1.0;
const SIT_FEET = ['FootL', 'FootR'];

// One download per model file however many avatars use it (two bartenders
// on pj5 fetched it twice); each avatar still parses its own copy, so tints
// and accessories stay per player.
const modelFiles = new Map(); // path -> Promise<ArrayBuffer>
export function loadModelFile(path) {
    if (!modelFiles.has(path)) {
        const request = new THREE.FileLoader().setResponseType('arraybuffer').loadAsync(path);
        // A failed download can be tried again later.
        request.catch(() => modelFiles.delete(path));
        modelFiles.set(path, request);
    }
    return modelFiles.get(path);
}

export function lerpAngle(from, to, t) {
    const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
    return from + delta * t;
}

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

        this.selectedModel = null;
        // null or 'sit' (applyPose, after the animation each frame).
        this.pose = null;
        this.poseFeet = null; // per foot: { bone, restPosition, restQuaternion, offset }
        // Accessories, tint, size, name color (src/appearance/catalog.js).
        this.appearance = { ...DEFAULT_APPEARANCE };
        this.model = null;
        this.baseModelScale = 0.8; // loadModel's scale before the size slider
        // Right-click gesture being played ({ name, time, ... }, see Gestures.js),
        // and the item it puts in the hand (a beer to toast with).
        this.gesture = null;
        this.gestureItem = null;
        
        this.animations = {
            mixer: null,
            actions: new Map(),
            current: null
        };

        // Crear elementos para el nombre flotante
        this.setupNameSprite();
        
        game.scene.add(this.mesh);

        this.chatBubble = null;
        this.chatTimeout = null;
    }

    setupNameSprite() {
        // Crear canvas para el nombre
        this.nameCanvas = document.createElement("canvas");
        this.nameContext = this.nameCanvas.getContext("2d");
        this.nameCanvas.width = 1024;
        this.nameCanvas.height = 256;

        // Crear textura y material
        this.nameTexture = new CanvasTexture(this.nameCanvas);
        const nameSpriteMaterial = new SpriteMaterial({
            map: this.nameTexture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });

        // Crear sprite
        this.nameSprite = new Sprite(nameSpriteMaterial);
        this.nameSprite.position.y = 1.6; // Ajustar altura para todos los jugadores
        this.nameSprite.scale.set(2.5, 0.6, 1);
        this.nameSprite.material.opacity = 0;
        this.nameSprite.renderOrder = 999;
        this.mesh.add(this.nameSprite);
    }

    async init() {
        if (this.selectedModel) {
            if (await this.loadModel() !== false) this.setupAnimations();
        }
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
            const modelId = this.selectedModel;
            const modelPath = `/assets/models/${modelId}.glb`;

            const gltf = await loader.parseAsync(await loadModelFile(modelPath), '/assets/models/');
            // Another model was picked while this one loaded: the latest wins.
            if (modelId !== this.selectedModel) return false;
            const model = gltf.scene;
            model.scale.set(0.8, 0.8, 0.8);
            model.position.y = -1.0;
            
            // Swap the previous model for the new one. Sprites (name, chat
            // bubble, emoji, talk indicator) stay. Before 2026-10-21 the old
            // model was matched as a "chat sprite" and kept, so every change
            // stacked another model.
            this.mesh.children
                .filter(child => !child.isSprite && !child.userData.keepOnModelSwap)
                .forEach(child => {
                    disposeTree(child);
                    this.mesh.remove(child);
                });

            this.mesh.add(model);
            this.model = model;
            this.modelId = modelId;
            // Rest pose, before the mixer moves anything: measure once.
            prepareAnchors(model, this.mesh, modelId);
            applyAppearance(model, modelId, this.wornAppearance());

            // Configurar animaciones
            if (this.animations.mixer) {
                this.animations.mixer.stopAllAction();
                this.animations.mixer.uncacheRoot(this.mesh);
            }
            this.animations.mixer = new THREE.AnimationMixer(model);
            this.animations.actions.clear();

            gltf.animations.forEach((clip) => {
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

            // Asegurarse de que el nombre siga siendo visible después de cargar el modelo
            if (this.nameSprite && this.id !== 'local') {
                this.nameSprite.visible = true;
                this.nameSprite.material.opacity = 1;
            }

        } catch (error) {
            console.error('Error loading model:', error);
            throw error; // Re-lanzar el error para manejarlo en setModel
        }
    }

    update(deltaTime) {
        if (this.animations.mixer) {
            this.animations.mixer.update(deltaTime);
        }
        this.applyPose();

        // Actualizar animaciones basadas en el estado
        if (this.isMoving && this.animations.actions.get('walk')) {
            if (this.animations.current !== this.animations.actions.get('walk')) {
                this.fadeToAction('walk');
            }
        } else if (this.isJumping && this.animations.actions.get('jump')) {
            if (this.animations.current !== this.animations.actions.get('jump')) {
                this.fadeToAction('jump');
            }
        } else if (this.animations.actions.get('idle')) {
            if (this.animations.current !== this.animations.actions.get('idle')) {
                this.fadeToAction('idle');
            }
        }

        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;
        this.updateGesture(deltaTime);
    }

    // After the animation and the mesh's transform (RemotePlayer too).
    updateGesture(deltaTime) {
        if (this.gesture && !applyGesture(this, deltaTime)) {
            this.gesture = null;
            this.setGestureItem(null);
        }
    }

    playGesture(name) {
        const def = GESTURES[name];
        if (!def || !this.model) return;
        // Restart cleanly: put the model back before the new one takes over.
        if (this.gesture?.rest) {
            this.model.position.copy(this.gesture.rest.position);
            this.model.rotation.copy(this.gesture.rest.rotation);
        }
        this.gesture = { name, time: 0, model: this.model };
        this.setGestureItem(def.item && !this.heldItem ? def.item : null);
    }

    stopGesture() {
        if (this.gesture) this.gesture.stopping = true;
    }

    setGestureItem(itemId) {
        if ((itemId ?? null) === this.gestureItem) return;
        this.gestureItem = itemId ?? null;
        if (this.model) applyAppearance(this.model, this.modelId, this.wornAppearance());
    }


    // Mic icon above the name while this player holds push to talk.
    setTalking(isTalking) {
        if (!this.talkSprite) {
            if (!isTalking) return;
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgba(220, 90, 11, 0.9)';
            ctx.beginPath();
            ctx.arc(64, 64, 60, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = '72px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🎙️', 64, 70);

            this.talkSprite = new Sprite(new SpriteMaterial({
                map: new CanvasTexture(canvas),
                transparent: true,
                depthTest: false,
                depthWrite: false
            }));
            this.talkSprite.position.y = 1.75;
            this.talkSprite.scale.set(0.45, 0.45, 1);
            this.talkSprite.renderOrder = 999;
            this.mesh.add(this.talkSprite);
        }
        this.talkSprite.visible = isTalking;
    }

    setUsername(username) {
        this.username = username;
        
        // No mostrar nombre sobre el jugador local
        if (this === this.game.players.localPlayer) {
            this.nameSprite.visible = false;
            return;
        }

        // Actualizar el sprite del nombre con las mismas dimensiones y estilos
        this.nameContext.clearRect(0, 0, this.nameCanvas.width, this.nameCanvas.height);

        const displayName = username || 'sin nombre';

        // Configurar estilo del texto igual que main.old.js
        this.nameContext.font = "bold 96px Arial";
        this.nameContext.textAlign = "center";
        this.nameContext.textBaseline = "middle";

        // Añadir sombra igual que main.old.js
        this.nameContext.shadowColor = 'rgba(0, 0, 0, 0.8)';
        this.nameContext.shadowBlur = 8;
        this.nameContext.shadowOffsetX = 4;
        this.nameContext.shadowOffsetY = 4;

        // Dibujar borde más grueso
        this.nameContext.strokeStyle = "#000000";
        this.nameContext.lineWidth = 12;
        this.nameContext.strokeText(displayName, this.nameCanvas.width / 2, this.nameCanvas.height / 2);

        // Dibujar texto con gradiente
        const gradient = this.nameContext.createLinearGradient(
            0,
            this.nameCanvas.height / 2 - 30,
            0,
            this.nameCanvas.height / 2 + 30
        );
        gradient.addColorStop(0, '#FFFFFF');
        gradient.addColorStop(1, '#DDDDDD');

        this.nameContext.fillStyle = this.appearance.nameColor ?? gradient;
        this.nameContext.fillText(displayName, this.nameCanvas.width / 2, this.nameCanvas.height / 2);

        // Quitar sombra
        this.nameContext.shadowColor = 'transparent';

        // Actualizar textura y mostrar sprite
        this.nameTexture.needsUpdate = true;
        this.nameSprite.material.opacity = 1;
        this.nameSprite.visible = true;
        
        // Ajustar posición y escala del nombre para todos los jugadores
        this.nameSprite.position.y = 1.3 * (this.appearance.scale ?? 1);
        this.nameSprite.scale.set(2.5, 0.6, 1); // Escala más grande
        this.nameSprite.renderOrder = 999;
    }

    // A drink from the bar (src/bar/drinks.js) in the hand, over whatever
    // hand accessory the appearance has. null puts the accessory back.
    setHeldItem(itemId) {
        if ((itemId ?? null) === (this.heldItem ?? null)) return;
        this.heldItem = itemId ?? null;
        applyAppearance(this.model, this.modelId, this.wornAppearance());
    }

    wornAppearance() {
        const hand = this.gestureItem ?? this.heldItem;
        return hand ? { ...this.appearance, hand } : this.appearance;
    }

    setPose(pose) {
        if (pose === this.pose) return;
        this.restoreFeet();
        this.pose = pose;
    }

    // Called after the mixer each frame. The idle animation doesn't drive
    // the feet's position (and barely their rotation), so the pose is set
    // from the rest transform each time instead of being added on top.
    applyPose() {
        // Beheaded (GuillotineSync): the head, and what's worn on it, shrink to
        // nothing; put back once (the animation doesn't scale it).
        if (this.model && (this.headless || this.headHidden)) {
            this.model.getObjectByName('Head')?.scale.setScalar(this.headless ? 1e-4 : 1);
            this.headHidden = this.headless;
        }
        // In the guillotine (GuillotineSync): head bowed 90° forward, face to
        // the floor, on top of whatever the animation did this frame.
        if (this.model && (this.headBowed || this.bowApplied)) this.bowHead();
        if (this.pose !== 'sit' || !this.model) return;
        if (!this.poseFeet || this.poseFeet.model !== this.model) this.measureFeet();
        this.poseFeet.feet.forEach(({ bone, restPosition, restQuaternion, offset, tilt }) => {
            bone.position.copy(restPosition).add(offset);
            bone.quaternion.copy(restQuaternion).multiply(tilt);
        });
    }

    // Turns the Head bone about the avatar's sideways axis (+90°: the face,
    // +z, turns to -y). The animation may not touch the head: then the
    // rotation left from last frame is ours, and we start again from the
    // head's own (else the bow would add up every frame); unbowed, it's put
    // back.
    bowHead() {
        const head = this.model.getObjectByName('Head');
        if (!head?.parent) return;
        if (this.bowApplied && head.quaternion.equals(this.bowApplied)) head.quaternion.copy(this.bowBase);
        if (!this.headBowed) {
            this.bowApplied = null;
            return;
        }
        this.bowBase = head.quaternion.clone();
        head.parent.updateWorldMatrix(true, false);
        const parent = head.parent.getWorldQuaternion(new THREE.Quaternion());
        const side = new THREE.Vector3(1, 0, 0).applyQuaternion(this.mesh.getWorldQuaternion(new THREE.Quaternion()));
        const bow = new THREE.Quaternion().setFromAxisAngle(side, Math.PI / 2);
        const world = parent.clone().multiply(head.quaternion);
        head.quaternion.copy(parent.invert().multiply(bow.multiply(world)));
        this.bowApplied = head.quaternion.clone();
    }

    // Rest transforms, and the avatar-space offset expressed in each foot's
    // parent space (measured once per model).
    measureFeet() {
        this.mesh.updateMatrixWorld(true);
        const feet = SIT_FEET.map(name => this.model.getObjectByName(name)).filter(Boolean).map(bone => {
            const start = bone.getWorldPosition(new THREE.Vector3());
            const end = this.mesh.localToWorld(this.mesh.worldToLocal(start.clone()).add(SIT_FOOT_OFFSET));
            const offset = bone.parent.worldToLocal(end).sub(bone.parent.worldToLocal(start.clone()));
            return {
                bone,
                restPosition: bone.position.clone(),
                restQuaternion: bone.quaternion.clone(),
                offset,
                tilt: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), SIT_FOOT_TILT)
            };
        });
        this.poseFeet = { model: this.model, feet };
    }

    restoreFeet() {
        if (!this.poseFeet || this.poseFeet.model !== this.model) {
            this.poseFeet = null;
            return;
        }
        this.poseFeet.feet.forEach(({ bone, restPosition, restQuaternion }) => {
            bone.position.copy(restPosition);
            bone.quaternion.copy(restQuaternion);
        });
        this.poseFeet = null;
    }

    setAppearance(appearance) {
        this.appearance = normalizeAppearance(appearance);
        // The model on screen, even while another one loads.
        applyAppearance(this.model, this.modelId, this.wornAppearance());
        if (this.username) this.setUsername(this.username);
    }

    cleanup() {
        if (this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }
        if (this.animations.mixer) {
            this.animations.mixer.stopAllAction();
            this.animations.actions.clear();
        }
        // Limpiar recursos (shared accessory materials stay)
        disposeTree(this.mesh);
        
        // Limpiar recursos del nombre
        if (this.nameSprite) {
            this.nameSprite.material.map.dispose();
            this.nameSprite.material.dispose();
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

    async setModel(modelId) {
        if (this.selectedModel === modelId) return;
        
        this.selectedModel = modelId;
        
        // Limpiar animaciones actuales
        if (this.animations.mixer) {
            this.animations.mixer.stopAllAction();
            this.animations.actions.clear();
            this.animations.current = null;
        }
        
        try {
            // Esperar a que termine de cargar el modelo
            if (await this.loadModel() !== false) this.setupAnimations();
        } catch (error) {
            console.error('Error setting model:', error);
        }
    }

    showChatBubble(message, isEmote = false, emoji = null) {
        if (!message) return;

        // No mostrar burbujas de chat para el jugador local (excepto emojis)
        if (this === this.game.players.localPlayer && !emoji) {
            return;
        }

        // Eliminar burbuja anterior si existe
        if (this.chatBubble) {
            this.mesh.remove(this.chatBubble);
            this.chatBubble = null;
        }

        // Si es un emoji, mostrar solo el emoji (permitir esto incluso para el jugador local)
        if (emoji) {
            this.showEmoji(emoji);
            return;
        }

        // Crear canvas para la burbuja
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 1024; // Aumentar resolución como en main.old.js
        canvas.height = 512;  // Aumentar resolución

        // Ajustar tamaños como en main.old.js
        const padding = 40;
        const borderRadius = 25;
        const arrowHeight = 30;

        // Configurar el estilo del texto igual que main.old.js
        context.font = 'bold 64px Arial';
        context.textAlign = 'left';
        context.textBaseline = 'top';

        // Medir y envolver el texto
        const maxWidth = canvas.width - (padding * 4);
        const words = message.split(' ');
        let lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = context.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);

        // Calcular altura total como en main.old.js
        const lineHeight = 56;
        const textHeight = lines.length * lineHeight;
        const bubbleHeight = textHeight + (padding * 2);
        const totalHeight = bubbleHeight + arrowHeight;
        const yOffset = canvas.height - totalHeight - padding;

        // Dibujar sombra igual que main.old.js
        context.save();
        context.shadowColor = 'rgba(0, 0, 0, 0.3)';
        context.shadowBlur = 15;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 5;

        // Dibujar fondo de la burbuja
        context.fillStyle = isEmote ? 'rgba(255, 230, 242, 0.95)' : 'rgba(255, 255, 255, 0.95)';
        this.roundRect(
            context,
            padding,
            yOffset,
            canvas.width - (padding * 2),
            bubbleHeight,
            borderRadius
        );

        // Dibujar flecha como en main.old.js
        const arrowWidth = 25;
        const centerX = canvas.width / 2;
        context.beginPath();
        context.moveTo(centerX - arrowWidth / 2, yOffset + bubbleHeight);
        context.lineTo(centerX, yOffset + bubbleHeight + arrowHeight);
        context.lineTo(centerX + arrowWidth / 2, yOffset + bubbleHeight);
        context.closePath();
        context.fill();

        context.restore();

        // Dibujar bordes como en main.old.js
        context.strokeStyle = isEmote ? 'rgba(255, 182, 193, 0.8)' : 'rgba(200, 200, 200, 0.8)';
        context.lineWidth = 2;

        // Borde de la burbuja
        this.roundRect(
            context,
            padding,
            yOffset,
            canvas.width - (padding * 2),
            bubbleHeight,
            borderRadius,
            true
        );

        // Borde de la flecha
        context.beginPath();
        context.moveTo(centerX - arrowWidth / 2, yOffset + bubbleHeight);
        context.lineTo(centerX, yOffset + bubbleHeight + arrowHeight);
        context.lineTo(centerX + arrowWidth / 2, yOffset + bubbleHeight);
        context.stroke();

        // Dibujar texto con sombra suave como en main.old.js
        lines.forEach((line, i) => {
            const x = padding * 2;
            const y = yOffset + padding + (i * lineHeight);

            context.save();
            context.shadowColor = 'rgba(0, 0, 0, 0.5)';
            context.shadowBlur = 4;
            context.shadowOffsetX = 2;
            context.shadowOffsetY = 2;

            // Primero dibujar el borde del texto
            context.strokeText(line, x, y);
            
            // Luego dibujar el texto
            context.fillStyle = isEmote ? '#d4458e' : '#000000';
            context.fillText(line, x, y);
            context.restore();
        });

        // Crear sprite con escala más grande
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        this.chatBubble = new THREE.Sprite(material);
        
        // Ajustar posición y escala de la burbuja
        this.chatBubble.position.set(0, 2.2, 0); // Altura ajustada
        this.chatBubble.scale.set(3.5, 1.6, 1); // Escala más grande para mejor visibilidad
        this.chatBubble.renderOrder = 999;
        this.mesh.add(this.chatBubble);

        // Limpiar timeout anterior
        if (this.chatTimeout) {
            clearTimeout(this.chatTimeout);
        }

        // Establecer timeout para desvanecer. The fade works on this bubble:
        // a newer one may have replaced it meanwhile (it read a null one).
        const bubble = this.chatBubble;
        this.chatTimeout = setTimeout(() => {
            const fadeStart = Date.now();
            const fadeDuration = 500;
            const fade = () => {
                const fadeElapsed = Date.now() - fadeStart;
                const opacity = 1 - (fadeElapsed / fadeDuration);

                if (opacity > 0) {
                    bubble.material.opacity = opacity;
                    requestAnimationFrame(fade);
                } else {
                    this.mesh.remove(bubble);
                    if (this.chatBubble === bubble) this.chatBubble = null;
                }
            };
            fade();
        }, 5000);
    }

    // Método auxiliar para dibujar rectángulos redondeados
    roundRect(ctx, x, y, width, height, radius, stroke = false) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (stroke) {
            ctx.stroke();
        } else {
            ctx.fill();
        }
    }

    // Nuevo método para mostrar emojis
    showEmoji(emoji) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 256;

        // Configurar estilo para el emoji
        context.save();
        context.shadowColor = 'rgba(0, 0, 0, 0.5)';
        context.shadowBlur = 4;
        context.shadowOffsetX = 2;
        context.shadowOffsetY = 2;
        context.font = 'bold 180px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = '#FFFFFF';
        context.fillText(emoji, canvas.width/2, canvas.height/2);
        context.restore();

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            depthTest: false
        });
        
        this.chatBubble = new THREE.Sprite(material);
        this.chatBubble.scale.set(1.8, 1.8, 1); // Escala más grande para emojis
        this.chatBubble.position.y = 2.4; // Altura ajustada para emojis
        this.chatBubble.renderOrder = 999;
        this.mesh.add(this.chatBubble);

        // Actualizar las posiciones en la animación (on this emoji: a newer
        // bubble may replace it meanwhile)
        const bubble = this.chatBubble;
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;

            if (elapsed < 2000) {
                const float = Math.sin(elapsed * 0.004) * 0.15;
                bubble.position.y = 2.4 + float; // Usar la nueva altura base
                bubble.rotation.z = Math.sin(elapsed * 0.002) * 0.15;
                const scale = 1.8 + Math.sin(elapsed * 0.006) * 0.1;
                bubble.scale.set(scale, scale, 1);
                requestAnimationFrame(animate);
            } else {
                const fadeStart = Date.now();
                const fadeDuration = 800;
                const fade = () => {
                    const fadeElapsed = Date.now() - fadeStart;
                    const opacity = 1 - (fadeElapsed / fadeDuration);

                    if (opacity > 0) {
                        bubble.material.opacity = opacity;
                        bubble.position.y = 2.4 + ((fadeElapsed / fadeDuration) * 0.5);
                        requestAnimationFrame(fade);
                    } else {
                        this.mesh.remove(bubble);
                        if (this.chatBubble === bubble) this.chatBubble = null;
                    }
                };
                fade();
            }
        };
        animate();
    }
}