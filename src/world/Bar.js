import * as THREE from 'three';

export class Bar {
    constructor(scene) {
        this.scene = scene;
        this.avatarCache = new Map(); // Cache for loaded avatar images
        this.createForumTV();
    }

    create() {
        this.createMainBar();
        this.createBackBar();
        this.createGlassesAndBottles();
    }

    createMainBar() {
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

        this.createBarSign();
    }

    createBarSign() {
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
        textMesh.position.set(0, 1.5, -2.14);
        this.scene.add(textMesh);
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

        // Estantes
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

    createGlassesAndBottles() {
        const bottleGroup = new THREE.Group();
        bottleGroup.name = 'BottlesAndGlasses';

        const colors = [0x4caf50, 0x2196f3, 0xf44336, 0xffeb3b];

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

        const bodyGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: 0.8,
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        bottleGroup.add(body);

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

    createForumTV() {
        // Create TV frame - make it more widescreen and bigger
        const tvFrameGeometry = new THREE.BoxGeometry(6.5, 4, 0.2);
        const tvFrameMaterial = new THREE.MeshStandardMaterial({
            color: 0x2f2f2f,
            roughness: 0.5,
            metalness: 0.7  // Increased metalness for better reflection
        });
        this.tvFrame = new THREE.Mesh(tvFrameGeometry, tvFrameMaterial);
        this.tvFrame.position.set(1.09, 3.8, 9.9);  // Lowered Y position from 5 to 3.8
        this.tvFrame.rotation.y = Math.PI;
        this.scene.add(this.tvFrame);

        // Create canvas with 16:9 aspect ratio
        this.forumCanvas = document.createElement('canvas');
        this.forumCanvas.width = 1600;
        this.forumCanvas.height = 900;
        this.forumContext = this.forumCanvas.getContext('2d');
        
        // Initialize scroll position
        this.scrollOffset = 0;
        this.isDragging = false;
        this.lastY = 0;
        this.maxScroll = 0;

        // Create screen with texture - slightly smaller than frame
        const tvScreenGeometry = new THREE.PlaneGeometry(6.3, 3.8);
        const texture = new THREE.CanvasTexture(this.forumCanvas);
        texture.needsUpdate = true;
        
        this.tvScreenMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.FrontSide
        });

        this.tvScreen = new THREE.Mesh(tvScreenGeometry, this.tvScreenMaterial);
        this.tvScreen.position.copy(this.tvFrame.position);
        this.tvScreen.position.z -= 0.11;
        this.tvScreen.rotation.copy(this.tvFrame.rotation);
        this.scene.add(this.tvScreen);

        // Setup interaction
        this.setupTVInteraction();

        // Start updating forum content
        this.updateForumContent();
        setInterval(() => this.updateForumContent(), 5000);
    }

    setupTVInteraction() {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let isDragging = false;
        let lastY = 0;

        // Mouse/Touch down
        const onPointerDown = (event) => {
            // Ignorar si el click es en un elemento de la UI
            if (event.target.closest('#username-dialog') || 
                event.target.closest('#chat-container') || 
                event.target.closest('#chat-box')) {
                return;
            }

            event.preventDefault();
            const clientX = event.clientX || (event.touches ? event.touches[0].clientX : 0);
            const clientY = event.clientY || (event.touches ? event.touches[0].clientY : 0);
            
            mouse.x = (clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(clientY / window.innerHeight) * 2 + 1;
            
            // Get camera from game instance
            const camera = window.game?.camera?.getCamera();
            if (!camera) return;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(this.tvScreen);
            
            if (intersects.length > 0) {
                isDragging = true;
                lastY = clientY;
                this.tvScreen.userData.isBeingDragged = true;
            }
        };

        // Mouse/Touch move
        const onPointerMove = (event) => {
            if (!isDragging) return;

            // Ignorar si el cursor está sobre un elemento de la UI
            if (event.target.closest('#username-dialog') || 
                event.target.closest('#chat-container') || 
                event.target.closest('#chat-box')) {
                return;
            }

            event.preventDefault();
            const clientY = event.clientY || (event.touches ? event.touches[0].clientY : lastY);
            const delta = (clientY - lastY) * 1;
            this.scrollOffset = Math.max(Math.min(this.scrollOffset + delta, 0), -this.maxScroll);
            lastY = clientY;
            
            this.renderContent();
        };

        // Mouse/Touch up
        const onPointerUp = (event) => {
            if (!isDragging) return;
            event.preventDefault();
            isDragging = false;
            if (this.tvScreen) {
                this.tvScreen.userData.isBeingDragged = false;
            }
        };

        // Mouse wheel scroll
        const onWheel = (event) => {
            // Ignorar si el cursor está sobre un elemento de la UI
            if (event.target.closest('#username-dialog') || 
                event.target.closest('#chat-container') || 
                event.target.closest('#chat-box')) {
                return;
            }

            // Check if mouse is over TV first
            const clientX = event.clientX;
            const clientY = event.clientY;
            mouse.x = (clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(clientY / window.innerHeight) * 2 + 1;
            
            const camera = window.game?.camera?.getCamera();
            if (!camera) return;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObject(this.tvScreen);
            
            if (intersects.length > 0) {
                event.preventDefault();
                const delta = event.deltaY * 0.5;
                this.scrollOffset = Math.max(Math.min(this.scrollOffset + delta, 0), -this.maxScroll);
                this.renderContent();
            }
        };

        // Add event listeners
        window.addEventListener('mousedown', onPointerDown, { passive: false });
        window.addEventListener('mousemove', onPointerMove, { passive: false });
        window.addEventListener('mouseup', onPointerUp, { passive: false });
        window.addEventListener('touchstart', onPointerDown, { passive: false });
        window.addEventListener('touchmove', onPointerMove, { passive: false });
        window.addEventListener('touchend', onPointerUp, { passive: false });
        window.addEventListener('wheel', onWheel, { passive: false });
    }

    renderContent() {
        if (!this.forumPostsData) return;

        // Clear canvas
        this.forumContext.fillStyle = '#1a1a1a';
        this.forumContext.fillRect(0, 0, this.forumCanvas.width, this.forumCanvas.height);
        
        // Draw header with MV orange gradient - improved gradient
        const headerGradient = this.forumContext.createLinearGradient(0, 0, 0, 90);
        headerGradient.addColorStop(0, '#ff7f40');  // Darker orange at top
        headerGradient.addColorStop(0.5, '#ff9644');  // Brighter orange in middle
        headerGradient.addColorStop(1, '#ff7f40');  // Darker orange at bottom
        this.forumContext.fillStyle = headerGradient;
        this.forumContext.fillRect(0, 0, this.forumCanvas.width, 90);
        
        // Add improved pattern to header
        this.forumContext.fillStyle = 'rgba(255, 255, 255, 0.15)';
        for (let i = 0; i < this.forumCanvas.width; i += 8) {
            this.forumContext.fillRect(i, 0, 4, 90);
        }
        
        // Draw header text with enhanced shadow
        this.forumContext.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.forumContext.shadowBlur = 8;
        this.forumContext.shadowOffsetX = 2;
        this.forumContext.shadowOffsetY = 2;
        this.forumContext.font = 'bold 74px Arial';
        this.forumContext.fillStyle = '#ffffff';
        this.forumContext.textAlign = 'center';
        this.forumContext.fillText('/gamedev/ Taberna', this.forumCanvas.width / 2, 60);
        this.forumContext.shadowColor = 'transparent';
        
        // Draw separator line with gradient
        const separatorGradient = this.forumContext.createLinearGradient(20, 0, this.forumCanvas.width - 20, 0);
        separatorGradient.addColorStop(0, '#ff964400');
        separatorGradient.addColorStop(0.1, '#ff9644');
        separatorGradient.addColorStop(0.9, '#ff9644');
        separatorGradient.addColorStop(1, '#ff964400');
        this.forumContext.strokeStyle = separatorGradient;
        this.forumContext.lineWidth = 3;
        this.forumContext.beginPath();
        this.forumContext.moveTo(20, 110);
        this.forumContext.lineTo(this.forumCanvas.width - 20, 110);
        this.forumContext.stroke();
        
        // Calculate total height for scrolling
        const postHeight = 200; // Increased height for better readability
        const totalHeight = this.forumPostsData.length * postHeight;
        this.maxScroll = Math.max(0, totalHeight - (this.forumCanvas.height - 120));
        
        // Draw posts with scroll offset
        let yOffset = 130 + this.scrollOffset;
        
        for (const post of this.forumPostsData) {
            // Skip if post is outside visible area
            if (yOffset + postHeight < 0 || yOffset > this.forumCanvas.height) {
                yOffset += postHeight;
                continue;
            }

            // Post background with enhanced gradient
            const postGradient = this.forumContext.createLinearGradient(10, yOffset, 10, yOffset + postHeight - 20);
            postGradient.addColorStop(0, '#2a2a2a');
            postGradient.addColorStop(0.5, '#333333');  // Added middle tone
            postGradient.addColorStop(1, '#2a2a2a');
            this.forumContext.fillStyle = postGradient;
            
            // Draw rounded rectangle for post with enhanced shadow
            this.forumContext.shadowColor = 'rgba(0, 0, 0, 0.3)';
            this.forumContext.shadowBlur = 12;
            this.forumContext.shadowOffsetX = 0;
            this.forumContext.shadowOffsetY = 4;
            this.forumContext.beginPath();
            this.forumContext.roundRect(15, yOffset, this.forumCanvas.width - 30, postHeight - 20, 20);  // Increased border radius
            this.forumContext.fill();
            this.forumContext.shadowColor = 'transparent';
            
            // Avatar circle with enhanced gradient
            const avatarGradient = this.forumContext.createRadialGradient(90, yOffset + 90, 35, 90, yOffset + 90, 50);
            avatarGradient.addColorStop(0, '#ff9644');
            avatarGradient.addColorStop(0.7, '#ff7f40');
            avatarGradient.addColorStop(1, '#ff6b2b');  // Added darker edge
            
            this.forumContext.fillStyle = avatarGradient;
            this.forumContext.beginPath();
            this.forumContext.arc(90, yOffset + 90, 45, 0, Math.PI * 2);
            this.forumContext.fill();
            
            // Avatar image
            this.forumContext.save();
            this.forumContext.beginPath();
            this.forumContext.arc(90, yOffset + 90, 42, 0, Math.PI * 2);
            this.forumContext.clip();
            
            if (post.avatar) {
                const avatarImg = this.avatarCache.get(post.avatar);
                if (avatarImg) {
                    this.forumContext.drawImage(avatarImg, 48, yOffset + 48, 84, 84);
                }
            }
            
            this.forumContext.restore();
            
            // Username with enhanced style
            this.forumContext.font = 'bold 42px Arial';
            this.forumContext.fillStyle = '#ff9644';
            this.forumContext.shadowColor = 'rgba(0, 0, 0, 0.3)';
            this.forumContext.shadowBlur = 4;
            this.forumContext.textAlign = 'left';
            this.forumContext.fillText(post.username, 160, yOffset + 50);
            this.forumContext.shadowColor = 'transparent';
            
            // Post number with subtle glow
            this.forumContext.font = '28px Arial';
            this.forumContext.fillStyle = '#888888';
            this.forumContext.shadowColor = '#ff964444';
            this.forumContext.shadowBlur = 2;
            this.forumContext.fillText(`#${post.postNum}`, this.forumCanvas.width - 100, yOffset + 50);
            this.forumContext.shadowColor = 'transparent';
            
            // Message with improved readability
            this.forumContext.font = '32px Arial';
            this.forumContext.fillStyle = '#ffffff';
            this.forumContext.shadowColor = 'rgba(0, 0, 0, 0.2)';
            this.forumContext.shadowBlur = 1;
            
            // Word wrap with better line height
            const maxWidth = this.forumCanvas.width - 240; // More space for larger text
            const words = post.message.split(' ');
            let line = '';
            let messageY = yOffset + 105; // Adjusted for larger text
            const lineHeight = 42; // Increased from 32px
            
            for (const word of words) {
                const testLine = line + word + ' ';
                const metrics = this.forumContext.measureText(testLine);
                
                if (metrics.width > maxWidth) {
                    this.forumContext.fillText(line, 160, messageY);
                    line = word + ' ';
                    messageY += lineHeight;
                    
                    if (messageY > yOffset + postHeight - 40) {
                        line += '...';
                        break;
                    }
                } else {
                    line = testLine;
                }
            }
            this.forumContext.fillText(line, 160, messageY);
            this.forumContext.shadowColor = 'transparent';
            
            yOffset += postHeight;
        }
        
        // Update texture
        this.tvScreenMaterial.map.needsUpdate = true;
    }

    async updateForumContent() {
        try {
            const response = await fetch('/mv-proxy', {
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.posts || !Array.isArray(data.posts)) {
                throw new Error('Invalid posts data received');
            }

            // Store posts data
            this.forumPostsData = data.posts;

            // Load avatars
            const avatarPromises = data.posts
                .map(post => post.avatar)
                .filter(url => url)
                .map(url => this.loadAvatarImage(url));
            
            await Promise.all(avatarPromises);

            // Render content
            this.renderContent();

        } catch (error) {
            console.error('Error updating forum content:', error);
            
            // Show error message
            this.forumContext.fillStyle = '#1a1a1a';
            this.forumContext.fillRect(0, 0, this.forumCanvas.width, this.forumCanvas.height);
            
            this.forumContext.font = 'bold 28px Arial';
            this.forumContext.fillStyle = '#ff4444';
            this.forumContext.textAlign = 'center';
            this.forumContext.fillText('Error updating content...', this.forumCanvas.width / 2, this.forumCanvas.height / 2);
            
            this.tvScreenMaterial.map.needsUpdate = true;
        }
    }

    // Helper method to load and cache avatar images
    async loadAvatarImage(avatarUrl) {
        if (!avatarUrl) return null;
        
        // Check cache first
        if (this.avatarCache.has(avatarUrl)) {
            return this.avatarCache.get(avatarUrl);
        }
        
        // Convert the URL to use our proxy
        const proxyUrl = `/mv-proxy?imageUrl=${encodeURIComponent(avatarUrl)}`;
        
        // Load new image through proxy
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.avatarCache.set(avatarUrl, img);
                resolve(img);
            };
            img.onerror = () => {
                console.error('Failed to load avatar:', avatarUrl);
                resolve(null);
            };
            img.src = proxyUrl;
        });
    }
}