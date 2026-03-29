"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { EDL, Hook, Segment, TranscriptWord } from "@/types";

interface VideoPlayerProps {
  videoUrl: string;
  edl: EDL;
  selectedHook?: Hook | null;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
}

function isInKeptSegment(time: number, segments: Segment[]): boolean {
  if (segments.length === 0) return true;
  for (const seg of segments) {
    if (time >= seg.start && time <= seg.end) return true;
  }
  return false;
}

function getNextSegment(time: number, segments: Segment[]): Segment | null {
  for (const seg of segments) {
    if (seg.start > time) return seg;
  }
  return null;
}

function getCompositionTimeForOriginalTime(
  time: number,
  segments: Segment[]
): number {
  let elapsed = 0;

  for (const segment of segments) {
    if (time < segment.start) {
      return elapsed;
    }

    if (time <= segment.end) {
      return elapsed + (time - segment.start);
    }

    elapsed += segment.end - segment.start;
  }

  return elapsed;
}

function getActiveCaptionGroup(
  captions: TranscriptWord[],
  timeInSeconds: number,
  windowSize: number = 5
): { words: TranscriptWord[]; activeIndex: number } {
  let currentIndex = -1;

  for (let i = 0; i < captions.length; i++) {
    if (
      timeInSeconds >= captions[i].start &&
      timeInSeconds < captions[i].end
    ) {
      currentIndex = i;
      break;
    }
  }

  if (currentIndex === -1) {
    for (let i = 0; i < captions.length; i++) {
      if (captions[i].start > timeInSeconds) {
        currentIndex = i;
        break;
      }
    }

    if (currentIndex === -1) {
      currentIndex = captions.length - 1;
    }
  }

  const halfWindow = Math.floor(windowSize / 2);
  const start = Math.max(0, currentIndex - halfWindow);
  const end = Math.min(captions.length, start + windowSize);

  return {
    words: captions.slice(start, end),
    activeIndex: currentIndex - start,
  };
}

function getHookOpacity(hook: Hook, compositionTime: number): number {
  if (
    compositionTime < hook.startTime ||
    compositionTime > hook.endTime
  ) {
    return 0;
  }

  const localTime = compositionTime - hook.startTime;
  const duration = Math.max(0.01, hook.endTime - hook.startTime);
  const fadeWindow = Math.min(0.25, duration / 4);

  if (localTime < fadeWindow) {
    return localTime / fadeWindow;
  }

  const remaining = hook.endTime - compositionTime;
  if (remaining < fadeWindow) {
    return remaining / fadeWindow;
  }

  return 1;
}

function CaptionPreview({
  captions,
  currentTime,
}: {
  captions: TranscriptWord[];
  currentTime: number;
}) {
  if (captions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-500">
        Captions will appear here after transcription.
      </div>
    );
  }

  const { words, activeIndex } = getActiveCaptionGroup(captions, currentTime);

  return (
    <div className="flex h-full items-center justify-center px-5 py-4">
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-center">
        {words.map((word, index) => {
          const isActive = index === activeIndex;
          return (
            <span
              key={`${word.start}-${word.text}-${index}`}
              className={`transition-all duration-100 ${
                isActive
                  ? "scale-105 text-white"
                  : "text-white/50"
              }`}
              style={{
                fontSize: isActive ? "1.55rem" : "1.3rem",
                fontWeight: isActive ? 900 : 700,
                textShadow: isActive
                  ? "0 2px 8px rgba(0, 0, 0, 0.8)"
                  : "none",
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function VideoPlayer({
  videoUrl,
  edl,
  selectedHook,
  currentTime,
  onTimeUpdate,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const t = video.currentTime;
    onTimeUpdate(t);

    if (!isInKeptSegment(t, edl.segments)) {
      const next = getNextSegment(t, edl.segments);
      if (next) {
        video.currentTime = next.start;
      } else {
        video.pause();
        setPlaying(false);
      }
    }
  }, [edl.segments, onTimeUpdate]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }, []);

  const seekTo = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = time;
      onTimeUpdate(time);
    },
    [onTimeUpdate]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (Math.abs(video.currentTime - currentTime) > 0.5) {
      video.currentTime = currentTime;
    }
  }, [currentTime]);

  const totalDuration = duration || 1;
  const segments = edl.segments;
  const captions = edl.captions;
  const compositionTime = getCompositionTimeForOriginalTime(currentTime, segments);
  const hookOpacity =
    selectedHook ? getHookOpacity(selectedHook, compositionTime) : 0;

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="flex min-h-0 flex-1 items-center justify-center bg-[#050505] p-4">
        <div
          className="relative h-full max-h-full w-full max-w-[430px] overflow-hidden rounded-[32px] border border-gray-800 bg-black shadow-[0_18px_80px_rgba(0,0,0,0.45)]"
          style={{ aspectRatio: "9 / 16" }}
        >
          <div className="relative h-[60%] overflow-hidden bg-black">
            <video
              ref={videoRef}
              src={videoUrl}
              className="h-full w-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={() => {
                if (videoRef.current) setDuration(videoRef.current.duration);
              }}
              onEnded={() => setPlaying(false)}
            />

            {selectedHook && hookOpacity > 0 && (
              <div
                className="pointer-events-none absolute inset-x-0 top-0 flex justify-center px-4 pt-6"
                style={{ opacity: hookOpacity }}
              >
                <div
                  className="max-w-[92%] text-center text-white"
                  style={{
                    fontSize: "1.7rem",
                    fontWeight: 900,
                    lineHeight: 1.15,
                    textShadow:
                      "0 4px 12px rgba(0, 0, 0, 0.9), 0 2px 4px rgba(0, 0, 0, 0.5)",
                  }}
                >
                  {selectedHook.text}
                </div>
              </div>
            )}
          </div>

          <div className="h-[40%] border-t border-gray-900 bg-black">
            <CaptionPreview captions={captions} currentTime={currentTime} />
          </div>
        </div>
      </div>

      <div className="px-3 py-2 bg-[#111] border-t border-gray-800">
        <div
          className="relative w-full h-3 bg-gray-800 rounded cursor-pointer mb-2"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            seekTo(pct * totalDuration);
          }}
        >
          {segments.map((seg, i) => (
            <div
              key={i}
              className="absolute top-0 h-full bg-gray-600 rounded"
              style={{
                left: `${(seg.start / totalDuration) * 100}%`,
                width: `${((seg.end - seg.start) / totalDuration) * 100}%`,
              }}
            />
          ))}
          <div
            className="absolute top-0 h-full w-0.5 bg-white"
            style={{
              left: `${(currentTime / totalDuration) * 100}%`,
            }}
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <button
            onClick={togglePlay}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
          >
            {playing ? "Pause" : "Play"}
          </button>
          <span className="text-gray-400 font-mono text-xs">
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
