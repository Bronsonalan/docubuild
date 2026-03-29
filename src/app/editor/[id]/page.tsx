"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import type { Project, Transcript, EDL, Hook } from "@/types";
import type { ChatMessage } from "@/components/ChatBox";
import VideoPlayer from "@/components/VideoPlayer";
import TranscriptPanel from "@/components/TranscriptPanel";
import ChatBox from "@/components/ChatBox";
import HookSelector from "@/components/HookSelector";
import ActionBar from "@/components/ActionBar";

type EditorStatus = "loading" | "transcribing" | "processing" | "ready" | "error";

const DEFAULT_EDL: EDL = { segments: [], hooks: [], captions: [] };

async function getErrorMessage(response: Response, fallback: string) {
  try {
    const data = await response.json();
    if (typeof data?.details === "string" && data.details) {
      return `${fallback}: ${data.details}`;
    }
    if (typeof data?.error === "string" && data.error) {
      return `${fallback}: ${data.error}`;
    }
  } catch {
    // Fall through to the default message if the response body is not JSON.
  }

  return fallback;
}

export default function EditorPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [status, setStatus] = useState<EditorStatus>("loading");
  const [videoUrl, setVideoUrl] = useState("");
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [edl, setEdl] = useState<EDL>(DEFAULT_EDL);
  const [hookCandidates, setHookCandidates] = useState<
    Array<{ text: string; reasoning: string }>
  >([]);
  const [selectedHook, setSelectedHook] = useState<Hook | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [playerTime, setPlayerTime] = useState(0);
  const [showHookSelector, setShowHookSelector] = useState(false);
  const [hooksLoading, setHooksLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [projectStatus, setProjectStatus] = useState<Project["status"]>(
    "uploading"
  );
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderStartedAt, setRenderStartedAt] = useState<string | null>(null);
  const initRan = useRef(false);

  // Persist a partial update (for client-only state like selectedHook)
  const persistProject = useCallback(
    async (updates: Partial<Project>) => {
      try {
        await fetch(`/api/project/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
      } catch {
        // best-effort
      }
    },
    [projectId]
  );

  // On mount: fetch project, run pipeline if needed
  useEffect(() => {
    if (initRan.current) return;
    initRan.current = true;
    let cancelled = false;

    async function init() {
      try {
        console.log(`[editor] init start projectId=${projectId}`);
        const res = await fetch(`/api/project/${projectId}`);
        if (!res.ok) throw new Error("Project not found");
        const proj: Project = await res.json();
        if (cancelled) return;

        console.log(
          `[editor] project loaded projectId=${projectId} transcript=${Boolean(proj.transcript)} edl=${Boolean(proj.edl)} status=${proj.status}`
        );
        setVideoUrl(proj.videoUrl);
        setHookCandidates(proj.hookCandidates || []);
        setSelectedHook(proj.selectedHook);
        setOutputUrl(proj.outputUrl || null);
        setProjectStatus(proj.status);
        setRenderError(proj.renderError || null);
        setRenderStartedAt(proj.renderStartedAt || null);

        // If already processed, load from store
        if (proj.transcript && proj.edl) {
          setTranscript(proj.transcript);
          setEdl(proj.edl);
          setStatus("ready");
          console.log(`[editor] ready from persisted state projectId=${projectId}`);
          return;
        }

        let transcriptToProcess = proj.transcript;
        if (transcriptToProcess) {
          setTranscript(transcriptToProcess);
          console.log(
            `[editor] resuming with persisted transcript projectId=${projectId} words=${transcriptToProcess.words.length}`
          );
        } else {
          // Step 1: Transcribe (server persists result)
          setStatus("transcribing");
          console.log(`[editor] requesting transcription projectId=${projectId}`);
          const transcribeRes = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId }),
          });
          if (!transcribeRes.ok) {
            throw new Error(
              await getErrorMessage(transcribeRes, "Transcription failed")
            );
          }
          const transcribeData = await transcribeRes.json();
          if (cancelled) return;
          transcriptToProcess = transcribeData.transcript;
          setTranscript(transcriptToProcess);
          console.log(
            `[editor] transcription received projectId=${projectId} words=${transcriptToProcess?.words?.length ?? 0}`
          );
        }

        // Step 2: Remove dead space (server persists result)
        setStatus("processing");
        console.log(`[editor] requesting dead-space removal projectId=${projectId}`);
        const deadspaceRes = await fetch("/api/remove-deadspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        });
        if (!deadspaceRes.ok) {
          throw new Error(
            await getErrorMessage(deadspaceRes, "Processing failed")
          );
        }
        const deadspaceData = await deadspaceRes.json();
        if (cancelled) return;
        setEdl(deadspaceData.edl);

        setStatus("ready");
        console.log(
          `[editor] ready after processing projectId=${projectId} segments=${deadspaceData.edl.segments.length}`
        );
      } catch (err) {
        if (!cancelled) {
          console.error(`[editor] init failed projectId=${projectId}`, err);
          setErrorMsg(err instanceof Error ? err.message : "Unknown error");
          setStatus("error");
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleGenerateHooks = useCallback(async () => {
    if (!transcript || hooksLoading) return;
    setHooksLoading(true);
    try {
      const res = await fetch("/api/generate-hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error("Hook generation failed");
      const data = await res.json();
      setHookCandidates(data.hooks || []);
      setShowHookSelector(true);
    } catch {
      // silently fail for MVP
    } finally {
      setHooksLoading(false);
    }
  }, [projectId, transcript, hooksLoading]);

  const handleSelectHook = useCallback(
    async (hook: Hook) => {
      setSelectedHook(hook);
      setShowHookSelector(false);
      await persistProject({ selectedHook: hook });
    },
    [persistProject]
  );

  const handleEdlUpdate = useCallback((newEdl: EDL) => {
    // Chat-edit already persists server-side, just update local state
    setEdl(newEdl);
  }, []);

  const handleRenderComplete = useCallback(
    async (url: string) => {
      setOutputUrl(url);
      setProjectStatus("complete");
      setRenderError(null);
      setRenderStartedAt(null);
    },
    []
  );

  const handleSeek = useCallback((time: number) => {
    setPlayerTime(time);
  }, []);

  const edlDuration = edl.segments.reduce(
    (sum, s) => sum + (s.end - s.start),
    0
  );

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading project...</p>
      </div>
    );
  }

  if (status === "transcribing") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-300 mb-2">Transcribing...</p>
          <p className="text-gray-500 text-sm">
            This may take a minute for longer videos.
          </p>
        </div>
      </div>
    );
  }

  if (status === "processing") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-300 mb-2">Removing dead space...</p>
          <p className="text-gray-500 text-sm">
            Analyzing transcript for silence gaps.
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-400 mb-2">Error</p>
          <p className="text-gray-500 text-sm mb-4">{errorMsg}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <span className="text-sm font-semibold tracking-tight">DocuBuild</span>
        {selectedHook && (
          <span className="text-xs text-gray-500 truncate max-w-xs">
            Hook: &ldquo;{selectedHook.text}&rdquo;
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Left column: Video + Chat */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 min-h-0">
            <VideoPlayer
              videoUrl={videoUrl}
              edl={edl}
              currentTime={playerTime}
              onTimeUpdate={setPlayerTime}
            />
          </div>

          {transcript && (
            <ChatBox
              projectId={projectId}
              onEdlUpdate={handleEdlUpdate}
              messages={chatMessages}
              onMessagesUpdate={setChatMessages}
            />
          )}
        </div>

        {/* Right column: Transcript */}
        <div className="w-80 border-l border-gray-800 flex-shrink-0">
          {transcript && (
            <TranscriptPanel
              words={transcript.words}
              edl={edl}
              currentTime={playerTime}
              onSeek={handleSeek}
            />
          )}
        </div>
      </div>

      {/* Action bar */}
      <ActionBar
        projectId={projectId}
        onGenerateHooks={handleGenerateHooks}
        hooksLoading={hooksLoading}
        outputUrl={outputUrl}
        projectStatus={projectStatus}
        renderError={renderError}
        renderStartedAt={renderStartedAt}
        onRenderComplete={handleRenderComplete}
      />

      {/* Hook selector modal */}
      {showHookSelector && (
        <HookSelector
          candidates={hookCandidates}
          edlDuration={edlDuration}
          onSelect={handleSelectHook}
          onClose={() => setShowHookSelector(false)}
        />
      )}
    </div>
  );
}
