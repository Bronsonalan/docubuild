import { NextRequest, NextResponse } from "next/server";
import {
  uploadAndWaitForFile,
  generateJSON,
  DEFAULT_GEMINI_MODEL,
} from "@/lib/gemini";
import { getMimeType, resolveStoredFilePath } from "@/lib/media";
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
  let projectId: string | null = null;
  try {
    const body = await request.json();
    projectId = body.projectId;

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

    const videoPath = resolveStoredFilePath(project.videoUrl);
    const mimeType = getMimeType(videoPath);

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
      ],
      {
        timeoutMs: 3 * 60 * 1000,
        operationName: `transcription projectId=${projectId}`,
      }
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
    if (projectId) {
      try {
        const project = await getProject(projectId);
        if (project && !project.transcript) {
          await saveProject({ ...project, status: "uploading" });
          console.log(
            `[transcribe] Reset project status after failure projectId=${projectId}`
          );
        }
      } catch (cleanupError) {
        console.error("[transcribe] Cleanup error:", cleanupError);
      }
    }

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
