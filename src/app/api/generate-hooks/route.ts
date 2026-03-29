import { NextRequest, NextResponse } from "next/server";
import { generateJSON, DEFAULT_GEMINI_MODEL } from "@/lib/gemini";
import { getProject, saveProject } from "@/lib/store";

const HOOK_GENERATION_SYSTEM_PROMPT = `You are a hook writer for short-form founder content. Given a video transcript, generate punchy, attention-grabbing hooks that would make someone stop scrolling. Each hook should be 5-10 words max. Return hooks that capture the most interesting/surprising/valuable moment in the transcript.

Return your response as JSON in this exact format:
{
  "hooks": [
    { "text": "The hook text here", "reasoning": "Why this hook works and what moment it captures" }
  ]
}

Rules:
- Each hook must be 5-10 words
- Hooks should be provocative, surprising, or create curiosity
- Focus on the most compelling moments from the transcript
- Include reasoning for why each hook would stop the scroll
- Do not use clickbait that misrepresents the content`;

const DEFAULT_COUNT = 5;

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const body = await request.json();
    const { projectId, count = DEFAULT_COUNT } = body as {
      projectId: string;
      count?: number;
    };

    console.log(
      `[hooks] Request received projectId=${String(projectId)} count=${count}`
    );

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const project = await getProject(projectId);
    if (!project || !project.transcript) {
      return NextResponse.json(
        { error: "Project not found or missing transcript" },
        { status: 404 }
      );
    }

    console.log(
      `[hooks] Generating hooks projectId=${projectId} transcript_words=${project.transcript.words.length}`
    );

    const result = await generateJSON<{
      hooks: Array<{ text: string; reasoning: string }>;
    }>(
      DEFAULT_GEMINI_MODEL,
      HOOK_GENERATION_SYSTEM_PROMPT,
      `Generate exactly ${count} hooks for this transcript:\n\n${project.transcript.fullText}`,
      {
        temperature: 0.9,
        timeoutMs: 60 * 1000,
        operationName: `hook generation projectId=${projectId}`,
      }
    );

    // Persist hooks to project
    await saveProject({ ...project, hookCandidates: result.hooks });

    console.log(
      `[hooks] Hooks persisted projectId=${projectId} hooks=${result.hooks.length} elapsed_ms=${Date.now() - startedAt}`
    );

    return NextResponse.json({ hooks: result.hooks });
  } catch (error) {
    console.error("[hooks] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate hooks",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
