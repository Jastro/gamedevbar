import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

class VirtualBar {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.users = new Map();
        this.moveSpeed = 0.1;
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

        // Usar URL relativa para WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.socket = new WebSocket(`${protocol}//${window.location.host}`);

        this.socket.addEventListener('open', () => {
            this.setupNetworking();
            this.init();
        });
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);

        // Configuración inicial de la cámara
        this.camera.position.set(0, 5, 10);

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
        this.setupEventListeners();
        this.animate();
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
                chatInput.blur();
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
        console.log("Adding user:", userId, position);
        if (this.users.has(userId)) {
            console.log("User already exists:", userId);
            return;
        }

        const pos = new THREE.Vector3(
            position[0] || position.x || 0,
            position[1] || position.y || 1,
            position[2] || position.z || 0
        );

        const user = this.createUser(userId, pos);
        this.users.set(userId, user);
        console.log("Users after adding:", Array.from(this.users.keys()));
    }

    setupNetworking() {
        this.socket.onopen = () => {
            console.log("Connected to server");
        };

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log("Received message:", data.type);

            switch (data.type) {
                case "init":
                    this.userId = data.userId;
                    console.log("Got user ID:", this.userId);
                    break;

                case "userJoined":
                    if (data.userId !== this.userId) {
                        this.addOtherUser(data.userId, data.position);
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

                case "userChat":
                    if (data.userId !== this.userId) {
                        this.updateUserChat(data.userId, data.message, data.isEmote);
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
            console.log('paintingPositions', pos.rotation, index);
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
        };
    }

    handleMouseMove(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(
            this.scene.children,
            true
        );

        // Restaurar highlight anterior
        if (this.highlightedObject) {
            this.highlightedObject.traverse((child) => {
                if (child.isMesh && child.userData.originalMaterial) {
                    child.material = child.userData.originalMaterial;
                }
            });
        }

        // Buscar el primer objeto seleccionable
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
        } else {
            this.highlightedObject = null;
        }
    }

    handleClick() {
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
    }

    sitOn(seat) {
        const user = this.users.get("local");
        if (!user) return;

        this.previousRotation = user.mesh.rotation.y;
        this.sittingOn = seat;
        const seatPosition = new THREE.Vector3();
        seat.getWorldPosition(seatPosition);

        user.mesh.position.copy(seatPosition);
        user.mesh.position.y += 0.9;

        const lookAtPoint = new THREE.Vector3(0, user.mesh.position.y, -3);
        user.mesh.lookAt(lookAtPoint);
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

    updateUserChat(id, message, isEmote = false) {
        const user = this.users.get(id);
        if (!user) return;

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

    moveLocalUser() {
        const user = this.users.get("local");
        if (!user || this.chatActive) return;

        if (this.sittingOn) {
            if (
                this.keysPressed["w"] ||
                this.keysPressed["s"] ||
                this.keysPressed["a"] ||
                this.keysPressed["d"]
            ) {
                this.sittingOn = null;
                user.mesh.rotation.y = this.previousRotation || 0;
                user.mesh.position.z += 0.5;

                // Notificar al servidor que el usuario se levantó
                this.socket.send(JSON.stringify({ type: "userStood" }));
            }
            return;
        }

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

        const bounds = {
            xMin: -14.5,
            xMax: 14.5,
            zMin: -9.5,
            zMax: 9.5,
        };

        const playerRadius = 0.4;

        const canMove =
            newPosition.x > bounds.xMin + playerRadius &&
            newPosition.x < bounds.xMax - playerRadius &&
            newPosition.z > bounds.zMin + playerRadius &&
            newPosition.z < bounds.zMax - playerRadius;

        if (canMove) {
            user.mesh.position.copy(newPosition);

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
                        rotation: user.mesh.rotation.y,
                    })
                );
            }
        }

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

}

// Iniciar la aplicación
const app = new VirtualBar();
setTimeout(loadPaintings, 1000);

// Manejar resize
window.addEventListener("resize", () => {
    app.camera.aspect = window.innerWidth / window.innerHeight;
    app.camera.updateProjectionMatrix();
    app.renderer.setSize(window.innerWidth, window.innerHeight);
});


// Exponer la app globalmente para debugging
window.app = app;


function loadPaintings() {
    // Primero obtén la lista de IDs de los cuadros
    const paintingsInfo = app.getPaintingsInfo();

    // Luego asigna las imágenes en orden
    paintingsInfo.forEach((painting, index) => {
        console.log(index);
        // Asumiendo que tus imágenes se llaman imagen1.jpg, imagen2.jpg, etc.
        const imageUrl = `/paintings/imagen${index + 1}.jpg`;
        console.log(imageUrl);
        app.loadImageToPainting(painting.id, imageUrl);
    });
}