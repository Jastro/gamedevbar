import * as THREE from 'three';

export class Bathroom {
    constructor(scene) {
        this.scene = scene;
        this.audioListener = null;
        this.soundEffects = [];
    }

    create() {
        this.createStructure();
        this.createFixtures();
        this.setupAudio();
    }

    createStructure() {
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
        const width = 4;
        const height = 3;
        const depth = 4;

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

        // Paredes para la puerta
        this.createDoorFrame();

        // Techo
        const ceiling = new THREE.Mesh(
            new THREE.BoxGeometry(4.2, 0.2, 4),
            wallMaterial
        );
        ceiling.position.set(13, 2.9, -6);
        this.scene.add(ceiling);
    }

    createDoorFrame() {
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });

        const doorWall1 = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 3, 1.4),
            wallMaterial
        );
        doorWall1.position.set(11.7, 1.5, -4);
        doorWall1.rotation.y = Math.PI / 2;
        this.scene.add(doorWall1);

        const doorWall2 = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 3, 1.4),
            wallMaterial
        );
        doorWall2.position.set(14.3, 1.5, -4);
        doorWall2.rotation.y = Math.PI / 2;
        this.scene.add(doorWall2);

        this.createDoor();
    }

    createDoor() {
        const doorGroup = new THREE.Group();
        doorGroup.position.set(13.7, 0, -4);

        const doorGeometry = new THREE.BoxGeometry(1.4, 2.5, 0.1);
        const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(-0.7, 1.25, 0);
        doorGroup.add(door);

        // Señalización
        this.createDoorSign(doorGroup, door);

        doorGroup.userData = {
            type: "door",
            isOpen: false,
            originalRotation: 0,
            isAnimating: false
        };

        this.scene.add(doorGroup);
    }

    createDoorSign(doorGroup, door) {
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
    }

    createFixtures() {
        this.createToilet();
        this.createSink();
    }

    createToilet() {
        const toiletGroup = new THREE.Group();

        // Base
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.4, 0.6),
            new THREE.MeshStandardMaterial({ color: 0xE3F2FD })
        );
        base.position.y = 0.2;
        toiletGroup.add(base);

        // Asiento
        const seat = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.1, 0.5),
            new THREE.MeshStandardMaterial({ color: 0xBBDEFB })
        );
        seat.position.y = 0.45;
        toiletGroup.add(seat);

        // Tanque
        const tank = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.8, 0.3),
            new THREE.MeshStandardMaterial({ color: 0xE3F2FD })
        );
        tank.position.set(0, 0.6, -0.2);
        toiletGroup.add(tank);

        toiletGroup.position.set(13.5, 0, -7);
        toiletGroup.userData = {
            type: "seat",
            isBathroom: true,
            originalMaterial: seat.material,
            highlightMaterial: new THREE.MeshStandardMaterial({
                color: 0x7fff7f,
                emissive: 0x2f2f2f,
            }),
            forwardDirection: new THREE.Vector3(0, 0, -1),
        };

        this.scene.add(toiletGroup);
    }

    createSink() {
        const sinkGroup = new THREE.Group();

        // Base del lavamanos
        const base = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, 0.1, 0.4),
            new THREE.MeshStandardMaterial({ color: 0xECEFF1 })
        );
        base.position.y = 0.9;
        sinkGroup.add(base);

        // Cuenco
        const bowl = new THREE.Mesh(
            new THREE.CylinderGeometry(0.25, 0.2, 0.15, 16),
            new THREE.MeshStandardMaterial({ color: 0xFFFFFF })
        );
        bowl.position.y = 0.85;
        sinkGroup.add(bowl);

        sinkGroup.position.set(11.5, 0, -7.5);
        this.scene.add(sinkGroup);
    }

    setupAudio() {
        this.audioListener = new THREE.AudioListener();
        if (window.game && window.game.camera) {
            window.game.camera.getCamera().add(this.audioListener);
        }

        // Cargar efectos de sonido
        const audioLoader = new THREE.AudioLoader();
        for (let i = 1; i <= 4; i++) {
            const sound = new THREE.PositionalAudio(this.audioListener);
            sound.setRefDistance(5);
            sound.setRolloffFactor(2);
            sound.setDistanceModel('exponential');
            
            audioLoader.load(`assets/sound/cacota${i}.mp3`, (buffer) => {
                sound.setBuffer(buffer);
                sound.setVolume(0.5);
            });
            
            this.soundEffects.push(sound);
        }
    }

    cleanup() {
        this.soundEffects.forEach(sound => {
            if (sound.isPlaying) {
                sound.stop();
            }
        });
    }
}