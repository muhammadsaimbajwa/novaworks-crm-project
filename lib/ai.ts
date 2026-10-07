import type { DirectoryUser } from "./validation";

/** An AI provider/transport failure. `message` is safe to show to the admin. */
export class AiServiceError extends Error {
  constructor(
    message: string,
    /** HTTP status from the provider, when there was one. Used to decide whether to try the next model. */
    public status?: number,
  ) {
    super(message);
  }
}

/** The model replied, but not with usable JSON. Safe to show; can be retried with feedback. */
export class AiOutputError extends Error {}

const SYSTEM_PROMPT = `You are an AI project manager for NovaWorks Technologies.

Your job is to convert meeting transcripts into structured projects and development tasks.

IMPORTANT RULES:

1. Use ONLY employees from the supplied team directory.
2. Never invent employees.
3. Never create new users.
4. Managers must be existing users with role MANAGER.
5. Task assignees must be existing users with role AGENT.
6. Extract projects from the final agreed decisions.
7. Ignore rejected requirements.
8. Ignore features explicitly excluded from the current scope.
9. If a requirement was changed later in the meeting, use the FINAL decision.
10. Do not create a task for a rejected feature.
11. Do not create a new project unless supported by the meeting.
12. Preserve separate projects when the meeting explicitly says they must remain separate.
13. Estimated hours represent effort, not calendar duration.
14. Return dates as YYYY-MM-DD.
15. Every project must have a manager and deadline.
16. Every task must have a title, description, assignee, deadline and estimated hours.
17. Task deadlines must not be later than their project deadline.
18. Do not include passwords in the AI input or output.
19. Return ONLY valid JSON matching the specified schema.

Additional guidance:
- People mentioned in the meeting who are NOT in the team directory (for example clients, external contacts or contractors) are not NovaWorks employees. Never assign them work and never use their names as IDs.
- Reference employees ONLY by the "id" values from the team directory (for example "PM01" or "DEV01").
- Match people by the name used in the meeting, and use their role and skills in the directory to resolve ambiguity.
- Pay special attention to later corrections in the transcript. The final agreement overrides earlier discussion, including deadlines, hour estimates and owners.
- Task titles should be short and specific. Descriptions should be one or two clear sentences describing the agreed work.
- If the meeting discusses any project work that was agreed, you MUST return it. Never return an empty "projects" list unless the meeting truly contains no project decisions at all.
- Treat a project as agreed when the team settles on a client, scope, owner or deadline for it, even if some details are discussed informally. Names may be written in English or Roman Urdu; match them to the directory by first name.
- Every project object MUST contain exactly these keys: "name", "clientName", "description", "managerId", "deadline", "tasks". "clientName" is the client company the project is for, as named in the meeting.
- Every task object MUST contain exactly these keys: "title", "description", "assigneeId", "deadline", "estimatedHours" (a number).
- Output raw JSON only: no markdown fences, no commentary.

Pay special attention to later corrections in the transcript. The final agreement overrides earlier discussion.`;

const OUTPUT_SCHEMA = `{
  "projects": [
    {
      "name": "string",
      "clientName": "string",
      "description": "string",
      "managerId": "id of a MANAGER from the team directory, e.g. PM01",
      "deadline": "YYYY-MM-DD",
      "tasks": [
        {
          "title": "string",
          "description": "string",
          "assigneeId": "id of an AGENT from the team directory, e.g. DEV01",
          "deadline": "YYYY-MM-DD",
          "estimatedHours": 12
        }
      ]
    }
  ]
}`;

function buildUserPrompt(transcript: string, directory: DirectoryUser[], feedback?: string) {
  const today = new Date().toISOString().slice(0, 10);
  let prompt = `Today's date is ${today}. If the meeting gives a date without a year, use the next matching date on or after today.

TEAM DIRECTORY:

${JSON.stringify(directory, null, 2)}

MEETING TRANSCRIPT:

${transcript}

EXPECTED JSON SCHEMA:

${OUTPUT_SCHEMA}`;

  if (feedback) {
    prompt += `\n\nYour previous answer was rejected for this reason: ${feedback}\nReturn a corrected JSON document that follows every rule.`;
  }
  return prompt;
}

/** Pulls a JSON object out of the model reply, tolerating code fences or stray text. */
function parseJsonReply(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new AiOutputError("Unable to create projects. The AI did not return valid JSON.");
  }
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new AiOutputError("Unable to create projects. The AI returned malformed JSON.");
  }
}

type Provider = "anthropic" | "openai";

/**
 * Picks the provider. "openai" means any OpenAI-compatible chat-completions API
 * (OpenRouter, Google Gemini, Groq, ...), selected with AI_BASE_URL.
 * AI_PROVIDER wins; otherwise: AI_BASE_URL set or an OpenRouter key (sk-or-...) -> "openai", else "anthropic".
 */
function pickProvider(apiKey: string): Provider {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === "anthropic") return "anthropic";
  if (explicit === "openai" || explicit === "openrouter") return "openai";
  return process.env.AI_BASE_URL || apiKey.startsWith("sk-or-") ? "openai" : "anthropic";
}

function maxTokens(): number {
  const value = Number(process.env.AI_MAX_TOKENS);
  return Number.isFinite(value) && value > 0 ? value : 4000;
}

function failFromStatus(status: number, detail: string): never {
  console.error(`AI API error ${status}:`, detail.slice(0, 500));
  let message = "The AI service returned an error. Please try again.";
  if (status === 401 || status === 403) {
    message = "The AI service rejected the API key. Check AI_API_KEY (and AI_PROVIDER / AI_MODEL).";
  } else if (status === 402) {
    message = "The AI account has no credits left. Add credit and try again.";
  } else if (status === 404) {
    message = "The AI model was not found. Check AI_MODEL.";
  } else if (status === 429) {
    message = "The AI service is rate limited right now. Please try again shortly.";
  }
  throw new AiServiceError(message, status);
}

/** AI_MODEL may list several models separated by commas; they are tried in order. */
function modelList(provider: Provider): string[] {
  const models = (process.env.AI_MODEL ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (models.length === 0) {
    if (provider === "anthropic") return ["claude-sonnet-5-5"];
    throw new AiServiceError("AI_MODEL is not set. Set it to a model id supported by your AI provider.");
  }
  return models.slice(0, 6);
}

/** Failures where trying the next model in the list can help. */
function shouldTryNextModel(error: unknown): boolean {
  if (!(error instanceof AiServiceError)) return false;
  const status = error.status;
  return status === 404 || status === 408 || status === 429 || (status !== undefined && status >= 500);
}

async function callProvider(
  provider: Provider,
  apiKey: string,
  model: string,
  userPrompt: string,
  signal: AbortSignal,
): Promise<string> {
  if (provider === "openai") {
    const baseUrl = (process.env.AI_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens(),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
      signal,
    });
    if (!response.ok) failFromStatus(response.status, await response.text().catch(() => ""));
    const data = (await response.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string | null } }> }
      | null;
    return data?.choices?.[0]?.message?.content ?? "";
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens(),
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
    signal,
  });
  if (!response.ok) failFromStatus(response.status, await response.text().catch(() => ""));
  const data = (await response.json().catch(() => null)) as
    | { content?: Array<{ type: string; text?: string }> }
    | null;
  return data?.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("") ?? "";
}

/**
 * Sends the transcript and team directory to the LLM and returns the parsed (but NOT yet validated) JSON.
 * Supports Anthropic and any OpenAI-compatible API (OpenRouter, Gemini, Groq); add another provider by extending callProvider().
 *
 * Passwords are never part of `directory`; it contains only id, name, role, specialization and skills.
 */
export async function extractProjectsFromTranscript(
  transcript: string,
  directory: DirectoryUser[],
  feedback?: string,
): Promise<unknown> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new AiServiceError("The AI service is not configured. Set AI_API_KEY on the server.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);

  let text = "";
  try {
    const provider = pickProvider(apiKey);
    const prompt = buildUserPrompt(transcript, directory, feedback);
    const models = modelList(provider);

    let lastError: unknown;
    for (const model of models) {
      try {
        text = await callProvider(provider, apiKey, model, prompt, controller.signal);
        console.log(`[AI] model used: ${model}`);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
        if (!shouldTryNextModel(error)) throw error;
        console.warn(`[AI] ${model} unavailable, trying next model...`);
      }
    }
    if (lastError) throw lastError;
  } catch (error) {
    if (error instanceof AiServiceError) throw error;
    console.error("AI request failed:", error);
    const timedOut = error instanceof Error && error.name === "AbortError";
    throw new AiServiceError(
      timedOut
        ? "The AI service took too long to respond. Please try again."
        : "Could not reach the AI service. Please try again.",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!text.trim()) {
    throw new AiOutputError("Unable to create projects. The AI returned an empty response.");
  }
  // Server-side debugging aid: shows what the model actually returned (visible in the terminal only).
  console.log("[AI raw reply]", text.slice(0, 4000));
  return parseJsonReply(text);
}
