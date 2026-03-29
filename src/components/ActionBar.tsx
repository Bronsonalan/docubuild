"use client";

import { useEffect, useState } from "react";

interface ActionBarProps {
  projectId: string;
  onGenerateHooks: () => void;
  hooksLoading: boolean;
  outputUrl: string | null;
  onRenderComplete: (url: string) => void;
}

export default function ActionBar({
  projectId,
  onGenerateHooks,
  hooksLoading,
  outputUrl,
  onRenderComplete,
}: ActionBarProps) {
  const [rendering, setRendering] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"info" | "success" | "error">(
    "info"
  );

  useEffect(() => {
    if (!rendering) return;

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [rendering]);

  const formatElapsed = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${remainder.toString().padStart(2, "0")}`;
  };

  const handleExport = async () => {
    setRendering(true);
    setElapsedSeconds(0);
    setStatusMessage(null);
    setStatusTone("info");

    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      const data = await res.json();
      if (!res.ok) {
        const details =
          typeof data?.details === "string" && data.details
            ? `: ${data.details}`
            : "";
        throw new Error(`${data?.error || "Render failed"}${details}`);
      }

      if (!data.outputUrl) {
        throw new Error("Render completed without an output URL.");
      }

      onRenderComplete(data.outputUrl);
      setStatusTone("success");
      setStatusMessage("Render complete.");
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Render failed."
      );
    } finally {
      setRendering(false);
    }
  };

  const activeStatus = rendering
    ? `Rendering... ${formatElapsed(elapsedSeconds)}`
    : statusMessage;
  const statusClass =
    statusTone === "error"
      ? "text-red-400"
      : statusTone === "success"
      ? "text-green-400"
      : "text-gray-400";

  return (
    <div className="px-4 py-3 bg-[#0e0e0e] border-t border-gray-800">
      <div className="flex items-center gap-3">
        <button
          onClick={onGenerateHooks}
          disabled={hooksLoading || rendering}
          className="px-4 py-2 bg-white text-black rounded font-medium text-sm hover:bg-gray-200 disabled:opacity-50"
        >
          {hooksLoading ? "Generating..." : "Generate Hooks"}
        </button>

        <button
          onClick={handleExport}
          disabled={rendering}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-50"
        >
          {rendering ? "Rendering..." : "Export"}
        </button>

        {outputUrl && (
          <a
            href={outputUrl}
            download
            className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded text-sm"
          >
            Download MP4
          </a>
        )}

        <button
          disabled
          className="px-4 py-2 bg-gray-800 text-gray-500 rounded text-sm cursor-not-allowed"
          title="Coming soon"
        >
          Publish to YouTube (Coming Soon)
        </button>
      </div>

      {activeStatus && (
        <p className={`mt-2 text-sm ${statusClass}`}>{activeStatus}</p>
      )}
    </div>
  );
}
