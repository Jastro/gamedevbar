import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

class VirtualBar {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.users = new Map();
        this.moveSpeed = 0.05;
		this.jumpSpeed = 0.18; // Initial upward speed
		this.gravity = -0.005; // Gravity force
		this.isJumping = false; // Is the player currently jumping
		this.verticalSpeed = 0; // Current vertical speed
		this.groundHeight = 1; // Height of the ground level
        this.keysPressed = {};
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.highlightedObject = null;
        this.lastChatTime = 0;
        this.chatTimeout = null;
        this.sittingOn = null;
        this.seats = new Map();
        this.chatActive = false;
        this.paintings = new Map();
        this.userId = null;
        this.lastSentPosition = undefined;
        this.lastSentRotation = undefined;
        this.username = null;
        this.socket = null;

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
            spinning: false
        };

        this.setupUsernameDialog();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // Configuración inicial de la cámara
        this.camera.position.set(0, 5, 10);

		// Radio del bar
		this.addLocalizedMusic();

        // Iluminación
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 10);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);

        this.createWalls();
        this.createBar();
        this.createFurniture();
        this.createBathroom();
        this.setupEventListeners();
        this.animate();
    }

    initializeGame() {
        // Inicializar Three.js
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );

        this.renderer = new THREE.WebGLRenderer({ antialias: true });


        
        // Inicializar WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = protocol === 'ws:' ? `${protocol}//${window.location.hostname}:3000`: `${protocol}//${window.location.hostname}`;
        this.socket = new WebSocket(url);

        this.socket.addEventListener('open', () => {
            this.setupNetworking();
            this.init();
            setTimeout(loadPaintings, 500)
        });
    }

    setupUsernameDialog() {
        const dialog = document.getElementById('username-dialog');
        const usernameInput = document.getElementById('username-input');
        const startButton = document.getElementById('start-button');
        const chatInput = document.getElementById('chat-input');
        const chatBox = document.getElementById('chat-box');

        startButton.addEventListener('click', () => {
            const username = usernameInput.value.trim();
            if (username) {
                this.username = username;
                dialog.classList.add('hidden');
                chatInput.classList.remove('hidden');
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
        if (user) {
            // Eliminar el modelo 3D de la escena
            this.scene.remove(user.mesh);

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
            this.createUser("local", new THREE.Vector3(0, 1, 0))
        );
    }

    updateOtherUser(userId, position, rotation) {
        const user = this.users.get(userId);
        if (user) {
            user.mesh.position.set(position[0], position[1], position[2]);
            user.mesh.rotation.y = rotation;
        }
    }

    addOtherUser(userId, position) {
        if (this.users.has(userId)) {
            return this.users.get(userId);
        }

        const pos = new THREE.Vector3(
            position[0] || position.x || 0,
            position[1] || position.y || 1,
            position[2] || position.z || 0
        );

        const user = this.createUser(userId, pos);
        this.users.set(userId, user);
        return user;  // Devolver el usuario creado
    }

    setupNetworking() {
        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case "init":
                    this.userId = data.userId;

                    this.socket.send(JSON.stringify({
                        type: 'initCompleted',
                        username: this.username
                    }));

                    break;

                case "userJoined":
                    if (data.userId !== this.userId) {
                        const user = this.addOtherUser(data.userId, data.position);
                        if (data.username) {
                            user.username = data.username;
                        }
                    }
                    break;
                case "userUsername":
                    const userToUpdate = this.users.get(data.userId);
                    if (userToUpdate) {
                        userToUpdate.username = data.username;
                    }
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
                        // Mostrar ventana de confirmación
                        if (confirm(`${data.challengerName} te ha retado a un duelo! ¿Aceptas?`)) {
                            this.socket.send(JSON.stringify({
                                type: "duelAccepted",
                                challengerId: data.challengerId
                            }));
                        } else {
                            this.socket.send(JSON.stringify({
                                type: "duelRejected",
                                challengerId: data.challengerId
                            }));
                        }
                    }
                    break;

                case "duelAccepted":
                    if (data.challengerId === this.userId) {
                        this.startDuel(data.targetId);
                    }
                    break;

                case "duelRejected":
                    if (data.challengerId === this.userId) {
                        alert("Tu reto ha sido rechazado!");
                    }
                    break;

                case "duelChoice":
                    if (this.duelState.isInDuel) {
                        this.processDuelChoice(data.choice, data.playerId);
                    }
                    break;
                case "userChat":
                    if (data.userId !== this.userId) {
                        this.updateUserChat(data.userId, data.message, data.isEmote, data.username);
                    }
                    break;

                case "error":
                    console.error("Server error:", data.message);
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

        /*const doorGroup = new THREE.Group();
        doorGroup.position.set(11, 0, -6); // Posición base del grupo

        // Crear puerta
        const doorGeometry = new THREE.BoxGeometry(1.4, 2.5, 0.1);
        const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(2, 1.25, 2); // Mover la mitad del ancho en X para que gire desde el borde
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
        this.scene.add(doorGroup);*/

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
        textMesh.position.set(0, 1.5, -2.13);
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
        const createBottle = (x, y, z, color) => {
            const bottleGroup = new THREE.Group();

            const bodyGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8);
            const bodyMaterial = new THREE.MeshStandardMaterial({
                color: color,
                transparent: true,
                opacity: 0.8,
            });
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);

            const neckGeometry = new THREE.CylinderGeometry(0.05, 0.1, 0.2, 8);
            const neck = new THREE.Mesh(neckGeometry, bodyMaterial);
            neck.position.y = 0.4;

            bottleGroup.add(body);
            bottleGroup.add(neck);
            bottleGroup.position.set(x, y, z);
            this.scene.add(bottleGroup);
        };

        const createGlass = (x, y, z) => {
            const glassGeometry = new THREE.CylinderGeometry(0.1, 0.07, 0.2, 8);
            const glassMaterial = new THREE.MeshStandardMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.4,
            });
            const glass = new THREE.Mesh(glassGeometry, glassMaterial);
            glass.position.set(x, y, z);
            this.scene.add(glass);
        };

        const colors = [0x4caf50, 0x2196f3, 0xf44336, 0xffeb3b];

        for (let i = -5; i <= 5; i += 1) {
            createBottle(
                i,
                1.8,
                -6.7,
                colors[Math.floor(Math.random() * colors.length)]
            );
            createBottle(
                i * 0.8,
                2.3,
                -6.7,
                colors[Math.floor(Math.random() * colors.length)]
            );
        }

        for (let i = -5; i <= 5; i += 1) {
            createGlass(i * 0.8, 1.4, -2.5);
        }
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

    createUser(id, position) {
        const group = new THREE.Group();

        const bodyGeometry = new THREE.CapsuleGeometry(0.3, 0.8, 4, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: Math.random() * 0xffffff,
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        group.add(body);

        const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
        const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffd700 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 0.65;
        group.add(head);

        const eyeGeometry = new THREE.CircleGeometry(0.08, 32);
        const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.1, 0.7, 0.24);
        group.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.1, 0.7, 0.24);
        group.add(rightEye);

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.width = 256;
        canvas.height = 64;

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.y = 1.4; // Texto del chat bajado
        sprite.scale.set(2, 0.5, 1);
        group.add(sprite);
        group.rotation.y = Math.PI;
        group.position.copy(position);
        this.scene.add(group);

        return {
            mesh: group,
            sprite: sprite,
            canvas: canvas,
            context: context,
            texture: texture,
            username: id === 'local' ? this.username : null
        };
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
            }
        }

        // Limpiar el highlight actual
        this.highlightedObject = null;

        // Primero buscar usuarios
        const localUser = this.users.get('local');
        for (const intersect of intersects) {
            const userId = this.findUserByMesh(intersect.object);
            if (userId && userId !== 'local') {
                const targetUser = this.users.get(userId);
                const distance = localUser.mesh.position.distanceTo(targetUser.mesh.position);

                if (distance <= 2 && !this.duelState.isInDuel && !targetUser.isInDuel) {
                    this.highlightedObject = { type: 'user', userId: userId };
                    // Highlight del usuario
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
        }

        // Si no encontramos usuario, buscar asientos
        const selectable = intersects.find(
            (intersect) =>
                intersect.object.parent &&
                intersect.object.parent.userData &&
                intersect.object.parent.userData.type === "seat"
        );

        if (selectable) {
            this.highlightedObject = selectable.object.parent;
            this.highlightedObject.traverse((child) => {
                if (child.isMesh && child.userData.highlightMaterial) {
                    child.material = child.userData.highlightMaterial;
                }
            });
        }
    }

    findUserByMesh(mesh) {
        for (const [userId, user] of this.users.entries()) {
            if (user.mesh === mesh || user.mesh.children.includes(mesh)) {
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

        // Crear UI para el duelo
        const duelUI = document.createElement('div');
        duelUI.id = 'duel-ui';
        duelUI.style.position = 'fixed';
        duelUI.style.top = '50%';
        duelUI.style.left = '50%';
        duelUI.style.transform = 'translate(-50%, -50%)';
        duelUI.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        duelUI.style.padding = '20px';
        duelUI.style.borderRadius = '10px';
        duelUI.style.color = 'white';
        duelUI.innerHTML = `
            <div id="duel-countdown">¡Prepárate!</div>
            <div id="duel-choices" style="display: none">
                <button onclick="app.makeDuelChoice('piedra')">🪨 Piedra</button>
                <button onclick="app.makeDuelChoice('papel')">📄 Papel</button>
                <button onclick="app.makeDuelChoice('tijera')">✂️ Tijera</button>
            </div>
        `;
        document.body.appendChild(duelUI);

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
        this.duelState.myChoice = choice;
        this.socket.send(JSON.stringify({
            type: "duelChoice",
            choice: choice,
            playerId: this.userId
        }));
        document.getElementById('duel-choices').style.display = 'none';
        document.getElementById('duel-countdown').textContent = 'Esperando al oponente...';
    }

    processDuelChoice(choice, playerId) {
        if (playerId === this.duelState.opponent) {
            const opponentChoice = choice;
            const myChoice = this.duelState.myChoice;

            let result;
            if (myChoice === opponentChoice) {
                result = "¡Empate!";
            } else if (
                (myChoice === 'piedra' && opponentChoice === 'tijera') ||
                (myChoice === 'papel' && opponentChoice === 'piedra') ||
                (myChoice === 'tijera' && opponentChoice === 'papel')
            ) {
                result = "¡Has ganado!";
            } else {
                result = "¡Has perdido!";
            }

            document.getElementById('duel-countdown').textContent =
                `${result} (${myChoice} vs ${opponentChoice})`;

            // Terminar el duelo después de 2 segundos
            setTimeout(() => {
                document.getElementById('duel-ui').remove();
                this.duelState.isInDuel = false;
                this.duelState.opponent = null;
                this.duelState.myChoice = null;
            }, 2000);
        }
    }

    handleClick() {
        if (this.chatActive || this.duelState.isInDuel) return;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        // Buscar si hemos clickeado en otro jugador
        for (const intersect of intersects) {
            const userId = this.findUserByMesh(intersect.object);
            if (userId && userId !== 'local') {
                const targetUser = this.users.get(userId);
                const localUser = this.users.get('local');

                // Comprobar distancia
                const distance = localUser.mesh.position.distanceTo(targetUser.mesh.position);
                if (distance > 2) {
                    alert("¡Estás demasiado lejos para retar a este jugador!");
                    return;
                }

                // Comprobar si el jugador ya está en duelo
                if (targetUser.isInDuel) {
                    alert("¡Este jugador ya está en un duelo!");
                    return;
                }

                this.socket.send(JSON.stringify({
                    type: "duelRequest",
                    targetId: userId,
                    challengerName: this.username
                }));
                return;
            }
        }
        if (this.highlightedObject && !this.sittingOn) {
            this.sitOn(this.highlightedObject);

            // Enviar evento de sentarse al servidor
            this.socket.send(
                JSON.stringify({
                    type: "userSat",
                    seatId: this.highlightedObject.id
                })
            );
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
        if (!user) return;

        // Guardar estado anterior
        this.previousPosition = user.mesh.position.clone();
        this.previousRotation = user.mesh.rotation.y;

        this.sittingOn = seat;
        const seatPosition = new THREE.Vector3();
        seat.getWorldPosition(seatPosition);

        // Ajustar posición al sentarse
        user.mesh.position.copy(seatPosition);
        user.mesh.position.y += 1.1;

        // Calcular rotación hacia la barra
        const barPosition = new THREE.Vector3(0, user.mesh.position.y, -3);
        const direction = barPosition.sub(user.mesh.position).normalize();
        const angle = Math.atan2(direction.x, direction.z);
        user.mesh.rotation.y = angle;

        // Ajustar la cámara del tirón
		const offsetDistance = 3.3; // Distance behind the seat
		const offsetHeight = 2; // Height above the user
		const cameraOffset = new THREE.Vector3(Math.sin(angle + Math.PI) * offsetDistance, offsetHeight, Math.cos(angle + Math.PI) * offsetDistance);

		// Set camera position and focus
		this.camera.position.copy(seatPosition.clone().add(cameraOffset));
		this.camera.lookAt(user.mesh.position);
	}

    sitOtherUser(userId, seatId) {
        const user = this.users.get(userId);
        const seat = this.seats.get(seatId);
        if (!user || !seat) return;

        const seatPosition = new THREE.Vector3();
        seat.getWorldPosition(seatPosition);

        user.mesh.position.copy(seatPosition);
        user.mesh.position.y += 0.9;

        const lookAtPoint = new THREE.Vector3(0, user.mesh.position.y, -3);
        user.mesh.lookAt(lookAtPoint);
    }

    standOtherUser(userId) {
        const user = this.users.get(userId);
        if (!user) return;
        // Aquí podrías añadir animación de levantarse si lo deseas
    }

    updateUserChat(id, message, isEmote = false, username = null) {
        const user = this.users.get(id);

        if (user) {
            const { canvas, context, texture, sprite } = user;

            if (user.chatTimeout) {
                clearTimeout(user.chatTimeout);
            }

            context.clearRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = isEmote ? "#ff69b4" : "#ffffff";
            context.font = "24px Arial";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(message, canvas.width / 2, canvas.height / 2);

            texture.needsUpdate = true;

            user.chatTimeout = setTimeout(() => {
                context.clearRect(0, 0, canvas.width, canvas.height);
                texture.needsUpdate = true;
            }, 5000);
        }

        const chatBox = document.getElementById('chat-box');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${isEmote ? 'emote-message' : ''}`;

        const displayName = id === 'local' ? this.username : (username || user.username || 'borracho');

        if (isEmote) {
            messageDiv.textContent = `* ${displayName} ${message}`;
        } else {
            messageDiv.textContent = `${displayName}: ${message}`;
        }

        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        while (chatBox.children.length > 50) {
            chatBox.removeChild(chatBox.firstChild);
        }
    }

	moveLocalUser() {
		const user = this.users.get("local");
		if (!user || this.chatActive) return;

		if (this.keysPressed[" "]) { // Detect jump input
			if (!this.isJumping) {
				this.isJumping = true;
				this.verticalSpeed = this.jumpSpeed; // Apply upward speed
			}
		}

		// Apply gravity if jumping
		if (this.isJumping) {
			user.mesh.position.y += this.verticalSpeed;
			this.verticalSpeed += this.gravity; // Apply gravity

			// Check if the player has landed
			if (user.mesh.position.y <= this.groundHeight) {
				user.mesh.position.y = this.groundHeight; // Reset to ground level
				this.isJumping = false; // Reset jump state
				this.verticalSpeed = 0; // Reset vertical speed
			}
		}

		// Movement logic for standing users
		const moveDistance = this.moveSpeed;
		const rotation = user.mesh.rotation.y;
		const newPosition = new THREE.Vector3();
		newPosition.copy(user.mesh.position);

		if (this.keysPressed["w"]) {
			newPosition.x += Math.sin(rotation) * moveDistance;
			newPosition.z += Math.cos(rotation) * moveDistance;
		}
		if (this.keysPressed["s"]) {
			newPosition.x -= Math.sin(rotation) * moveDistance;
			newPosition.z -= Math.cos(rotation) * moveDistance;
		}
		if (this.keysPressed["a"]) {
			user.mesh.rotation.y += 0.03;
		}
		if (this.keysPressed["d"]) {
			user.mesh.rotation.y -= 0.03;
		}

		// Ensure movement stays within bounds
		const bounds = {
			xMin: -14.5,
			xMax: 14.5,
			zMin: -9.5,
			zMax: 9.5
		};

		const playerRadius = 0.4;

		if (
			newPosition.x > bounds.xMin + playerRadius &&
			newPosition.x < bounds.xMax - playerRadius &&
			newPosition.z > bounds.zMin + playerRadius &&
			newPosition.z < bounds.zMax - playerRadius
		) {
			user.mesh.position.x = newPosition.x;
			user.mesh.position.z = newPosition.z;
		}

		// Update the camera position
		const distance = 5;
		const height = distance * Math.sin(this.cameraRotation.vertical);
		const radius = distance * Math.cos(this.cameraRotation.vertical);

		const cameraOffset = new THREE.Vector3(
			radius * Math.sin(this.cameraRotation.horizontal),
			height,
			radius * Math.cos(this.cameraRotation.horizontal)
		);

		this.camera.position.copy(user.mesh.position).add(cameraOffset);
		this.camera.lookAt(user.mesh.position);

		// Notify the server of position changes
		if (
			this.lastSentPosition === undefined ||
			!this.lastSentPosition.equals(user.mesh.position) ||
			this.lastSentRotation !== user.mesh.rotation.y
		) {
			this.lastSentPosition = user.mesh.position.clone();
			this.lastSentRotation = user.mesh.rotation.y;

			this.socket.send(
				JSON.stringify({
					type: "userMoved",
					position: user.mesh.position.toArray(),
					rotation: user.mesh.rotation.y
				})
			);
		}
	}

    animate() {
        requestAnimationFrame(() => this.animate());
        this.moveLocalUser();
        this.renderer.render(this.scene, this.camera);
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

	addLocalizedMusic() {
		// Add an AudioListener to the camera
		const listener = new THREE.AudioListener();
		this.camera.add(listener);

		// Create a positional audio object
		const sound = new THREE.PositionalAudio(listener);

		// Load the .mp3 file
		const audioLoader = new THREE.AudioLoader();
		audioLoader.load('assets/sound/ElFary_LaMandanga.mp3', (buffer) => {
			sound.setBuffer(buffer);
			sound.setLoop(true); // Set to true if you want the music to loop
			sound.setVolume(0.5); // Adjust volume (0.0 to 1.0)
			sound.play();
		});

		// Attach the sound to an object in the scene
		const soundSource = new THREE.SphereGeometry(0.4, 18, 18); // Small visual sphere for the sound source
		const soundMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
		const soundMesh = new THREE.Mesh(soundSource, soundMaterial);
		soundMesh.position.set(-5, 1.7, -3); // Position the sound in the scene
		this.scene.add(soundMesh);

		// Attach the sound to the sound source
		soundMesh.add(sound);
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

