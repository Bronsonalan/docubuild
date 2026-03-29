"use client";

import { useRef, useEffect } from "react";
import type { TranscriptWord, EDL } from "@/types";

interface TranscriptPanelProps {
  words: TranscriptWord[];
  edl: EDL;
  currentTime: number;
  onSeek: (time: number) => void;
}

function isWordInKeptSegment(word: TranscriptWord, edl: EDL): boolean {
  for (const seg of edl.segments) {
    if (word.start >= seg.start && word.end <= seg.end) return true;
  }
  return false;
}

export default function TranscriptPanel({
  words,
  edl,
  currentTime,
  onSeek,
}: TranscriptPanelProps) {
  const activeRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentTime]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto p-4 font-mono text-sm leading-relaxed"
    >
      <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-3">
        Transcript
      </h3>
      <div className="flex flex-wrap gap-x-1.5 gap-y-1">
        {words.map((word, i) => {
          const isActive = currentTime >= word.start && currentTime < word.end;
          const isKept = isWordInKeptSegment(word, edl);

          return (
            <span
              key={i}
              ref={isActive ? activeRef : undefined}
              onClick={() => onSeek(word.start)}
              className={`cursor-pointer px-0.5 rounded transition-colors ${
                isActive
                  ? "bg-white text-black"
                  : isKept
                  ? "text-gray-200 hover:text-white"
                  : "text-gray-600 line-through hover:text-gray-400"
              }`}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
