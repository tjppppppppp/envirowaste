// Foundable AI: the models this app's server code calls. Foundable sets OPENAI_BASE_URL and OPENAI_API_KEY for the
// published app and the owner's credits pay for each call, so the app needs no key of its own. Import this file only
// from server code, and never edit it: Build writes it, and replaces it whole when it changes.
import { createOpenAI } from "@ai-sdk/openai";
import { APICallError, RetryError, defaultSettingsMiddleware, wrapLanguageModel } from "ai";

// Both names are read as a call is made, never as this module loads: their values arrive with each request.
function provider() {
  return createOpenAI({ baseURL: process.env.OPENAI_BASE_URL, apiKey: process.env.OPENAI_API_KEY });
}

// Whether calls go through Foundable AI, which runs "default" on the model this website's owner picked; a key of
// the owner's own reaches OpenAI, which knows no such name.
function viaFoundable() {
  return process.env.OPENAI_BASE_URL?.endsWith("/api/app-ai/openai/v1") === true;
}

/**
 * A model on OpenAI's Responses API, which runs tools at every reasoning effort: "default" for this website's model,
 * which its owner picks and changes with no rebuild, or a model Foundable AI serves by its name. Nothing is stored at OpenAI
 * (store: false), so each call carries the whole conversation, its tool calls and its reasoning, which every later step of a
 * tool loop and every later turn of a chat needs. It reasons at low effort unless a call's
 * providerOptions.openai.reasoningEffort asks for more, and passes the signed-in user's id, when there is one, as OpenAI's
 * safety identifier.
 */
export function model(id: string, userId?: string | null) {
  const named = id === "default" && !viaFoundable() ? "gpt-6-luna" : id;
  // The AI SDK knows only OpenAI's names, so it is told the website's model reasons, as every model it may be does.
  const openai = { store: false, reasoningEffort: "low", ...(named === "default" ? { forceReasoning: true } : {}),
    ...(userId ? { safetyIdentifier: userId } : {}) };
  return wrapLanguageModel({ model: provider().responses(named),
    middleware: defaultSettingsMiddleware({ settings: { providerOptions: { openai } } }) });
}

/** Most AI features, on this website's model: chat replies, writing, summaries and extraction. Pass the signed-in user's id when there is one. */
export function fast(userId?: string | null) {
  return model("default", userId);
}

/** Harder reasoning and longer answers, on a stronger model whatever this website's model. Pass the signed-in user's id when there is one. */
export function smart(userId?: string | null) {
  return model("gpt-6.1-sol", userId);
}

/** Embeddings, for search by meaning. */
export function embedding() {
  return provider().embedding("text-embedding-3-small");
}

/**
 * Files a visitor gives a feature to read (a PDF, a Word or PowerPoint file, plain text), uploaded once with the AI SDK's
 * uploadFile (providerOptions: { openai: { purpose: "user_data" } }) and named in a message by the reference it answers
 * (a file part's providerReference), so every step of an answer sends the reference, never the file again. Through
 * Foundable AI a file is deleted an hour after its upload, so it is read in the request it comes with.
 */
export function files() {
  return provider().files();
}

/**
 * Pictures, drawn or edited with the AI SDK's generateImage: "gpt-image-2.6-flare", or a picture model Foundable AI serves by its name.
 * Name a size on every call (size: "1024x1024") and the quality as pictureQuality() gives it (providerOptions: { openai:
 * { quality: pictureQuality() } }): each picture costs by both.
 */
export function picture(id: string = "gpt-image-2.6-flare") {
  return provider().image(id);
}

/**
 * The quality a picture is drawn at: through Foundable AI none, so Foundable AI draws it at the quality this website's owner
 * picked, which they change with no rebuild; on a key of the owner's own, "low", since OpenAI's own default may
 * draw at its dearest.
 */
export function pictureQuality() {
  return viaFoundable() ? undefined : "low";
}

/**
 * A website not in English gives every sentence Foundable AI shows its visitors in its own language in src/ai/words.ts,
 * `export const aiWords = { paused: "…", signIn: "…" }`, each under its name in this file's `failureWords` or in what the
 * kit's src/lib/ai/turn.ts passes to its `inWebsiteWords`, and there too the name of each field a change shows on its
 * confirmation card, by the field's input name: `export const aiFieldNames = { email: "…" }`. Vite reads that file as the
 * website builds, finding none where it does not exist; a sentence or field it leaves out, or gives no words for, stays as
 * these files say it in English.
 */
const modules: Record<string, unknown> = import.meta.env ? import.meta.glob("/src/ai/words.ts", { eager: true }) : {};
const ownWords = Object.values(modules).map(module => (module as { aiWords?: unknown } | null)?.aiWords)
  .find((words): words is Record<string, unknown> => typeof words === "object" && words !== null);

/** `english` with the website's own words for each of its sentences in its place, by its name (`ownWords`). */
function inWebsiteWords<Words extends Record<string, string>>(english: Words): Readonly<Record<keyof Words, string>> {
  return Object.fromEntries(Object.entries(english).map(([name, sentence]) => {
    const own = ownWords?.[name];
    return [name, typeof own === "string" && own.trim() !== "" ? own : sentence];
  })) as Record<keyof Words, string>;
}

/** What a visitor reads where the answer would be when its call failed. */
const failureWords = inWebsiteWords({
  /** No answer came, and nothing more particular applies. */
  unavailable: "This feature isn't available right now. Please try again in a moment.",
  /** The request is too big for the day's limit, the body cap or the model's context window. */
  requestTooBig: "This request is too big for this site's AI. Please try a shorter one.",
  /** Foundable AI paused the website's AI. */
  paused: "This feature is taking a short break. Please try again later.",
  /** Callers crowd in, after the SDK's own retries. */
  busy: "Lots of people are asking right now. Please try again in a moment.",
  /** A file the visitor attached could not be read (a damaged one, or one that is not what its name says). */
  fileUnreadable: "That file couldn't be read. Please try a different file.",
  /** A file the visitor attached is no longer kept (an hour after it was attached). */
  fileGone: "That file is no longer available. Please attach it again.",
});

/**
 * What a visitor reads where the answer would be, for every failure, so no page waits on an answer that failed: the
 * sentence `failureWords` has for a pause, a request too big, callers crowding in or a file it could not read or no longer
 * keeps, and `unavailable` for anything else, a
 * failure with no status among them (a lost connection, or a stream that broke after it began).
 */
export function aiVisitorMessage(error: unknown): string {
  const failure = RetryError.isInstance(error) ? error.lastError : error;
  if (!APICallError.isInstance(failure)) return failureWords.unavailable;
  const refusal = (failure.data as { error?: { code?: unknown } } | undefined)?.error;
  if (refusal?.code === "app_ai_file_unavailable") return failureWords.fileGone;
  if (refusal?.code === "invalid_file") return failureWords.fileUnreadable;
  if (refusal?.code === "app_ai_call_too_big" || refusal?.code === "context_length_exceeded" || failure.statusCode === 413)
    return failureWords.requestTooBig;
  if (failure.statusCode === 402) return failureWords.paused;
  if (failure.statusCode === 429) return failureWords.busy;
  return failureWords.unavailable;
}
