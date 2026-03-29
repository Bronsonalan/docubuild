import type { Part } from "@google/generative-ai";

const FILE_POLL_INTERVAL_MS = 2000;
const FILE_PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_GENERATION_TIMEOUT_MS = 60 * 1000;

type GeminiClients = {
  FileState: (typeof import("@google/generative-ai/server"))["FileState"];
  fileManager: InstanceType<
    (typeof import("@google/generative-ai/server"))["GoogleAIFileManager"]
  >;
  genAI: InstanceType<(typeof import("@google/generative-ai"))["GoogleGenerativeAI"]>;
};

let geminiClientsPromise: Promise<GeminiClients> | null = null;

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.error(
        `[gemini] ${operationName} timed out after ${timeoutMs}ms`
      );
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  return apiKey;
}

async function getGeminiClients(): Promise<GeminiClients> {
  if (!geminiClientsPromise) {
    geminiClientsPromise = (async () => {
      const [{ GoogleGenerativeAI }, { GoogleAIFileManager, FileState }] =
        await Promise.all([
          import("@google/generative-ai"),
          import("@google/generative-ai/server"),
        ]);
      const apiKey = getApiKey();

      return {
        FileState,
        fileManager: new GoogleAIFileManager(apiKey),
        genAI: new GoogleGenerativeAI(apiKey),
      };
    })();
  }

  return geminiClientsPromise;
}

/**
 * Upload a file to the Gemini File API and wait for it to become ACTIVE.
 */
export async function uploadAndWaitForFile(
  filePath: string,
  mimeType: string,
  displayName: string
) {
  const startedAt = Date.now();
  const { fileManager, FileState } = await getGeminiClients();
  console.log(
    `[gemini] Uploading file for processing: ${displayName} (${mimeType}) from ${filePath}`
  );
  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType,
    displayName,
  });

  let file = uploadResult.file;
  let pollCount = 0;

  console.log(
    `[gemini] File uploaded: ${file.name} initial state=${String(file.state)}`
  );

  // Poll until the file is done processing
  while (file.state === FileState.PROCESSING) {
    pollCount += 1;
    if (Date.now() - startedAt > FILE_PROCESSING_TIMEOUT_MS) {
      throw new Error(
        `File processing timed out after ${FILE_PROCESSING_TIMEOUT_MS / 1000}s for ${file.name}`
      );
    }

    console.log(
      `[gemini] Poll ${pollCount} for ${file.name}: state=${String(file.state)} elapsed_ms=${Date.now() - startedAt}`
    );
    await new Promise((resolve) => setTimeout(resolve, FILE_POLL_INTERVAL_MS));
    file = await fileManager.getFile(file.name);
  }

  if (file.state === FileState.FAILED) {
    throw new Error(`File processing failed: ${file.name}`);
  }

  console.log(
    `[gemini] File ready: ${file.name} final state=${String(file.state)} elapsed_ms=${Date.now() - startedAt}`
  );

  return file;
}

/**
 * Generate content with JSON output using the specified model.
 */
export async function generateJSON<T>(
  modelName: string,
  systemInstruction: string,
  prompt: string | Array<Part>,
  requestOptions?: {
    temperature?: number;
    timeoutMs?: number;
    operationName?: string;
  }
): Promise<T> {
  const startedAt = Date.now();
  const { genAI } = await getGeminiClients();
  const operationName = requestOptions?.operationName ?? "generateJSON";
  const timeoutMs =
    requestOptions?.timeoutMs ?? DEFAULT_GENERATION_TIMEOUT_MS;
  console.log(
    `[gemini] generateJSON start model=${modelName} operation=${operationName} prompt_type=${Array.isArray(prompt) ? "parts" : "text"} timeout_ms=${timeoutMs}`
  );
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: requestOptions?.temperature,
    },
  });

  const result = await withTimeout(
    model.generateContent(prompt),
    timeoutMs,
    operationName
  );
  const text = result.response.text();
  console.log(
    `[gemini] generateJSON complete model=${modelName} operation=${operationName} response_chars=${text.length} elapsed_ms=${Date.now() - startedAt}`
  );
  return JSON.parse(text) as T;
}
