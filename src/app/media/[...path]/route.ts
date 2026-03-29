import { createReadStream, type ReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getMediaPath, getMimeType, type MediaKind } from "@/lib/media";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function parseMediaParts(parts: string[]): { kind: MediaKind; fileName: string } {
  if (parts.length !== 2) {
    throw new Error("Invalid media path");
  }

  const [kind, fileName] = parts;
  if (kind !== "uploads" && kind !== "renders") {
    throw new Error("Invalid media kind");
  }

  if (path.basename(fileName) !== fileName) {
    throw new Error("Invalid media filename");
  }

  return { kind, fileName };
}

function isIgnorableStreamError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return (
    code === "ERR_INVALID_STATE" ||
    code === "ERR_STREAM_PREMATURE_CLOSE" ||
    code === "ECONNRESET"
  );
}

function toWebStream(
  stream: ReadStream,
  signal: AbortSignal
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const cleanup = () => {
        stream.off("data", onData);
        stream.off("end", onEnd);
        stream.off("error", onError);
        signal.removeEventListener("abort", onAbort);
      };

      const closeSafely = () => {
        if (closed) return;
        closed = true;
        cleanup();
        try {
          controller.close();
        } catch {
          // The controller may already be closed if the consumer cancelled.
        }
      };

      const destroySafely = () => {
        if (!stream.destroyed) {
          stream.destroy();
        }
      };

      const onData = (chunk: string | Buffer) => {
        if (closed) return;
        try {
          const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
          controller.enqueue(new Uint8Array(buf));
        } catch (error) {
          if (!isIgnorableStreamError(error)) {
            console.error("[media] Stream enqueue error:", error);
          }
          closeSafely();
          destroySafely();
        }
      };

      const onEnd = () => {
        closeSafely();
      };

      const onError = (error: Error) => {
        if (closed) return;
        closed = true;
        cleanup();
        if (isIgnorableStreamError(error)) {
          destroySafely();
          return;
        }
        controller.error(error);
      };

      const onAbort = () => {
        closeSafely();
        destroySafely();
      };

      stream.on("data", onData);
      stream.on("end", onEnd);
      stream.on("error", onError);
      signal.addEventListener("abort", onAbort, { once: true });
    },
    cancel() {
      if (!stream.destroyed) {
        stream.destroy();
      }
    },
  });
}

async function serveFile(
  request: NextRequest,
  context: RouteContext,
  headOnly: boolean
) {
  try {
    const { path: parts } = await context.params;
    const { kind, fileName } = parseMediaParts(parts);
    const filePath = getMediaPath(kind, fileName);
    const fileStat = await stat(filePath);
    const contentType = getMimeType(filePath);

    const commonHeaders = new Headers({
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": contentType,
    });

    const range = request.headers.get("range");
    if (!range) {
      commonHeaders.set("Content-Length", String(fileStat.size));
      if (headOnly) {
        return new NextResponse(null, { headers: commonHeaders });
      }

      const stream = createReadStream(filePath);
      return new NextResponse(toWebStream(stream, request.signal), {
        headers: commonHeaders,
      });
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      return new NextResponse("Invalid Range header", { status: 416 });
    }

    const [, startText, endText] = match;
    const start = startText ? Number.parseInt(startText, 10) : 0;
    const end = endText ? Number.parseInt(endText, 10) : fileStat.size - 1;

    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start < 0 ||
      end < start ||
      start >= fileStat.size
    ) {
      return new NextResponse("Requested range not satisfiable", {
        status: 416,
        headers: {
          "Content-Range": `bytes */${fileStat.size}`,
        },
      });
    }

    const chunkSize = end - start + 1;
    commonHeaders.set("Content-Length", String(chunkSize));
    commonHeaders.set("Content-Range", `bytes ${start}-${end}/${fileStat.size}`);

    if (headOnly) {
      return new NextResponse(null, { status: 206, headers: commonHeaders });
    }

    const stream = createReadStream(filePath, { start, end });
    return new NextResponse(toWebStream(stream, request.signal), {
      status: 206,
      headers: commonHeaders,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Invalid media path" ||
        error.message === "Invalid media kind" ||
        error.message === "Invalid media filename")
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return NextResponse.json({ error: "Media file not found" }, { status: 404 });
    }

    console.error("[media] Error:", error);
    return NextResponse.json({ error: "Failed to serve media" }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return serveFile(request, context, false);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  return serveFile(request, context, true);
}
