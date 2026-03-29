"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

type RecentProject = {
  id: string;
  createdAt: string;
  status: string;
  videoUrl: string;
  outputUrl: string | null;
  transcriptWords: number;
  segments: number;
};

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        const response = await fetch("/api/projects?limit=6");
        if (!response.ok) return;
        const data = (await response.json()) as { projects?: RecentProject[] };
        if (!cancelled) {
          setRecentProjects(data.projects || []);
        }
      } catch {
        // Best-effort only; the landing page should still work without history.
      }
    }

    loadProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Unsupported format. Use mp4, mov, or webm.");
        return;
      }
      setError(null);
      setUploading(true);
      setProgress(0);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload");

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        const result = await new Promise<{ id: string; videoUrl: string }>(
          (resolve, reject) => {
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
              } else {
                reject(new Error(xhr.statusText || "Upload failed"));
              }
            };
            xhr.onerror = () => reject(new Error("Upload failed"));
            xhr.send(formData);
          }
        );

        router.push(`/editor/${result.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setUploading(false);
      }
    },
    [router]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <h1 className="text-5xl font-bold tracking-tight mb-2">DocuBuild</h1>
      <p className="text-lg text-gray-400 mb-12">
        Upload. Auto-edit. Publish.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full max-w-xl h-64 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors ${
          dragging
            ? "border-white bg-white/5"
            : "border-gray-600 hover:border-gray-400"
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-gray-300">Uploading... {progress}%</p>
            <div className="w-48 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <svg
              className="w-10 h-10 text-gray-500 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-gray-300">
              Drop a video here, or click to browse
            </p>
            <p className="text-sm text-gray-500 mt-1">mp4, mov, webm</p>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && <p className="text-red-400 mt-4 text-sm">{error}</p>}

      {recentProjects.length > 0 && (
        <div className="w-full max-w-xl mt-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium uppercase tracking-[0.2em] text-gray-400">
              Recent Projects
            </h2>
            <span className="text-xs text-gray-500">
              Resume without re-uploading
            </span>
          </div>

          <div className="border border-gray-800 rounded-lg overflow-hidden bg-[#0f0f0f]">
            {recentProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between gap-4 px-4 py-3 border-b border-gray-800 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-mono text-gray-200 truncate">
                    {project.id}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatProjectMeta(project)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {project.outputUrl && (
                    <a
                      href={project.outputUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 text-xs rounded border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white"
                    >
                      Output
                    </a>
                  )}
                  <a
                    href={`/editor/${project.id}`}
                    className="px-3 py-1.5 text-xs rounded bg-white text-black hover:bg-gray-200"
                  >
                    Open
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatProjectMeta(project: RecentProject): string {
  const createdAt = new Date(project.createdAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return `${project.status} · ${project.transcriptWords} words · ${project.segments} segments · ${createdAt}`;
}
