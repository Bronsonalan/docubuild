import React from 'react';
import {
  AbsoluteFill,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Sequence,
} from 'remotion';
import type { Hook, TranscriptWord } from '../types';
import type { DocuBuildShortSchemaProps } from './schema';

const VIDEO_AREA_PERCENT = 0.6;
const CAPTION_AREA_PERCENT = 1 - VIDEO_AREA_PERCENT;

/**
 * Finds the active caption word at the given time in seconds.
 * Returns the index of the current word and the surrounding words for display.
 */
function getActiveCaptionGroup(
  captions: TranscriptWord[],
  timeInSeconds: number,
  windowSize: number = 5
): { words: TranscriptWord[]; activeIndex: number } {
  let currentIndex = -1;
  for (let i = 0; i < captions.length; i++) {
    if (timeInSeconds >= captions[i].start && timeInSeconds < captions[i].end) {
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

const CaptionBar: React.FC<{
  captions: TranscriptWord[];
  timeInSeconds: number;
  height: number;
}> = ({ captions, timeInSeconds, height }) => {
  if (captions.length === 0) return null;

  const { words, activeIndex } = getActiveCaptionGroup(captions, timeInSeconds);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height,
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 40px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        {words.map((word, i) => {
          const isActive = i === activeIndex;
          return (
            <span
              key={`${word.start}-${word.text}`}
              style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: isActive ? 64 : 56,
                fontWeight: isActive ? 900 : 700,
                color: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)',
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
                transition: 'all 0.1s ease',
                textShadow: isActive
                  ? '0 2px 8px rgba(0, 0, 0, 0.8)'
                  : 'none',
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};

const HookOverlay: React.FC<{
  hook: Hook;
  frame: number;
  fps: number;
  videoAreaHeight: number;
}> = ({ hook, frame, fps, videoAreaHeight }) => {
  const timeInSeconds = frame / fps;
  if (timeInSeconds < hook.startTime || timeInSeconds > hook.endTime) {
    return null;
  }

  const hookDurationFrames = (hook.endTime - hook.startTime) * fps;
  const hookStartFrame = hook.startTime * fps;
  const localFrame = frame - hookStartFrame;

  const opacity = interpolate(
    localFrame,
    [0, 10, hookDurationFrames - 10, hookDurationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: videoAreaHeight,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 60,
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 52,
          fontWeight: 900,
          color: '#FFFFFF',
          textAlign: 'center',
          maxWidth: '90%',
          textShadow: '0 4px 12px rgba(0, 0, 0, 0.9), 0 2px 4px rgba(0, 0, 0, 0.5)',
          lineHeight: 1.2,
        }}
      >
        {hook.text}
      </div>
    </div>
  );
};

export const DocuBuildShort: React.FC<DocuBuildShortSchemaProps> = ({
  videoUrl,
  edl,
  selectedHook,
}) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const timeInSeconds = frame / fps;

  const videoAreaHeight = Math.round(height * VIDEO_AREA_PERCENT);
  const captionAreaHeight = Math.round(height * CAPTION_AREA_PERCENT);

  // Calculate cumulative frame offset for segments
  let cumulativeOffset = 0;
  const segmentSequences = edl.segments.map((segment) => {
    const segmentDurationFrames = Math.round((segment.end - segment.start) * fps);
    const startFrom = Math.round(segment.start * fps);
    const sequenceFrom = cumulativeOffset;
    cumulativeOffset += segmentDurationFrames;
    return { segment, segmentDurationFrames, startFrom, sequenceFrom };
  });

  // Cast EDL captions to TranscriptWord[] (zod schema matches the interface)
  const captions = edl.captions as TranscriptWord[];

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/* Video area - letterboxed in top 60% */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: videoAreaHeight,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
        }}
      >
        {segmentSequences.map(({ segment, segmentDurationFrames, startFrom, sequenceFrom }) => (
          <Sequence
            key={`${segment.start}-${segment.end}`}
            from={sequenceFrom}
            durationInFrames={segmentDurationFrames}
            layout="none"
          >
            <OffthreadVideo
              src={videoUrl}
              startFrom={startFrom}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          </Sequence>
        ))}
      </div>

      {/* Hook overlay on video portion */}
      {selectedHook && (
        <HookOverlay
          hook={selectedHook as Hook}
          frame={frame}
          fps={fps}
          videoAreaHeight={videoAreaHeight}
        />
      )}

      {/* Caption bar - bottom 40% */}
      <CaptionBar
        captions={captions}
        timeInSeconds={timeInSeconds}
        height={captionAreaHeight}
      />
    </AbsoluteFill>
  );
};
