import React, { useState } from 'react';
import { motionValue } from 'framer-motion';
import FloatingPlayerControls from '../../src/components/FloatingPlayerControls';
import NowPlayingToast from '../../src/components/app/overlays/NowPlayingToast';
import { playerBottomBarLiveOffset } from '../../src/stores/motionSignals';
import { PlayerState } from '../../src/types';
import type { ProbeDefinition } from './definition';

// Real toast and real capsule, with synthetic tracks. This does not imitate native audio playback.
const time = motionValue(42);
function CarTrackToastProbe() {
    const [track, setTrack] = useState(0);
    const [playing, setPlaying] = useState(true);
    const [auto, setAuto] = useState(false);
    const title = `分屏切歌测试 ${track} · A long song title that must truncate`;
    return <div className="relative h-screen bg-zinc-900 text-white" data-probe-car-toast={track}>
        <div className="absolute left-4 top-4 z-[90] flex flex-wrap gap-3">
            <button data-test-next onClick={() => setTrack(v => v+1)}>Next track</button>
            <button data-test-playing onClick={() => setPlaying(v => !v)}>Toggle playback</button>
            <button data-test-auto onClick={() => setAuto(true)}>Auto hide</button>
            <button data-test-offset onClick={() => playerBottomBarLiveOffset.set(64)}>Raise baseline</button>
        </div>
        <FloatingPlayerControls
            currentSong={{name:title}}
            playerState={playing ? PlayerState.PLAYING : PlayerState.PAUSED}
            currentTime={time} duration={240} loopMode="all" currentView="player"
            audioSrc="probe://audio" canTogglePlay lyrics={null}
            onSeek={() => {}} onTogglePlay={() => setPlaying(v => !v)} onToggleLoop={() => {}}
            onNavigateToPlayer={() => {}} isDaylight={false}
            slotPrimary="prev" slotSecondary="next" slotContext={{onShuffle:()=>{},canShuffle:false,
                onLike:()=>{},isLiked:false,likeDisabled:true,invokeCommandById:()=>{},canInvokeCommandById:()=>false}}
            onCommitBottomBarOffset={() => {}}
        />
        <NowPlayingToast song={{title,artist:'Folia test artist',coverUrl:null}}
            trackKey={String(track)} isDaylight={false} mode={auto ? 'auto' : 'always'} timeoutSec={3}/>
    </div>;
}
const definition: ProbeDefinition = {id:'carTrackToast',title:'Car track toast clearance',
    description:'Actual capsule/toast bounds, shared baseline offset, next-track update and timed dismissal.',Component:CarTrackToastProbe};
export default definition;
