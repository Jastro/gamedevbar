import * as THREE from 'three';

export class ArcadeSnake {
    constructor(scene) {
        this.scene = scene;
        this.arcadeGroup = null;
        this.screen = null;
        this.canvas = null;
        this.context = null;
        this.gameState = 'title';
        this.currentPlayer = null;
        this.isActive = false;
        this.titleSoundTimeout = null;
        this.sounds = {};
        this.snakeSpeed = 7; // Velocidad configurable (frames por movimiento)
        this.frameCount = 0;

        // Estado del juego
        this.snake = [];
        this.food = null;
        this.direction = 'right';
        this.nextDirection = 'right';
        this.score = 0;
        this.highScores = []

        this.setupCanvas();
        this.setupControls();
        this.setupSounds();
    }

    updateHighScores(scores) {
        this.highScores = scores;
        if (this.gameState === 'title' || this.gameState === 'gameover') {
            this.drawTitleScreen(this.gameState === 'title');
        }
    }

    create(position = { x: 7, y: 2, z: -8 }) {
        this.arcadeGroup = new THREE.Group();

        // Mueble arcade
        const cabinetGeometry = new THREE.BoxGeometry(2, 4, 1.5);
        const cabinetMaterial = new THREE.MeshStandardMaterial({
            color: 0x2c3e50,
            roughness: 0.2,
            metalness: 0.8
        });
        const cabinet = new THREE.Mesh(cabinetGeometry, cabinetMaterial);

        // Pantalla
        const screenGeometry = new THREE.PlaneGeometry(1.8, 1.8);
        const screenTexture = new THREE.CanvasTexture(this.canvas);
        screenTexture.minFilter = THREE.LinearFilter;
        const screenMaterial = new THREE.MeshBasicMaterial({
            map: screenTexture,
            emissive: 0xffffff,
            emissiveMap: screenTexture
        });
        this.screen = new THREE.Mesh(screenGeometry, screenMaterial);
        this.screen.position.z = 0.76;
        this.screen.position.y = 0.5;

        // Panel de control
        const controlPanelGeometry = new THREE.BoxGeometry(1.8, 0.5, 0.8);
        const controlPanel = new THREE.Mesh(controlPanelGeometry, cabinetMaterial);
        controlPanel.position.y = -1;
        controlPanel.position.z = 0.3;
        controlPanel.rotation.x = -Math.PI / 6;

        this.arcadeGroup.add(cabinet);
        this.arcadeGroup.add(this.screen);
        this.arcadeGroup.add(controlPanel);

        this.arcadeGroup.position.set(position.x, position.y, position.z);
        this.arcadeGroup.userData = {
            type: "arcade",
            isInteractive: true,
            originalMaterial: cabinetMaterial,
            highlightMaterial: new THREE.MeshStandardMaterial({
                color: 0x7fff7f,
                emissive: 0x2f2f2f,
            })
        };

        this.scene.add(this.arcadeGroup);
        this.initGame();
        this.animate();
    }

    setupCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 512;
        this.canvas.height = 512;
        this.context = this.canvas.getContext('2d');
    }

    setupSounds() {
        const listener = new THREE.AudioListener();
        if (window.game?.camera) {
            window.game.camera.getCamera().add(listener);
        }

        const audioLoader = new THREE.AudioLoader();

        this.sounds.title = new THREE.Audio(listener);
        audioLoader.load('/assets/sound/arcade/intro.mp3', (buffer) => {
            this.sounds.title.setBuffer(buffer);
            this.sounds.title.setVolume(0.5);
        });

        this.sounds.eat = new THREE.Audio(listener);
        audioLoader.load('/assets/sound/arcade/point.wav', (buffer) => {
            this.sounds.eat.setBuffer(buffer);
            this.sounds.eat.setVolume(0.3);
        });

        this.sounds.die = new THREE.Audio(listener);
        audioLoader.load('/assets/sound/arcade/gameover.mp3', (buffer) => {
            this.sounds.die.setBuffer(buffer);
            this.sounds.die.setVolume(0.5);
        });
    }

    setupControls() {
        document.addEventListener('keydown', (e) => {
            if (!this.isActive) return;

            switch (e.key) {
                case 'ArrowUp':
                    if (this.direction !== 'down') this.nextDirection = 'up';
                    break;
                case 'ArrowDown':
                    if (this.direction !== 'up') this.nextDirection = 'down';
                    break;
                case 'ArrowLeft':
                    if (this.direction !== 'right') this.nextDirection = 'left';
                    break;
                case 'ArrowRight':
                    if (this.direction !== 'left') this.nextDirection = 'right';
                    break;
            }
        });
    }

    playTitleSound() {
        if (this.sounds.title && !this.sounds.title.isPlaying && this.gameState === 'title') {
            this.sounds.title.play();
            clearTimeout(this.titleSoundTimeout);
            this.titleSoundTimeout = setTimeout(() => this.playTitleSound(), 45000);
        }
    }

    initGame() {
        // Inicializar serpiente
        this.snake = [
            { x: 10, y: 10 },
            { x: 9, y: 10 },
            { x: 8, y: 10 }
        ];
        this.direction = 'right';
        this.nextDirection = 'right';
        this.score = 0;
        this.spawnFood();
        this.drawTitleScreen();
    }

    spawnFood() {
        const gridSize = 20;
        do {
            this.food = {
                x: Math.floor(Math.random() * gridSize),
                y: Math.floor(Math.random() * gridSize)
            };
        } while (this.snake.some(segment =>
            segment.x === this.food.x && segment.y === this.food.y));
    }

    drawTitleScreen(showHighScores = false) {
        const ctx = this.context;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (showHighScores) {
            ctx.fillStyle = 'lime';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('HIGH SCORES', this.canvas.width / 2, 80);

            ctx.font = '24px Arial';
            this.highScores.slice(0, 10).forEach((score, index) => {
                ctx.fillText(
                    `${index + 1}. ${score.name}: ${score.score}`,
                    this.canvas.width / 2,
                    140 + (index * 30)
                );
            });
        } else {
            ctx.fillStyle = 'lime';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('SNAKE', this.canvas.width / 2, 200);

            ctx.font = '24px Arial';
            ctx.fillText('Acércate y haz clic para jugar', this.canvas.width / 2, 300);
            ctx.fillText('Usa las flechas para moverte', this.canvas.width / 2, 350);

            if (this.highScores.length > 0) {
                ctx.fillText(
                    `Top: ${this.highScores[0].name} - ${this.highScores[0].score}`,
                    this.canvas.width / 2,
                    400
                );
            }
        }
        this.updateScreenTexture();
        this.playTitleSound();

        if (!showHighScores && this.gameState === 'title') {  // Añadir verificación de gameState
            this.titleScreenTimeout = setTimeout(() => {       // Guardar referencia al timeout
                this.drawTitleScreen(true);
                this.highScoreTimeout = setTimeout(() => {     // Guardar referencia al timeout
                    this.drawTitleScreen(false);
                }, 6000);
            }, 40000);
        }
    }

    drawGameOver() {
        const ctx = this.context;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = 'red';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', this.canvas.width / 2, 150);

        ctx.fillStyle = 'white';
        ctx.font = '32px Arial';
        ctx.fillText(`Puntuación: ${this.score}`, this.canvas.width / 2, 250);

        // Mostrar tabla de puntuaciones
        ctx.font = '24px Arial';
        ctx.fillText('High Scores:', this.canvas.width / 2, 320);
        this.highScores.slice(0, 5).forEach((score, index) => {
            ctx.fillText(
                `${score.name}: ${score.score}`,
                this.canvas.width / 2,
                360 + (index * 30)
            );
        });

        this.updateScreenTexture();
    }

    updateGame() {
        if (this.gameState !== 'playing') return;

        this.frameCount++;
        if (this.frameCount < this.snakeSpeed) return;
        this.frameCount = 0;

        // Actualizar dirección
        this.direction = this.nextDirection;

        // Calcular nueva posición de la cabeza
        const head = { ...this.snake[0] };
        switch (this.direction) {
            case 'up': head.y--; break;
            case 'down': head.y++; break;
            case 'left': head.x--; break;
            case 'right': head.x++; break;
        }

        // Wrap around
        const gridSize = 20;
        head.x = (head.x + gridSize) % gridSize;
        head.y = (head.y + gridSize) % gridSize;

        // Verificar colisión con la serpiente
        if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
            this.gameOver();
            return;
        }

        // Mover serpiente
        this.snake.unshift(head);

        // Verificar comida
        if (head.x === this.food.x && head.y === this.food.y) {
            this.score += 10;
            this.spawnFood();
            if (this.sounds.eat) this.sounds.eat.play();
        } else {
            this.snake.pop();
        }

        this.draw();
    }

    draw() {
        const ctx = this.context;
        const gridSize = 20;
        const cellSize = this.canvas.width / gridSize;

        // Limpiar canvas
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Dibujar serpiente
        ctx.fillStyle = 'lime';
        this.snake.forEach((segment, index) => {
            ctx.fillRect(
                segment.x * cellSize,
                segment.y * cellSize,
                cellSize - 1,
                cellSize - 1
            );
        });

        // Dibujar comida
        ctx.fillStyle = 'red';
        ctx.fillRect(
            this.food.x * cellSize,
            this.food.y * cellSize,
            cellSize - 1,
            cellSize - 1
        );

        // Dibujar puntuación
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`Score: ${this.score}`, 10, 30);

        this.updateScreenTexture();
    }

    updateScreenTexture() {
        if (this.screen && this.screen.material.map) {
            this.screen.material.map.needsUpdate = true;
        }
    }

    checkPlayerProximity(playerPosition) {
        const maxDistance = 3;
        const arcadePosition = this.arcadeGroup.position;
        const distance = new THREE.Vector3(
            playerPosition.x - arcadePosition.x,
            0,
            playerPosition.z - arcadePosition.z
        ).length();
        return distance <= maxDistance;
    }

    startGame() {
        this.gameState = 'playing';
        this.isActive = true;
        if (this.sounds.title) this.sounds.title.stop();
        if (this.titleSoundTimeout) clearTimeout(this.titleSoundTimeout);
        if (this.titleScreenTimeout) clearTimeout(this.titleScreenTimeout);  // Limpiar timeouts
        if (this.highScoreTimeout) clearTimeout(this.highScoreTimeout);     // Limpiar timeouts
        this.initGame();
    }
    gameOver() {
        this.gameState = 'gameover';
        if (this.sounds.die) this.sounds.die.play();
    
        // Enviar puntuación al servidor
        if (window.game?.network) {
            window.game.network.send('snakeHighScore', {
                username: window.game?.username || 'Player',
                score: this.score
            });
        }
    
        this.drawGameOver();
        
        setTimeout(() => {
            this.gameState = 'title';
            this.isActive = false;
            this.drawTitleScreen();
        }, 5000);
    }


    animate() {
        requestAnimationFrame(() => this.animate());
        this.updateGame();
    }

    cleanup() {
        Object.values(this.sounds).forEach(sound => {
            if (sound.isPlaying) sound.stop();
        });
        if (this.titleSoundTimeout) clearTimeout(this.titleSoundTimeout);
        if (this.arcadeGroup && this.arcadeGroup.parent) {
            this.arcadeGroup.parent.remove(this.arcadeGroup);
        }
    }
}