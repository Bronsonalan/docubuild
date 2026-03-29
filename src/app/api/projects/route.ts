import { NextRequest, NextResponse } from "next/server";
import { listProjects } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;
    const projects = await listProjects(Number.isNaN(limit) ? 20 : limit);

    return NextResponse.json({
      projects: projects.map((project) => ({
        id: project.id,
        createdAt: project.createdAt,
        status: project.status,
        videoUrl: project.videoUrl,
        outputUrl: project.outputUrl || null,
        transcriptWords: project.transcript?.words.length ?? 0,
        segments: project.edl?.segments.length ?? 0,
      })),
    });
  } catch (error) {
    console.error("[projects] Error:", error);
    return NextResponse.json(
      { error: "Failed to list projects" },
      { status: 500 }
    );
  }
}
