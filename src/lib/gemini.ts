import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";

const apiKey = process.env.GEMINI_API_KEY;
const FILE_POLL_INTERVAL_MS = 2000;
const FILE_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}

export const genAI = new GoogleGenerativeAI(apiKey);
export const fileManager = new GoogleAIFileManager(apiKey);
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/**
 * Upload a file to the Gemini File API and wait for it to become ACTIVE.
 */
export async function uploadAndWaitForFile(
  filePath: string,
  mimeType: string,
  displayName: string
) {
  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType,
    displayName,
  });

  let file = uploadResult.file;
  const startedAt = Date.now();

  // Poll until the file is done processing
  while (file.state === FileState.PROCESSING) {
    if (Date.now() - startedAt > FILE_PROCESSING_TIMEOUT_MS) {
      throw new Error(
        `File processing timed out after ${FILE_PROCESSING_TIMEOUT_MS / 1000}s`
      );
    }

    await new Promise((resolve) => setTimeout(resolve, FILE_POLL_INTERVAL_MS));
    file = await fileManager.getFile(file.name);
  }

  if (file.state === FileState.FAILED) {
    throw new Error(`File processing failed: ${file.name}`);
  }

  return file;
}

/**
 * Generate content with JSON output using the specified model.
 */
export async function generateJSON<T>(
  modelName: string,
  systemInstruction: string,
  prompt: string | Array<import("@google/generative-ai").Part>,
  requestOptions?: { temperature?: number }
): Promise<T> {
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: requestOptions?.temperature,
    },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return JSON.parse(text) as T;
}
