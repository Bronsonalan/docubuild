"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { EDL, Segment } from "@/types";

interface VideoPlayerProps {
  videoUrl: string;
  edl: EDL;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
}

function isInKeptSegment(time: number, segments: Segment[]): boolean {
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

export default function VideoPlayer({
  videoUrl,
  edl,
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

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="flex-1 relative min-h-0">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => {
            if (videoRef.current) setDuration(videoRef.current.duration);
          }}
          onEnded={() => setPlaying(false)}
        />
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
