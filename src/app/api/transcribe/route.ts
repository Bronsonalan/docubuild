import { NextRequest, NextResponse } from "next/server";
import path from "path";
import {
  uploadAndWaitForFile,
  generateJSON,
  DEFAULT_GEMINI_MODEL,
} from "@/lib/gemini";
import { getProject, saveProject } from "@/lib/store";
import type { Transcript } from "@/types";

const TRANSCRIPTION_SYSTEM_PROMPT = `You are a precise audio/video transcription engine. Given a video file, transcribe every spoken word with accurate word-level timestamps.

Return your response as JSON in this exact format:
{
  "words": [
    { "text": "word", "start": 0.0, "end": 0.5, "confidence": 0.99 }
  ],
  "fullText": "the complete transcript as a single string",
  "duration": 123.45
}

Rules:
- "start" and "end" are in seconds (float)
- "confidence" is between 0 and 1
- "fullText" is all words joined by spaces
- "duration" is the total video duration in seconds
- Include every spoken word — do not skip filler words (um, uh, like, etc.)
- Timestamps must be monotonically increasing
- Each word's "end" must be >= its "start"`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId } = body;

    console.log(`[transcribe] Request received projectId=${String(projectId)}`);

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const project = await getProject(projectId);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (project.transcript) {
      console.log(
        `[transcribe] Reusing persisted transcript projectId=${projectId} words=${project.transcript.words.length}`
      );
      return NextResponse.json({ transcript: project.transcript });
    }

    // Update status
    await saveProject({ ...project, status: "transcribing" });
    console.log(
      `[transcribe] Starting Gemini transcription projectId=${projectId} videoUrl=${project.videoUrl}`
    );

    // Resolve the video file path from the public directory
    const videoPath = path.join(process.cwd(), "public", project.videoUrl);

    // Determine MIME type from extension
    const ext = path.extname(project.videoUrl).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".avi": "video/x-msvideo",
      ".webm": "video/webm",
      ".mkv": "video/x-matroska",
    };
    const mimeType = mimeTypes[ext] || "video/mp4";

    // Upload to Gemini File API and wait for processing
    const file = await uploadAndWaitForFile(
      videoPath,
      mimeType,
      `transcription-${Date.now()}`
    );
    console.log(
      `[transcribe] Gemini file ready projectId=${projectId} file=${file.name}`
    );

    // Generate transcription using Gemini
    const transcript = await generateJSON<Transcript>(
      DEFAULT_GEMINI_MODEL,
      TRANSCRIPTION_SYSTEM_PROMPT,
      [
        {
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri,
          },
        },
        { text: "Transcribe this video with word-level timestamps." },
      ]
    );

    console.log(
      `[transcribe] Gemini transcription complete projectId=${projectId} words=${transcript.words.length} duration=${transcript.duration}`
    );

    // Persist transcript so interrupted sessions can resume from processing.
    await saveProject({ ...project, transcript, status: "processing" });
    console.log(
      `[transcribe] Transcript persisted projectId=${projectId} next_status=processing`
    );

    return NextResponse.json({ transcript });
  } catch (error) {
    console.error("[transcribe] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to transcribe video",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
