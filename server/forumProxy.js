// Forum TV backend: scrapes the Mediavida thread with Puppeteer and proxies
// avatars/images (Mediavida blocks hotlinking without a Referer).
const puppeteer = require('puppeteer');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

function registerForumRoutes(app) {
    // Cache durations
    const FORUM_CACHE_DURATION = 30 * 1000; // 30 seconds for forum data
    const IMAGE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for images

    // Cache for storing images temporarily
    const imageCache = new Map();

    // Clean up expired cache entries periodically
    setInterval(() => {
        const now = Date.now();
        for (const [key, value] of imageCache.entries()) {
            if (now - value.timestamp > IMAGE_CACHE_DURATION) {
                imageCache.delete(key);
            }
        }
    }, 60000); // Check every minute

    // Image proxy endpoint
    app.get('/proxy-image', async (req, res) => {
        try {
            const imageUrl = req.query.url;
            if (!imageUrl) {
                return res.status(400).send('No image URL provided');
            }

            const response = await fetch(imageUrl, {
                headers: {
                    'Referer': 'https://www.mediavida.com/',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (!response.ok) {
                return res.status(response.status).send('Failed to fetch image');
            }

            const contentType = response.headers.get('content-type');
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

            response.body.pipe(res);
        } catch (error) {
            console.error('Error proxying image:', error);
            res.status(500).send('Error fetching image');
        }
    });

    // Cache for forum posts
    let forumPostsCache = [];
    let lastFetchTime = 0;

    // Function to fetch forum posts
    async function fetchForumPosts() {
        let browser = null;
        try {
            browser = await puppeteer.launch({
                headless: 'new',
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-software-rasterizer'
                ]
            });
            const page = await browser.newPage();
        
            // Set a reasonable timeout
            await page.setDefaultNavigationTimeout(30000);
        
            await page.goto('https://www.mediavida.com/foro/gamedev/gamedev-taberna-ahora-nuestro-propio-habbo-gamedev-718219/live', {
                waitUntil: 'networkidle0'
            });

            const posts = await page.evaluate(() => {
                const postElements = document.querySelectorAll('#posts-wrap .post');
                return Array.from(postElements).slice(0, 10).map(post => {
                    // Username extraction
                    const username = post.querySelector('.autor')?.textContent?.trim() || '';
                
                    // Avatar extraction - try multiple selectors and sources
                    let avatar = '';
                    const avatarImg = post.querySelector('.avatar img, .avatar');
                    if (avatarImg) {
                        // Try data-src first (lazy loading), then src
                        avatar = avatarImg.getAttribute('data-src') || avatarImg.getAttribute('src') || '';
                    
                        // If it's a relative URL, make it absolute
                        if (avatar && !avatar.startsWith('http')) {
                            avatar = 'https://www.mediavida.com' + (avatar.startsWith('/') ? '' : '/') + avatar;
                        }
                    
                        // Replace any default avatar with empty string
                        if (avatar.includes('pix.gif') || avatar.includes('default_avatar')) {
                            avatar = '';
                        }
                    }
                
                    // Message extraction
                    const messageEl = post.querySelector('.post-contents');
                    const message = messageEl ? messageEl.textContent.trim() : '';
                
                    // Post number extraction
                    const postNum = post.getAttribute('data-num') || '';
                
                    return { 
                        username, 
                        avatar, 
                        message, 
                        postNum,
                        timestamp: Date.now() 
                    };
                });
            });

            console.log('Fetched posts with avatars:', posts.map(p => ({ username: p.username, avatar: p.avatar })));
            forumPostsCache = posts;
            lastFetchTime = Date.now();
            return posts;
        } catch (error) {
            console.error('Error fetching forum posts:', error);
            return forumPostsCache; // Return cached posts on error
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    // Initialize cache on startup
    fetchForumPosts().catch(console.error);

    // Proxy endpoint for both forum data and images
    app.get('/mv-proxy', async (req, res) => {
        try {
            // If imageUrl is provided, handle image proxy
            if (req.query.imageUrl) {
                const imageUrl = req.query.imageUrl;
            
                // Check cache first
                if (imageCache.has(imageUrl)) {
                    const cachedImage = imageCache.get(imageUrl);
                    if (Date.now() - cachedImage.timestamp < IMAGE_CACHE_DURATION) {
                        res.type(cachedImage.contentType);
                        return res.send(cachedImage.data);
                    } else {
                        imageCache.delete(imageUrl);
                    }
                }

                // Download image
                const imageResponse = await fetch(imageUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://www.mediavida.com/',
                        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
                    },
                    timeout: 5000 // 5 second timeout
                }).catch(error => {
                    console.error(`Failed to fetch image ${imageUrl}:`, error);
                    return null;
                });

                if (!imageResponse || !imageResponse.ok) {
                    console.error(`Image fetch failed for ${imageUrl}: ${imageResponse?.status}`);
                    return res.status(404).send('Image not found');
                }

                let contentType = imageResponse.headers.get('content-type');
                // Ensure we have a valid content type
                if (!contentType || !contentType.startsWith('image/')) {
                    contentType = 'image/jpeg'; // Default to JPEG if no valid content type
                }

                const buffer = await imageResponse.buffer().catch(error => {
                    console.error(`Failed to get buffer for ${imageUrl}:`, error);
                    return null;
                });

                if (!buffer) {
                    return res.status(500).send('Failed to process image');
                }

                // Cache the image
                imageCache.set(imageUrl, {
                    data: buffer,
                    contentType,
                    timestamp: Date.now()
                });

                // Send response with appropriate headers
                res.set('Cache-Control', 'public, max-age=300'); // 5 minutes cache
                res.set('Content-Type', contentType);
                res.send(buffer);
                return;
            }

            // Handle forum data request
            if (Date.now() - lastFetchTime > FORUM_CACHE_DURATION) {
                console.log('Cache expired, fetching new posts');
                await fetchForumPosts();
            }
        
            if (forumPostsCache.length === 0) {
                console.log('Cache empty, fetching posts');
                await fetchForumPosts();
            }
        
            console.log(`Sending ${forumPostsCache.length} posts`);
            res.json({ posts: forumPostsCache });

        } catch (error) {
            console.error('Proxy error:', error);
            // En caso de error, devolver el caché existente si hay datos
            if (forumPostsCache.length > 0) {
                res.json({ posts: forumPostsCache });
            } else {
                res.status(500).json({ error: error.message });
            }
        }
    });
}

module.exports = { registerForumRoutes };
