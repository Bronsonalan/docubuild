"use client";

import { useState } from "react";

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

  const handleExport = async () => {
    setRendering(true);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (data.outputUrl) {
        onRenderComplete(data.outputUrl);
      }
    } catch {
      // stub
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#0e0e0e] border-t border-gray-800">
      <button
        onClick={onGenerateHooks}
        disabled={hooksLoading}
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
          Download
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
  );
}
