import * as THREE from 'three';

export class ArcadePong {
    constructor(scene) {
        this.scene = scene;
        this.arcadeGroup = null;
        this.screen = null;
        this.game = null;
        this.canvas = null;
        this.context = null;
        this.currentPlayer = null;
        this.secondPlayer = null;
        this.isActive = false;
        this.gameState = 'title'; // title, onePlayer, twoPlayer, gameOver
        this.VICTORY_SCORE = 5; // Puntuación para ganar
        this.victoryTimeout = null;
        this.keysPressed = {};
        this.sounds = {};
        this.titleSoundTimeout = null;
        this.setupCanvas();
        this.setupControls();
        this.setupSounds();
    }

    create(position = { x: 7, y: 2, z: -8 }) {
        // Grupo principal del arcade
        this.arcadeGroup = new THREE.Group();

        // Crear el mueble del arcade
        const cabinetGeometry = new THREE.BoxGeometry(2, 4, 1.5);
        const cabinetMaterial = new THREE.MeshStandardMaterial({
            color: 0x2c3e50,
            roughness: 0.2,
            metalness: 0.8
        });
        const cabinet = new THREE.Mesh(cabinetGeometry, cabinetMaterial);

        // Pantalla del arcade
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

        // Añadir todo al grupo
        this.arcadeGroup.add(cabinet);
        this.arcadeGroup.add(this.screen);
        this.arcadeGroup.add(controlPanel);

        // Posicionar el arcade
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

        if (window.game?.world?.collisionManager) {
            window.game.world.collisionManager.addCollider(this.arcadeGroup);
        }

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
        if (window.game && window.game.camera) {
            window.game.camera.getCamera().add(listener);
        }

        const audioLoader = new THREE.AudioLoader();

        // Sonido de título (no en loop, lo manejaremos manualmente)
        this.sounds.title = new THREE.Audio(listener);
        audioLoader.load('/assets/sound/arcade/intro.mp3', (buffer) => {
            this.sounds.title.setBuffer(buffer);
            this.sounds.title.setLoop(false);
            this.sounds.title.setVolume(0.5);
        });

        // Sonido de golpe
        this.sounds.hit = new THREE.Audio(listener);
        audioLoader.load('/assets/sound/arcade/hit.wav', (buffer) => {
            this.sounds.hit.setBuffer(buffer);
            this.sounds.hit.setVolume(0.3);
        });

        // Sonido de punto
        this.sounds.point = new THREE.Audio(listener);
        audioLoader.load('/assets/sound/arcade/point.wav', (buffer) => {
            this.sounds.point.setBuffer(buffer);
            this.sounds.point.setVolume(0.4);
        });

        // Sonido de victoria
        this.sounds.victory = new THREE.Audio(listener);
        audioLoader.load('/assets/sound/arcade/gameover.mp3', (buffer) => {
            this.sounds.victory.setBuffer(buffer);
            this.sounds.victory.setVolume(0.5);
        });

        // Sonido de derrota
        this.sounds.gameOver = new THREE.Audio(listener);
        audioLoader.load('/assets/sound/arcade/gameover.mp3', (buffer) => {
            this.sounds.gameOver.setBuffer(buffer);
            this.sounds.gameOver.setVolume(0.5);
        });
    }

    playTitleSound() {
        if (this.sounds.title && !this.sounds.title.isPlaying && this.gameState === 'title') {
            this.sounds.title.play();
            this.titleSoundTimeout = setTimeout(() => this.playTitleSound(), 30000);
        }
    }

    isPlayingGame(playerId) {
        return (this.isActive &&
            ((this.currentPlayer && this.currentPlayer.id === playerId) ||
                (this.secondPlayer && this.secondPlayer.id === playerId)));
    }

    checkVictory() {
        if (this.game.paddle1.score >= this.VICTORY_SCORE ||
            this.game.paddle2.score >= this.VICTORY_SCORE) {

            const winner = this.game.paddle1.score >= this.VICTORY_SCORE ?
                this.currentPlayer : this.secondPlayer;

            this.showVictoryScreen(winner);

            // Reiniciar después de 5 segundos
            this.victoryTimeout = setTimeout(() => {
                this.resetGame();
            }, 5000);
        }
    }

    resetGame() {
        if (this.victoryTimeout) {
            clearTimeout(this.victoryTimeout);
            this.victoryTimeout = null;
        }

        this.initGame();
        this.gameState = 'title';
        this.currentPlayer = null;
        this.secondPlayer = null;
        this.isActive = false;

        this.syncGameState();
    }

    showVictoryScreen(winner) {
        const ctx = this.context;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Efecto de destello
        const time = Date.now();
        const hue = (time % 1000) / 1000 * 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;

        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('¡FIN DEL JUEGO!', this.canvas.width / 2, this.canvas.height / 2 - 40);

        if (this.sounds.gameOver && !this.sounds.gameOver.isPlaying) {
            this.sounds.gameOver.play();
        }

        // En modo un jugador
        if (this.gameState === 'onePlayer') {
            ctx.font = '32px Arial';
            ctx.fillText(
                this.game.paddle1.score >= this.VICTORY_SCORE ? '¡Has ganado!' : '¡Ha ganado la CPU!',
                this.canvas.width / 2,
                this.canvas.height / 2 + 20
            );
        }

        this.updateScreenTexture();
    }

    checkPlayerProximity(playerPosition) {
        const maxDistance = 3; // Distancia máxima para interactuar
        const arcadePosition = this.arcadeGroup.position;

        const distance = new THREE.Vector3(
            playerPosition.x - arcadePosition.x,
            0, // Ignoramos altura
            playerPosition.z - arcadePosition.z
        ).length();

        return distance <= maxDistance;
    }

    initGame() {
        this.game = {
            paddle1: { y: 256, score: 0 },
            paddle2: { y: 256, score: 0 },
            ball: {
                x: 256,
                y: 256,
                dx: 5,
                dy: 5,
                speed: 5
            },
            paddleHeight: 80,
            paddleWidth: 20,
        };
        this.drawTitleScreen();
    }

    drawTitleScreen() {
        const ctx = this.context;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('PONG', this.canvas.width / 2, 200);

        ctx.font = '24px Arial';
        ctx.fillText('Acércate y haz clic para jugar', this.canvas.width / 2, 300);
        ctx.fillText('Controles: W/S o ↑/↓', this.canvas.width / 2, 350);

        this.updateScreenTexture();

        this.playTitleSound();
    }

    updateScreenTexture() {
        if (this.screen && this.screen.material.map) {
            this.screen.material.map.needsUpdate = true;
        }
    }

    updateTitleScreen() {
        const ctx = this.context;
        const currentTime = Date.now();

        // Limpiar pantalla
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Color parpadeante para el título
        const hue = (currentTime % 3000) / 3000 * 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;

        // Título con efecto de escala
        const scale = 1 + Math.sin(currentTime / 500) * 0.1;
        ctx.font = `bold ${48 * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText('PONG', this.canvas.width / 2, 200);

        // Texto de instrucciones parpadeante
        const alpha = Math.sin(currentTime / 400) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.font = '24px Arial';
        ctx.fillText('Acércate y haz clic para jugar', this.canvas.width / 2, 300);
        ctx.fillText('Controles: W/S o ↑/↓', this.canvas.width / 2, 350);

        this.updateScreenTexture();
    }


    animate() {
        if (this.gameState === 'title') {
            this.updateTitleScreen();
        } else if (this.isActive) {
            this.update();
        }
        requestAnimationFrame(() => this.animate());
    }

    update() {
        if (this.gameState === 'gameOver') {
            this.showVictoryScreen(this.game.paddle1.score >= this.VICTORY_SCORE ? this.currentPlayer : this.secondPlayer);
            return;
        }

        // Actualizar controles antes de la lógica del juego
        this.updateControls();

        // Actualizar lógica del juego
        this.updateGameLogic();

        // Verificar victoria después de actualizar
        this.checkVictory();

        // Dibujar estado actual
        this.draw();
    }

    updateGameLogic() {
        const game = this.game;

        if (this.gameState === 'gameOver') return;

        // Actualizar posición de la bola
        game.ball.x += game.ball.dx;
        game.ball.y += game.ball.dy;

        // Colisiones con paredes superior e inferior
        if (game.ball.y <= 0 || game.ball.y >= this.canvas.height) {
            game.ball.dy *= -1;
        }

        // Colisiones con palas
        if (this.checkPaddleCollision()) {
            game.ball.dx *= -1.1;
            game.ball.speed *= 1.1;
        }

        // Puntuación
        if (game.ball.x <= 0) {
            if (this.sounds.point && !this.sounds.point.isPlaying) {
                this.sounds.point.play();
            }
            game.paddle2.score++;
            if (game.paddle2.score >= this.VICTORY_SCORE) {
                this.gameState = 'gameOver';
            } else {
                this.resetBall('paddle2');
            }
        } else if (game.ball.x >= this.canvas.width) {
            if (this.sounds.point && !this.sounds.point.isPlaying) {
                this.sounds.point.play();
            }
            game.paddle1.score++;
            if (game.paddle1.score >= this.VICTORY_SCORE) {
                this.gameState = 'gameOver';
            } else {
                this.resetBall('paddle1');
            }
        }

        // IA para modo un jugador
        if (this.gameState === 'onePlayer') {
            this.updateAI();
        }
    }

    checkPaddleCollision() {
        const game = this.game;
        // Colisión con pala izquierda
        if (game.ball.x <= game.paddleWidth &&
            game.ball.y >= game.paddle1.y - game.paddleHeight / 2 &&
            game.ball.y <= game.paddle1.y + game.paddleHeight / 2) {
            if (this.sounds.hit && !this.sounds.hit.isPlaying) {
                this.sounds.hit.play();
            }
            return true;
        }
        // Colisión con pala derecha
        if (game.ball.x >= this.canvas.width - game.paddleWidth &&
            game.ball.y >= game.paddle2.y - game.paddleHeight / 2 &&
            game.ball.y <= game.paddle2.y + game.paddleHeight / 2) {
            if (this.sounds.hit && !this.sounds.hit.isPlaying) {
                this.sounds.hit.play();
            }
            return true;
        }
        return false;
    }

    setupControls() {
        // Limpiar listeners anteriores si existen
        if (this.keyDownHandler) {
            document.removeEventListener('keydown', this.keyDownHandler);
            document.removeEventListener('keyup', this.keyUpHandler);
        }

        this.keyDownHandler = (e) => {
            this.keysPressed[e.code] = true;
        };

        this.keyUpHandler = (e) => {
            this.keysPressed[e.code] = false;
        };

        document.addEventListener('keydown', this.keyDownHandler);
        document.addEventListener('keyup', this.keyUpHandler);
    }

    updateControls() {
        if (!this.isActive) return;

        const isPlayer1 = this.currentPlayer && this.currentPlayer.id === window.game.players.localPlayer.id;
        const isPlayer2 = this.secondPlayer && this.secondPlayer.id === window.game.players.localPlayer.id;

        if (!isPlayer1 && !isPlayer2) return;

        const paddle = isPlayer1 ? this.game.paddle1 : this.game.paddle2;
        const paddleSpeed = 10;

        // Mover la pala basado en las teclas presionadas
        if (this.keysPressed['KeyW'] || this.keysPressed['ArrowUp']) {
            paddle.y = Math.max(paddle.y - paddleSpeed, this.game.paddleHeight / 2);
            this.syncGameState();
        }
        if (this.keysPressed['KeyS'] || this.keysPressed['ArrowDown']) {
            paddle.y = Math.min(paddle.y + paddleSpeed, this.canvas.height - this.game.paddleHeight / 2);
            this.syncGameState();
        }
    }

    // Método para sincronizar el estado del juego
    syncGameState() {
        if (window.game?.network) {
            const state = {
                type: 'arcadeState',
                gameState: this.gameState,
                data: {
                    paddle1: this.game.paddle1,
                    paddle2: this.game.paddle2,
                    ball: this.game.ball,
                    currentPlayer: this.currentPlayer?.id,
                    secondPlayer: this.secondPlayer?.id
                }
            };
            window.game.network.send('arcadeState', state);
        }
    }

    // Método para recibir actualizaciones
    updateGameState(state) {
        // Actualizar estado del juego
        if (state.data) {
            this.gameState = state.gameState;
            this.game.paddle1 = state.data.paddle1;
            this.game.paddle2 = state.data.paddle2;
            this.game.ball = state.data.ball;

            // Actualizar referencias de jugadores
            if (state.data.currentPlayer) {
                this.currentPlayer = { id: state.data.currentPlayer };
            }
            if (state.data.secondPlayer) {
                this.secondPlayer = { id: state.data.secondPlayer };
            }

            // Activar el juego si no estaba activo
            if (!this.isActive && this.gameState !== 'title') {
                this.isActive = true;
            }
        }
    }

    updateAI() {
        const game = this.game;
        const targetY = game.ball.y;
        const currentY = game.paddle2.y;
        const diff = targetY - currentY;
        const speed = 5;

        if (Math.abs(diff) > speed) {
            game.paddle2.y += diff > 0 ? speed : -speed;
        }
    }

    resetBall(scorer) {
        const game = this.game;
        game.ball.x = this.canvas.width / 2;
        game.ball.y = this.canvas.height / 2;
        game.ball.speed = 5;
        game.ball.dx = scorer === 'paddle1' ? 5 : -5;
        game.ball.dy = (Math.random() * 10 - 5);
    }

    draw() {
        const ctx = this.context;
        const game = this.game;

        // Limpiar canvas
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Dibujar línea central
        ctx.strokeStyle = 'white';
        ctx.setLineDash([20, 15]);
        ctx.beginPath();
        ctx.moveTo(this.canvas.width / 2, 0);
        ctx.lineTo(this.canvas.width / 2, this.canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Dibujar puntuación
        ctx.fillStyle = 'white';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(game.paddle1.score.toString(), this.canvas.width / 4, 60);
        ctx.fillText(game.paddle2.score.toString(), (this.canvas.width * 3) / 4, 60);

        // Dibujar palas
        ctx.fillRect(0, game.paddle1.y - game.paddleHeight / 2, game.paddleWidth, game.paddleHeight);
        ctx.fillRect(
            this.canvas.width - game.paddleWidth,
            game.paddle2.y - game.paddleHeight / 2,
            game.paddleWidth,
            game.paddleHeight
        );

        // Dibujar bola
        ctx.beginPath();
        ctx.arc(game.ball.x, game.ball.y, 10, 0, Math.PI * 2);
        ctx.fill();

        this.updateScreenTexture();
    }

    startOnePlayerGame(player) {
        // Limpiar el timeout del sonido del título
        if (this.titleSoundTimeout) {
            clearTimeout(this.titleSoundTimeout);
            this.titleSoundTimeout = null;
        }
        // Detener el sonido del título si está sonando
        if (this.sounds.title && this.sounds.title.isPlaying) {
            this.sounds.title.stop();
        }
        this.currentPlayer = player;
        this.gameState = 'onePlayer';
        this.isActive = true;
        this.setupControls();
        this.initGame();
        this.syncGameState(); // Sincronizar estado inicial
    }

    startTwoPlayerGame(player2) {
        this.secondPlayer = player2;
        this.gameState = 'twoPlayer';
        this.setupControls();
        this.initGame();
        this.syncGameState(); // Sincronizar estado inicial
    }

    cleanup() {
        Object.values(this.sounds).forEach(sound => {
            if (sound.isPlaying) {
                sound.stop();
            }
        });

        if (this.arcadeGroup && this.arcadeGroup.parent) {
            this.arcadeGroup.parent.remove(this.arcadeGroup);
        }
    }
}