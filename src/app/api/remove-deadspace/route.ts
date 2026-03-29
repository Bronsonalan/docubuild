import { NextRequest, NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/store";
import type { EDL, Segment, TranscriptWord } from "@/types";

const DEFAULT_THRESHOLD = 1.0; // seconds — only cut gaps longer than 1s

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, threshold = DEFAULT_THRESHOLD } = body as {
      projectId: string;
      threshold?: number;
    };

    console.log(
      `[deadspace] Request received projectId=${String(projectId)} threshold=${threshold}`
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

    const { transcript } = project;
    console.log(
      `[deadspace] Processing transcript projectId=${projectId} words=${transcript.words.length}`
    );

    if (transcript.words.length === 0) {
      const emptyEdl: EDL = { segments: [], hooks: [], captions: [] };
      await saveProject({ ...project, edl: emptyEdl, status: "editing" });
      console.log(
        `[deadspace] Empty transcript projectId=${projectId} -> empty EDL persisted`
      );
      return NextResponse.json({ edl: emptyEdl });
    }

    const segments: Segment[] = [];
    const captions: TranscriptWord[] = [];

    // Group consecutive words where the gap between them is <= threshold
    let groupStart = transcript.words[0].start;
    let groupEnd = transcript.words[0].end;
    let groupWords: TranscriptWord[] = [transcript.words[0]];

    for (let i = 1; i < transcript.words.length; i++) {
      const prev = transcript.words[i - 1];
      const curr = transcript.words[i];
      const gap = curr.start - prev.end;

      if (gap <= threshold) {
        groupEnd = curr.end;
        groupWords.push(curr);
      } else {
        segments.push({ start: groupStart, end: groupEnd });
        captions.push(...groupWords);

        groupStart = curr.start;
        groupEnd = curr.end;
        groupWords = [curr];
      }
    }

    // Finalize the last group
    segments.push({ start: groupStart, end: groupEnd });
    captions.push(...groupWords);

    const edl: EDL = {
      segments,
      hooks: [],
      captions,
    };

    // Persist EDL to project
    await saveProject({ ...project, edl, status: "editing" });
    console.log(
      `[deadspace] EDL persisted projectId=${projectId} segments=${edl.segments.length} captions=${edl.captions.length}`
    );

    return NextResponse.json({ edl });
  } catch (error) {
    console.error("[deadspace] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to remove dead space",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
