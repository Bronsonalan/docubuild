import { NextRequest, NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  try {
    const { id } = await params;
    console.log(`[project] GET request received id=${id}`);
    const project = await getProject(id);

    if (!project) {
      console.warn(
        `[project] GET not found id=${id} elapsed_ms=${Date.now() - startedAt}`
      );
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    console.log(
      `[project] GET success id=${id} status=${project.status} transcript=${Boolean(project.transcript)} edl=${Boolean(project.edl)} output=${Boolean(project.outputUrl)} elapsed_ms=${Date.now() - startedAt}`
    );
    return NextResponse.json(project);
  } catch (error) {
    console.error("[project] GET error:", error);
    return NextResponse.json(
      { error: "Failed to get project" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startedAt = Date.now();
  try {
    const { id } = await params;
    console.log(`[project] PUT request received id=${id}`);
    const existing = await getProject(id);

    if (!existing) {
      console.warn(
        `[project] PUT not found id=${id} elapsed_ms=${Date.now() - startedAt}`
      );
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const updates = await request.json();
    const merged = { ...existing, ...updates, id };
    await saveProject(merged);

    const updatedKeys = Object.keys(updates).sort().join(",");
    console.log(
      `[project] PUT success id=${id} updated_keys=${updatedKeys || "none"} status=${merged.status} elapsed_ms=${Date.now() - startedAt}`
    );

    return NextResponse.json(merged);
  } catch (error) {
    console.error("[project] PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}
