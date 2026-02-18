'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const FALLBACK_TRACKS = [
  'https://cdn.pixabay.com/audio/2024/11/28/audio_3e90ab3a5c.mp3',
];

export default function MusicPlayer() {
  const audioRef     = useRef<HTMLAudioElement | null>(null);
  const tracksRef    = useRef<string[]>(FALLBACK_TRACKS);
  const isPlayingRef = useRef(false); // source of truth for auto-advance handlers
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume]   = useState(0.25);
  const [trackIdx, setTrackIdx] = useState(0);
  const [showVolume, setShowVolume] = useState(false);

  // Create audio element exactly once
  useEffect(() => {
    const audio = new Audio();
    audio.loop   = false;
    audio.volume = 0.25;
    audioRef.current = audio;

    const advance = (fromIdx: number) => {
      if (!isPlayingRef.current) return; // user hasn't started playback — stay quiet
      const tracks = tracksRef.current;
      const next   = (fromIdx + 1) % tracks.length;
      setTrackIdx(next);
      audio.src = tracks[next];
      audio.play().catch(() => {});
    };

    audio.addEventListener('ended', () => advance(trackIdx));
    audio.addEventListener('error', () => advance(trackIdx));

    return () => {
      audio.pause();
      audio.src = '';
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlayingRef.current) {
      audio.pause();
      isPlayingRef.current = false;
      setPlaying(false);
    } else {
      audio.src = tracksRef.current[trackIdx];
      audio.play().catch(() => {});
      isPlayingRef.current = true;
      setPlaying(true);
    }
  }, [trackIdx]);

  const skip = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const tracks = tracksRef.current;
    const next   = (trackIdx + 1) % tracks.length;
    setTrackIdx(next);
    audio.src = tracks[next];
    if (isPlayingRef.current) audio.play().catch(() => {});
  }, [trackIdx]);

  return (
    <div
      className="flex items-center gap-2 relative"
      onMouseEnter={() => setShowVolume(true)}
      onMouseLeave={() => setShowVolume(false)}
    >
      {showVolume && (
        <div className="flex items-center gap-1.5 animate-in fade-in">
          <input
            type="range" min={0} max={1} step={0.01} value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-16 h-1 accent-gold cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
          />
        </div>
      )}

      {playing && (
        <button onClick={skip}
          className="text-dim hover:text-gold text-[11px] cursor-pointer transition-colors"
          title="Next track">
          &#x23ED;
        </button>
      )}

      <button onClick={toggle}
        className={`
          flex items-center gap-1.5 px-2.5 py-1 rounded border cursor-pointer
          text-[10px] uppercase tracking-wider font-bold transition-all
          ${playing
            ? 'border-gold/40 text-gold bg-gold/10 hover:bg-gold/20'
            : 'border-border text-dim hover:text-gold hover:border-gold/40'}
        `}
        title={playing ? 'Pause ambient music' : 'Play ambient music'}
      >
        <span className="text-sm">{playing ? '◼' : '♫'}</span>
        <span className="hidden sm:inline">{playing ? 'MUSIC ON' : 'MUSIC'}</span>
      </button>
    </div>
  );
}
