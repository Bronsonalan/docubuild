"use client";

import { useState, useRef, useEffect } from "react";
import type { EDL } from "@/types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatBoxProps {
  projectId: string;
  onEdlUpdate: (edl: EDL) => void;
  messages: ChatMessage[];
  onMessagesUpdate: (messages: ChatMessage[]) => void;
}

export default function ChatBox({
  projectId,
  onEdlUpdate,
  messages,
  onMessagesUpdate,
}: ChatBoxProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    onMessagesUpdate(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          message: text,
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const data = await res.json();

      onMessagesUpdate([
        ...newMessages,
        {
          role: "assistant",
          content: data.explanation || "Edit applied.",
        },
      ]);

      if (data.edl) {
        onEdlUpdate(data.edl);
      }
    } catch {
      onMessagesUpdate([
        ...newMessages,
        { role: "assistant", content: "Error processing your request." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`flex flex-col bg-[#111] border-t border-gray-800 transition-all ${
        expanded ? "h-72" : "h-32"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-800">
        <span className="text-xs text-gray-500 uppercase tracking-wider">
          Chat
        </span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 text-sm min-h-0">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={
              msg.role === "user" ? "text-gray-200" : "text-gray-400"
            }
          >
            <span className="text-gray-600 text-xs mr-1.5">
              {msg.role === "user" ? "you:" : "ai:"}
            </span>
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="text-gray-500 text-xs">Thinking...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-800">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder='e.g. "Cut the first 30 seconds"'
          className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded text-sm"
        >
          Send
        </button>
      </div>
    </div>
  );
}
