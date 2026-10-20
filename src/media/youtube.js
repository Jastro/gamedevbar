// YouTube helpers: IFrame API loader and link → video id parsing.

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
let apiPromise = null;

// Resolves with window.YT once https://www.youtube.com/iframe_api is ready.
export function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (!apiPromise) {
        apiPromise = new Promise((resolve, reject) => {
            const previous = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                previous?.();
                resolve(window.YT);
            };
            const script = document.createElement('script');
            script.src = 'https://www.youtube.com/iframe_api';
            script.async = true;
            script.onerror = () => {
                apiPromise = null;
                reject(new Error('YouTube API failed to load'));
            };
            document.head.appendChild(script);
        });
    }
    return apiPromise;
}

// Accepts a bare id or youtube.com/watch?v=, youtu.be/, /shorts/, /embed/, /live/ links.
export function parseYouTubeId(text) {
    const input = (text || '').trim();
    if (VIDEO_ID.test(input)) return input;
    let url;
    try {
        url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    } catch {
        return null;
    }
    const host = url.hostname.replace(/^(www|m|music)\./, '');
    let id = null;
    if (host === 'youtu.be') {
        id = url.pathname.slice(1).split('/')[0];
    } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        id = url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1];
    }
    return id && VIDEO_ID.test(id) ? id : null;
}

// Player error codes → message for the chat.
export function describeYouTubeError(code) {
    if (code === 101 || code === 150) return 'ese vídeo no se puede ver fuera de YouTube';
    if (code === 100) return 'ese vídeo no existe o es privado';
    if (code === 2) return 'el enlace no es válido';
    return 'YouTube no ha podido reproducirlo';
}
