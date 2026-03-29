import { NextRequest, NextResponse } from "next/server";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import { mkdir } from "fs/promises";
import { getProject, saveProject } from "@/lib/store";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();

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

    // Construct absolute video URL
    const port = process.env.PORT || 3000;
    const absoluteVideoUrl = `http://localhost:${port}${project.videoUrl}`;

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
