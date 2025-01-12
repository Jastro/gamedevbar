// src/entities/Player.js
import { Group, Vector3, AnimationMixer, CanvasTexture, SpriteMaterial, Sprite } from 'three';
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

        this.selectedModel = null;
        
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
            await this.loadModel();
            this.setupAnimations();
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
            console.log('Loading model for player:', this.id, 'Model:', this.selectedModel);
            const modelPath = `/assets/models/${this.selectedModel}.glb`;
            
            const gltf = await loader.loadAsync(modelPath);
            const model = gltf.scene;
            model.scale.set(0.8, 0.8, 0.8);
            model.position.y = -1.0;
            
            // Guardar referencias a los sprites antes de limpiar
            const nameSprite = this.nameSprite;
            const chatSprite = this.mesh.children.find(child => child.material?.map === this.chatTexture);
            const emojiSprite = this.mesh.children.find(child => child.material?.map === this.emojiTexture);
            
            // Limpiar TODOS los hijos del mesh, incluyendo modelos anteriores
            while(this.mesh.children.length > 0) {
                const child = this.mesh.children[0];
                // Limpiar geometrías y materiales antes de remover
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
                this.mesh.remove(child);
            }
            
            // Añadir nuevo modelo
            this.mesh.add(model);

            // Restaurar los sprites
            if (nameSprite) this.mesh.add(nameSprite);
            if (chatSprite) this.mesh.add(chatSprite);
            if (emojiSprite) this.mesh.add(emojiSprite);

            // Configurar animaciones
            if (this.animations.mixer) {
                this.animations.mixer.stopAllAction();
                this.animations.mixer.uncacheRoot(this.mesh);
            }
            this.animations.mixer = new THREE.AnimationMixer(model);
            this.animations.actions.clear();

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

            // Asegurarse de que el nombre siga siendo visible después de cargar el modelo
            if (this.nameSprite && this.id !== 'local') {
                this.nameSprite.visible = true;
                this.nameSprite.material.opacity = 1;
            }

            console.log('Modelo cargado exitosamente');
        } catch (error) {
            console.error('Error loading model:', error);
            console.log('Ruta del modelo:', `/assets/models/${this.selectedModel}.glb`);
            throw error; // Re-lanzar el error para manejarlo en setModel
        }
    }

    update(deltaTime) {
        if (this.animations.mixer) {
            this.animations.mixer.update(deltaTime);
        }

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

        this.nameContext.fillStyle = gradient;
        this.nameContext.fillText(displayName, this.nameCanvas.width / 2, this.nameCanvas.height / 2);

        // Quitar sombra
        this.nameContext.shadowColor = 'transparent';

        // Actualizar textura y mostrar sprite
        this.nameTexture.needsUpdate = true;
        this.nameSprite.material.opacity = 1;
        this.nameSprite.visible = true;
        
        // Ajustar posición y escala del nombre para todos los jugadores
        this.nameSprite.position.y = 1.3;
        this.nameSprite.scale.set(2.5, 0.6, 1); // Escala más grande
        this.nameSprite.renderOrder = 999;
    }

    cleanup() {
        if (this.mesh.parent) {
            this.mesh.parent.remove(this.mesh);
        }
        if (this.animations.mixer) {
            this.animations.mixer.stopAllAction();
            this.animations.actions.clear();
        }
        // Limpiar recursos
        this.mesh.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => material.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        
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
        console.log('Setting model:', modelId, 'for player:', this.id);
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
            await this.loadModel();
            this.setupAnimations();
            console.log('Model successfully set for player:', this.id, 'Model:', modelId);
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

        // Establecer timeout para desvanecer
        this.chatTimeout = setTimeout(() => {
            const fadeStart = Date.now();
            const fadeDuration = 500;
            const fade = () => {
                const fadeElapsed = Date.now() - fadeStart;
                const opacity = 1 - (fadeElapsed / fadeDuration);

                if (opacity > 0) {
                    this.chatBubble.material.opacity = opacity;
                    requestAnimationFrame(fade);
                } else {
                    this.mesh.remove(this.chatBubble);
                    this.chatBubble = null;
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

        // Actualizar las posiciones en la animación
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;

            if (elapsed < 2000) {
                const float = Math.sin(elapsed * 0.004) * 0.15;
                this.chatBubble.position.y = 2.4 + float; // Usar la nueva altura base
                this.chatBubble.rotation.z = Math.sin(elapsed * 0.002) * 0.15;
                const scale = 1.8 + Math.sin(elapsed * 0.006) * 0.1;
                this.chatBubble.scale.set(scale, scale, 1);
                requestAnimationFrame(animate);
            } else {
                const fadeStart = Date.now();
                const fadeDuration = 800;
                const fade = () => {
                    const fadeElapsed = Date.now() - fadeStart;
                    const opacity = 1 - (fadeElapsed / fadeDuration);

                    if (opacity > 0) {
                        this.chatBubble.material.opacity = opacity;
                        this.chatBubble.position.y = 2.4 + ((fadeElapsed / fadeDuration) * 0.5);
                        requestAnimationFrame(fade);
                    } else {
                        this.mesh.remove(this.chatBubble);
                        this.chatBubble = null;
                    }
                };
                fade();
            }
        };
        animate();
    }
}