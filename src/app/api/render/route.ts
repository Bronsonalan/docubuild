import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { mkdir } from "fs/promises";
import { getProject, saveProject } from "@/lib/store";

export const maxDuration = 300;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function firstHeaderValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

function getRequestOrigin(request: NextRequest): string {
  const protocol =
    firstHeaderValue(request.headers.get("x-forwarded-proto")) ??
    request.nextUrl.protocol.replace(/:$/, "") ??
    "http";
  const host =
    firstHeaderValue(request.headers.get("x-forwarded-host")) ??
    firstHeaderValue(request.headers.get("host")) ??
    request.nextUrl.host;

  if (host) {
    return `${protocol}://${host}`;
  }

  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  let projectId: string | null = null;

  try {
    const body = await request.json();
    projectId = body.projectId;

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

    if (!project.edl) {
      return NextResponse.json(
        { error: "Project has no EDL" },
        { status: 400 }
      );
    }

    if (!project.transcript) {
      return NextResponse.json(
        { error: "Project has no transcript" },
        { status: 400 }
      );
    }

    // Update status to rendering
    project.status = "rendering";
    await saveProject(project);

    console.log(`[render] Starting render for project ${projectId}`);

    // OffthreadVideo needs an absolute URL that matches the current request origin.
    const absoluteVideoUrl = new URL(
      project.videoUrl,
      getRequestOrigin(request)
    ).toString();

    // Calculate total duration from EDL segments
    const totalSeconds = project.edl.segments.reduce(
      (sum, s) => sum + (s.end - s.start),
      0
    );
    const totalFrames = Math.max(1, Math.round(totalSeconds * 30));

    console.log(
      `[render] Total duration: ${totalSeconds}s (${totalFrames} frames)`
    );

    // Create output directory
    const rendersDir = path.join(process.cwd(), "public", "renders");
    await mkdir(rendersDir, { recursive: true });

    console.log("[render] Loading Remotion server packages...");
    const [{ bundle }, { renderMedia, selectComposition }] = await Promise.all([
      import("@remotion/bundler"),
      import("@remotion/renderer"),
    ]);

    // Bundle the Remotion entry point
    console.log("[render] Bundling Remotion project...");
    const bundleLocation = await bundle({
      entryPoint: path.join(process.cwd(), "src/remotion/index.ts"),
      webpackOverride: (config) => config,
    });

    console.log("[render] Bundle complete, selecting composition...");

    const inputProps = {
      videoUrl: absoluteVideoUrl,
      edl: project.edl,
      selectedHook: project.selectedHook || null,
    };

    // Resolve composition
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: "DocuBuildShort",
      inputProps,
    });

    // Render the video
    const outputPath = path.join(
      process.cwd(),
      "public",
      "renders",
      `${projectId}.mp4`
    );

    console.log(`[render] Rendering to ${outputPath}...`);

    await renderMedia({
      composition: {
        ...composition,
        durationInFrames: totalFrames,
      },
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
    });

    console.log(`[render] Render complete for project ${projectId}`);

    // Update project with output URL and status
    const outputUrl = `/renders/${projectId}.mp4`;
    project.status = "complete";
    project.outputUrl = outputUrl;
    await saveProject(project);

    return NextResponse.json({ outputUrl });
  } catch (error) {
    if (projectId) {
      try {
        const project = await getProject(projectId);
        if (project) {
          project.status = "editing";
          await saveProject(project);
        }
      } catch {
        // Best-effort cleanup; the original render error is the important signal.
      }
    }

    console.error("[render] Error:", error);
    return NextResponse.json(
      {
        error: "Render failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
