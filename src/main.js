import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { EmotesUI } from './emotesUI.js';

class VirtualBar {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.users = new Map();
        this.moveSpeed = 0.05;
        this.keysPressed = {};
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.highlightedObject = null;
        this.lastChatTime = 0;
        this.chatTimeout = null;
        this.sittingOn = null;
        this.seats = new Map();
        this.doors = new Map();
        this.chatActive = false;
        this.paintings = new Map();
        this.userId = null;
        this.lastSentPosition = undefined;
        this.lastSentRotation = undefined;
        this.username = null;
        this.socket = null;
        this.clock = new THREE.Clock(); // Añadimos un reloj para las animaciones

        this.previousPosition = null;
        this.previousRotation = null;
        this.cameraTarget = new THREE.Vector3();
        this.transitioningFromSeat = false;

        this.duelState = {
            challenged: null,
            challenger: null,
            isInDuel: false,
            duelStartTime: null,
            myChoice: null,
            spinning: false,
            opponentChoice: null,
            waitingForResult: false  // Añadir esta línea
        };

        this.CHAT_MAX_LENGTH = 200;
        this.CHAT_DISPLAY_TIME = 8000;
        this.CHAT_FADE_TIME = 1000;

        this.EMOTE_DISPLAY_TIME = 3000; // Aumentar a 3 segundos

        this.cameraDistance = 5; // Distancia inicial de la cámara
        this.minCameraDistance = 2; // Distancia mínima de zoom
        this.maxCameraDistance = 8; // Distancia máxima de zoom

        this.jumpSpeed = 0.18;  // Velocidad inicial hacia arriba
        this.gravity = -0.005;  // Fuerza de gravedad
        this.isJumping = false; // Si el jugador está saltando
        this.verticalSpeed = 0; // Velocidad vertical actual
        this.groundHeight = 1;  // Altura del nivel del suelo

        this.selectedModel = 'pj'; // Modelo por defecto
        this.modelPreviews = new Map();
        this.setupModelSelector();

        this.setupUsernameDialog();
        this.isMoving = false;
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // Configuración inicial de la cámara
        this.camera.position.set(0, 5, 10);

        // Iluminación
        /*const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 10);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);*/

        const floorMesh = this.scene.getObjectByName("Floor");
        if (floorMesh) {
            const floorTexture = new THREE.TextureLoader().load(
                "https://threejs.org/examples/textures/hardwood2_diffuse.jpg"
            );
            floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
            floorTexture.repeat.set(8, 6);
            floorMesh.material.map = floorTexture;
            floorMesh.material.needsUpdate = true;
        }


        const paintingPositions = [
            { x: -12, y: 4, z: -9.8, rotation: 0 },
            { x: -8, y: 4, z: -9.8, rotation: 0 },
            { x: -4, y: 4, z: -9.8, rotation: 0 },
            { x: 0, y: 4, z: -9.8, rotation: 0 },
            { x: 4, y: 4, z: -9.8, rotation: 0 },
            { x: 8, y: 4, z: -9.8, rotation: 0 },
            { x: 12, y: 4, z: -9.8, rotation: 0 },
            { x: 14.8, y: 4, z: -6, rotation: 4.7 },
            { x: 14.8, y: 4, z: -2, rotation: 4.7 },
            { x: 14.8, y: 4, z: 2, rotation: 4.7 },
            { x: 14.8, y: 4, z: 6, rotation: 4.7 },
            { x: -14.8, y: 4, z: -6, rotation: -4.7 },
            { x: -14.8, y: 4, z: -2, rotation: -4.7 },
            { x: -14.8, y: 4, z: 2, rotation: -4.7 },
            { x: -14.8, y: 4, z: 6, rotation: -4.7 },
        ];
    
        paintingPositions.forEach((pos, index) => {
            this.createPainting(pos.x, pos.y, pos.z, pos.rotation, index);
        });


        this.createGlassesAndBottles();
        //this.createWalls();
        //this.createBar();
        this.createFurniture();
        //this.createBathroom();
        this.setupEventListeners();

        this.animate();
        this.addLocalizedMusic();
        setTimeout(loadPaintings, 500);
    }

    initializeGame() {
        // Inicializar Three.js base
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );

        this.renderer = new THREE.WebGLRenderer({ antialias: true });

        // Cargar la escena desde JSON
        const loader = new THREE.ObjectLoader();
        loader.load('level.json', (loadedScene) => {
            this.scene = loadedScene;

            // Configurar sombras y seats después de cargar
            this.scene.traverse((object) => {
                if (object.isMesh) {
                    object.castShadow = true;
                    object.receiveShadow = true;
                }

                // Procesar sillas y taburetes
                if (object.userData && object.userData.type === "seat") {
                    this.seats.set(object.id, object);

                    // Añadir material de highlight si no existe
                    if (!object.userData.highlightMaterial) {
                        object.userData.highlightMaterial = new THREE.MeshStandardMaterial({
                            color: 0x7fff7f,
                            emissive: 0x2f2f2f,
                        });
                    }

                    // Guardar material original si no existe
                    if (!object.userData.originalMaterial) {
                        object.traverse((child) => {
                            if (child.isMesh) {
                                child.userData.originalMaterial = child.material;
                            }
                        });
                    }
                }

                // Guardar referencia a las puertas
                if (object.userData && object.userData.type === "door") {
                    this.doors.set(object.id, object);
                }
            });

            // Inicializar WebSocket después de cargar la escena
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const url = protocol === 'ws:' ?
                `${protocol}//${window.location.hostname}:3000` :
                `${protocol}//${window.location.hostname}`;
            this.socket = new WebSocket(url);

            this.socket.addEventListener('open', () => {
                this.socket.send(JSON.stringify({
                    type: 'setUsername',
                    username: this.username,
                    selectedModel: this.selectedModel
                }));

                this.setupNetworking();
                this.init();
                setTimeout(loadPaintings, 500);
            });
        });
    }

    setupUsernameDialog() {
        const dialog = document.getElementById('username-dialog');
        const usernameInput = document.getElementById('username-input');
        const startButton = document.getElementById('start-button');
        const chatInput = document.getElementById('chat-input');
        const chatBox = document.getElementById('chat-box');
        const chatContainer = document.getElementById('chat-container');

        startButton.addEventListener('click', () => {
            const username = usernameInput.value.trim();
            if (username) {
                this.username = username;
                dialog.classList.add('hidden');
                chatContainer.classList.remove('hidden');
                chatBox.classList.remove('hidden');

                // Iniciar todo después de tener el username
                this.initializeGame();
            }
        });

        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                startButton.click();
            }
        });
    }

    removeOtherUser(userId) {
        const user = this.users.get(userId);
        if (!user) {
            console.warn(`[removeOtherUser] Usuario ${userId} no encontrado`);
            return;
        }

        // Eliminar el modelo 3D y todos sus hijos de la escena
        if (user.mesh) {
            user.mesh.traverse((child) => {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            this.scene.remove(user.mesh);
        }

        // Limpiar animaciones
        if (user.animations && user.animations.mixer) {
            user.animations.mixer.stopAllAction();
            user.animations.mixer.uncacheRoot(user.mesh);
        }

        // Limpiar texturas
        if (user.chatTexture) user.chatTexture.dispose();
        if (user.nameTexture) user.nameTexture.dispose();
        if (user.emojiTexture) user.emojiTexture.dispose();

        // Limpiar el asiento si el usuario estaba sentado
        if (this.seats) {
            for (const [seatId, seat] of this.seats.entries()) {
                if (seat.occupiedBy === userId) {
                    seat.occupiedBy = null;
                }
            }
        }

        // Eliminar el usuario del mapa de usuarios
        this.users.delete(userId);
    }

    setupEventListeners() {
        // Variables para el control de la cámara
        let isRightMouseDown = false;
        let previousMouseX = 0;
        let previousMouseY = 0;

        // Variables para la rotación de la cámara
        this.cameraRotation = {
            horizontal: 0,
            vertical: Math.PI / 6, // Ángulo inicial de elevación
        };

        // Controles de teclado
        window.addEventListener("keydown", (e) => {
            this.keysPressed[e.key.toLowerCase()] = true;
        });

        window.addEventListener("keyup", (e) => {
            this.keysPressed[e.key.toLowerCase()] = false;
        });

        // Control de la cámara con el botón derecho
        window.addEventListener("mousedown", (e) => {
            if (e.button === 2) {
                isRightMouseDown = true;
                previousMouseX = e.clientX;
                previousMouseY = e.clientY;
            }
        });

        window.addEventListener("mouseup", (e) => {
            if (e.button === 2) {
                isRightMouseDown = false;
            }
        });


        window.addEventListener("click", () => this.handleClick());
        window.addEventListener("mousemove", (e) => {
            // Primero manejamos el highlight
            this.handleMouseMove(e);

            // Luego la rotación de cámara (separado)
            if (isRightMouseDown) {
                const deltaX = e.clientX - previousMouseX;
                const deltaY = e.clientY - previousMouseY;

                this.cameraRotation.horizontal -= deltaX * 0.005;
                this.cameraRotation.vertical += deltaY * 0.005;

                this.cameraRotation.vertical = Math.max(
                    0.1,
                    Math.min(Math.PI / 2, this.cameraRotation.vertical)
                );

                previousMouseX = e.clientX;
                previousMouseY = e.clientY;
            }
        });

        // Prevenir el menú contextual
        window.addEventListener("contextmenu", (e) => {
            e.preventDefault();
        });

        // Chat
        const chatInput = document.getElementById("chat-input");
        const chatContainer = document.getElementById("chat-container");

        // Inicializar EmotesUI
        this.emotesUI = new EmotesUI(chatInput, (emote) => {
            const message = `${emote.text}`;
            this.updateUserChat("local", message, true);
            this.showEmoji("local", emote.emoji);
            this.socket.send(
                JSON.stringify({
                    type: "userChat",
                    message: message,
                    isEmote: true,
                    emoji: emote.emoji
                })
            );
            chatInput.focus();
        });

        chatInput.addEventListener("focus", () => {
            this.chatActive = true;
        });
        chatInput.addEventListener("blur", () => {
            this.chatActive = false;
        });
        chatInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                const message = chatInput.value;
                if (message.startsWith("/me ")) {
                    this.updateUserChat("local", message.substring(4), true);
                    // Enviar al servidor
                    this.socket.send(
                        JSON.stringify({
                            type: "userChat",
                            message: message.substring(4),
                            isEmote: true,
                        })
                    );
                } else {
                    this.updateUserChat("local", message, false);
                    // Enviar al servidor
                    this.socket.send(
                        JSON.stringify({
                            type: "userChat",
                            message: message,
                            isEmote: false,
                        })
                    );
                }
                chatInput.value = "";
                chatInput.focus();
            }
        });

        // Crear usuario local
        this.users.set(
            "local",
            this.createUser("local", new THREE.Vector3(0, 1, 0), this.selectedModel)
        );

        // Añadir control de zoom con la rueda del ratón
        window.addEventListener("wheel", (e) => {
            if (this.chatActive) return;

            // Ajustar la sensibilidad del zoom
            const zoomSpeed = 0.001;
            this.cameraDistance += e.deltaY * zoomSpeed * this.cameraDistance;

            // Limitar el zoom entre los valores mínimo y máximo
            this.cameraDistance = Math.max(
                this.minCameraDistance,
                Math.min(this.maxCameraDistance, this.cameraDistance)
            );
        });
    }

    updateOtherUser(userId, position, rotation) {
        const user = this.users.get(userId);
        if (!user) return;

        // Guardar la posición anterior para comparar
        const previousPosition = user.mesh.position.clone();

        // Actualizar posición y rotación
        user.mesh.position.set(position[0], position[1], position[2]);
        user.mesh.rotation.y = rotation;

        // Actualizar el tiempo de la última actualización y la posición anterior
        user.lastUpdateTime = Date.now();
        user.lastPosition = previousPosition;
    }

    addOtherUser(userId, data) {
        // Si el usuario ya existe, actualizar su modelo si es necesario
        if (this.users.has(userId)) {
            const existingUser = this.users.get(userId);
            if (data.selectedModel && existingUser.selectedModel !== data.selectedModel) {
                // Eliminar el usuario existente
                this.removeOtherUser(userId);
            } else {
                return existingUser;
            }
        }

        // Crear vector de posición
        const pos = new THREE.Vector3(
            data.position?.[0] || 0,
            data.position?.[1] || 1,
            data.position?.[2] || 0
        );

        // Asegurarnos de que usamos el modelo correcto del usuario
        if (!data.selectedModel) {
            console.warn(`[addOtherUser] No se recibió modelo para usuario ${userId}, usando default`);
        }
        const modelToUse = data.selectedModel || 'pj';

        const user = this.createUser(userId, pos, modelToUse);
        user.selectedModel = modelToUse; // Guardar el modelo seleccionado en el usuario
        this.users.set(userId, user);

        // Iniciar con animación idle
        if (user.animations && user.animations.idle) {
            this.fadeToAction(user, user.animations.idle);
        }

        return user;
    }

    setupNetworking() {
        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case "init":
                    this.userId = data.userId;

                    this.socket.send(JSON.stringify({
                        type: 'initCompleted',
                        username: this.username,
                        selectedModel: this.selectedModel // Añadir esta línea
                    }));
                    break;

                case "userJoined":
                    if (data.userId !== this.userId) {
                        const user = this.addOtherUser(data.userId, {
                            position: data.position,
                            selectedModel: data.selectedModel
                        });
                        if (data.username) {
                            this.updateUserName(data.userId, data.username);
                        }
                    }
                    break;

                case "userUsername":
                    this.updateUserName(data.userId, data.username);
                    break;
                case "userLeft":
                    this.removeOtherUser(data.userId);
                    break;

                case "userMoved":
                    if (data.userId !== this.userId) {
                        this.updateOtherUser(data.userId, data.position, data.rotation);
                    }
                    break;

                case "userSat":
                    if (data.userId !== this.userId) {
                        this.sitOtherUser(data.userId, data.seatId);
                    }
                    break;

                case "userStood":
                    if (data.userId !== this.userId) {
                        this.standOtherUser(data.userId);
                    }
                    break;
                case "duelRequest":
                    if (data.targetId === this.userId) {
                        // Mostrar ventana de confirmación mejorada
                        const challenger = this.users.get(data.challengerId);
                        const challengerName = challenger ? challenger.username : data.challengerName;

                        const confirmDialog = document.createElement('div');
                        confirmDialog.style.cssText = `
                            position: fixed;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            background-color: rgba(0, 0, 0, 0.9);
                            padding: 20px;
                            border-radius: 15px;
                            color: white;
                            text-align: center;
                            font-family: Arial, sans-serif;
                            border: 2px solid #dc5a0b;
                            box-shadow: 0 0 20px rgba(220, 90, 11, 0.3);
                            z-index: 2001;
                        `;

                        confirmDialog.innerHTML = `
                            <div style="font-size: 24px; margin-bottom: 20px;">
                                ⚔️ ¡Desafío! ⚔️
                            </div>
                            <div style="margin-bottom: 20px;">
                                ${challengerName} te ha retado a un duelo de Piedra, Papel o Tijera
                            </div>
                            <div style="display: flex; justify-content: center; gap: 10px;">
                                <button id="accept-duel" style="padding: 10px 20px; background: #28a745; border: none; border-radius: 5px; color: white; cursor: pointer;">Aceptar</button>
                                <button id="reject-duel" style="padding: 10px 20px; background: #dc3545; border: none; border-radius: 5px; color: white; cursor: pointer;">Rechazar</button>
                            </div>
                        `;

                        document.body.appendChild(confirmDialog);

                        // Manejar respuesta
                        document.getElementById('accept-duel').onclick = () => {
                            this.socket.send(JSON.stringify({
                                type: "duelAccepted",
                                challengerId: data.challengerId,
                                targetId: this.userId
                            }));
                            confirmDialog.remove();
                            this.startDuel(data.challengerId);
                        };

                        document.getElementById('reject-duel').onclick = () => {
                            this.socket.send(JSON.stringify({
                                type: "duelRejected",
                                challengerId: data.challengerId
                            }));
                            confirmDialog.remove();
                        };
                    }
                    break;

                case "duelAccepted":
                    if (data.challengerId === this.userId) {
                        this.startDuel(data.targetId);
                    }
                    break;

                case "duelRejected":
                    if (data.challengerId === this.userId) {
                        const rejectDialog = document.createElement('div');
                        rejectDialog.style.cssText = `
                            position: fixed;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            background-color: rgba(0, 0, 0, 0.9);
                            padding: 20px;
                            border-radius: 15px;
                            color: white;
                            text-align: center;
                            font-family: Arial, sans-serif;
                            border: 2px solid #dc3545;
                            z-index: 2001;
                        `;

                        rejectDialog.innerHTML = `
                            <div style="font-size: 24px;">❌ Tu reto ha sido rechazado</div>
                        `;

                        document.body.appendChild(rejectDialog);
                        setTimeout(() => rejectDialog.remove(), 2000);
                    }
                    break;

                case "duelChoice":
                    if (this.duelState.isInDuel) {
                        this.processDuelChoice(data.choice, data.playerId);
                    }
                    break;
                case "userChat":
                    if (data.userId !== this.userId) {
                        // Solo actualizar la burbuja de chat sobre el personaje si no es un mensaje de taberna
                        if (data.userId !== 'taberna' && !data.isTaberna) {
                            this.updateUserChat(data.userId, data.message, data.isEmote, data.username, data.emoji, false);
                        } else {
                            // Si es un mensaje de taberna, actualizar solo el chat box
                            const chatBox = document.getElementById('chat-box');
                            const messageDiv = document.createElement('div');
                            messageDiv.className = 'chat-message taberna-message';
                            messageDiv.innerHTML = `<span class="taberna-tag">Taberna</span> ${data.message}`;
                            chatBox.appendChild(messageDiv);
                            chatBox.scrollTop = chatBox.scrollHeight;

                            while (chatBox.children.length > 50) {
                                chatBox.removeChild(chatBox.firstChild);
                            }
                        }
                    }
                    break;

                case "error":
                    console.error("Server error:", data.message);
                    break;
                case 'ballPosition':
                    if (this.ball) {
                        this.ball.updateFromServer(data.position, data.velocity);
                    }
                    break;
                case 'ballSync':
                    if (this.ball) {
                        this.ball.syncFromServer(data.position, data.velocity);
                    }
                    break;
                case "duelResult":
                    this.processDuelResult(data);
                    break;
            }
        };

        this.socket.onerror = (error) => {
            console.error("WebSocket error:", error);
        };

        this.socket.onclose = () => {
            console.log("Disconnected from server");
        };
    }

    createBathroom() {
        // Tamaño del baño
        const width = 4;
        const height = 3;
        const depth = 4;

        // Paredes del baño
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
        const wall2Material = new THREE.MeshStandardMaterial({ color: 0xdc5a0b });

        // Pared trasera
        const backWall = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, 0.2),
            wallMaterial
        );
        backWall.position.set(13, height / 2, -8);
        this.scene.add(backWall);

        // Pared lateral
        const sideWall = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, height, depth),
            wallMaterial
        );
        sideWall.position.set(11, height / 2, -6);
        this.scene.add(sideWall);

        // Pared para la puerta
        const doorWall = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, height, 1.4), // 1.4 es el ancho menos la puerta
            wallMaterial
        );
        doorWall.position.set(11.7, height / 2, -4);
        doorWall.rotation.y = Math.PI / 2;
        this.scene.add(doorWall);

        const doorWall2 = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, height, 1.4),
            wallMaterial
        );
        doorWall2.position.set(14.3, height / 2, -4);
        doorWall2.rotation.y = Math.PI / 2;
        this.scene.add(doorWall2);

        // Techo
        const ceiling = new THREE.Mesh(
            new THREE.BoxGeometry(4.2, 0.2, 4),
            wallMaterial
        );
        ceiling.position.set(13, 2.9, -6);
        this.scene.add(ceiling);

        // Grupo de la puerta
        const doorGroup = new THREE.Group();
        doorGroup.position.set(13.7, 0, -4); // Posición del grupo alineada con el marco de la puerta

        // Crear puerta
        const doorGeometry = new THREE.BoxGeometry(1.4, 2.5, 0.1);
        const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(-0.7, 1.25, 0); // La mitad del ancho en X negativo para que gire desde el borde
        doorGroup.add(door);

        // Señalización en la puerta
        const signGeometry = new THREE.PlaneGeometry(1, 1);
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 256;
        signCanvas.height = 256;
        const signContext = signCanvas.getContext('2d');
        signContext.fillStyle = '#FFFFFF';
        signContext.fillRect(0, 0, 256, 256);
        signContext.fillStyle = '#000000';
        signContext.font = '48px Arial';
        signContext.textAlign = 'center';
        signContext.textBaseline = 'middle';
        signContext.fillText('🚽', 128, 128);

        const signTexture = new THREE.CanvasTexture(signCanvas);
        const signMaterial = new THREE.MeshBasicMaterial({ map: signTexture });
        const sign = new THREE.Mesh(signGeometry, signMaterial);
        sign.position.copy(door.position);
        sign.position.z += 0.06;
        sign.position.y += 0.7;
        doorGroup.add(sign);

        // Configurar el userData en el grupo en lugar de la puerta
        doorGroup.userData = {
            type: "door",
            isOpen: false,
            originalRotation: 0,
            isAnimating: false
        };

        this.scene.add(doorGroup);

        // Grupo del inodoro completo
        const toiletGroup = new THREE.Group();

        // Base del inodoro (más detallada y colorida)
        const toiletBase = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.4, 0.6),
            new THREE.MeshStandardMaterial({ color: 0xE3F2FD }) // Azul muy claro
        );
        toiletBase.position.y = 0.2;
        toiletGroup.add(toiletBase);

        // Asiento del inodoro
        const toiletSeat = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.1, 0.5),
            new THREE.MeshStandardMaterial({ color: 0xBBDEFB }) // Azul claro
        );
        toiletSeat.position.y = 0.45;
        toiletGroup.add(toiletSeat);

        // Tanque de agua
        const toiletTank = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.8, 0.3),
            new THREE.MeshStandardMaterial({ color: 0xE3F2FD })
        );
        toiletTank.position.set(0, 0.6, -0.2);
        toiletGroup.add(toiletTank);

        // Botón del tanque
        const tankButton = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.1, 0.05),
            new THREE.MeshStandardMaterial({ color: 0x90CAF9 })
        );
        tankButton.position.set(0, 0.9, -0.15);
        toiletGroup.add(tankButton);

        toiletGroup.position.set(13.5, 0, -7);
        toiletGroup.userData = {
            type: "seat",
            isBathroom: true,
            originalMaterial: toiletSeat.material,
            highlightMaterial: new THREE.MeshStandardMaterial({
                color: 0x7fff7f,
                emissive: 0x2f2f2f,
            }),
            forwardDirection: new THREE.Vector3(0, 0, -1),
        };

        // Añadir sonidos posicionales al inodoro
        const audioListener = new THREE.AudioListener();
        this.camera.add(audioListener);

        toiletGroup.userData.sounds = [];
        const audioLoader = new THREE.AudioLoader();
        for (let i = 1; i <= 4; i++) {
            const sound = new THREE.PositionalAudio(audioListener);
            sound.setRefDistance(5); // Distancia de referencia para la atenuación
            sound.setRolloffFactor(2); // Factor de atenuación con la distancia
            sound.setDistanceModel('exponential'); // Modelo de atenuación exponencial
            audioLoader.load(`assets/sound/cacota${i}.mp3`, (buffer) => {
                sound.setBuffer(buffer);
                sound.setVolume(0.5);
            });
            toiletGroup.add(sound);
            toiletGroup.userData.sounds.push(sound);
        }

        toiletGroup.userData.soundInterval = null;
        toiletGroup.userData.playRandomSound = function () {
            if (this.sounds.length === 0) return;
            const randomIndex = Math.floor(Math.random() * this.sounds.length);
            const sound = this.sounds[randomIndex];
            if (!sound.isPlaying) {
                sound.play();
            }
        };

        toiletGroup.userData.startSounds = function () {
            if (this.soundInterval) return;
            this.playRandomSound();
            this.soundInterval = setInterval(() => {
                this.playRandomSound();
            }, 5000);
        };

        toiletGroup.userData.stopSounds = function () {
            if (this.soundInterval) {
                clearInterval(this.soundInterval);
                this.soundInterval = null;
                this.sounds.forEach(sound => {
                    if (sound.isPlaying) {
                        sound.stop();
                    }
                });
            }
        };

        this.scene.add(toiletGroup);
        this.seats.set(toiletGroup.id, toiletGroup);

        // Lavamanos con más detalles
        const sinkGroup = new THREE.Group();

        // Base del lavamanos
        const sinkBase = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.1, 0.4),
            new THREE.MeshStandardMaterial({ color: 0xECEFF1 }) // Gris muy claro
        );
        sinkBase.position.y = 0.9;
        sinkGroup.add(sinkBase);

        // Cuenco del lavamanos
        const sinkBowl = new THREE.Mesh(
            new THREE.CylinderGeometry(0.25, 0.2, 0.15, 16),
            new THREE.MeshStandardMaterial({ color: 0xFFFFFF })
        );
        sinkBowl.position.y = 0.85;
        sinkGroup.add(sinkBowl);

        // Soporte
        const sinkStand = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.9, 0.1),
            new THREE.MeshStandardMaterial({ color: 0xCFD8DC }) // Gris claro
        );
        sinkStand.position.y = 0.45;
        sinkGroup.add(sinkStand);

        // Grifo
        const faucet = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.03, 0.2),
            new THREE.MeshStandardMaterial({ color: 0xB0BEC5 }) // Gris metálico
        );
        faucet.rotation.x = Math.PI / 2;
        faucet.position.set(0, 1, -0.1);
        sinkGroup.add(faucet);

        sinkGroup.position.set(11.5, 0, -7.5);
        this.scene.add(sinkGroup);
    }

    createWalls() {
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0xf0e6d2,
            roughness: 0.7,
        });

        // Pared trasera
        const backWallGeometry = new THREE.BoxGeometry(30, 8, 0.2);
        const backWall = new THREE.Mesh(backWallGeometry, wallMaterial);
        backWall.position.set(0, 4, -10);
        this.scene.add(backWall);

        // Paredes laterales
        const sideWallGeometry = new THREE.BoxGeometry(0.2, 8, 20);
        const leftWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
        leftWall.position.set(-15, 4, 0);
        this.scene.add(leftWall);

        const rightWall = new THREE.Mesh(sideWallGeometry, wallMaterial);
        rightWall.position.set(15, 4, 0);
        this.scene.add(rightWall);

        // Pared frontal
        const frontWallGeometry = new THREE.BoxGeometry(30, 8, 0.2);
        const frontWall = new THREE.Mesh(frontWallGeometry, wallMaterial);
        frontWall.position.set(0, 4, 10);
        this.scene.add(frontWall);

        const paintingPositions = [
            { x: -12, y: 4, z: -9.8, rotation: 0 },
            { x: -8, y: 4, z: -9.8, rotation: 0 },
            { x: -4, y: 4, z: -9.8, rotation: 0 },
            { x: 0, y: 4, z: -9.8, rotation: 0 },
            { x: 4, y: 4, z: -9.8, rotation: 0 },
            { x: 8, y: 4, z: -9.8, rotation: 0 },
            { x: 12, y: 4, z: -9.8, rotation: 0 },
            { x: 14.8, y: 4, z: -6, rotation: 4.7 },
            { x: 14.8, y: 4, z: -2, rotation: 4.7 },
            { x: 14.8, y: 4, z: 2, rotation: 4.7 },
            { x: 14.8, y: 4, z: 6, rotation: 4.7 },
            { x: -14.8, y: 4, z: -6, rotation: -4.7 },
            { x: -14.8, y: 4, z: -2, rotation: -4.7 },
            { x: -14.8, y: 4, z: 2, rotation: -4.7 },
            { x: -14.8, y: 4, z: 6, rotation: -4.7 },
        ];

        paintingPositions.forEach((pos, index) => {
            this.createPainting(pos.x, pos.y, pos.z, pos.rotation, index);
        });
    }

    createPainting(x, y, z, rotation, index) {
        const frameGeometry = new THREE.BoxGeometry(2, 2, 0.1);
        const frameMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b4513,
            roughness: 0.5,
        });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);

        const canvasGeometry = new THREE.PlaneGeometry(1.8, 1.8);
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext("2d");

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#000000";
        context.font = "20px Arial";
        context.textAlign = "center";
        context.fillText(
            `Cuadro ${index + 1}`,
            canvas.width / 2,
            canvas.height / 2
        );

        const texture = new THREE.CanvasTexture(canvas);
        const canvasMaterial = new THREE.MeshBasicMaterial({
            map: texture,
        });
        const canvasMesh = new THREE.Mesh(canvasGeometry, canvasMaterial);
        canvasMesh.position.z = 0.06;

        const paintingGroup = new THREE.Group();
        paintingGroup.add(frame);
        paintingGroup.add(canvasMesh);
        paintingGroup.position.set(x, y, z);
        paintingGroup.rotation.y = rotation;

        this.scene.add(paintingGroup);

        this.paintings.set(paintingGroup.id, {
            group: paintingGroup,
            canvas: canvas,
            context: context,
            texture: texture,
        });
    }

    createBar() {
        const floorGeometry = new THREE.PlaneGeometry(30, 20);
        const floorTexture = new THREE.TextureLoader().load(
            "https://threejs.org/examples/textures/hardwood2_diffuse.jpg"
        );
        floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
        floorTexture.repeat.set(8, 6);
        const floorMaterial = new THREE.MeshStandardMaterial({
            map: floorTexture,
            roughness: 0.8,
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Barra
        const barGeometry = new THREE.BoxGeometry(12, 1.2, 2);
        const barMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b4513,
            roughness: 0.6,
        });
        const bar = new THREE.Mesh(barGeometry, barMaterial);
        bar.position.set(0, 0.7, -3);
        bar.castShadow = true;
        bar.receiveShadow = true;
        this.scene.add(bar);

        const signGeometry = new THREE.BoxGeometry(2, 0.5, 0.1);
        const signMaterial = new THREE.MeshStandardMaterial({
            color: 0xff8c00,
        });
        const sign = new THREE.Mesh(signGeometry, signMaterial);
        sign.position.set(0, 1.5, -2.2);
        this.scene.add(sign);

        // Texto del cartel
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 64;
        const context = canvas.getContext("2d");
        context.fillStyle = "#FFFFFF";
        context.font = "bold 32px Arial";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText("Gamedev MV", 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const textMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
        });
        const textGeometry = new THREE.PlaneGeometry(1.8, 0.4);
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.set(0, 1.5, -2.15);
        this.scene.add(textMesh);

        this.createBackBar();
        this.createGlassesAndBottles();

        for (let i = -4; i <= 4; i += 2) {
            this.createStool(i, 0);
        }
    }

    createBackBar() {
        const backBarGeometry = new THREE.BoxGeometry(12, 3, 0.5);
        const backBarMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a3219,
            roughness: 0.7,
        });
        const backBar = new THREE.Mesh(backBarGeometry, backBarMaterial);
        backBar.position.set(0, 1.5, -7);
        backBar.castShadow = true;
        this.scene.add(backBar);

        const estantesAlturas = [1.5, 2.0, 2.5];
        estantesAlturas.forEach((altura) => {
            const shelfGeometry = new THREE.BoxGeometry(11.5, 0.1, 0.8);
            const shelfMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
            const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
            shelf.position.set(0, altura, -6.8);
            shelf.castShadow = true;
            this.scene.add(shelf);
        });
    }

    createStool(x, z) {
        const stoolGroup = new THREE.Group();

        const seatGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
        const seatMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a });
        const seat = new THREE.Mesh(seatGeometry, seatMaterial);
        seat.position.y = 0.9;
        stoolGroup.add(seat);

        const legGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.9, 8);
        const legMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
        const leg = new THREE.Mesh(legGeometry, legMaterial);
        leg.position.y = 0.45;
        stoolGroup.add(leg);

        const baseGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16);
        const base = new THREE.Mesh(baseGeometry, legMaterial);
        base.position.y = 0.025;
        stoolGroup.add(base);

        stoolGroup.position.set(x, 0, -1.5);
        stoolGroup.castShadow = true;
        this.scene.add(stoolGroup);

        stoolGroup.userData = {
            type: "seat",
            originalMaterial: seatMaterial,
            highlightMaterial: new THREE.MeshStandardMaterial({
                color: 0x7fff7f,
                emissive: 0x2f2f2f,
            }),
            forwardDirection: new THREE.Vector3(0, 0, -1),
        };
        seat.userData = {
            type: "seat",
            originalMaterial: seatMaterial,
            highlightMaterial: new THREE.MeshStandardMaterial({
                color: 0x7fff7f,
                emissive: 0x2f2f2f,
            }),
        };
        this.seats.set(stoolGroup.id, stoolGroup);

        return stoolGroup;
    }

    createGlassesAndBottles() {
        const colors = [0x4caf50, 0x2196f3, 0xf44336, 0xffeb3b];

        const bottleGroup = new THREE.Group();
        bottleGroup.name = 'BottlesAndGlasses';

        // Crear botellas
        for (let i = -5; i <= 5; i += 1) {
            // Primera fila de botellas
            const bottle1 = this.createBottle(colors[Math.floor(Math.random() * colors.length)]);
            bottle1.position.set(i, 1.8, -6.7);
            bottleGroup.add(bottle1);

            // Segunda fila de botellas
            const bottle2 = this.createBottle(colors[Math.floor(Math.random() * colors.length)]);
            bottle2.position.set(i * 0.8, 2.3, -6.7);
            bottleGroup.add(bottle2);
        }

        // Crear vasos
        for (let i = -5; i <= 5; i += 1) {
            const glass = this.createGlass();
            glass.position.set(i * 0.8, 1.4, -2.5);
            bottleGroup.add(glass);
        }

        this.scene.add(bottleGroup);
    }

    createBottle(color) {
        const bottleGroup = new THREE.Group();

        // Cuerpo de la botella
        const bodyGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.8,
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        bottleGroup.add(body);

        // Cuello de la botella
        const neckGeometry = new THREE.CylinderGeometry(0.05, 0.1, 0.2, 8);
        const neck = new THREE.Mesh(neckGeometry, bodyMaterial);
        neck.position.y = 0.4;
        bottleGroup.add(neck);

        return bottleGroup;
    }

    createGlass() {
        const glassGeometry = new THREE.CylinderGeometry(0.1, 0.07, 0.2, 8);
        const glassMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.4,
        });
        return new THREE.Mesh(glassGeometry, glassMaterial);
    }

    createFurniture() {
        const tablePositions = [
            { x: -5, z: 2 },
            { x: 0, z: 2 },
            { x: 5, z: 2 },
        ];

        tablePositions.forEach((pos) => {
            this.createTableSet(pos.x, pos.z);
        });
    }

    createTableSet(x, z) {
        const tableGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.05, 16);
        const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
        const table = new THREE.Mesh(tableGeometry, tableMaterial);
        table.position.set(x, 1, z);
        table.castShadow = true;
        this.scene.add(table);

        const legGeometry = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
        const leg = new THREE.Mesh(legGeometry, tableMaterial);
        leg.position.set(x, 0.5, z);
        this.scene.add(leg);

        const chairPositions = [
            { x: 1, z: 0 },
            { x: -1, z: 0 },
            { x: 0, z: 1 },
            { x: 0, z: -1 },
        ];

        chairPositions.forEach((pos) => {
            this.createChair(x + pos.x, z + pos.z);
        });
    }

    createChair(x, z) {
        const chairGroup = new THREE.Group();

        const seatGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.5);
        const chairMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a });
        const seat = new THREE.Mesh(seatGeometry, chairMaterial);
        seat.position.y = 0.5;
        chairGroup.add(seat);

        const backGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.1);
        const back = new THREE.Mesh(backGeometry, chairMaterial);
        back.position.set(0, 0.75, -0.2);
        chairGroup.add(back);

        const legGeometry = new THREE.BoxGeometry(0.05, 0.5, 0.05);
        const legPositions = [
            { x: 0.2, z: 0.2 },
            { x: -0.2, z: 0.2 },
            { x: 0.2, z: -0.2 },
            { x: -0.2, z: -0.2 },
        ];

        legPositions.forEach((pos) => {
            const leg = new THREE.Mesh(legGeometry, chairMaterial);
            leg.position.set(pos.x, 0.25, pos.z);
            chairGroup.add(leg);
        });

        chairGroup.position.set(x, 0, z);

        const angle = Math.atan2(0 - x, 0 - z);
        chairGroup.rotation.y = angle;

        chairGroup.userData = {
            type: "seat",
            originalMaterial: chairMaterial,
            highlightMaterial: new THREE.MeshStandardMaterial({
                color: 0x7fff7f,
                emissive: 0x2f2f2f,
            }),
            forwardDirection: new THREE.Vector3(0, 0, -1),
        };

        this.seats.set(chairGroup.id, chairGroup);
        chairGroup.castShadow = true;
        this.scene.add(chairGroup);
    }

    createUser(id, position, modelId = 'pj') {
        const group = new THREE.Group();
        const loader = new GLTFLoader();

        const animations = {
            idle: null,
            walk: null,
            jump: null,
            mixer: null,
            currentAction: null
        };

        // Determinar qué modelo cargar y guardarlo en el usuario
        let modelToUse = modelId;
        if (id === 'local') {
            modelToUse = this.selectedModel;
        }

        const modelPath = `/assets/models/${modelToUse}.glb`;

        // Chat sprite
        const chatCanvas = document.createElement("canvas");
        const chatContext = chatCanvas.getContext("2d");
        chatCanvas.width = 1024;
        chatCanvas.height = 512;

        const chatTexture = new THREE.CanvasTexture(chatCanvas);
        const chatSpriteMaterial = new THREE.SpriteMaterial({
            map: chatTexture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        const chatSprite = new THREE.Sprite(chatSpriteMaterial);
        chatSprite.position.y = 1.8;
        chatSprite.scale.set(6, 3, 1);
        chatSprite.material.opacity = 0;
        chatSprite.renderOrder = 999;
        chatSprite.center.set(0.5, 0);
        group.add(chatSprite);

        // Name sprite
        const nameCanvas = document.createElement("canvas");
        const nameContext = nameCanvas.getContext("2d");
        nameCanvas.width = 512;
        nameCanvas.height = 128;

        const nameTexture = new THREE.CanvasTexture(nameCanvas);
        const nameSpriteMaterial = new THREE.SpriteMaterial({
            map: nameTexture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        const nameSprite = new THREE.Sprite(nameSpriteMaterial);
        nameSprite.position.y = 1.2;
        nameSprite.scale.set(3.5, 0.9, 1);
        nameSprite.center.set(0.5, 0);
        nameSprite.renderOrder = 999;
        group.add(nameSprite);

        // Emoji sprite
        const emojiCanvas = document.createElement("canvas");
        const emojiContext = emojiCanvas.getContext("2d");
        emojiCanvas.width = 256;
        emojiCanvas.height = 256;

        const emojiTexture = new THREE.CanvasTexture(emojiCanvas);
        const emojiSpriteMaterial = new THREE.SpriteMaterial({
            map: emojiTexture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });
        const emojiSprite = new THREE.Sprite(emojiSpriteMaterial);
        emojiSprite.position.y = 3.0;
        emojiSprite.scale.set(1.5, 1.5, 1);
        emojiSprite.material.opacity = 0;
        emojiSprite.renderOrder = 999;
        group.add(emojiSprite);

        // Cargar el modelo GLB
        loader.load(modelPath,
            (gltf) => {
                const model = gltf.scene;
                model.scale.set(0.8, 0.8, 0.8);
                model.position.y = -1.0;
                group.add(model);

                // Configurar animaciones
                animations.mixer = new THREE.AnimationMixer(model);

                // Guardar todas las animaciones
                gltf.animations.forEach((clip) => {
                    const cleanName = clip.name.toLowerCase().trim();
                    if (cleanName.includes('idle')) {
                        animations.idle = animations.mixer.clipAction(clip);
                    }
                    else if (cleanName.includes('walk')) {
                        animations.walk = animations.mixer.clipAction(clip);
                    }
                    else if (cleanName.includes('jump')) {
                        animations.jump = animations.mixer.clipAction(clip);
                    }
                });

                if (animations.idle) {
                    animations.currentAction = animations.idle;
                    animations.idle.reset().play();
                }
            },
            (progress) => {
                console.log(`[createUser] Cargando modelo ${modelPath}: ${(progress.loaded / progress.total * 100)}%`);
            },
            (error) => {
                console.error(`[create User] Error cargando modelo ${modelPath}:`, error);
            }
        );

        group.rotation.y = Math.PI;
        group.position.copy(position);

        const user = {
            mesh: group,
            animations: animations,
            chatSprite: chatSprite,
            chatCanvas: chatCanvas,
            chatContext: chatContext,
            chatTexture: chatTexture,
            nameSprite: nameSprite,
            nameCanvas: nameCanvas,
            nameContext: nameContext,
            nameTexture: nameTexture,
            emojiSprite: emojiSprite,
            emojiCanvas: emojiCanvas,
            emojiContext: emojiContext,
            emojiTexture: emojiTexture,
            username: null,
            selectedModel: modelToUse
        };

        this.scene.add(group);
        return user;
    }

    handleMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        // Restaurar highlight anterior
        if (this.highlightedObject) {
            if (this.highlightedObject.userData && this.highlightedObject.userData.type === "seat") {
                this.highlightedObject.traverse((child) => {
                    if (child.isMesh && child.userData.originalMaterial) {
                        child.material = child.userData.originalMaterial;
                    }
                });
            } else if (this.highlightedObject.type === "user") {
                const user = this.users.get(this.highlightedObject.userId);
                if (user && user.mesh) {
                    user.mesh.children.forEach(child => {
                        if (child.isMesh && child.userData.originalMaterial) {
                            child.material = child.userData.originalMaterial;
                        }
                    });
                }
            } else if (this.highlightedObject.userData && this.highlightedObject.userData.type === "radio") {
                const body = this.highlightedObject.children[0];
                body.material = this.highlightedObject.userData.originalMaterial;
                this.highlightedObject.scale.set(1, 1, 1);
            }
        }

        // Limpiar el highlight actual
        this.highlightedObject = null;

        // Buscar objetos interactuables en orden de prioridad
        for (const intersect of intersects) {
            // 1. Comprobar usuarios
            const userId = this.findUserByMesh(intersect.object);
            if (userId && userId !== 'local') {
                const targetUser = this.users.get(userId);
                const localUser = this.users.get('local');
                const distance = localUser.mesh.position.distanceTo(targetUser.mesh.position);

                if (distance <= 2 && !this.duelState.isInDuel && !targetUser.isInDuel) {
                    this.highlightedObject = { type: 'user', userId: userId };
                    targetUser.mesh.children.forEach(child => {
                        if (child.isMesh) {
                            child.userData.originalMaterial = child.material.clone();
                            child.material = new THREE.MeshStandardMaterial({
                                color: 0x7fff7f,
                                emissive: 0x2f2f2f,
                            });
                        }
                    });
                    return;
                }
            }

            // 2. Comprobar radio
            const radioGroup = intersect.object.parent;
            if (radioGroup && radioGroup.userData && radioGroup.userData.type === "radio") {
                this.highlightedObject = radioGroup;
                const body = radioGroup.children[0];
                body.material = radioGroup.userData.highlightMaterial;
                radioGroup.scale.set(1.1, 1.1, 1.1);
                return;
            }

            // 3. Comprobar asientos
            if (intersect.object.parent &&
                intersect.object.parent.userData &&
                intersect.object.parent.userData.type === "seat") {

                this.highlightedObject = intersect.object.parent;
                this.highlightedObject.traverse((child) => {
                    if (child.isMesh && child.userData.highlightMaterial) {
                        child.material = child.userData.highlightMaterial;
                    }
                });
                return;
            }
        }
    }

    findUserByMesh(mesh) {
        for (const [userId, user] of this.users.entries()) {
            if (user.mesh === mesh || user.mesh.children.includes(mesh)) {
                return userId;
            }
            // Buscar recursivamente en todos los hijos del mesh del usuario
            let found = false;
            user.mesh.traverse((child) => {
                if (child === mesh) {
                    found = true;
                }
            });
            if (found) {
                return userId;
            }
        }
        return null;
    }

    startDuel(opponentId) {
        this.duelState.isInDuel = true;
        this.duelState.opponent = opponentId;
        this.duelState.spinning = true;
        this.duelState.duelStartTime = Date.now();
        this.duelState.myChoice = null;
        this.duelState.opponentChoice = null;

        // Crear UI mejorada para el duelo
        const duelUI = document.createElement('div');
        duelUI.id = 'duel-ui';
        duelUI.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: rgba(0, 0, 0, 0.9);
            padding: 30px;
            border-radius: 15px;
            color: white;
            text-align: center;
            font-family: Arial, sans-serif;
            border: 2px solid #dc5a0b;
            box-shadow: 0 0 20px rgba(220, 90, 11, 0.3);
            z-index: 2000;
        `;

        duelUI.innerHTML = `
            <div id="duel-countdown" style="font-size: 24px; margin-bottom: 20px;">¡Prepárate!</div>
            <div id="duel-choices" style="display: none; gap: 10px;">
                <button class="duel-button" data-choice="piedra" style="font-size: 20px;">🪨 Piedra</button>
                <button class="duel-button" data-choice="papel" style="font-size: 20px;">📄 Papel</button>
                <button class="duel-button" data-choice="tijera" style="font-size: 20px;">✂️ Tijera</button>
            </div>
            <div id="duel-timer" style="margin-top: 15px; font-size: 18px;"></div>
        `;
        document.body.appendChild(duelUI);

        // Añadir event listeners a los botones
        const buttons = duelUI.querySelectorAll('.duel-button');
        buttons.forEach(button => {
            button.addEventListener('click', () => {
                const choice = button.getAttribute('data-choice');
                this.makeDuelChoice(choice);
            });
        });

        // Añadir estilos para los botones
        const style = document.createElement('style');
        style.textContent = `
            .duel-button {
                padding: 12px 24px;
                margin: 0 10px;
                border: none;
                border-radius: 8px;
                background: #dc5a0b;
                color: white;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            .duel-button:hover {
                background: #ab4609;
                transform: scale(1.05);
            }
            .duel-button:disabled {
                background: #666;
                cursor: not-allowed;
                transform: none;
            }
        `;
        document.head.appendChild(style);

        // Iniciar cuenta regresiva
        let countdown = 3;
        const countdownInterval = setInterval(() => {
            const countdownEl = document.getElementById('duel-countdown');
            if (countdown > 0) {
                countdownEl.textContent = countdown;
                countdown--;
            } else {
                clearInterval(countdownInterval);
                countdownEl.textContent = '¡ELIGE!';
                document.getElementById('duel-choices').style.display = 'flex';
                document.getElementById('duel-choices').style.justifyContent = 'center';

                // Iniciar temporizador para elegir
                let timeLeft = 10;
                const timerInterval = setInterval(() => {
                    if (timeLeft > 0) {
                        document.getElementById('duel-timer').textContent = `Tiempo restante: ${timeLeft}s`;
                        timeLeft--;
                    } else {
                        clearInterval(timerInterval);
                        if (!this.duelState.myChoice) {
                            this.makeDuelChoice('timeout');
                        }
                    }
                }, 1000);
            }
        }, 1000);

        // Iniciar la animación de dar vueltas
        this.spinPlayers();
    }

    spinPlayers() {
        const spinDuration = 3000; // 3 segundos de giro
        const startTime = Date.now();
        const opponent = this.users.get(this.duelState.opponent);
        const localUser = this.users.get('local');
        const radius = 1;
        const center = opponent.mesh.position.clone();

        const animate = () => {
            if (!this.duelState.spinning) return;

            const elapsed = Date.now() - startTime;
            if (elapsed < spinDuration) {
                const angle = (elapsed / 500) * Math.PI * 2; // Una vuelta cada 500ms
                localUser.mesh.position.x = center.x + Math.cos(angle) * radius;
                localUser.mesh.position.z = center.z + Math.sin(angle) * radius;
                localUser.mesh.lookAt(center);

                requestAnimationFrame(animate);
            } else {
                this.duelState.spinning = false;
                document.getElementById('duel-countdown').textContent = '¡ELIGE!';
                document.getElementById('duel-choices').style.display = 'block';
            }
        };

        animate();
    }

    makeDuelChoice(choice) {
        if (this.duelState.myChoice || !this.duelState.isInDuel) return;

        this.duelState.myChoice = choice;
        this.duelState.waitingForResult = true;

        // Deshabilitar botones después de elegir
        const buttons = document.querySelectorAll('.duel-button');
        buttons.forEach(button => button.disabled = true);

        document.getElementById('duel-countdown').textContent = 'Esperando al oponente...';
        document.getElementById('duel-timer').textContent = '';

        this.socket.send(JSON.stringify({
            type: "duelChoice",
            choice: choice,
            playerId: this.userId
        }));
    }

    processDuelChoice(choice, playerId) {
        if (!this.duelState.isInDuel) return;

        if (playerId === this.duelState.opponent) {
            this.duelState.opponentChoice = choice;

            // Mostrar mensaje de espera
            const duelCountdown = document.getElementById('duel-countdown');
            if (duelCountdown && !this.duelState.myChoice) {
                duelCountdown.textContent = '¡El oponente ya eligió! Es tu turno...';
            }
        }
    }

    processDuelResult(result) {
        if (!this.duelState.isInDuel || !this.duelState.waitingForResult) return;

        const myChoice = this.duelState.myChoice;
        const opponentChoice = result.player1.id === this.userId ?
            result.player2.choice : result.player1.choice;

        let resultText;
        let resultEmoji;
        const opponent = this.users.get(this.duelState.opponent);
        const opponentName = opponent ? opponent.username : "oponente";

        // Determinar el resultado
        if (myChoice === opponentChoice) {
            resultText = "¡Empate!";
            resultEmoji = "🤝";
        } else if (
            (myChoice === 'piedra' && opponentChoice === 'tijera') ||
            (myChoice === 'papel' && opponentChoice === 'piedra') ||
            (myChoice === 'tijera' && opponentChoice === 'papel')
        ) {
            resultText = "¡Has ganado!";
            resultEmoji = "🏆";
        } else {
            resultText = "¡Has perdido!";
            resultEmoji = "💔";
        }

        // Actualizar la UI
        const duelCountdown = document.getElementById('duel-countdown');
        if (duelCountdown) {
            duelCountdown.innerHTML = `
                <div style="font-size: 32px; margin-bottom: 10px;">${resultEmoji}</div>
                <div>${resultText}</div>
                <div style="margin-top: 15px; font-size: 20px;">
                    Tú: ${result.choiceEmojis[myChoice]} vs ${result.choiceEmojis[opponentChoice]} :Oponente
                </div>
            `;

            // Terminar el duelo después de mostrar el resultado
            setTimeout(() => {
                const duelUI = document.getElementById('duel-ui');
                if (duelUI) {
                    duelUI.style.opacity = '0';
                    duelUI.style.transition = 'opacity 0.5s ease';
                    setTimeout(() => {
                        duelUI.remove();
                        const addedStyle = document.querySelector('style');
                        if (addedStyle && addedStyle.textContent.includes('duel-button')) {
                            addedStyle.remove();
                        }
                    }, 500);
                }
                // Resetear el estado del duelo
                this.duelState.isInDuel = false;
                this.duelState.opponent = null;
                this.duelState.myChoice = null;
                this.duelState.opponentChoice = null;
                this.duelState.waitingForResult = false;
            }, 3000);
        }
    }

    handleClick() {
        if (this.chatActive || this.duelState.isInDuel) {
            console.log('Click ignorado - Chat activo o en duelo:', {
                chatActive: this.chatActive,
                isInDuel: this.duelState.isInDuel
            });
            return;
        }

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        // Primero buscar interacción con la radio
        const radioIntersect = intersects.find(intersect =>
            intersect.object.parent &&
            intersect.object.parent.userData &&
            intersect.object.parent.userData.type === "radio"
        );

        if (radioIntersect) {
            const radioGroup = radioIntersect.object.parent;
            const sound = radioGroup.userData.sound;
            const indicator = radioGroup.userData.indicator;

            if (radioGroup.userData.isPlaying) {
                sound.pause();
                indicator.material.emissive.setHex(0x696969);
                indicator.material.color.setHex(0x696969);
                indicator.material.emissiveIntensity = 0.1;
            } else {
                sound.play();
                indicator.material.emissive.setHex(radioGroup.userData.originalIndicatorColor);
                indicator.material.color.setHex(radioGroup.userData.originalIndicatorColor);
                indicator.material.emissiveIntensity = 0.5;
            }
            radioGroup.userData.isPlaying = !radioGroup.userData.isPlaying;
            return;
        }

        // Luego buscar interacción con otros usuarios
        for (const intersect of intersects) {
            const userId = this.findUserByMesh(intersect.object);
            if (userId && userId !== 'local') {
                const targetUser = this.users.get(userId);
                const localUser = this.users.get('local');

                // Comprobar distancia
                const distance = localUser.mesh.position.distanceTo(targetUser.mesh.position);
                if (distance > 2) {
                    this.showMessage("¡Estás demasiado lejos para retar a este jugador!");
                    return;
                }

                // Comprobar si el jugador ya está en duelo
                if (targetUser.isInDuel) {
                    this.showMessage("¡Este jugador ya está en un duelo!");
                    return;
                }

                // Comprobar si nosotros ya estamos en duelo
                if (this.duelState.isInDuel) {
                    this.showMessage("¡Ya estás en un duelo!");
                    return;
                }

                // Añadir feedback para el retador
                this.showMessage("¡Solicitud de duelo enviada! Esperando respuesta...");

                const targetName = targetUser.username || "otro jugador";
                this.updateUserChat("local", `ha retado a ${targetName} a un duelo`, true);

                this.socket.send(JSON.stringify({
                    type: "duelRequest",
                    targetId: userId,
                    challengerId: this.userId,
                    challengerName: this.username
                }));
                return;
            }
        }

        // Finalmente, buscar interacción con asientos
        if (this.highlightedObject && !this.sittingOn &&
            this.highlightedObject.userData &&
            this.highlightedObject.userData.type === "seat") {

            this.sitOn(this.highlightedObject);
            this.socket.send(JSON.stringify({
                type: "userSat",
                seatId: this.highlightedObject.id
            }));
            return;
        }

        const doorClick = intersects.find(
            intersect => {
                const parent = intersect.object.parent;
                return parent && parent.userData && parent.userData.type === "door";
            }
        );

        if (doorClick) {
            const doorGroup = doorClick.object.parent;
            if (doorGroup.userData.isAnimating) return;

            doorGroup.userData.isOpen = !doorGroup.userData.isOpen;
            doorGroup.userData.isAnimating = true;
            const targetRotation = doorGroup.userData.isOpen ? -Math.PI / 2 : doorGroup.userData.originalRotation;

            const animate = () => {
                const diff = targetRotation - doorGroup.rotation.y;
                if (Math.abs(diff) > 0.01) {
                    doorGroup.rotation.y += diff * 0.1;
                    requestAnimationFrame(animate);
                } else {
                    doorGroup.rotation.y = targetRotation;
                    doorGroup.userData.isAnimating = false;
                }
            };
            animate();
            return;
        }
    }

    sitOn(seat) {
        const user = this.users.get("local");
        if (!user || this.sittingOn) return;

        // Guardar estado anterior
        this.previousPosition = user.mesh.position.clone();
        this.previousRotation = user.mesh.rotation.y;

        this.sittingOn = seat;
        const seatPosition = new THREE.Vector3();
        seat.getWorldPosition(seatPosition);

        // Ajustar posición al sentarse
        user.mesh.position.copy(seatPosition);

        if (seat.userData.isBathroom) {
            // Ajustes específicos para el aseo
            user.mesh.position.y += 1.2; // Altura específica para el inodoro
            user.mesh.position.z += 0.2; // Ajuste hacia adelante para que se vea mejor sentado
            user.mesh.rotation.y = Math.PI; // Girar para mirar al frente

            // Configuración específica de la cámara para el aseo
            this.cameraRotation.horizontal = Math.PI; // Cámara mirando desde atrás
            this.cameraRotation.vertical = Math.PI / 6;

            const offsetDistance = 2.5; // Más cerca para el aseo
            const offsetHeight = 2;
            const cameraOffset = new THREE.Vector3(
                0, // Sin offset en X para mantenerla centrada
                offsetHeight,
                offsetDistance
            );

            this.camera.position.copy(user.mesh.position).add(cameraOffset);
        } else {
            // Configuración normal para otros asientos
            user.mesh.position.y += 1.4;

            // Calcular rotación hacia la barra
            const barPosition = new THREE.Vector3(0, user.mesh.position.y, -3);
            const direction = barPosition.sub(user.mesh.position).normalize();
            const angle = Math.atan2(direction.x, direction.z);
            user.mesh.rotation.y = angle;

            // Ajustar la cámara normal
            this.cameraRotation.horizontal = angle + Math.PI;
            this.cameraRotation.vertical = Math.PI / 6;

            const offsetDistance = 3.3;
            const offsetHeight = 2;
            const cameraOffset = new THREE.Vector3(
                Math.sin(angle + Math.PI) * offsetDistance,
                offsetHeight,
                Math.cos(angle + Math.PI) * offsetDistance
            );

            this.camera.position.copy(seatPosition.clone().add(cameraOffset));
        }

        // Si es el inodoro, iniciar los sonidos y mostrar emoji
        if (seat.userData.isBathroom) {
            seat.userData.startSounds();
            // Mostrar el emoji de caca permanentemente mientras está sentado
            const emojiCanvas = user.emojiCanvas;
            const emojiContext = user.emojiContext;
            const emojiTexture = user.emojiTexture;
            const emojiSprite = user.emojiSprite;

            emojiContext.clearRect(0, 0, emojiCanvas.width, emojiCanvas.height);
            emojiContext.font = 'bold 180px Arial';
            emojiContext.textAlign = 'center';
            emojiContext.textBaseline = 'middle';
            emojiContext.fillText('💩', emojiCanvas.width / 2, emojiCanvas.height / 2);
            emojiTexture.needsUpdate = true;
            emojiSprite.material.opacity = 1;
            emojiSprite.visible = true;
            user.poopingEmoji = true;
        }

        this.camera.lookAt(user.mesh.position);
    }

    sitOtherUser(userId, seatId) {
        const user = this.users.get(userId);
        const seat = this.seats.get(seatId);
        if (!user || !seat) return;

        const seatPosition = new THREE.Vector3();
        seat.getWorldPosition(seatPosition);

        user.mesh.position.copy(seatPosition);

        if (seat.userData.isBathroom) {
            // Ajustes específicos para el aseo para otros usuarios
            user.mesh.position.y += 1.2;
            user.mesh.position.z += 0.2;
            user.mesh.rotation.y = Math.PI; // Girar para mirar al frente
        } else {
            // Configuración normal para otros asientos
            user.mesh.position.y += 1.4;
            const lookAtPoint = new THREE.Vector3(0, user.mesh.position.y, -3);
            user.mesh.lookAt(lookAtPoint);
        }

        // Si es el inodoro, iniciar los sonidos y mostrar emoji
        if (seat.userData.isBathroom) {
            seat.userData.startSounds();
            // Mostrar el emoji de caca permanentemente mientras está sentado
            const emojiCanvas = user.emojiCanvas;
            const emojiContext = user.emojiContext;
            const emojiTexture = user.emojiTexture;
            const emojiSprite = user.emojiSprite;

            emojiContext.clearRect(0, 0, emojiCanvas.width, emojiCanvas.height);
            emojiContext.font = 'bold 180px Arial';
            emojiContext.textAlign = 'center';
            emojiContext.textBaseline = 'middle';
            emojiContext.fillText('💩', emojiCanvas.width / 2, emojiCanvas.height / 2);
            emojiTexture.needsUpdate = true;
            emojiSprite.material.opacity = 1;
            emojiSprite.visible = true;
            user.poopingEmoji = true;
        }
    }

    standOtherUser(userId) {
        const user = this.users.get(userId);
        if (!user) return;

        // Buscar si el usuario estaba sentado en el inodoro
        for (const [seatId, seat] of this.seats.entries()) {
            if (seat.userData.isBathroom && seat.userData.soundInterval) {
                seat.userData.stopSounds();
                if (user.poopingEmoji) {
                    user.emojiSprite.material.opacity = 0;
                    user.emojiSprite.visible = false;
                    user.poopingEmoji = false;
                }
            }
        }
    }

    updateUserChat(id, message, isEmote = false, username = null, emoji = null, skipChatBox = false) {
        const user = this.users.get(id);
        if (!user) return;

        // Si es el usuario local, solo actualizar el chat box y salir
        if (id === 'local') {
            if (!skipChatBox) {
                // Actualizar el chat box
                const chatBox = document.getElementById('chat-box');
                const messageDiv = document.createElement('div');
                messageDiv.className = `chat-message ${isEmote ? 'emote-message' : ''}`;

                if (isEmote) {
                    messageDiv.textContent = `* ${this.username} ${message}`;
                } else {
                    messageDiv.textContent = `${this.username}: ${message}`;
                }

                chatBox.appendChild(messageDiv);
                chatBox.scrollTop = chatBox.scrollHeight;

                while (chatBox.children.length > 50) {
                    chatBox.removeChild(chatBox.firstChild);
                }
            }
            return;
        }

        // Si hay un emoji directo, solo mostrar el emoji sin burbuja de chat
        if (emoji) {
            this.showEmoji(id, emoji);

            // Actualizar el chat box
            const chatBox = document.getElementById('chat-box');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message emote-message';
            const displayName = id === 'local' ? this.username : user.username;
            messageDiv.textContent = `* ${displayName} ${message}`;
            chatBox.appendChild(messageDiv);
            chatBox.scrollTop = chatBox.scrollHeight;

            while (chatBox.children.length > 50) {
                chatBox.removeChild(chatBox.firstChild);
            }
            return;
        }

        const { chatCanvas, chatContext, chatTexture, chatSprite } = user;

        if (user.chatTimeout) {
            clearTimeout(user.chatTimeout);
        }

        // Limpiar completamente el canvas
        chatContext.clearRect(0, 0, chatCanvas.width, chatCanvas.height);

        // Ajustar tamaños
        const padding = 40;
        const borderRadius = 25;
        const arrowHeight = 30;

        // Configurar el estilo del texto
        chatContext.font = 'bold 48px Arial';
        chatContext.textAlign = 'left';
        chatContext.textBaseline = 'top';

        // Medir y envolver el texto
        const maxWidth = chatCanvas.width - (padding * 4); // Más padding para el texto
        const words = message.split(' ');
        let lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = chatContext.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);

        // Calcular altura total
        const lineHeight = 56;
        const textHeight = lines.length * lineHeight;
        const bubbleHeight = textHeight + (padding * 2);
        const totalHeight = bubbleHeight + arrowHeight;

        // Desplazar todo el contenido hacia abajo en el canvas
        const yOffset = chatCanvas.height - totalHeight - padding;

        // Dibujar la sombra de la burbuja
        chatContext.save();
        chatContext.shadowColor = 'rgba(0, 0, 0, 0.3)';
        chatContext.shadowBlur = 15;
        chatContext.shadowOffsetX = 0;
        chatContext.shadowOffsetY = 5;

        // Dibujar el fondo de la burbuja
        chatContext.fillStyle = isEmote ? 'rgba(255, 230, 242, 0.95)' : 'rgba(255, 255, 255, 0.95)';
        roundRect(
            chatContext,
            padding,
            yOffset,
            chatCanvas.width - (padding * 2),
            bubbleHeight,
            borderRadius
        );

        // Dibujar la flecha con el mismo color que la burbuja
        chatContext.beginPath();
        const arrowWidth = 25;
        const centerX = chatCanvas.width / 2;
        chatContext.moveTo(centerX - arrowWidth / 2, yOffset + bubbleHeight);
        chatContext.lineTo(centerX, yOffset + bubbleHeight + arrowHeight);
        chatContext.lineTo(centerX + arrowWidth / 2, yOffset + bubbleHeight);
        chatContext.closePath();
        chatContext.fill();

        // Restaurar el contexto para quitar la sombra
        chatContext.restore();

        // Dibujar el borde de la burbuja
        chatContext.strokeStyle = isEmote ? 'rgba(255, 182, 193, 0.8)' : 'rgba(200, 200, 200, 0.8)';
        chatContext.lineWidth = 2;

        // Borde de la burbuja
        roundRect(
            chatContext,
            padding,
            yOffset,
            chatCanvas.width - (padding * 2),
            bubbleHeight,
            borderRadius,
            true // Solo stroke
        );

        // Borde de la flecha
        chatContext.beginPath();
        chatContext.moveTo(centerX - arrowWidth / 2, yOffset + bubbleHeight);
        chatContext.lineTo(centerX, yOffset + bubbleHeight + arrowHeight);
        chatContext.lineTo(centerX + arrowWidth / 2, yOffset + bubbleHeight);
        chatContext.stroke();

        // Dibujar el texto con mejor contraste
        lines.forEach((line, i) => {
            const x = padding * 2;
            const y = yOffset + padding + (i * lineHeight);

            // Sombra suave para el texto
            chatContext.save();
            chatContext.shadowColor = 'rgba(0, 0, 0, 0.2)';
            chatContext.shadowBlur = 2;
            chatContext.shadowOffsetX = 1;
            chatContext.shadowOffsetY = 1;

            // Color del texto según si es emote o no
            chatContext.fillStyle = isEmote ? '#d4458e' : '#000000';
            chatContext.fillText(line, x, y);
            chatContext.restore();
        });

        chatTexture.needsUpdate = true;
        chatSprite.material.opacity = 1.0;
        chatSprite.renderOrder = 999;

        // Temporizador para desvanecer
        user.chatTimeout = setTimeout(() => {
            const fadeStart = Date.now();
            const fade = () => {
                const elapsed = Date.now() - fadeStart;
                const opacity = 1 - (elapsed / this.CHAT_FADE_TIME);

                if (opacity > 0) {
                    chatSprite.material.opacity = opacity;
                    requestAnimationFrame(fade);
                } else {
                    chatContext.clearRect(0, 0, chatCanvas.width, chatCanvas.height);
                    chatTexture.needsUpdate = true;
                    chatSprite.material.opacity = 0;
                }
            };
            fade();
        }, this.CHAT_DISPLAY_TIME);

        // Actualizar el chat box
        const chatBox = document.getElementById('chat-box');
        const messageDiv = document.createElement('div');
        const displayName = id === 'local' ? this.username : (user ? user.username : username);

        if (id === 'taberna') {
            messageDiv.className = 'chat-message taberna-message';
            messageDiv.innerHTML = `<span class="taberna-tag">Taberna</span> ${message}`;
        } else {
            messageDiv.className = `chat-message ${isEmote ? 'emote-message' : ''}`;
            if (isEmote) {
                messageDiv.textContent = `* ${displayName} ${message}`;
            } else {
                messageDiv.textContent = `${displayName}: ${message}`;
            }
        }

        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        while (chatBox.children.length > 50) {
            chatBox.removeChild(chatBox.firstChild);
        }

        if (isEmote) {
            // Si recibimos un emoji directamente, usarlo
            if (emoji) {
                this.showEmoji(id, emoji);
            } else {
                // Si no, buscarlo en la lista de emotes
                const emote = emotesList.find(e => message.includes(e.text));
                if (emote) {
                    this.showEmoji(id, emote.emoji);
                }
            }
        }
    }

    moveLocalUser() {
        const user = this.users.get("local");
        if (!user || this.chatActive) return;

        // Actualizar el estado de movimiento antes de procesar el movimiento
        const wasMoving = this.isMoving;
        this.isMoving = (this.keysPressed["w"] || this.keysPressed["a"] ||
            this.keysPressed["s"] || this.keysPressed["d"]);

        // Si el usuario está sentado y presiona cualquier tecla de movimiento, levantarse
        if (this.sittingOn && (this.keysPressed["w"] || this.keysPressed["a"] ||
            this.keysPressed["s"] || this.keysPressed["d"])) {
            this.standUp();
            return;
        }

        // Detectar salto (solo si no está sentado)
        if (!this.sittingOn && this.keysPressed[" "]) {
            if (!this.isJumping) {
                this.isJumping = true;
                this.verticalSpeed = this.jumpSpeed;
            }
        }

        // Aplicar gravedad si está saltando
        if (!this.sittingOn && this.isJumping) {
            user.mesh.position.y += this.verticalSpeed;
            this.verticalSpeed += this.gravity;

            if (user.mesh.position.y <= this.groundHeight) {
                user.mesh.position.y = this.groundHeight;
                this.isJumping = false;
                this.verticalSpeed = 0;
            }
        }

        // Si está sentado, solo actualizar la cámara
        if (this.sittingOn) {
            // Actualizar la cámara mientras está sentado
            const seatPosition = new THREE.Vector3();
            this.sittingOn.getWorldPosition(seatPosition);

            const distance = this.cameraDistance;
            const height = distance * Math.sin(this.cameraRotation.vertical);
            const radius = distance * Math.cos(this.cameraRotation.vertical);

            const cameraOffset = new THREE.Vector3(
                radius * Math.sin(this.cameraRotation.horizontal),
                height,
                radius * Math.cos(this.cameraRotation.horizontal)
            );

            this.camera.position.copy(seatPosition).add(cameraOffset);
            this.camera.lookAt(user.mesh.position);
            return;
        }

        // Resto del código de movimiento para cuando no está sentado...
        const moveDistance = this.moveSpeed;
        const newPosition = new THREE.Vector3();
        newPosition.copy(user.mesh.position);

        // Obtener la dirección de la cámara
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0));

        const moveVector = new THREE.Vector3(0, 0, 0);

        if (this.keysPressed["w"]) moveVector.add(cameraDirection);
        if (this.keysPressed["s"]) moveVector.sub(cameraDirection);
        if (this.keysPressed["a"]) moveVector.sub(right);
        if (this.keysPressed["d"]) moveVector.add(right);

        // Actualizar isMoving basado en si hay movimiento
        this.isMoving = moveVector.lengthSq() > 0;

        // Normalizar el vector de movimiento si existe movimiento
        if (moveVector.lengthSq() > 0) {
            moveVector.normalize();

            // Aplicar el movimiento
            newPosition.add(moveVector.multiplyScalar(moveDistance));

            // Rotar el personaje hacia la dirección del movimiento
            const angle = Math.atan2(moveVector.x, moveVector.z);
            user.mesh.rotation.y = angle;
        }

        // Comprobar colisión con la pelota
        if (this.ball) {
            const ballDistance = newPosition.distanceTo(this.ball.mesh.position);
            if (ballDistance < 0.6) { // Radio combinado de jugador + pelota
                const direction = new THREE.Vector3()
                    .subVectors(this.ball.mesh.position, newPosition)
                    .normalize();

                // Calcular la velocidad basada en el movimiento del jugador
                const kickPower = 5 * moveDistance / 0.1; // Ajustar según necesidad
                direction.multiply(moveVector); // Aplicar dirección del movimiento
                direction.y = 0.2; // Pequeño impulso hacia arriba

                this.ball.kick(direction, kickPower);
            }
        }

        // Comprobar colisiones
        const bounds = {
            xMin: -14.5,
            xMax: 14.5,
            zMin: -9.5,
            zMax: 9.5
        };

        const playerRadius = 0.4;

        // Definir las áreas y alturas de colisión para la barra y estanterías
        const barBounds = {
            xMin: -6,
            xMax: 6,
            zMin: -4,
            zMax: -2,
            height: 1.2  // Altura de la barra
        };

        const backBarBounds = {
            xMin: -6,
            xMax: 6,
            zMin: -7.5,
            zMax: -6.5,
            height: 3.0  // Altura del backbar
        };

        // Función auxiliar para comprobar colisión con un área rectangular
        const checkCollision = (bounds, position, playerHeight) => {
            const horizontalCollision = position.x >= bounds.xMin - playerRadius &&
                position.x <= bounds.xMax + playerRadius &&
                position.z >= bounds.zMin - playerRadius &&
                position.z <= bounds.zMax + playerRadius;

            // Si hay colisión horizontal, verificar si el jugador está por encima del objeto
            if (horizontalCollision) {
                return playerHeight < bounds.height;
            }
            return false;
        };

        // Obtener la altura actual del jugador
        const playerHeight = this.isJumping ? user.mesh.position.y : this.groundHeight;

        // Comprobar colisiones con los objetos
        const collidesWithBar = checkCollision(barBounds, newPosition, playerHeight);
        const collidesWithBackBar = checkCollision(backBarBounds, newPosition, playerHeight);

        // Si colisiona y está saltando, ajustar la altura
        if ((collidesWithBar || collidesWithBackBar) && this.isJumping) {
            const objectHeight = collidesWithBar ? barBounds.height : backBarBounds.height;
            if (playerHeight > objectHeight) {
                // Permitir el movimiento si está por encima del objeto
                user.mesh.position.x = newPosition.x;
                user.mesh.position.z = newPosition.z;
            } else if (this.verticalSpeed > 0) {
                // Si está subiendo, permitir el movimiento vertical
                user.mesh.position.y += this.verticalSpeed;
            } else {
                // Si está cayendo, aterrizar sobre el objeto
                user.mesh.position.y = objectHeight;
                this.isJumping = false;
                this.verticalSpeed = 0;
            }
        } else {
            // Aplicar límites del mapa y movimiento normal
            if (newPosition.x > bounds.xMin + playerRadius &&
                newPosition.x < bounds.xMax - playerRadius &&
                newPosition.z > bounds.zMin + playerRadius &&
                newPosition.z < bounds.zMax - playerRadius &&
                (!collidesWithBar && !collidesWithBackBar)) {

                user.mesh.position.x = newPosition.x;
                user.mesh.position.z = newPosition.z;
            }
        }

        // Actualizar la cámara
        const distance = this.cameraDistance;
        const height = distance * Math.sin(this.cameraRotation.vertical);
        const radius = distance * Math.cos(this.cameraRotation.vertical);

        const cameraOffset = new THREE.Vector3(
            radius * Math.sin(this.cameraRotation.horizontal),
            height,
            radius * Math.cos(this.cameraRotation.horizontal)
        );

        // Posición deseada de la cámara
        const targetCameraPos = new THREE.Vector3().copy(user.mesh.position).add(cameraOffset);

        // Crear un raycaster desde el personaje hacia la posición deseada de la cámara
        const raycaster = new THREE.Raycaster();
        raycaster.set(
            user.mesh.position,
            cameraOffset.clone().normalize()
        );

        // Lista de objetos a comprobar para colisiones (paredes)
        const walls = this.scene.children.filter(obj =>
            obj.isMesh &&
            (obj.geometry instanceof THREE.BoxGeometry) &&
            obj.position.y >= 2 // Asumiendo que las paredes están en y >= 2
        );

        const intersects = raycaster.intersectObjects(walls);

        if (intersects.length > 0) {
            // Si hay una colisión, colocar la cámara justo antes del punto de colisión
            const collision = intersects[0];
            if (collision.distance < cameraOffset.length()) {
                const adjustedDistance = collision.distance * 0.9; // 90% de la distancia a la pared
                const adjustedOffset = cameraOffset.normalize().multiplyScalar(adjustedDistance);
                this.camera.position.copy(user.mesh.position).add(adjustedOffset);
            } else {
                this.camera.position.copy(targetCameraPos);
            }
        } else {
            this.camera.position.copy(targetCameraPos);
        }

        this.camera.lookAt(user.mesh.position);

        // Enviar actualización al servidor si la posición ha cambiado
        if (this.lastSentPosition === undefined ||
            !this.lastSentPosition.equals(user.mesh.position) ||
            this.lastSentRotation !== user.mesh.rotation.y) {
            this.lastSentPosition = user.mesh.position.clone();
            this.lastSentRotation = user.mesh.rotation.y;

            this.socket.send(JSON.stringify({
                type: "userMoved",
                position: user.mesh.position.toArray(),
                rotation: user.mesh.rotation.y
            }));
        }
    }

    standUp() {
        if (!this.sittingOn) return;

        const user = this.users.get("local");
        if (!user) return;

        // Si estaba en el inodoro, detener los sonidos y ocultar emoji
        if (this.sittingOn.userData.isBathroom) {
            this.sittingOn.userData.stopSounds();
            if (user.poopingEmoji) {
                user.emojiSprite.material.opacity = 0;
                user.emojiSprite.visible = false;
                user.poopingEmoji = false;
            }
        }

        // Restaurar posición anterior si existe
        if (this.previousPosition) {
            user.mesh.position.copy(this.previousPosition);
            user.mesh.rotation.y = this.previousRotation;
        } else {
            // Si no hay posición anterior, colocar al usuario frente al asiento
            const offset = new THREE.Vector3(0, 0, 1);
            offset.applyQuaternion(this.sittingOn.quaternion);
            user.mesh.position.copy(this.sittingOn.position).add(offset);
        }

        // Asegurarse de que el usuario está a la altura correcta
        user.mesh.position.y = this.groundHeight;

        // Notificar al servidor
        this.socket.send(JSON.stringify({
            type: "userStood"
        }));

        // Limpiar el estado de sentado
        this.sittingOn = null;
        this.previousPosition = null;
        this.previousRotation = null;
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();
        const currentTime = Date.now();

        // Actualizar todas las animaciones de los usuarios
        this.users.forEach(user => {
            if (user.animations && user.animations.mixer) {
                user.animations.mixer.update(delta);

                // Solo procesar animaciones para otros usuarios (no el local)
                if (user !== this.users.get('local')) {
                    // Si no hemos recibido actualización en 100ms, consideramos que está quieto
                    const timeSinceLastUpdate = currentTime - (user.lastUpdateTime || 0);
                    const isMoving = timeSinceLastUpdate < 100;

                    if (isMoving && user.animations.walk) {
                        this.fadeToAction(user, user.animations.walk);
                    } else if (!isMoving && user.animations.idle) {
                        this.fadeToAction(user, user.animations.idle);
                    }
                }
            }
        });

        const localUser = this.users.get('local');
        if (localUser) {
            // Actualizar animaciones basadas en el estado
            if (localUser.animations && localUser.animations.mixer) {
                const isMoving = this.isMoving;
                const isJumping = this.isJumping;

                if (isJumping && localUser.animations.jump) {
                    this.fadeToAction(localUser, localUser.animations.jump);
                } else if (isMoving && localUser.animations.walk) {
                    this.fadeToAction(localUser, localUser.animations.walk);
                } else if (!isMoving && !isJumping && localUser.animations.idle) {
                    this.fadeToAction(localUser, localUser.animations.idle);
                }
            }

            this.users.forEach(user => {
                if (user !== localUser) {
                    if (user.nameSprite) {
                        user.nameSprite.lookAt(this.camera.position);
                    }
                    if (user.emojiSprite) {
                        user.emojiSprite.lookAt(this.camera.position);
                    }
                }
            });
        }

        this.moveLocalUser();
        this.renderer.render(this.scene, this.camera);
    }

    fadeToAction(user, newAction, duration = 0.2) {
        if (!user.animations || !newAction) return;
        if (user.animations.currentAction === newAction) return;

        const current = user.animations.currentAction;
        if (current) {
            current.fadeOut(duration);
        }

        newAction.reset()
            .setEffectiveTimeScale(1)
            .setEffectiveWeight(1)
            .fadeIn(duration)
            .play();

        user.animations.currentAction = newAction;
    }

    loadImageToPainting(paintingId, imageUrl) {
        const painting = this.paintings.get(paintingId);
        if (!painting) return;

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const { canvas, context, texture } = painting;
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(img, 0, 0, canvas.width, canvas.height);
            texture.needsUpdate = true;
        };
        img.src = imageUrl;
    }

    getPaintingsInfo() {
        const info = [];
        this.paintings.forEach((painting, id) => {
            const worldPos = new THREE.Vector3();
            painting.group.getWorldPosition(worldPos);
            info.push({
                id: id,
                position: worldPos,
                rotation: painting.group.rotation.y,
            });
        });
        return info;
    }

    updateUserName(userId, username) {
        const user = this.users.get(userId);
        if (!user) {
            console.warn('Usuario no encontrado:', userId);
            return;
        }

        user.username = username;

        // No mostrar nombre sobre nuestro propio personaje
        if (userId === 'local') {
            return;
        }

        const { nameContext, nameCanvas, nameTexture } = user;

        // Aumentar el tamaño del canvas para mejor resolución
        nameCanvas.width = 1024; // Duplicar el ancho
        nameCanvas.height = 256; // Duplicar el alto

        nameContext.clearRect(0, 0, nameCanvas.width, nameCanvas.height);

        const displayName = username || 'sin nombre';

        // Aumentar tamaño de fuente
        nameContext.font = "bold 96px Arial"; // Doblar el tamaño de la fuente
        nameContext.textAlign = "center";
        nameContext.textBaseline = "middle";

        // Mejorar la sombra para mayor legibilidad
        nameContext.shadowColor = 'rgba(0, 0, 0, 0.8)';
        nameContext.shadowBlur = 8;
        nameContext.shadowOffsetX = 4;
        nameContext.shadowOffsetY = 4;

        // Borde más grueso
        nameContext.strokeStyle = "#000000";
        nameContext.lineWidth = 12;
        nameContext.strokeText(displayName, nameCanvas.width / 2, nameCanvas.height / 2);

        // Texto principal con gradiente más visible
        const gradient = nameContext.createLinearGradient(
            0,
            nameCanvas.height / 2 - 30,
            0,
            nameCanvas.height / 2 + 30
        );
        gradient.addColorStop(0, '#FFFFFF');
        gradient.addColorStop(1, '#DDDDDD');

        nameContext.fillStyle = gradient;
        nameContext.fillText(displayName, nameCanvas.width / 2, nameCanvas.height / 2);

        // Quitar sombra
        nameContext.shadowColor = 'transparent';

        nameTexture.needsUpdate = true; // Asegurarnos de que la textura se actualice
        user.nameSprite.material.opacity = 1; // Asegurarnos de que el sprite sea visible
        user.nameSprite.visible = true; // Asegurarnos de que el sprite esté visible
    }

    showEmoji(userId, emoji) {
        const user = this.users.get(userId);
        if (!user) return;

        const { emojiContext, emojiCanvas, emojiTexture, emojiSprite } = user;

        // Limpiar el canvas
        emojiContext.clearRect(0, 0, emojiCanvas.width, emojiCanvas.height);

        // Dibujar el emoji con sombra para mejor visibilidad
        emojiContext.save();
        emojiContext.shadowColor = 'rgba(0, 0, 0, 0.5)';
        emojiContext.shadowBlur = 4;
        emojiContext.shadowOffsetX = 2;
        emojiContext.shadowOffsetY = 2;
        emojiContext.font = 'bold 180px Arial'; // Emoji más grande
        emojiContext.textAlign = 'center';
        emojiContext.textBaseline = 'middle';
        emojiContext.fillStyle = '#FFFFFF'; // Color blanco para mejor contraste
        emojiContext.fillText(emoji, emojiCanvas.width / 2, emojiCanvas.height / 2);
        emojiContext.restore();

        emojiTexture.needsUpdate = true;
        emojiSprite.material.opacity = 1;

        // Hacer el sprite más grande para mejor visibilidad
        emojiSprite.scale.set(1.2, 1.2, 1);

        // Posicionar el emoji más alto sobre la cabeza
        emojiSprite.position.y = 2.0;

        // Animación mejorada
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;

            if (elapsed < this.EMOTE_DISPLAY_TIME) {
                // Animación de flotación más pronunciada
                const float = Math.sin(elapsed * 0.004) * 0.15;
                emojiSprite.position.y = 2.0 + float;

                // Rotación suave
                emojiSprite.rotation.z = Math.sin(elapsed * 0.002) * 0.15;

                // Escala pulsante sutil
                const scale = 1.2 + Math.sin(elapsed * 0.006) * 0.1;
                emojiSprite.scale.set(scale, scale, 1);

                requestAnimationFrame(animate);
            } else {
                // Desvanecer más lentamente
                const fadeStart = Date.now();
                const fadeDuration = 800; // 800ms para desvanecer
                const fade = () => {
                    const fadeElapsed = Date.now() - fadeStart;
                    const opacity = 1 - (fadeElapsed / fadeDuration);

                    if (opacity > 0) {
                        emojiSprite.material.opacity = opacity;
                        // Flotar hacia arriba mientras desaparece
                        emojiSprite.position.y = 2.0 + ((fadeElapsed / fadeDuration) * 0.5);
                        requestAnimationFrame(fade);
                    } else {
                        emojiSprite.material.opacity = 0;
                        emojiSprite.position.y = 2.0;
                    }
                };
                fade();
            }
        };
        animate();
    }

    showMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 20%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: rgba(0, 0, 0, 0.9);
            padding: 15px 30px;
            border-radius: 10px;
            color: white;
            font-family: Arial, sans-serif;
            text-align: center;
            z-index: 2001;
            animation: fadeOut 2s forwards;
        `;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeOut {
                0% { opacity: 1; }
                70% { opacity: 1; }
                100% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);

        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.remove();
            style.remove();
        }, 2000);
    }

    addLocalizedMusic() {
        this.radio = this.createRadio();
    }

    createRadio() {
        const radioGroup = new THREE.Group();

        // Cuerpo principal de la radio - Cambiar color a uno más distintivo
        const bodyGeometry = new THREE.BoxGeometry(1, 0.5, 0.4); // Aumentar tamaño
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x964B00, // Marrón más oscuro
            roughness: 0.7,
            metalness: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        radioGroup.add(body);

        // Panel frontal - Ajustar tamaño proporcionalmente
        const panelGeometry = new THREE.BoxGeometry(0.95, 0.45, 0.01);
        const panelMaterial = new THREE.MeshStandardMaterial({
            color: 0x2F4F4F,
            roughness: 0.5,
            metalness: 0.5
        });
        const panel = new THREE.Mesh(panelGeometry, panelMaterial);
        panel.position.z = 0.2;
        radioGroup.add(panel);

        // Altavoz (rejilla) - Ajustar posición
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

        // Perilla de volumen - Ajustar posición
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

        // Posicionar la radio - Bajar la posición
        radioGroup.position.set(-5, 1.5, -3); // Cambiar Y de 1.7 a 1.5

        // Añadir propiedades para el control de audio e interactividad
        radioGroup.userData = {
            type: "radio",
            isPlaying: true,
            indicator: indicator,
            originalIndicatorColor: 0x32CD32,
            originalMaterial: bodyMaterial,
            highlightMaterial: new THREE.MeshStandardMaterial({
                color: 0xB87333, // Color cobre para el highlight
                roughness: 0.7,
                metalness: 0.5,
                emissive: 0x331100,
                emissiveIntensity: 0.2
            })
        };

        // Configurar el audio
        const listener = new THREE.AudioListener();
        this.camera.add(listener);

        const sound = new THREE.PositionalAudio(listener);
        const audioLoader = new THREE.AudioLoader();
        audioLoader.load('assets/sound/ElFary_LaMandanga.mp3', (buffer) => {
            sound.setBuffer(buffer);
            sound.setLoop(true);
            sound.setVolume(0.5);
            sound.play();
        });

        radioGroup.add(sound);
        radioGroup.userData.sound = sound;

        this.scene.add(radioGroup);
        return radioGroup;
    }

    setupModelSelector() {
        const options = document.querySelectorAll('.model-option');

        // Crear previsualización para cada modelo
        options.forEach(option => {
            const modelId = option.dataset.model;
            const previewContainer = option.querySelector('.model-preview');
            this.createModelPreview(modelId, previewContainer);

            option.addEventListener('click', () => {
                options.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                this.selectedModel = modelId;
            });
        });

        // Asegurarnos de que el primer modelo esté seleccionado por defecto
        this.selectedModel = options[0].dataset.model;
        options[0].classList.add('selected');
    }

    createModelPreview(modelId, container) {
        // Crear escena de previsualización
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

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
        loader.load(`/assets/models/${modelId}.glb`, (gltf) => {
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
        });

        // Posicionar cámara
        camera.position.set(0, 0, 3);
        camera.lookAt(0, 0, 0);

        // Animación de rotación
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
}

// Iniciar la aplicación
const app = new VirtualBar();

window.addEventListener("resize", () => {
    app.camera.aspect = window.innerWidth / window.innerHeight;
    app.camera.updateProjectionMatrix();
    app.renderer.setSize(window.innerWidth, window.innerHeight);
});


window.app = app;


function loadPaintings() {
    const paintingsInfo = app.getPaintingsInfo();

    paintingsInfo.forEach((painting, index) => {
        const imageUrl = `/paintings/imagen${index + 1}.jpg`;
        app.loadImageToPainting(painting.id, imageUrl);
    });
}

function roundRect(ctx, x, y, width, height, radius, strokeOnly = false) {
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
    if (!strokeOnly) {
        ctx.fill();
    }
    ctx.stroke();
}