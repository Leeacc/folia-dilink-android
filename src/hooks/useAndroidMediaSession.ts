import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { PlayerState } from '../types';
import type { SongResult } from '../types';
import { isCapacitorAndroid } from '../platform/runtime';
import { carMedia } from '../services/android/carMedia';
import { getSongArtistLabel, getSongAlbumLabel, getSongCoverUrl } from '../services/onlineMusic/songMetadata';

// One-second native state publishing; transport events use current callbacks without rerender subscriptions.
type Options = {
    audioRef: RefObject<HTMLAudioElement | null>;
    currentSong: SongResult | null;
    playerState: PlayerState;
    isNowPlayingStageActive: boolean;
    isNowPlayingControlDisabledRef: RefObject<boolean>;
    mediaSessionPlayRef: RefObject<() => Promise<void>>;
    mediaSessionPauseRef: RefObject<() => void>;
    mediaSessionPrevRef: RefObject<() => void>;
    mediaSessionNextRef: RefObject<() => Promise<void> | void>;
};
export function useAndroidMediaSession(options: Options) {
    const latest = useRef(options);
    latest.current = options;
    useEffect(() => {
        if (!isCapacitorAndroid()) return;
        let stopped = false;
        const handle = carMedia.addListener('command', (event) => {
            const current = latest.current;
            if (current.isNowPlayingStageActive || current.isNowPlayingControlDisabledRef.current) return;
            if (event.action === 'play') void current.mediaSessionPlayRef.current().catch(() => {});
            if (event.action === 'pause') current.mediaSessionPauseRef.current();
            if (event.action === 'previous') current.mediaSessionPrevRef.current();
            if (event.action === 'next') void current.mediaSessionNextRef.current();
            if (event.action === 'seek' && current.audioRef.current && Number.isFinite(event.position)) {
                current.audioRef.current.currentTime = Math.max(
                    0,
                    Math.min(current.audioRef.current.duration || 0, event.position),
                );
            }
        });
        const publish = () => {
            if (stopped) return;
            const current = latest.current;
            const audio = current.audioRef.current;
            const song = current.isNowPlayingStageActive ? null : current.currentSong;
            void carMedia
                .update({
                    hasTrack: Boolean(song),
                    playing: Boolean(song && audio && !audio.paused && !audio.ended),
                    title: song?.name,
                    artist: getSongArtistLabel(song),
                    album: getSongAlbumLabel(song),
                    cover: getSongCoverUrl(song) || '',
                    duration: audio && Number.isFinite(audio.duration) ? audio.duration : 0,
                    position: audio?.currentTime || 0,
                })
                .catch(() => {});
        };
        publish();
        const timer = window.setInterval(publish, 1000);
        const events = ['play', 'pause', 'seeked', 'loadedmetadata', 'ended'];
        const audio = options.audioRef.current;
        events.forEach((event) => audio?.addEventListener(event, publish));
        return () => {
            stopped = true;
            clearInterval(timer);
            events.forEach((event) => audio?.removeEventListener(event, publish));
            void handle.then((value) => value.remove());
            void carMedia.update({ hasTrack: false, playing: false, duration: 0, position: 0 }).catch(() => {});
        };
    }, [options.audioRef]);
    useEffect(() => {
        if (!isCapacitorAndroid()) return;
        // React's discrete track/playback change publishes before the next timer tick.
        const audio = options.audioRef.current;
        const song = options.isNowPlayingStageActive ? null : options.currentSong;
        void carMedia
            .update({
                hasTrack: Boolean(song),
                playing: Boolean(song && audio && !audio.paused && !audio.ended),
                title: song?.name,
                artist: getSongArtistLabel(song),
                album: getSongAlbumLabel(song),
                cover: getSongCoverUrl(song) || '',
                duration: audio && Number.isFinite(audio.duration) ? audio.duration : 0,
                position: audio?.currentTime || 0,
            })
            .catch(() => {});
    }, [options.currentSong, options.playerState, options.isNowPlayingStageActive, options.audioRef]);
}
