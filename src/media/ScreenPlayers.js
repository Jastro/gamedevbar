import { loadYouTubeApi, describeYouTubeError } from './youtube';
import { loadTwitchApi, twitchParents } from './twitch';

// One interface over the YouTube and Twitch embeds, so the projector can sync
// either one the same way. Each player builds its iframe inside `container`
// (the CSS3D element) and empties it again on destroy().
//   media: { provider: 'youtube' | 'twitch' | 'twitch-vod', videoId }
//   ready, seekable, play(), pause(), stop(), seek(s), load(media, start),
//   getCurrentTime(), getDuration(), isPaused(), isPlaying(), setVolume(0..1),
//   kick() (retry playback with sound after a click), destroy().

const ATTACH_TIMEOUT = 15000;

export function providerFamily(provider) {
    return provider === 'twitch' || provider === 'twitch-vod' ? 'twitch' : 'youtube';
}

export function createScreenPlayer(media, container, options) {
    const Player = providerFamily(media.provider) === 'twitch' ? TwitchScreenPlayer : YouTubeScreenPlayer;
    return new Player(container, options);
}

// The embeds only build their iframe in an attached element, and the CSS3D
// layer attaches ours on its next render.
async function waitAttached(element) {
    const deadline = performance.now() + ATTACH_TIMEOUT;
    while (!element.isConnected && performance.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

class ScreenPlayer {
    constructor(container, { width, height, onReady, onError }) {
        this.container = container;
        this.width = width;
        this.height = height;
        this.onReady = onReady;
        this.onError = onError;
        this.player = null;
        this.ready = false;
        this.destroyed = false;
        this.media = null;
    }

    get family() {
        return providerFamily(this.media?.provider);
    }

    destroy() {
        this.destroyed = true;
        this.ready = false;
        try {
            this.player?.destroy?.();
        } catch {
            // Already gone.
        }
        this.player = null;
        this.container.replaceChildren();
    }
}

class YouTubeScreenPlayer extends ScreenPlayer {
    get seekable() {
        return true;
    }

    async create(media, startSeconds) {
        this.media = media;
        const YT = await loadYouTubeApi();
        await waitAttached(this.container);
        if (this.destroyed) return;
        const host = document.createElement('div');
        this.container.appendChild(host);
        this.player = new YT.Player(host, {
            width: this.width,
            height: this.height,
            videoId: media.videoId,
            playerVars: {
                autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0,
                modestbranding: 1, playsinline: 1, iv_load_policy: 3,
                start: Math.floor(startSeconds)
            },
            events: {
                onReady: () => {
                    if (this.destroyed) return;
                    this.ready = true;
                    this.player.setVolume(0); // the projector sets the real one next update
                    this.onReady?.();
                },
                onError: (event) => this.onError?.(describeYouTubeError(event.data))
            }
        });
    }

    load(media, startSeconds) {
        this.media = media;
        this.player.loadVideoById({ videoId: media.videoId, startSeconds });
    }

    play() { this.player.playVideo(); }
    pause() { this.player.pauseVideo(); }
    stop() { this.player.stopVideo(); }
    seek(seconds) { this.player.seekTo(seconds, true); }
    getCurrentTime() { return this.player.getCurrentTime?.() ?? 0; }
    getDuration() { return this.player.getDuration?.() || 0; }

    isPaused() {
        return this.player.getPlayerState?.() === window.YT.PlayerState.PAUSED;
    }

    isPlaying() {
        const state = this.player.getPlayerState?.();
        return state === window.YT.PlayerState.PLAYING || state === window.YT.PlayerState.BUFFERING;
    }

    setVolume(gain) {
        this.player.unMute?.();
        this.player.setVolume?.(Math.round(gain * 100));
    }

    kick() {
        this.play();
    }
}

let twitchElementCount = 0;

class TwitchScreenPlayer extends ScreenPlayer {
    get seekable() {
        return this.media?.provider === 'twitch-vod';
    }

    async create(media) {
        this.media = media;
        const Twitch = await loadTwitchApi();
        await waitAttached(this.container);
        if (this.destroyed) return;
        const host = document.createElement('div');
        host.id = `twitch-screen-${++twitchElementCount}`;
        this.container.appendChild(host);
        this.lastVolume = null;
        this.reportedOffline = false;
        this.player = new Twitch.Player(host.id, {
            width: this.width,
            height: this.height,
            parent: twitchParents(),
            autoplay: true,
            muted: false,
            ...this.mediaOptions(media)
        });
        this.player.addEventListener(Twitch.Player.READY, () => {
            if (this.destroyed) return;
            this.ready = true;
            this.player.setVolume(0); // the projector sets the real one next update
            this.player.setMuted(false);
            this.onReady?.();
        });
        // A channel that isn't live shows Twitch's offline screen; say so once.
        this.player.addEventListener(Twitch.Player.OFFLINE, () => {
            if (this.destroyed || this.media?.provider !== 'twitch' || this.reportedOffline) return;
            this.reportedOffline = true;
            this.onError?.(`el canal ${this.media.videoId} no está en directo ahora`);
        });
        this.player.addEventListener(Twitch.Player.ONLINE, () => {
            this.reportedOffline = false;
        });
    }

    mediaOptions(media) {
        return media.provider === 'twitch-vod' ? { video: `v${media.videoId}` } : { channel: media.videoId };
    }

    load(media, startSeconds) {
        this.media = media;
        this.reportedOffline = false;
        if (media.provider === 'twitch-vod') this.player.setVideo(`v${media.videoId}`, startSeconds);
        else this.player.setChannel(media.videoId);
    }

    play() { this.player.play(); }
    pause() { this.player.pause(); }
    stop() { this.player.pause(); }
    seek(seconds) { this.player.seek(seconds); }
    getCurrentTime() { return this.player.getCurrentTime?.() ?? 0; }
    getDuration() { return this.player.getDuration?.() || 0; }
    isPaused() { return Boolean(this.player.isPaused?.()); }
    isPlaying() { return !this.isPaused() && !this.player.getEnded?.(); }

    // Twitch takes 0..1; only send changes (each call is a postMessage).
    setVolume(gain) {
        const volume = Math.round(gain * 100) / 100;
        if (volume === this.lastVolume) return;
        this.lastVolume = volume;
        this.player.setVolume(volume);
    }

    kick() {
        this.player.setMuted(false);
        this.lastVolume = null;
        this.play();
    }
}
