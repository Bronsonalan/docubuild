export interface TranscriptWord {
  text: string;
  start: number; // seconds
  end: number;   // seconds
  confidence: number;
}

export interface Transcript {
  words: TranscriptWord[];
  fullText: string;
  duration: number;
}

export interface Segment {
  start: number; // seconds
  end: number;   // seconds
}

export interface Hook {
  text: string;
  startTime: number;
  endTime: number;
}

export interface EDL {
  segments: Segment[];
  hooks: Hook[];
  captions: TranscriptWord[];
}

export interface Project {
  id: string;
  videoUrl: string;
  transcript: Transcript | null;
  edl: EDL | null;
  hookCandidates: Array<{ text: string; reasoning: string }>;
  selectedHook: Hook | null;
  outputUrl?: string;
  status: 'uploading' | 'transcribing' | 'processing' | 'editing' | 'rendering' | 'complete';
  createdAt: string;
}
