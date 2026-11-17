// Foundable AI kit: a visitor's video as still pictures, taken in their own browser, for a feature that is shown videos.
// Foundable keeps this file and replaces it whole when the kit changes, so never edit it. The video itself never leaves
// the visitor's device: the browser's own player opens the picked file where it is, and the page's chat (chat.tsx) sends
// only the pictures this file takes from it, so a video of any size is read with no upload.
import { aiVideo, aiVideoGap, aiVideoPictures, aiVideoSeconds } from "./turn";

/** One picture of a video: its time in the video, in seconds, and the picture, a JPEG. */
export interface AiVideoPicture {
  at: number;
  picture: Blob;
}

/** A video opened to take its pictures: its length, how far apart and how many they are, and the next one until none is left. */
export interface AiVideoLook {
  seconds: number;
  gap: number;
  pictures: number;
  /** The next picture, in order from the video's start; null once every one is taken. Rejects with `AiVideoStalled` where it never comes. */
  next(): Promise<AiVideoPicture | null>;
  /** Lets the video go: its player and the address it read the file by. */
  close(): void;
}

/** A video's next picture did not come: its player stopped, as a page left open in the background or a sleeping phone stops one. */
export class AiVideoStalled extends Error {
  constructor() {
    super("The video's next picture did not come.");
    this.name = "AiVideoStalled";
  }
}

/**
 * How long the player has to show a video's first picture, and each later one, in milliseconds: a phone opens a film of
 * several gigabytes in a few seconds and moves to a picture in well under one, so past these it is not coming.
 */
const openMs = 30_000, pictureMs = 20_000;

/** Waits for one of `events` on `target`, at most `ms`: its name, "late" past `ms`, "left" where `signal` aborts first. */
function heard(target: EventTarget, events: readonly string[], ms: number, signal: AbortSignal): Promise<string> {
  return new Promise(resolve => {
    const done = (outcome: string) => {
      clearTimeout(timer);
      for (const event of events) target.removeEventListener(event, on);
      signal.removeEventListener("abort", left);
      resolve(outcome);
    };
    const on = (event: Event) => done(event.type), left = () => done("left");
    const timer = setTimeout(() => done("late"), ms);
    for (const event of events) target.addEventListener(event, on);
    if (signal.aborted) done("left");
    else signal.addEventListener("abort", left);
  });
}

/** Waits until the page shows again, or `signal` aborts: a hidden page's player decodes nothing. */
function shown(signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const done = () => {
      document.removeEventListener("visibilitychange", seen);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const seen = () => { if (document.visibilityState === "visible") done(); };
    if (signal.aborted || document.visibilityState === "visible") return resolve();
    document.addEventListener("visibilitychange", seen);
    signal.addEventListener("abort", done);
  });
}

/**
 * Opens a picked video to take its pictures, or answers null for one this browser cannot open, one with no picture in it
 * (a sound recording under a video's name) or one whose length it cannot tell. Each picture is the frame the player shows
 * at its time, one each `aiVideoGap` from the start, drawn at most `aiVideo.edge` pixels on its longer side and never
 * larger than the video, a JPEG at `aiVideo.quality` or, where a browser's encoder writes it past `aiVideo.pictureBytes`,
 * at the quality that last fitted, a tenth lower each try down to `aiVideo.leastQuality`: the same frame comes out twice
 * the size from one browser as from another, and a phone sends every byte. A page hidden while a picture is awaited waits
 * until it shows again, then asks once more.
 */
export async function openAiVideo(file: Blob, signal: AbortSignal): Promise<AiVideoLook | null> {
  const address = URL.createObjectURL(file), video = document.createElement("video");
  // Silent and in the page's own frame, so a phone plays nothing aloud and opens no player of its own.
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  const close = () => {
    video.removeAttribute("src");
    // Without this the player keeps the file open until the page goes.
    video.load();
    URL.revokeObjectURL(address);
  };
  const refuse = () => {
    close();
    return null;
  };
  // Listening before the address is set, so a small file's first picture is never missed.
  const first = heard(video, ["loadeddata", "error"], openMs, signal);
  video.src = address;
  // An iPhone loads nothing of a video that is not played until it is told to.
  video.load();
  if (await first !== "loadeddata" || !video.videoWidth || !video.videoHeight) return refuse();
  // A recording a browser made itself says its length only once the player has been sent past its end.
  if (!Number.isFinite(video.duration)) {
    const told = heard(video, ["durationchange", "error"], pictureMs, signal);
    video.currentTime = Number.MAX_SAFE_INTEGER;
    if (await told !== "durationchange") return refuse();
  }
  const seconds = video.duration;
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > aiVideoSeconds) return refuse();
  const gap = aiVideoGap(seconds), pictures = aiVideoPictures(seconds);
  const scale = Math.min(1, aiVideo.edge / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return refuse();
  // The last frame starts a little before the video's end, so no picture is asked for past it.
  const latest = Math.max(0, seconds - 0.05);
  /** Moves the player to `at`: whether it shows that frame now. */
  const moved = async (at: number): Promise<boolean> => {
    // Already there, as a video's first picture is once it has loaded: no move, so nothing to wait for.
    if (!video.seeking && video.readyState >= 2 && Math.abs(video.currentTime - at) < 0.001) return true;
    const arrived = heard(video, ["seeked", "error"], pictureMs, signal);
    video.currentTime = at;
    return await arrived === "seeked";
  };
  /** The frame the player shows now, as a JPEG at `quality`. */
  const drawn = (quality: number) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
  // The quality the last picture fitted at, where every later one starts: it only goes down, so most pictures are written once.
  let taken = 0, quality: number = aiVideo.quality;
  return {
    seconds, gap, pictures, close,
    async next() {
      if (taken >= pictures) return null;
      const at = taken * gap, target = Math.min(at, latest);
      if (signal.aborted) throw new AiVideoStalled();
      if (!await moved(target)) {
        if (signal.aborted || video.error) throw new AiVideoStalled();
        // A page hidden meanwhile had its player stopped by the browser: once it shows again the picture is asked for once more.
        await shown(signal);
        if (signal.aborted || !await moved(target)) throw new AiVideoStalled();
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      let picture = await drawn(quality);
      while (picture && picture.size > aiVideo.pictureBytes && quality - 0.1 >= aiVideo.leastQuality - 0.001) {
        quality = Math.round((quality - 0.1) * 10) / 10;
        picture = await drawn(quality);
      }
      if (!picture) throw new AiVideoStalled();
      taken += 1;
      return { at, picture };
    },
  };
}
