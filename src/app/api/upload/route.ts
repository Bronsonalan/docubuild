import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { saveProject } from "@/lib/store";
import type { Project } from "@/types";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided. Send a file field in multipart form data." },
        { status: 400 }
      );
    }

    // Ensure uploads directory exists
    await mkdir(UPLOADS_DIR, { recursive: true });

    // Generate a UUID filename preserving the original extension
    const ext = path.extname(file.name) || ".mp4";
    const id = uuidv4();
    const filename = `${id}${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);

    // Write the file to disk
    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    const videoUrl = `/uploads/${filename}`;

    // Save project to store
    const project: Project = {
      id,
      videoUrl,
      transcript: null,
      edl: null,
      hookCandidates: [],
      selectedHook: null,
      status: "uploading",
      createdAt: new Date().toISOString(),
    };
    await saveProject(project);

    return NextResponse.json({ id, videoUrl });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
