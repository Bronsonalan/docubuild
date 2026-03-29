"use client";

import type { Hook } from "@/types";

interface HookCandidate {
  text: string;
  reasoning: string;
}

interface HookSelectorProps {
  candidates: HookCandidate[];
  edlDuration?: number;
  onSelect: (hook: Hook) => void;
  onClose: () => void;
}

export default function HookSelector({
  candidates,
  edlDuration,
  onSelect,
  onClose,
}: HookSelectorProps) {
  const hookEndTime =
    edlDuration && edlDuration > 0
      ? Math.min(5, Math.max(2, edlDuration * 0.15))
      : 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#141414] border border-gray-700 rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold">Select a Hook</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-5 space-y-3">
          {candidates.length === 0 && (
            <p className="text-gray-500 text-sm">No hook candidates yet.</p>
          )}
          {candidates.map((candidate, i) => (
            <button
              key={i}
              onClick={() =>
                onSelect({
                  text: candidate.text,
                  startTime: 0,
                  endTime: hookEndTime,
                })
              }
              className="w-full text-left p-4 bg-[#1a1a1a] border border-gray-700 rounded-lg hover:border-gray-500 transition-colors"
            >
              <p className="text-white font-medium mb-1">
                &ldquo;{candidate.text}&rdquo;
              </p>
              <p className="text-gray-500 text-xs">{candidate.reasoning}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
