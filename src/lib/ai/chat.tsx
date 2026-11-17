// Foundable AI's chat, the browser half of an assistant: the visitor's words go to its route with their sign-in, and its
// answer, the changes it asks the visitor to confirm and its failures come back to show. Build writes this file and replaces
// it whole when it changes, so never edit it: give the chat the website's look with className and the data-ai-* attributes.
import { Chat, useChat } from "@ai-sdk/react";
import { APICallError, DefaultChatTransport, getToolName, isFileUIPart, isTextUIPart, isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses, type DynamicToolUIPart, type ToolUIPart, type UIMessage } from "ai";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { aiChangeWords, aiChatWords, aiFeatureKindLimits, aiFeaturePath, aiFieldName, aiFileAccept, aiFileHeader, aiFileLimits, aiFileType, aiFileTypes, aiPageKey, aiPhoto,
  aiPageLimits, aiTurnBodyBytes, aiTurnWords, aiVideo, aiVideoHeader, aiVideoTypes, aiVisitorTokenHeader, type AiConversation, type AiFile, type AiPage,
  type AiPictureAnswer, type AiRefusal, type AiTextTurn, type AiTurnRequest, type AiUpload, type AiVideoKept, type AiVideoNotes, type AiVideoRefusal,
  type AiVideoStretch } from "./turn";
import { openAiVideo, type AiVideoPicture } from "./video";

/** The website's backend client (src/lib/backend.ts), whose session says who is signed in. */
export interface AiVisitorSessions {
  auth: { getSession(): Promise<{ data: { session: { access_token: string } | null } }> };
}

export interface AiChatOptions {
  /** The website's backend client: a signed-in visitor's questions then carry their sign-in, and the website keeps their conversation. */
  backend?: AiVisitorSessions;
  /** What the page shows, by id ({ productId: product.id }), so "this one" means it. Never text: the server reads each item itself. */
  page?: AiPage;
}

/** A tool's step in an answer, as the AI SDK names it. */
export type AiToolPart = ToolUIPart | DynamicToolUIPart;

/** What the chat's look needs: the conversation, its state and what the visitor can do. */
export interface AiChat {
  /**
   * The conversation, oldest first: show it with AiMessages, or draw each message in an element marked
   * data-ai-message={message.role}, with its parts in AiText and AiConfirm, and mark the element showing errorText
   * data-ai-error, as AiMessages does: Build's verify reads an answer by those marks.
   */
  messages: UIMessage[];
  /** An answer is on its way: disable sending and show that the assistant is working. */
  busy: boolean;
  /** Why no answer came, as a sentence for the visitor, to show where the answer would be; null otherwise. */
  errorText: string | null;
  /**
   * Sends the visitor's words and the files they attached (`useAiFiles`' `files`), unless both are empty or an answer is on its
   * way; done once the answer came or failed.
   */
  send(text: string, files?: readonly AiFile[]): Promise<void>;
  /** Stops the answer on its way, keeping what came so far. */
  stop(): Promise<void>;
  /** Asks again after a failure; done once the answer came or failed. */
  retry(): Promise<void>;
  /**
   * The visitor's answer to a change the assistant's last answer asks to make: nothing changes without their yes. A change an
   * earlier answer asked for is ignored, since the conversation moved on and the website declined it.
   */
  confirm(approvalId: string, approved: boolean): Promise<void>;
  /** Starts a new conversation, forgetting this one here and, for a signed-in visitor, on the website. */
  clear(): Promise<void>;
}

/** An assistant's chat outside React: what useAiChat runs on, and one chat several components can share (useAiChat(store)). */
export interface AiChatStore extends Omit<AiChat, "messages" | "busy" | "errorText"> {
  /** The AI SDK's chat the conversation runs on. */
  readonly chat: Chat<UIMessage>;
  /** The visitor's sign-in and the page, read as each question goes: set them again whenever they change. */
  options: AiChatOptions;
  /** Shows the conversation kept so far, once: the website's for a signed-in visitor, this browser's otherwise. */
  load(): Promise<void>;
  /** AiChat's errorText, read from the chat as it is now. */
  errorText(): string | null;
  /**
   * Uploads one file the visitor picked, for a feature that reads files: the file to attach to their next question, or the
   * sentence why not (a kind no feature reads, an empty one, past `aiFileLimits.bytes`, or the upload failing). Files go one
   * at a time in the order asked, sharing the visitor's connection as they would anyway, so the website holds one of
   * theirs at a time; `taken` aborting (the visitor took it away) stops its upload, or skips it if it waits, and a send
   * past its time (`uploadTime`) stops it, so no file holds up the next. `useAiFiles` runs it as files are picked. A video,
   * for a feature that is shown videos, is never uploaded, whatever its size: its pictures are taken here, in the
   * visitor's browser, and sent a stretch at a time for the feature to write notes on, which the question then attaches
   * under the video's name; `watched` hears how far along it is, from 0 to 1, and its first picture once, to show.
   */
  upload(file: File, taken?: AbortSignal, watched?: (progress: AiVideoProgress) => void): Promise<AiFile | AiRefusal>;
}

/** How far a video's watching has come: the share done, from 0 to 1, and, once, its first picture. */
export interface AiVideoProgress {
  done: number;
  first?: Blob;
}

/** The most messages a browser keeps of an anonymous visitor's conversation. */
const keptMessages = 100;
/**
 * How long, in seconds, an upload Foundable AI answered busy is sent again for in all, and the longest wait between sends:
 * a minute, in which the files ahead of it go and the visitor sees it still uploading.
 */
const uploadPatienceSeconds = 60, uploadWaitSeconds = 10;
/**
 * How long one send of an upload may take, in milliseconds, from its sign-in read to its answer: a minute, room for
 * Foundable AI's half minute with OpenAI, and a second for each 16 KB, an eighth of a megabit a second, slower than any
 * connection a visitor still uses. A busy wait between sends is no part of it. Past it the file stops as a lost connection
 * does, so a stalled one never holds up the files after it.
 */
const uploadTime = (bytes: number) => (60 + bytes / (16 * 1024)) * 1_000;
/**
 * How long a stretch of a video's pictures has for its notes after it is sent, in milliseconds: the model reads a full
 * stretch in well under a minute, and Foundable AI may hold a call that long again while others run.
 */
const notesTime = 180_000;
/** How many times a stretch whose connection broke is sent again before the video stops: a phone's connection drops and comes back. */
const stretchRetries = 2;

/** Waits `ms`, or less where `signal` aborts first: whether it waited them out. */
function waitedOut(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise(resolve => {
    if (signal.aborted) return resolve(false);
    const stopped = () => {
      clearTimeout(timer);
      resolve(false);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stopped);
      resolve(true);
    }, ms);
    signal.addEventListener("abort", stopped, { once: true });
  });
}

/**
 * A file's name as it is sent: its own, with the ending its type says added where it has none a feature reads, as a phone
 * names a file it exports from another app ("Lecture notes", a PDF).
 */
function fileName(file: File): string {
  if (aiFileType(file.name, pickedKinds)) return file.name;
  const ending = [...Object.values(aiFileTypes), aiVideoTypes].flatMap(types => Object.entries(types)).find(([, type]) => type === file.type)?.[0];
  return ending ? `${file.name}${ending}` : file.name;
}
/** Every kind of file a person may pick. */
const pickedKinds = [...Object.keys(aiFileTypes), "video"];

/**
 * An assistant's chat, by its feature id. A signed-in visitor's conversation is the website's: read when the chat first
 * shows, and never kept in this browser or sent back as history. An anonymous visitor's stays in this browser, and each
 * question carries its earlier words, the last turns that fit. Every question carries the page's ids and path.
 */
export function createAiChatStore(feature: string, options: AiChatOptions = {}): AiChatStore {
  // Once a question or a read carried a sign-in, the conversation is the website's.
  let signedIn = false;
  let sending = false;
  let loaded = false;
  // Questions the route refused before answering stay on screen beside the reason, but were never part of the conversation:
  // they are never sent back as history or kept in this browser.
  const refused = new Set<string>();
  let asking: string | null = null;
  let pressing = false;
  // The last answer once a change confirmed in it lost its answer (a tab closed while it ran, a connection that broke):
  // settled as the website's route settles one, since it may have run, it never runs again, and the visitor reads why.
  let lost: string | null = null;
  const settleLost = (messages: UIMessage[]): UIMessage[] => {
    const last = messages[messages.length - 1];
    if (last?.role !== "assistant" || !last.parts.some(confirmedWithoutResult)) return messages;
    lost = last.id;
    const parts = last.parts.map(part => confirmedWithoutResult(part)
      ? { ...part, state: "output-error", errorText: aiChangeWords.unknownResult } as AiToolPart : part);
    return [...messages.slice(0, -1), { ...last, parts }];
  };
  /** Keeps an anonymous visitor's conversation in this browser, less the questions the route refused. */
  const keepHere = (messages: UIMessage[]) => {
    if (!signedIn) keep(feature, messages.filter(message => !refused.has(message.id)));
  };
  const reread = async () => {
    const token = await accessToken(store.options.backend);
    if (token) chat.messages = settleLost(await savedConversation(feature, token));
    else signedIn = false;
  };
  const chat: Chat<UIMessage> = new Chat<UIMessage>({
    id: `foundable-ai-${feature}`,
    transport: new DefaultChatTransport<UIMessage>({
      api: aiFeaturePath(feature),
      prepareSendMessagesRequest: async ({ messages }) => {
        asking = null;
        pressing = false;
        const token = await accessToken(store.options.backend);
        // A sign-in that lapsed is said, never answered as a stranger's question; New conversation starts one as a stranger.
        if (!token && signedIn) throw new Error(aiTurnWords.signInAgain);
        if (token) signedIn = true;
        const message = messages[messages.length - 1]!;
        asking = message.role === "user" ? message.id : null;
        pressing = message.role === "assistant";
        refused.delete(message.id);
        const body: AiTurnRequest = { message, page: pageOf(store.options.page) };
        if (!signedIn) fitHistory(body, textTurns(messages.slice(0, -1).filter(earlier => !refused.has(earlier.id))));
        return { body, headers: token ? visitorHeaders(token) : {} };
      },
    }),
    // The visitor answered every change the assistant asked to make: their answers go at once.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: ({ messages }) => keepHere(messages),
    onError: error => {
      // A press whose answer broke off, which the route never refused, may have run its change: it is never sent again.
      if (!APICallError.isInstance(error)) {
        if (pressing) chat.messages = settleLost(chat.messages);
        return;
      }
      if (asking !== null) refused.add(asking);
      // Another tab moved a signed-in visitor's conversation on: show it as the website keeps it.
      if (signedIn && error.statusCode === 409) reread().catch(() => {});
    },
  });
  const busy = () => chat.status === "submitted" || chat.status === "streaming";
  // What an upload that stopped answers: taken away, past its time or its connection lost.
  const cutOff: AiRefusal = { error: aiChatWords.disconnected };
  // The uploads asked for, each sent once the one before it ends or stops.
  let uploading: Promise<unknown> = Promise.resolve();
  /** One send of a file, within its time (`uploadTime`, which stops it past it), or null where it stopped or its connection failed. */
  const sent = async (file: File, name: string, stop: AbortController) => {
    const late = setTimeout(() => stop.abort(), uploadTime(file.size));
    try {
      const token = await accessToken(store.options.backend);
      // The file itself is the body, named in its header.
      const response = await fetch(aiFeaturePath(feature), { method: "POST", body: file, signal: stop.signal, headers: {
        [aiFileHeader]: encodeURIComponent(name), "content-type": "application/octet-stream", ...(token ? visitorHeaders(token) : {}) } });
      return { response, answer: await response.json().catch(() => null) as Partial<AiUpload & AiRefusal> | null };
    } catch {
      return null;
    } finally { clearTimeout(late); }
  };
  const uploaded = async (file: File, name: string, stop: AbortController): Promise<AiFile | AiRefusal> => {
    for (let waited = 0; ;) {
      const reply = await sent(file, name, stop);
      if (!reply) return cutOff;
      const { response, answer } = reply;
      // Foundable AI was taking other files: it is sent again after the wait asked for, so the visitor only waits, unless
      // the file is taken away meanwhile.
      const wait = Math.min(Number(response.headers.get("retry-after")), uploadWaitSeconds);
      if (response.status === 429 && wait > 0 && waited + wait <= uploadPatienceSeconds) {
        waited += wait;
        if (!await waitedOut(wait * 1_000, stop.signal)) return cutOff;
        continue;
      }
      if (response.ok && answer?.file) return answer.file;
      return { error: typeof answer?.error === "string" ? answer.error : aiChatWords.failed };
    }
  };
  /**
   * One request of a video's (`aiVideoHeader`), within `ms`: its answer, read whole, or null where it stopped, ran past
   * its time or lost its connection, before its answer began or after.
   */
  const videoRequest = async <Answer,>(named: AiVideoStretch | AiVideoKept, body: Blob | string, type: string, ms: number, stop: AbortController):
    Promise<{ status: number; wait: number; answer: Partial<Answer & AiVideoRefusal> | null } | null> => {
    const sending = new AbortController(), give = () => sending.abort();
    const late = setTimeout(give, ms);
    stop.signal.addEventListener("abort", give, { once: true });
    try {
      if (stop.signal.aborted) return null;
      const token = await accessToken(store.options.backend);
      const response = await fetch(aiFeaturePath(feature), { method: "POST", body, signal: sending.signal, headers: {
        [aiVideoHeader]: encodeURIComponent(JSON.stringify(named)), "content-type": type, ...(token ? visitorHeaders(token) : {}) } });
      const answer = await response.json().catch(() => null) as Partial<Answer & AiVideoRefusal> | null;
      // The route begins a stretch's answer at once and writes it whole only once the model has read the pictures, so a
      // successful answer that cannot be read is one whose connection was lost meanwhile: only this request goes again,
      // never the whole video.
      if (response.ok && answer === null) return null;
      return { status: response.status, wait: Number(response.headers.get("retry-after")), answer };
    } catch {
      return null;
    } finally {
      clearTimeout(late);
      stop.signal.removeEventListener("abort", give);
    }
  };
  /**
   * A video's request sent until it is answered: again after the wait asked for while Foundable AI is busy, within
   * `uploadPatienceSeconds` in all, and again where its connection broke, `stretchRetries` times. Its answer, or the
   * sentence why not.
   */
  const videoAnswer = async <Answer,>(named: AiVideoStretch | AiVideoKept, body: Blob | string, type: string, ms: number, stop: AbortController,
    has: (answer: Partial<Answer>) => boolean): Promise<Answer | AiRefusal> => {
    for (let waited = 0, broken = 0; ;) {
      const reply = await videoRequest<Answer>(named, body, type, ms, stop);
      if (stop.signal.aborted) return cutOff;
      if (!reply) {
        if (++broken > stretchRetries || !await waitedOut(2_000 * broken, stop.signal)) return cutOff;
        continue;
      }
      const { status, answer } = reply;
      if (status >= 200 && status < 300 && answer && has(answer)) return answer as Answer;
      // Busy is said by the status of a request refused at once, or in the answer of one that had begun.
      const asked = status === 429 ? reply.wait : Number(answer?.retryAfter);
      const wait = Math.min(asked, uploadWaitSeconds);
      if (wait > 0 && waited + wait <= uploadPatienceSeconds) {
        waited += wait;
        if (!await waitedOut(wait * 1_000, stop.signal)) return cutOff;
        continue;
      }
      return { error: typeof answer?.error === "string" ? answer.error : aiChatWords.failed };
    }
  };
  /**
   * A picked video, watched: its pictures taken one after another (video.ts) and sent a stretch at a time, `aiVideo.atOnce`
   * stretches being read while the next is taken, then every stretch's notes sent back once to be kept, which answers the
   * file the question attaches, exactly as the route answered it (under the name the route keeps, which a question is held
   * to). Its share done counts each picture twice, once taken and once read.
   */
  const watch = async (file: File, name: string, stop: AbortController, heard: (progress: AiVideoProgress) => void): Promise<AiFile | AiRefusal> => {
    // What ends the watching: the pick taken away (`stop`), or a stretch refused, which the stretches still being read end with.
    const halt = new AbortController(), taken = () => halt.abort();
    stop.signal.addEventListener("abort", taken, { once: true });
    if (stop.signal.aborted) halt.abort();
    const look = await openAiVideo(file, halt.signal);
    if (!look) {
      stop.signal.removeEventListener("abort", taken);
      return stop.signal.aborted ? cutOff : { error: aiTurnWords.videoUnreadable };
    }
    const video = { name, seconds: look.seconds }, notes: AiVideoNotes[] = [], refused: AiRefusal[] = [], reading = new Set<Promise<void>>();
    let drawn = 0, read = 0;
    const said = () => heard({ done: Math.min(1, (drawn + read) / (2 * look.pictures)) });
    try {
      for (let first = 0, held: AiVideoPicture | null = null, ended = false; !ended && !refused.length;) {
        // One stretch: pictures until the next would pass its count or its bytes; that one opens the stretch after.
        const pictures: Blob[] = [];
        let bytes = 0;
        while (pictures.length < aiVideo.stretchPictures) {
          const next: AiVideoPicture | null = held ?? await look.next();
          held = null;
          if (!next) {
            ended = true;
            break;
          }
          if (pictures.length && bytes + next.picture.size > aiVideo.stretchBytes) {
            held = next;
            break;
          }
          if (!drawn) heard({ done: 0, first: next.picture });
          pictures.push(next.picture);
          bytes += next.picture.size;
          drawn += 1;
          said();
        }
        if (!pictures.length) break;
        const at = notes.length, stretch: AiVideoStretch = { ...video, first, sizes: pictures.map(picture => picture.size) };
        notes.length += 1;
        first += pictures.length;
        const sent: Promise<void> = videoAnswer<AiVideoNotes>(stretch, new Blob(pictures), "application/octet-stream", uploadTime(bytes) + notesTime, halt,
          answer => typeof answer.notes === "string" && typeof answer.from === "number" && typeof answer.to === "number").then(answer => {
          if ("error" in answer) {
            refused.push(answer);
            halt.abort();
            return;
          }
          notes[at] = answer;
          read += stretch.sizes.length;
          said();
        }).finally(() => reading.delete(sent));
        reading.add(sent);
        // The next stretch's pictures are taken while these are read, but no more than `atOnce` wait on their notes at a time.
        if (reading.size >= aiVideo.atOnce) await Promise.race(reading);
      }
      await Promise.all(reading);
      if (stop.signal.aborted) return cutOff;
      if (refused[0]) return refused[0];
      if (!notes.length) return { error: aiTurnWords.videoUnreadable };
      const kept = await videoAnswer<AiUpload>({ ...video, keep: true }, JSON.stringify(notes), "application/json", notesTime, halt,
        answer => typeof answer.file === "object" && answer.file !== null);
      if ("error" in kept) return stop.signal.aborted ? cutOff : kept;
      heard({ done: 1 });
      return kept.file;
    } catch {
      // A picture that never came: the pick was taken away, a stretch was refused, the page was left, the phone slept, or
      // the player gave up on the file partway.
      await Promise.all(reading);
      return stop.signal.aborted ? cutOff : refused[0] ?? { error: aiTurnWords.videoStalled };
    } finally {
      // Its player goes as soon as its pictures are done with, and a stretch still being read stops with it.
      halt.abort();
      stop.signal.removeEventListener("abort", taken);
      look.close();
    }
  };
  const store: AiChatStore = {
    chat,
    options,
    async load() {
      if (loaded) return;
      loaded = true;
      const token = await accessToken(store.options.backend);
      if (token) signedIn = true;
      const saved = token ? await savedConversation(feature, token) : readKept(feature);
      if (saved.length && chat.messages.length === 0) chat.messages = settleLost(saved);
    },
    errorText() {
      const last = chat.messages[chat.messages.length - 1];
      if (lost !== null && last?.id === lost && !busy()) return aiChangeWords.unknownResult;
      if (chat.status === "error") return visitorSentence(chat.error);
      return chat.status === "ready" && last !== undefined && !answered(last) ? aiChatWords.unanswered : null;
    },
    async send(text, files = []) {
      if (busy() || sending || (!text.trim() && !files.length)) return;
      sending = true;
      try { await chat.sendMessage(text.trim() ? { text, files: [...files] } : { files: [...files] }); } finally { sending = false; }
    },
    async upload(file, taken, watched) {
      // A file the website would refuse is refused at once, never waiting its turn. A video has no size to refuse: it is
      // never sent.
      const name = fileName(file), type = aiFileType(name, pickedKinds);
      if (!type) return { error: aiTurnWords.fileType };
      const shown = type.kind === "video";
      if (!shown && file.size > aiFileLimits.bytes) return { error: aiTurnWords.fileTooBig };
      if (file.size === 0) return { error: aiTurnWords.fileEmpty };
      if (taken?.aborted) return cutOff;
      // Taken away, or a send past its time, it stops wherever it is (a sign-in read or a wait included) and the next goes.
      const stop = new AbortController(), take = () => stop.abort();
      taken?.addEventListener("abort", take, { once: true });
      const stopped = new Promise<AiRefusal>(resolve => stop.signal.addEventListener("abort", () => resolve(cutOff), { once: true }));
      const before = uploading;
      const turn = before.then(() => stop.signal.aborted ? cutOff
        : shown ? watch(file, name, stop, watched ?? (() => {})) : uploaded(file, name, stop));
      const outcome = Promise.race([turn, stopped]);
      // The next waits for every file before it as well as this one, so one taken away while it waits lets none jump ahead.
      uploading = Promise.all([before, outcome]).catch(() => {});
      try { return await outcome; } finally { taken?.removeEventListener("abort", take); }
    },
    stop: () => chat.stop(),
    async retry() {
      if (busy() || sending || chat.messages.length === 0) return;
      // A press the route refused sends the visitor's answers again (one whose answer broke off was settled as lost).
      if (lastAssistantMessageIsCompleteWithApprovalResponses({ messages: chat.messages })) return chat.sendMessage();
      // Asking again redoes the last answer, so never once one of its tools ran: its change could be asked for, and run, twice.
      const last = chat.messages[chat.messages.length - 1]!;
      if (last.role === "assistant" && last.parts.some(toolRan)) return;
      await chat.regenerate();
    },
    async confirm(approvalId, approved) {
      // The SDK sends a press only once the last answer's changes are all answered, so a yes to an earlier one went nowhere.
      if (!waiting(chat.messages, approvalId)) return;
      await chat.addToolApprovalResponse({ id: approvalId, approved });
      // Kept at once, before the answer: a tab closed while the change runs never shows its card again for a second yes.
      keepHere(chat.messages);
    },
    async clear() {
      await chat.stop();
      chat.clearError();
      chat.messages = [];
      forget(feature);
      if (!signedIn) return;
      try {
        const token = await accessToken(store.options.backend);
        if (token) await fetch(aiFeaturePath(feature), { method: "DELETE", headers: visitorHeaders(token) });
        // What the website keeps now: nothing, unless the delete did not reach it.
        await reread();
      } catch { /* The next load shows what the website kept. */ }
    },
  };
  return store;
}

/** One file the visitor picked: uploading, ready to send (`file`), or refused with the sentence why (`error`). */
export interface AiPickedFile {
  key: string;
  name: string;
  /**
   * A photo's own picture, to show as the visitor picked it (an image's `src`, `entry.name` its `alt`), or a
   * video's first picture, once it is taken: an address only this page opens, which ends when the pick is taken away or
   * the page goes. None for any other file.
   */
  preview?: string;
  /**
   * How far a video's watching has come, from 0 to 1, while it has neither `file` nor `error`: show it as a bar or a
   * percentage beside the name, since a long video takes minutes. None for any other file.
   */
  progress?: number;
  file?: AiFile;
  error?: string;
}

/** The files a visitor attaches to their next question, for a feature that reads the kinds `kinds` names. */
export interface AiFiles {
  /** Every file picked, in order, to show with its name, whether it is still uploading and why it was refused. */
  picked: AiPickedFile[];
  /** The ready ones, to send with the question: chat.send(text, files). */
  files: AiFile[];
  /** A file is still uploading: wait to send, so it goes with the question. */
  uploading: boolean;
  /** The file input's accept: the kinds this feature reads, so a phone's picker offers them. */
  accept: string;
  /** Takes the files a file input gave (its onChange's event.target.files), each uploaded in turn, up to `aiFileLimits.files` in all. */
  add(files: FileList | readonly File[] | null): void;
  /** Takes one picked file away, stopping its upload. */
  remove(key: string): void;
  /** Takes every picked file away, as a sent question does, stopping any upload. */
  clear(): void;
}

/**
 * The files a visitor attaches, for a feature that reads files (its file names `files`): each uploaded as it is picked, so
 * Send never waits on a big file, a video watched in the visitor's browser in place of an upload (`progress`), and each
 * refused one shown with why. Give the input `accept` and `multiple`, call `add`
 * with what it gave, show `picked` (each name, a photo's `preview`, a remove button, "uploading" or the error), send
 * `files` with the question, then `clear`.
 */
export function useAiFiles(chat: AiChatStore, kinds: readonly string[]): AiFiles {
  const [picked, setPicked] = useState<AiPickedFile[]>([]);
  // The picks as they stand now, which each change reads and writes, so an upload starts once per file picked, never inside
  // a state update React may run twice.
  const current = useRef<AiPickedFile[]>([]);
  const show = useCallback((next: AiPickedFile[]) => {
    // A photo's preview ends with its pick, so the page holds no picture it no longer shows.
    for (const entry of current.current) if (entry.preview && !next.some(kept => kept.key === entry.key)) URL.revokeObjectURL(entry.preview);
    current.current = next;
    setPicked(next);
  }, []);
  // Each pick still uploading, by key, to stop once it is taken away or the picker goes.
  const stops = useRef(new Map<string, AbortController>());
  useEffect(() => {
    // Where the effects run again with the picks kept (a hidden page shown again, a hot update), their previews ended with
    // the last run, so each pick shows by its name alone.
    if (current.current.some(entry => entry.preview)) show(current.current.map(({ preview: _ended, ...entry }) => entry));
    return () => {
      for (const stop of stops.current.values()) stop.abort();
      for (const entry of current.current) if (entry.preview) URL.revokeObjectURL(entry.preview);
    };
  }, [show]);
  const add = useCallback((files: FileList | readonly File[] | null) => {
    // The room left: the files picked and not refused, so a refused file takes none of it.
    let room = aiFileLimits.files - current.current.filter(entry => !entry.error).length;
    const uploads: [string, File][] = [];
    const added = Array.from(files ?? []).map((file): AiPickedFile => {
      const key = crypto.randomUUID(), type = aiFileType(fileName(file), kinds);
      if (!type) return { key, name: file.name, error: aiTurnWords.fileType };
      if (room <= 0) return { key, name: file.name, error: aiTurnWords.tooManyFiles };
      room -= 1;
      uploads.push([key, file]);
      return { key, name: file.name, ...(aiPhoto(type) ? { preview: URL.createObjectURL(file) } : type.kind === "video" ? { progress: 0 } : {}) };
    });
    show([...current.current, ...added]);
    for (const [key, file] of uploads) {
      const stop = new AbortController();
      stops.current.set(key, stop);
      // A video says how far its watching has come, and shows its first picture once it is taken; a pick taken away hears nothing.
      const watched = ({ done, first }: AiVideoProgress) => {
        if (!current.current.some(entry => entry.key === key)) return;
        show(current.current.map(entry => entry.key === key ? { ...entry, progress: done, ...(first && !entry.preview ? { preview: URL.createObjectURL(first) } : {}) } : entry));
      };
      void chat.upload(file, stop.signal, watched).then(outcome => {
        stops.current.delete(key);
        // A pick taken away while it uploaded stays away.
        if (!current.current.some(entry => entry.key === key)) return;
        show(current.current.map(entry => {
          if (entry.key !== key) return entry;
          const { progress: _watched, ...settled } = entry;
          return { ...settled, ...("error" in outcome ? { error: outcome.error } : { file: outcome }) };
        }));
      });
    }
  }, [chat, kinds, show]);
  const remove = useCallback((key: string) => {
    stops.current.get(key)?.abort();
    show(current.current.filter(entry => entry.key !== key));
  }, [show]);
  const clear = useCallback(() => {
    for (const stop of stops.current.values()) stop.abort();
    show([]);
  }, [show]);
  return {
    picked,
    files: picked.flatMap(entry => entry.file ? [entry.file] : []),
    uploading: picked.some(entry => !entry.file && !entry.error),
    accept: aiFileAccept(kinds),
    add, remove, clear,
  };
}

/** An assistant's chat for a component: by its feature id, or a chat several components share (createAiChatStore). */
export function useAiChat(chat: string | AiChatStore, options?: AiChatOptions): AiChat {
  const store = useMemo(() => typeof chat === "string" ? createAiChatStore(chat) : chat, [chat]);
  const { messages, status } = useChat({ chat: store.chat });
  // The sign-in and page the next question reads, set once a render commits: a render React discards (StrictMode's second
  // render, an interrupted concurrent one) changes nothing. Before the read below, which needs the sign-in.
  useEffect(() => { if (options) store.options = options; }, [store, options]);
  useEffect(() => {
    store.load().catch(() => { /* Nothing to show yet: the conversation starts empty. */ });
    // A chat this component made stops with it; a shared one is its maker's.
    return typeof chat === "string" ? () => { void store.stop(); } : undefined;
  }, [chat, store]);
  return {
    messages,
    busy: status === "submitted" || status === "streaming",
    errorText: store.errorText(),
    send: store.send,
    stop: store.stop,
    retry: store.retry,
    confirm: store.confirm,
    clear: store.clear,
  };
}

/**
 * The conversation as the visitor sees it: each message's text with AiText and each change it asks to make with AiConfirm,
 * a tool's other steps as `tools` shows them by the tool's name (its output-available part as the website's own cards), and
 * the reason no answer came where the answer would be.
 */
export function AiMessages({ chat, tools, className }: {
  chat: AiChat;
  tools?: Partial<Record<string, (part: AiToolPart) => ReactNode>>;
  className?: string;
}) {
  return (
    <div className={className} data-ai-messages="">
      {chat.messages.map(message => (
        <div key={message.id} data-ai-message={message.role}>
          {message.parts.map((part, index) => {
            if (isTextUIPart(part)) return <AiText key={index} text={part.text} />;
            // A file the visitor attached shows by its name alone.
            if (isFileUIPart(part)) return <p key={index} data-ai-file="">{part.filename ?? aiChatWords.file}</p>;
            if (!isToolUIPart(part)) return null;
            const shown = tools?.[getToolName(part)]?.(part) ?? null;
            return part.state === "approval-requested"
              ? <AiConfirm key={index} chat={chat} part={part}>{shown}</AiConfirm>
              : <Fragment key={index}>{shown}</Fragment>;
          })}
        </div>
      ))}
      {chat.errorText !== null && <p role="alert" data-ai-error="">{chat.errorText}</p>}
    </div>
  );
}

/**
 * A change the assistant asks to make, until the visitor answers: what it will send, field by field, and Confirm and Cancel.
 * `children` says what the change is ("Send this to the studio?"); the fields always show, so the visitor sees exactly what
 * goes. Only the last answer's changes wait for a yes: one an earlier answer asked for reads as not confirmed, since the
 * conversation moved on and the website declined it.
 */
export function AiConfirm({ chat, part, children, confirmLabel = aiChatWords.confirm, cancelLabel = aiChatWords.cancel }: {
  chat: Pick<AiChat, "messages" | "confirm">;
  part: AiToolPart;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  if (part.state !== "approval-requested") return null;
  const { id } = part.approval;
  if (!waiting(chat.messages, id)) return <p data-ai-unconfirmed="">{aiChatWords.unconfirmed}</p>;
  return (
    <div data-ai-confirm="">
      {children}
      <dl>
        {fields(part.input).map(([name, value]) => (
          <Fragment key={name}><dt>{name}</dt><dd>{value}</dd></Fragment>
        ))}
      </dl>
      <button type="button" data-ai-answer="confirm" onClick={() => chat.confirm(id, true)}>{confirmLabel}</button>
      <button type="button" data-ai-answer="cancel" onClick={() => chat.confirm(id, false)}>{cancelLabel}</button>
    </div>
  );
}

/**
 * A picture feature's ask, the browser half of its route: the person's words go to it, with their sign-in where the website
 * signs people in, and its answer comes back: the picture, a data address to show in the website's Image and keep through
 * its own save, or the sentence to show where it would be. A picture can take a minute or two to draw.
 */
export async function drawAiPicture(feature: string, words: string, options: AiChatOptions = {}): Promise<AiPictureAnswer | AiRefusal> {
  const token = await accessToken(options.backend);
  const body: AiTurnRequest = { message: { id: crypto.randomUUID(), role: "user", parts: [{ type: "text", text: words }] }, page: pageOf(options.page) };
  try {
    const response = await fetch(aiFeaturePath(feature), { method: "POST", body: JSON.stringify(body),
      headers: { "content-type": "application/json", ...(token ? visitorHeaders(token) : {}) } });
    const answer = await response.json() as Partial<AiPictureAnswer & AiRefusal> | null;
    if (typeof answer?.picture === "string") return { picture: answer.picture };
    return { error: typeof answer?.error === "string" ? answer.error : aiChatWords.failed };
  } catch {
    return { error: aiChatWords.failed };
  }
}

/**
 * An answer's text, in paragraphs, never as HTML and never with a picture: an answer can carry planted text, and a picture
 * loads by itself, sending whatever its address holds, so a picture's markdown shows only its words. A link to one of this
 * website's pages shows its words; a link anywhere else also shows where it goes, and opens without telling that site this
 * page's address.
 */
export function AiText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className} data-ai-text="">
      {text.split(/\n{2,}/u).filter(paragraph => paragraph.trim() !== "").map((paragraph, index) => (
        <p key={index}>
          {paragraph.split("\n").map((line, at) => <Fragment key={at}>{at > 0 && <br />}{inline(line)}</Fragment>)}
        </p>
      ))}
    </div>
  );
}

/** A picture's markdown, a link's, bold text, or a bare web address: each within one line and free of parentheses. */
const marks = /!\[([^\]\n]*)\]\(([^()\s]*)\)|\[([^\]\n]+)\]\(([^()\s]+)\)|\*\*([^*\n]+)\*\*|(https?:\/\/[^\s<>()[\]]+)/giu;

function inline(line: string): ReactNode[] {
  const shown: ReactNode[] = [];
  let at = 0;
  for (const match of line.matchAll(marks)) {
    const [whole, alt, , label, href, bold, address] = match;
    shown.push(line.slice(at, match.index));
    at = match.index + whole.length;
    if (alt !== undefined) shown.push(alt);
    else if (label !== undefined) shown.push(link(label, href!, shown.length));
    else if (bold !== undefined) shown.push(<strong key={shown.length}>{bold}</strong>);
    else {
      // A sentence's last mark is the sentence's, not the address's.
      const [, bare, after] = /^(.*?)([.,;:!?'"]*)$/u.exec(address!)!;
      shown.push(link(bare!, bare!, shown.length), after);
    }
  }
  shown.push(line.slice(at));
  return shown;
}

function link(label: string, href: string, key: number): ReactNode {
  // One of this website's pages: a path, never "//host" or "/\host", which browsers read as another site.
  if (/^\/(?![/\\])/u.test(href)) return <a key={key} href={href}>{label}</a>;
  if (!/^(?:https?:\/\/|mailto:|tel:)/iu.test(href)) return label;
  return <a key={key} href={href} target="_blank" rel="noopener noreferrer">{label === href ? href : `${label} (${href})`}</a>;
}

/** A change's input as the visitor reads it: each field's name in words and its value as text. */
function fields(input: unknown): [string, string][] {
  if (input === null || input === undefined) return [];
  if (typeof input !== "object" || Array.isArray(input)) return [[aiChatWords.value, valueText(input)]];
  return Object.entries(input).filter(([, value]) => value !== null && value !== undefined)
    .map(([name, value]) => [fieldName(name), valueText(value)]);
}

/** A field's name on its card: the website's own (`aiFieldName`), else its input name in words ("preferredDate" reads "Preferred date"). */
function fieldName(name: string): string {
  const own = aiFieldName(name);
  if (own !== undefined) return own;
  const words = name.replace(/([a-z0-9])([A-Z])/gu, "$1 $2").replace(/[_-]+/gu, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function valueText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.every(item => typeof item === "string" || typeof item === "number")) return value.join(", ");
  return JSON.stringify(value);
}

/** A failure's sentence: the website's own, else the chat's (`aiChatWords`) for a lost connection or an answer that never came. */
function visitorSentence(error: Error | undefined): string {
  // The route refused before answering, with { error } in its body.
  if (APICallError.isInstance(error)) return refusalSentence(error.responseBody) ?? aiChatWords.failed;
  if (error instanceof TypeError) return aiChatWords.disconnected;
  // The answer's stream ended on its error part, whose text the website wrote for visitors.
  return error?.constructor === Error && error.message.trim() !== "" ? error.message : aiChatWords.failed;
}

function refusalSentence(body: string | undefined): string | null {
  try {
    const { error } = JSON.parse(body ?? "") as Partial<AiRefusal>;
    return typeof error === "string" && error.trim() !== "" ? error : null;
  } catch {
    return null;
  }
}

/** Whether a message is an answer the visitor can see: words, or a tool's step. */
const answered = (message: UIMessage) => message.role === "assistant"
  && message.parts.some(part => (isTextUIPart(part) && part.text.trim() !== "") || isToolUIPart(part));

/** A tool's step that ran: its result, or its failure. */
const toolRan = (part: UIMessage["parts"][number]) =>
  isToolUIPart(part) && (part.state === "output-available" || part.state === "output-error");

/** A change the visitor confirmed that has no result yet: its press is on its way, or its answer was lost. */
const confirmedWithoutResult = (part: UIMessage["parts"][number]): part is AiToolPart =>
  isToolUIPart(part) && part.state === "approval-responded" && part.approval.approved;

/** Whether the last message asks for this change and still waits for the visitor's answer: the one answer the SDK sends. */
function waiting(messages: UIMessage[], approvalId: string): boolean {
  const last = messages[messages.length - 1];
  return last?.role === "assistant"
    && last.parts.some(part => isToolUIPart(part) && part.state === "approval-requested" && part.approval.id === approvalId);
}

async function accessToken(backend: AiVisitorSessions | undefined): Promise<string | null> {
  if (!backend) return null;
  const { data } = await backend.auth.getSession();
  return data.session?.access_token ?? null;
}

/** A signed-in visitor's request: their access token in its own header, which a live preview's door passes on as it is. */
const visitorHeaders = (token: string): Record<string, string> => ({ [aiVisitorTokenHeader]: token });

/** The page as a question carries it: the ids the route takes, then the path while there is room; nothing the route refuses. */
function pageOf(page: AiPage | undefined): AiPage {
  const entries = Object.entries(page ?? {}).filter(takes).slice(0, aiPageLimits.entries);
  const path: [string, string] = ["path", location.pathname];
  if (entries.length < aiPageLimits.entries && !entries.some(([key]) => key === "path") && takes(path)) entries.push(path);
  return Object.fromEntries(entries);
}

const takes = ([key, value]: [string, unknown]) =>
  aiPageKey.test(key) && typeof value === "string" && value.length <= aiPageLimits.valueCharacters;

/** An anonymous visitor's earlier turns as a question carries them: their words alone. */
function textTurns(messages: UIMessage[]): AiTextTurn[] {
  const turns: AiTextTurn[] = [];
  for (const { id, role, parts } of messages) {
    if (role !== "user" && role !== "assistant") continue;
    const texts = parts.filter(isTextUIPart).filter(part => part.text.trim() !== "")
      .map(part => ({ type: "text" as const, text: part.text }));
    if (texts.length) turns.push({ id, role, parts: texts });
  }
  return turns;
}

/** The last turns the route keeps, the oldest dropped until the question fits the route's size. */
function fitHistory(body: AiTurnRequest, turns: AiTextTurn[]) {
  let history = turns.slice(-aiFeatureKindLimits.assistant.historyMessages);
  while (history.length && byteLength({ ...body, history }) > aiTurnBodyBytes) history = history.slice(1);
  if (history.length) body.history = history;
}

const byteLength = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

async function savedConversation(feature: string, token: string): Promise<UIMessage[]> {
  const response = await fetch(aiFeaturePath(feature), { headers: visitorHeaders(token) });
  if (!response.ok) return [];
  return messagesOf(((await response.json()) as Partial<AiConversation> | null)?.messages);
}

/** Saved messages by their shape alone: each with an id, a role and its parts. */
function messagesOf(value: unknown): UIMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((message): message is UIMessage => typeof message === "object" && message !== null
    && typeof message.id === "string" && typeof message.role === "string" && Array.isArray(message.parts));
}

const storageKey = (feature: string) => `foundable-ai:${feature}`;

// A browser may keep nothing (a private window, or storage blocked or full): the conversation then lasts until the page closes.
function readKept(feature: string): UIMessage[] {
  try { return messagesOf(JSON.parse(localStorage.getItem(storageKey(feature)) ?? "null")); } catch { return []; }
}

function keep(feature: string, messages: UIMessage[]) {
  try {
    if (messages.length) localStorage.setItem(storageKey(feature), JSON.stringify(messages.slice(-keptMessages)));
    else localStorage.removeItem(storageKey(feature));
  } catch { /* Kept nowhere, as readKept says. */ }
}

function forget(feature: string) {
  try { localStorage.removeItem(storageKey(feature)); } catch { /* Kept nowhere, as readKept says. */ }
}
