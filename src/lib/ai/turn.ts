// Foundable AI kit: what an AI feature's route takes and answers, shared by the route (feature.server.ts) and the page's
// chat. Foundable keeps this file and replaces it whole when the kit changes, so never edit it. It holds no secret and runs
// in the browser as well as on the server.
import type { UIMessage } from "ai";

/** Each kind of feature's limits, Foundable AI's own: the route holds every request to its feature's. */
export const aiFeatureKindLimits = {
  "assistant": {
    "steps": 6,
    "outputTokens": 4000,
    "messageCharacters": 2000,
    "historyMessages": 20
  },
  "generator": {
    "steps": 6,
    "outputTokens": 8000,
    "messageCharacters": 2000,
    "historyMessages": 0
  },
  "extractor": {
    "steps": 6,
    "outputTokens": 2000,
    "messageCharacters": 20000,
    "historyMessages": 0
  },
  "classifier": {
    "steps": 6,
    "outputTokens": 2000,
    "messageCharacters": 20000,
    "historyMessages": 0
  },
  "search": {
    "steps": 1,
    "outputTokens": 0,
    "messageCharacters": 2000,
    "historyMessages": 0
  }
} as const;
export type AiFeatureKind = keyof typeof aiFeatureKindLimits;

/** The most a request's body may be, in bytes; a bigger one is refused before it is read. */
export const aiTurnBodyBytes = 131_072;

/**
 * The files a feature reads, by each kind its file names (`files`): `pdf`, a PDF the model reads with its pages' pictures;
 * `text`, a document it reads for its words; `image`, a photo it looks at. Each kind's files by their name's ending, and
 * the type each is sent as.
 */
export const aiFileTypes = {
  "pdf": {
    ".pdf": "application/pdf"
  },
  "text": {
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".rtf": "application/rtf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".odt": "application/vnd.oasis.opendocument.text",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  },
  "image": {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp"
  }
} as const;
/**
 * The videos a feature is shown (`files`: `video`), by their name's ending, and each one's type. A video is never sent:
 * the page takes still pictures from it (video.ts), the route writes timed notes on them (video.server.ts), and the
 * question attaches those notes under the video's name.
 */
export const aiVideoTypes = {".mp4":"video/mp4",".m4v":"video/x-m4v",".mov":"video/quicktime",".webm":"video/webm"} as const;
/** Every kind of file a person may pick, each with its files by their name's ending. */
const aiPickedTypes = { ...aiFileTypes, video: aiVideoTypes } as const;
export type AiFileKind = keyof typeof aiPickedTypes;
/** A kind whose files are uploaded as they are, for the model to read: every kind but a video. */
export type AiUploadedKind = keyof typeof aiFileTypes;
/** What each kind is uploaded as, where the model reads it (the AI SDK's uploadFile, `providerOptions.openai.purpose`). */
export const aiFilePurposes = {"pdf":"user_data","text":"user_data","image":"vision"} as const;
/**
 * The detail the model reads a photo at (`providerOptions.openai.imageDetail`): the level at which a phone's photo of any
 * size is read, for about the same cost. The route says it, never the page.
 */
export const aiPhotoDetail = "high";
/** Whether a file is a photo, which the model looks at: one sent as a type the `image` kind takes. */
export const aiPhoto = (file: { mediaType: string }): boolean => (Object.values(aiFileTypes.image) as string[]).includes(file.mediaType);
/** Whether a file is a video, which the model reads as the notes its watching wrote: one of a type the `video` kind takes. */
export const aiVideoFile = (file: { mediaType: string }): boolean => (Object.values(aiVideoTypes) as string[]).includes(file.mediaType);
/**
 * How a video is watched, Foundable AI's own numbers: the model that writes the notes; a picture each `usualGapSeconds`,
 * never closer than `leastGapSeconds`, at least `leastPictures` of a clip that has room for them and at most `mostPictures`
 * of any video (`aiVideoGap`); each picture at most `edge` pixels on its longer side, a JPEG at `quality`, lowered to
 * `leastQuality` at the lowest while a picture comes out past `pictureBytes`; one request of at most `stretchPictures`
 * pictures and `stretchBytes` of them, `atOnce` requests at a time; each stretch's notes at most
 * `notesTokens` of output; the notes kept as a document of `notesType`, named with `notesEnding`.
 */
export const aiVideo = {
  "model": "gpt-6.1-terra",
  "usualGapSeconds": 3,
  "leastGapSeconds": 1,
  "leastPictures": 60,
  "mostPictures": 600,
  "edge": 640,
  "quality": 0.7,
  "leastQuality": 0.4,
  "pictureBytes": 48000,
  "stretchPictures": 120,
  "stretchBytes": 3500000,
  "atOnce": 2,
  "notesTokens": 6000,
  "notesType": "text/plain",
  "notesEnding": ".txt"
} as const;
/**
 * How far apart, in seconds, a video's pictures are taken, by its length: a third of its seconds as pictures, at least
 * `leastPictures` and at most `mostPictures` of them, never closer than `leastGapSeconds`. The page and the route both
 * read it, so a stretch's times are the same on each.
 */
export function aiVideoGap(seconds: number): number {
  return Math.max(aiVideo.leastGapSeconds, seconds / Math.min(Math.max(seconds / aiVideo.usualGapSeconds, aiVideo.leastPictures), aiVideo.mostPictures));
}
/** How many pictures a video of this length is read by, one each `aiVideoGap` from its start. */
export function aiVideoPictures(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / aiVideoGap(seconds) - 1e-9));
}
/** A time in a video as its notes write it: minutes and seconds, with hours once it has any (`1:04:09`, `0:07`). */
export function aiVideoTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds)), hours = Math.floor(whole / 3_600), minutes = Math.floor(whole % 3_600 / 60);
  const rest = String(whole % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}
/** The longest video the kit watches, in seconds: a day, past which a length is no video's. */
export const aiVideoSeconds = 86_400;
/** The most a stretch's notes may be, in characters, and the most of all a video's stretches that are kept, in bytes. */
export const aiVideoNotes = { characters: 32_000, bytes: 1_048_576 } as const;
/**
 * The header a video's requests name it in (URI-encoded JSON): `AiVideoStretch` on a request whose body is a stretch's
 * pictures, one after another, and `AiVideoKept` on the last, whose body is the notes that came back (`AiVideoNotes[]`).
 */
export const aiVideoHeader = "x-ai-video";
/** A video as each of its requests names it: its name, its length in seconds and how many pictures it is read by. */
export interface AiVideoNamed {
  name: string;
  seconds: number;
}
/** A stretch of a video's pictures: where it starts among the video's pictures, and each picture's size in bytes, in order. */
export interface AiVideoStretch extends AiVideoNamed {
  first: number;
  sizes: number[];
}
/** The request that keeps a watched video's notes, so a question can attach them. */
export interface AiVideoKept extends AiVideoNamed {
  keep: true;
}
/** What the route answers a stretch: its notes, with the times they cover; or the sentence why not, and how long to wait before asking again. */
export interface AiVideoNotes {
  from: number;
  to: number;
  notes: string;
}
export interface AiVideoRefusal extends AiRefusal {
  retryAfter?: number;
}
/** The files one question may attach, the most one file may be in bytes, and the most of its name that is kept. */
export const aiFileLimits = {"files":3,"bytes":20971520,"nameCharacters":200} as const;
/**
 * A file a question attaches: the part the AI SDK sends, naming the file by the reference its upload answered
 * (`providerReference`), which reaches the model in its place, so the file itself goes once, with its upload.
 */
export interface AiFile {
  type: "file";
  mediaType: string;
  filename: string;
  url: string;
  providerReference: { openai: string };
}
/** A feature's answer to an upload (a POST of multipart/form-data with one `file`): the file to attach, or AiRefusal. */
export interface AiUpload {
  file: AiFile;
}

/** The kind and type a file's name says it is, among the kinds a feature reads; null for a file none of them takes. */
export function aiFileType(name: string, kinds: readonly string[]): { kind: AiFileKind; mediaType: string } | null {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return null;
  const ending = name.slice(dot).toLowerCase();
  for (const [kind, types] of Object.entries(aiPickedTypes) as [AiFileKind, Record<string, string>][]) {
    if (kinds.includes(kind) && Object.hasOwn(types, ending)) return { kind, mediaType: types[ending]! };
  }
  return null;
}

/**
 * What a file input offers for the kinds a feature reads: its `accept`, each ending and its type, so a phone's picker offers
 * them. An iPhone hands a photo over as a JPEG only to a picker that lists exact picture types, as this does, and as a
 * HEIC, which no feature reads, to one that says `image/*`; for a video's types it offers its library's videos and its camera.
 */
export function aiFileAccept(kinds: readonly string[]): string {
  const offered = (Object.entries(aiPickedTypes) as [AiFileKind, Record<string, string>][]).filter(([kind]) => kinds.includes(kind))
    .flatMap(([, types]) => Object.entries(types).flat());
  return [...new Set(offered)].join(",");
}

/** A reference an upload answered: Foundable AI's (or OpenAI's own, on a key of the owner's) file id. */
const fileReference = /^file-[A-Za-z0-9_-]{1,1024}$/u;

/**
 * The header an upload names its file in (its name, URI-encoded): the request's body is the file itself, which the route
 * takes whole, never a form it must take apart.
 */
export const aiFileHeader = "x-ai-file";

/**
 * How long a streamed answer goes without a byte before the route says it is still there, in milliseconds: an SSE comment,
 * which the page's chat never reads as part of the answer. A live preview's door cuts a connection silent for a minute, so a
 * model thinking or a tool running long never reads as a dead connection (Miguel's sitting, 2026-10-07).
 */
export const aiStreamKeepAliveMs = 15_000;

/** What a page may tell a feature about itself (its path and the ids of what it shows), within these bounds. */
export const aiPageLimits = { entries: 8, valueCharacters: 200 } as const;
/** A page entry's name. */
export const aiPageKey = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

/**
 * The header a signed-in visitor's page sends their sign-in in, their backend access token (supabase-js's
 * `session.access_token`); a request without it is anonymous. Never Authorization, which a live preview replaces with its own.
 */
export const aiVisitorTokenHeader = "x-visitor-token";

/** A feature's route: POST asks it, GET reads a signed-in visitor's conversation with it, DELETE clears that. */
export function aiFeaturePath(featureId: string): string {
  return "/api/ai/" + featureId;
}

/** The page's own ids and path, as strings; the route never reads them as instructions. */
export type AiPage = Record<string, string>;
/**
 * One earlier message of an anonymous visitor's conversation, which stays in their browser: its words alone, of which the
 * route reads no more than the feature's message limit.
 */
export interface AiTextTurn {
  id: string;
  role: "user" | "assistant";
  parts: Array<{ type: "text"; text: string }>;
}
/**
 * A request to a feature's route, sent with `aiVisitorTokenHeader` only while the visitor is signed in: `message` is the
 * visitor's new message (its words alone), or the assistant message their Confirm or Cancel answered; `history`, only
 * without a token, is the earlier messages an anonymous visitor's browser keeps.
 */
export interface AiTurnRequest {
  message: UIMessage;
  history?: AiTextTurn[];
  page?: AiPage;
}
/** What the route answers in place of an answer it will not give: a sentence for the visitor, shown where the answer would be. */
export interface AiRefusal {
  error: string;
}
/**
 * A picture feature's answer: the picture as a data address (`data:image/png;base64,…`), which an Image shows and the
 * website's own save keeps. A failure answers `AiRefusal` in its place.
 */
export interface AiPictureAnswer {
  picture: string;
}
/** A signed-in visitor's conversation with a feature, as the route's GET answers it. */
export interface AiConversation {
  messages: UIMessage[];
}

/**
 * The website's own words for each sentence below, under its name, where a website not in English gives them in its
 * language, as the helper (src/lib/ai.server.ts) says: `aiWords` in src/ai/words.ts, which Vite reads as the website builds,
 * finding none where it does not exist. A sentence it leaves out, or gives no words for, stays as this kit says it in English.
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

/** The website's own names for the fields a change shows on its card, by each field's input name: `aiFieldNames` there. */
const ownFieldNames = Object.values(modules).map(module => (module as { aiFieldNames?: unknown } | null)?.aiFieldNames)
  .find((names): names is Record<string, unknown> => typeof names === "object" && names !== null);

/** The website's own name for a change's field, by its input name (`ownFieldNames`); none where it gives no words for it. */
export function aiFieldName(name: string): string | undefined {
  const own = ownFieldNames?.[name];
  return typeof own === "string" && own.trim() !== "" ? own : undefined;
}

/** What a visitor reads when the route refuses a request. */
export const aiTurnWords = inWebsiteWords({
  malformed: "Something went wrong sending that. Please try again.",
  tooLong: "That message is too long. Please send a shorter one.",
  /** A file of a kind the feature does not read. */
  fileType: "This kind of file can't be read here. Please choose another file.",
  /** A file past `aiFileLimits.bytes`. */
  fileTooBig: "That file is too big. Please choose one under 20 MB.",
  /** A file with nothing in it. */
  fileEmpty: "That file is empty. Please choose another file.",
  /** More files than one question may attach. */
  tooManyFiles: "That's too many files at once. Please attach up to 3.",
  /** A video this browser cannot open, or one with no picture in it. */
  videoUnreadable: "This video can't be opened here. Please try another one, such as an MP4.",
  /** A video whose pictures stopped coming, as when the page is left or the phone sleeps while it is read. */
  videoStalled: "The video stopped loading. Please keep this page open and try again.",
  tooBig: "This conversation is too long to continue. Please start a new one.",
  signIn: "Please sign in to use this.",
  signInAgain: "Please sign in again to continue.",
  movedOn: "This conversation changed somewhere else. Please reload the page.",
  method: "This feature does not take that request.",
  notReady: "This feature isn't ready yet. Please try again later.",
});

/** What the model and the visitor read of a change its confirmation left unmade or unknown. */
export const aiChangeWords = inWebsiteWords({
  /** A change nobody confirmed before the conversation moved on: the reason the model reads. */
  notConfirmed: "The visitor did not confirm this change, so it was not made.",
  /** A confirmed change whose answer was lost before its result was kept: it may have run, so it never runs again. */
  unknownResult: "This change may have gone through, but its result was lost. Check before trying it again.",
});

/** What a visitor reads in the page's chat (chat.tsx) beside what the route sends. */
export const aiChatWords = inWebsiteWords({
  /** No answer came because the connection broke. */
  disconnected: "The connection was lost. Please check it and try again.",
  /** A failure that came with no sentence of the route's. */
  failed: "Something went wrong. Please try again.",
  /** The answer ended with nothing the visitor can see. */
  unanswered: "No answer came. Please try again.",
  /** A change an earlier answer asked for, which the conversation moved on from. */
  unconfirmed: "Not confirmed.",
  confirm: "Confirm",
  cancel: "Cancel",
  /** The label of a change's input that is one value rather than fields. */
  value: "Value",
  /** A file the visitor attached, where it names none. */
  file: "File",
});

/** The visitor's new message: their words, and the files it attaches (none where the feature reads none). */
export interface AiQuestion {
  id: string;
  text: string;
  files: AiFile[];
}
/** The visitor's answer to one confirmation: the change it confirms, as the assistant message they answered names it. */
export interface AiConfirmation {
  type: "confirmation";
  toolName: string;
  toolCallId: string;
  input: unknown;
  approvalId: string;
  approved: boolean;
  reason?: string;
}
/** A Confirm or Cancel press: the assistant message it answers, by its words and the changes it confirms, in their order. */
export interface AiPress {
  messageId: string;
  parts: Array<{ type: "text"; text: string } | AiConfirmation>;
}
export type AiTurn =
  | { question: AiQuestion; history: AiTextTurn[]; page: AiPage }
  | { press: AiPress; history: AiTextTurn[]; page: AiPage };

const messageId = /^[A-Za-z0-9_-]{1,64}$/;
const reasonCharacters = 500;
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const only = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key));
const textPart = (value: unknown): value is { type: "text"; text: string } => record(value) && value.type === "text" && typeof value.text === "string";
/** A message's words, its text parts a line apart, as the limit on a message counts them. */
const textOf = (parts: readonly { text: string }[]) => parts.map(part => part.text).join("\n");
/** Words cut to `characters`, a character the cut would split left out whole. */
const cut = (text: string, characters: number) => {
  const last = text.charCodeAt(characters - 1);
  return text.slice(0, last >= 0xd800 && last <= 0xdbff ? characters - 1 : characters);
};

/**
 * The route's reading of a request, which takes the visitor's words, their decisions and the page's ids and nothing else:
 * a model, instructions, tools, sizes, earlier answers for a signed-in visitor and any other part are never read from it.
 * A new message is text, within the feature's message limit, and the files the feature reads (`files`, its kinds), each
 * named by the reference its upload answered, at most `aiFileLimits.files` of them, words or files or both; a press is the decisions in an assistant message's
 * answered confirmations (`approval-responded`), the rest of that message left out but its words; an anonymous visitor's
 * history is text alone, its newest `historyMessages` kept, each cut to the message limit rather than refused, since an
 * answer runs past it; a page has at most `aiPageLimits.entries` bounded strings.
 */
export function readAiTurnRequest(body: unknown, rules: { messageCharacters: number; historyMessages: number; signedIn: boolean; files?: readonly string[] }):
  { turn: AiTurn } | { refusal: { status: 400 | 413; error: string } } {
  const refused = (status: 400 | 413 = 400, error: string = aiTurnWords.malformed) => ({ refusal: { status, error } });
  if (!record(body) || !only(body, ["message", "history", "page"]) || rules.signedIn && body.history !== undefined) return refused();
  const page = readPage(body.page), history = readHistory(body.history, rules);
  const message = body.message;
  if (!page || !history || !record(message) || typeof message.id !== "string" || !messageId.test(message.id)
    || !Array.isArray(message.parts)) return refused();
  if (message.role === "user") {
    const texts = (message.parts as unknown[]).filter(textPart), files: AiFile[] = [];
    for (const part of message.parts as unknown[]) {
      if (textPart(part)) continue;
      const file = filePart(part, rules.files ?? []);
      if (!file) return refused();
      files.push(file);
    }
    if (files.length > aiFileLimits.files) return refused(413, aiTurnWords.tooManyFiles);
    const text = textOf(texts);
    if (!text.trim() && !files.length) return refused();
    if (text.length > rules.messageCharacters) return refused(413, aiTurnWords.tooLong);
    return { turn: { question: { id: message.id, text, files }, history, page } };
  }
  if (message.role !== "assistant") return refused();
  const parts: AiPress["parts"] = [], approvals = new Set<string>();
  for (const part of message.parts as unknown[]) {
    if (textPart(part)) parts.push({ type: "text", text: part.text });
    if (!record(part) || typeof part.type !== "string" || !part.type.startsWith("tool-") || part.state !== "approval-responded") continue;
    const approval = part.approval;
    if (part.type.length <= 5 || typeof part.toolCallId !== "string" || !record(approval) || typeof approval.id !== "string"
      || typeof approval.approved !== "boolean" || approvals.has(approval.id)
      || approval.reason !== undefined && (typeof approval.reason !== "string" || approval.reason.length > reasonCharacters)) return refused();
    approvals.add(approval.id);
    parts.push({ type: "confirmation", toolName: part.type.slice(5), toolCallId: part.toolCallId, input: part.input,
      approvalId: approval.id, approved: approval.approved, ...(approval.reason === undefined ? {} : { reason: approval.reason }) });
  }
  if (!approvals.size) return refused();
  return { turn: { press: { messageId: message.id, parts }, history, page } };
}

/**
 * A file a new message attaches, by its shape: a reference an upload answered and a name of a kind the feature reads, sent
 * as the type that name says it is, nothing else; null for any other part.
 */
function filePart(value: unknown, kinds: readonly string[]): AiFile | null {
  if (!record(value) || value.type !== "file" || typeof value.filename !== "string" || !value.filename.length
    || [...value.filename].length > aiFileLimits.nameCharacters || typeof value.mediaType !== "string" || typeof value.url !== "string"
    || !record(value.providerReference) || typeof value.providerReference.openai !== "string" || !fileReference.test(value.providerReference.openai)
    || !only(value, ["type", "mediaType", "filename", "url", "providerReference"]) || !only(value.providerReference, ["openai"])) return null;
  const type = aiFileType(value.filename, kinds);
  if (!type || type.mediaType !== value.mediaType) return null;
  return { type: "file", mediaType: type.mediaType, filename: value.filename, url: "", providerReference: { openai: value.providerReference.openai } };
}

function readPage(value: unknown): AiPage | null {
  if (value === undefined) return {};
  if (!record(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > aiPageLimits.entries) return null;
  const page: AiPage = {};
  for (const [key, entry] of entries) {
    if (!aiPageKey.test(key) || typeof entry !== "string" || entry.length > aiPageLimits.valueCharacters) return null;
    page[key] = entry;
  }
  return page;
}

/**
 * An anonymous visitor's earlier messages, by their shape: text alone, the newest `historyMessages`, each read as its words
 * cut to `messageCharacters` where they run past it, so a history costs at most that many messages of that many characters.
 */
function readHistory(value: unknown, rules: { historyMessages: number; messageCharacters: number }): AiTextTurn[] | null {
  if (value === undefined || rules.historyMessages <= 0) return [];
  if (!Array.isArray(value)) return null;
  const turns: AiTextTurn[] = [];
  for (const turn of value.slice(-rules.historyMessages) as unknown[]) {
    if (!record(turn) || !only(turn, ["id", "role", "parts"]) || typeof turn.id !== "string" || !messageId.test(turn.id)
      || turn.role !== "user" && turn.role !== "assistant" || !Array.isArray(turn.parts) || !turn.parts.length) return null;
    const parts: AiTextTurn["parts"] = [];
    for (const part of turn.parts as unknown[]) {
      if (!textPart(part) || !only(part, ["type", "text"])) return null;
      parts.push({ type: "text", text: part.text });
    }
    const words = textOf(parts);
    turns.push({ id: turn.id, role: turn.role,
      parts: words.length > rules.messageCharacters ? [{ type: "text", text: cut(words, rules.messageCharacters) }] : parts });
  }
  return turns;
}
