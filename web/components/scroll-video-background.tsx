"use client";

import { useEffect, useRef, useState } from "react";

type ScrollVideoBackgroundProps = {
  src: string;
  className?: string;
};

export function ScrollVideoBackground({
  src,
  className,
}: ScrollVideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [bufferProgress, setBufferProgress] = useState(0);
  const [canPlay, setCanPlay] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const videoEl = video;

    let cancelled = false;
    let destroyHls: (() => void) | undefined;

    const updateBufferedProgress = () => {
      if (!videoEl.duration || !isFinite(videoEl.duration)) return;

      let bufferedEnd = 0;
      for (let i = 0; i < videoEl.buffered.length; i++) {
        bufferedEnd = Math.max(bufferedEnd, videoEl.buffered.end(i));
      }

      setBufferProgress(
        Math.min(100, Math.round((bufferedEnd / videoEl.duration) * 100)),
      );
    };

    const handleCanPlay = () => {
      updateBufferedProgress();
      setCanPlay(true);
    };

    videoEl.addEventListener("progress", updateBufferedProgress);
    videoEl.addEventListener("canplay", handleCanPlay);

    const isHls = src.includes(".m3u8");

    async function attachSource() {
      if (!isHls) {
        videoEl.src = src;
        videoEl.load();
        return;
      }

      if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
        videoEl.src = src;
        videoEl.load();
        return;
      }

      const Hls = (await import("hls.js")).default;
      if (cancelled) return;

      if (!Hls.isSupported()) {
        videoEl.src = src;
        videoEl.load();
        return;
      }

      const hls = new Hls({
        maxBufferLength: 120,
        maxMaxBufferLength: 600,
        maxBufferSize: 200 * 1024 * 1024,
        startPosition: 0,
        capLevelToPlayerSize: false,
        startLevel: -1,
        autoStartLoad: true,
      });

      destroyHls = () => hls.destroy();
      hls.loadSource(src);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        const maxLevel = data.levels.length - 1;
        hls.currentLevel = maxLevel;
        hls.startLevel = maxLevel;
      });

      hls.on(Hls.Events.FRAG_BUFFERED, updateBufferedProgress);
    }

    attachSource().catch(() => {
      if (!cancelled) {
        videoEl.src = src;
        videoEl.load();
      }
    });

    return () => {
      cancelled = true;
      destroyHls?.();
      videoEl.removeEventListener("progress", updateBufferedProgress);
      videoEl.removeEventListener("canplay", handleCanPlay);
    };
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const videoEl = video;
    let rafId = 0;
    let targetTime = 0;
    let seekPending = false;

    const getTargetTime = () => {
      if (!videoEl.duration || !isFinite(videoEl.duration)) return null;

      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll <= 0) return 0;

      const progress = Math.max(0, Math.min(1, window.scrollY / maxScroll));
      return progress * videoEl.duration;
    };

    const doSeek = () => {
      if (!videoEl.duration || !isFinite(videoEl.duration)) return;

      if (videoEl.seeking) {
        seekPending = true;
        return;
      }

      seekPending = false;
      if (Math.abs(videoEl.currentTime - targetTime) > 0.001) {
        videoEl.currentTime = targetTime;
      }
    };

    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const nextTarget = getTargetTime();
        if (nextTarget === null) return;

        targetTime = nextTarget;
        doSeek();
      });
    };

    const handleSeeked = () => {
      if (seekPending) {
        const nextTarget = getTargetTime();
        if (nextTarget !== null) targetTime = nextTarget;
        doSeek();
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    videoEl.addEventListener("loadedmetadata", handleScroll);
    videoEl.addEventListener("seeked", handleSeeked);
    handleScroll();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      videoEl.removeEventListener("loadedmetadata", handleScroll);
      videoEl.removeEventListener("seeked", handleSeeked);
    };
  }, []);

  return (
    <>
      {!canPlay && (
        <div
          aria-hidden
          className="fixed inset-0 z-50 flex items-center justify-center bg-black"
        >
          <p className="font-sans text-2xl text-white">
            Loading... {bufferProgress}%
          </p>
        </div>
      )}

      <div
        aria-hidden
        className={`fixed top-0 left-0 w-full h-full z-0 pointer-events-none${className ? ` ${className}` : ""}`}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          crossOrigin="anonymous"
          preload="auto"
          className="w-full h-full object-cover"
        />
      </div>
    </>
  );
}

export default ScrollVideoBackground;
