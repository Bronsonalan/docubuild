"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
    </div>
  );
}
