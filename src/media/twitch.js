// Twitch helpers: embed API loader and link → { provider, videoId } parsing.
// Two providers on the projector: 'twitch' (a channel's live stream, videoId =
// channel name) and 'twitch-vod' (a past broadcast, videoId = numeric id).

export const TWITCH_CHANNEL = /^[A-Za-z0-9_]{1,25}$/;
export const TWITCH_VOD = /^\d{1,12}$/;

// First path segments on twitch.tv that are pages, not channels.
const RESERVED = new Set([
    'directory', 'videos', 'settings', 'search', 'downloads', 'jobs', 'p', 'turbo', 'prime', 'store',
    'subscriptions', 'inventory', 'wallet', 'drops', 'friends', 'messages', 'payments', 'login', 'signup',
    'logout', 'moderator', 'popout', 'embed', 'clip', 'clips', 'collections', 'u'
]);

let apiPromise = null;

// Resolves with window.Twitch once https://player.twitch.tv/js/embed/v1.js is loaded.
export function loadTwitchApi() {
    if (window.Twitch?.Player) return Promise.resolve(window.Twitch);
    if (!apiPromise) {
        apiPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://player.twitch.tv/js/embed/v1.js';
            script.async = true;
            script.onload = () => (window.Twitch?.Player ? resolve(window.Twitch) : reject(new Error('Twitch API missing')));
            script.onerror = () => {
                apiPromise = null;
                reject(new Error('Twitch API failed to load'));
            };
            document.head.appendChild(script);
        });
    }
    return apiPromise;
}

// Twitch only plays inside pages whose domain is listed in `parent`, including
// every page around ours if we're embedded (e.g. in the forum).
export function twitchParents() {
    const hosts = new Set([window.location.hostname]);
    try {
        Array.from(window.location.ancestorOrigins ?? []).forEach(origin => hosts.add(new URL(origin).hostname));
        if (window.top !== window && document.referrer) hosts.add(new URL(document.referrer).hostname);
    } catch {
        // Ignore unreadable origins.
    }
    return [...hosts].filter(Boolean);
}

// Accepts twitch.tv/<channel>, twitch.tv/videos/<id>, twitch.tv/<channel>/v/<id>
// and player.twitch.tv/?channel= / ?video= links. Returns { provider, videoId },
// { error: 'clip' } for clips (no volume control, so not supported), or null.
export function parseTwitchLink(text) {
    const input = (text || '').trim();
    let url;
    try {
        url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    } catch {
        return null;
    }
    const host = url.hostname.toLowerCase().replace(/^(www|m|go)\./, '');
    if (host === 'clips.twitch.tv') return { error: 'clip' };
    if (host === 'player.twitch.tv') {
        const channel = url.searchParams.get('channel');
        const video = url.searchParams.get('video')?.replace(/^v/i, '');
        if (video && TWITCH_VOD.test(video)) return { provider: 'twitch-vod', videoId: video };
        if (channel && TWITCH_CHANNEL.test(channel)) return { provider: 'twitch', videoId: channel.toLowerCase() };
        return null;
    }
    if (host !== 'twitch.tv') return null;

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'videos' && TWITCH_VOD.test(parts[1] ?? '')) return { provider: 'twitch-vod', videoId: parts[1] };
    if (parts[1] === 'v' && TWITCH_VOD.test(parts[2] ?? '')) return { provider: 'twitch-vod', videoId: parts[2] };
    if (parts[1] === 'clip' || parts[0] === 'clip') return { error: 'clip' };
    const channel = parts[0];
    if (channel && !RESERVED.has(channel.toLowerCase()) && TWITCH_CHANNEL.test(channel)) {
        return { provider: 'twitch', videoId: channel.toLowerCase() };
    }
    return null;
}
