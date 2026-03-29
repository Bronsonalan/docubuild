import { access } from "fs/promises";
import { NextResponse } from "next/server";
import { RENDERS_DIR, UPLOADS_DIR } from "@/lib/media";

export const dynamic = "force-dynamic";

const DEFAULT_CHROME_EXECUTABLE =
  process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "/usr/bin/chromium";

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const chromePath =
    process.env.REMOTION_BROWSER_EXECUTABLE ||
    process.env.CHROME_PATH ||
    DEFAULT_CHROME_EXECUTABLE;

  const [uploadsDirExists, rendersDirExists, chromeExists] = await Promise.all([
    pathExists(UPLOADS_DIR),
    pathExists(RENDERS_DIR),
    pathExists(chromePath),
  ]);

  return NextResponse.json({
    ok: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    chromePath,
    chromeExists,
    storage: {
      uploadsDir: UPLOADS_DIR,
      uploadsDirExists,
      rendersDir: RENDERS_DIR,
      rendersDirExists,
    },
  });
}
