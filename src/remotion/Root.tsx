import React from 'react';
import { Composition } from 'remotion';
import { DocuBuildShort } from './DocuBuildShort';
import { docuBuildShortSchema } from './schema';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DocuBuildShort"
        component={DocuBuildShort}
        schema={docuBuildShortSchema}
        durationInFrames={30 * 30}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          edl: {
            segments: [{ start: 0, end: 30 }],
            hooks: [],
            captions: [
              { text: 'Welcome', start: 0, end: 0.5, confidence: 1 },
              { text: 'to', start: 0.5, end: 0.7, confidence: 1 },
              { text: 'DocuBuild', start: 0.7, end: 1.2, confidence: 1 },
            ],
          },
          selectedHook: {
            text: 'The moment everything changed',
            startTime: 2,
            endTime: 6,
          },
        }}
      />
    </>
  );
};
