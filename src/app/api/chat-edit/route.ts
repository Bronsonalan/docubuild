import { NextRequest, NextResponse } from "next/server";
import { generateJSON, DEFAULT_GEMINI_MODEL } from "@/lib/gemini";
import { getProject, saveProject } from "@/lib/store";
import type { EDL } from "@/types";

const CHAT_EDIT_SYSTEM_PROMPT = `You are a video editor assistant. The user is editing a video using a transcript-based editor. They will give you commands like "remove from 1:30 to 2:00", "cut the part where I talk about X", "keep only the first 3 minutes", etc.

You have the full transcript with word-level timestamps and the current edit decision list (EDL). Interpret the user's command and return an updated EDL.

Return JSON in this exact format:
{
  "segments": [{ "start": 0.0, "end": 5.0 }],
  "hooks": [{ "text": "hook text", "startTime": 0.0, "endTime": 3.0 }],
  "captions": [{ "text": "word", "start": 0.0, "end": 0.5, "confidence": 0.99 }],
  "explanation": "What I changed and why"
}

Rules:
- segments: array of time ranges (in seconds) to include in the final video
- hooks: preserve existing hooks unless the user asks to change them, adjust times if segments shift
- captions: include only the transcript words that fall within the new segments
- explanation: brief natural language description of what was changed
- Times are in seconds (float)
- Segments must not overlap and should be sorted by start time
- When the user says "remove" or "cut", exclude that range from segments
- When the user says "keep only", include only that range
- When the user references transcript content ("the part where I talk about X"), use the transcript to find the relevant timestamps`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, message } = body as {
      projectId: string;
      message: string;
    };

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    const project = await getProject(projectId);
    if (!project || !project.transcript || !project.edl) {
      return NextResponse.json(
        { error: "Project not found or missing transcript/edl" },
        { status: 404 }
      );
    }

    const prompt = `User command: "${message}"

Current EDL:
${JSON.stringify(project.edl, null, 2)}

Full transcript:
${JSON.stringify(project.transcript, null, 2)}

Apply the user's editing command and return the updated EDL.`;

    const result = await generateJSON<EDL & { explanation: string }>(
      DEFAULT_GEMINI_MODEL,
      CHAT_EDIT_SYSTEM_PROMPT,
      prompt
    );

    const { explanation, ...updatedEdl } = result;
    const edl: EDL = {
      segments: updatedEdl.segments,
      hooks: updatedEdl.hooks,
      captions: updatedEdl.captions,
    };

    // Persist updated EDL to project
    await saveProject({ ...project, edl });

    return NextResponse.json({ edl, explanation });
  } catch (error) {
    console.error("Chat edit error:", error);
    return NextResponse.json(
      { error: "Failed to process editing command" },
      { status: 500 }
    );
  }
}
