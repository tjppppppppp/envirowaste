// Foundable AI kit: how an AI feature that makes pictures draws one, for its route (feature.server.ts). Foundable keeps this
// file and replaces it whole when the kit changes, so never edit it.
import { generateImage } from "ai";
import { picture, pictureQuality } from "../ai.server";
import { aiStreamKeepAliveMs, type AiPictureAnswer, type AiRefusal } from "./turn";

/** What a picture feature's folder hands the kit beside its instructions: the picture's size, the kit's where it names none, and rarely its quality. */
export interface AiPictureSetup {
  /** Its size in pixels, each side a multiple of 16: `1024x1024` (the kit's), `1536x1024` wide, `1024x1536` tall. */
  size?: `${number}x${number}`;
  /**
   * How finely this feature alone is drawn: `low`, `medium` (about twice its credits) or `high` (about seven times); where it
   * names none, the website's quality (`pictureQuality()`), which its owner picks with no rebuild.
   */
  quality?: "low" | "medium" | "high";
}

/** A feature that makes pictures, as its route reads its file. */
interface PictureFeature {
  id: string;
  model: string;
}

/**
 * A picture feature's answer to a person's words: one picture drawn on the feature's model (the helper's picture model for the
 * website's own, "default") from the feature's instructions and those words, as one call to Foundable AI tagged with the
 * feature and its turn, and the request's own Foundable AI headers (`aiCallHeaders`). It answers at once as JSON (`AiPictureAnswer`), keeping the line busy with a space each
 * `aiStreamKeepAliveMs` while the picture is drawn, which JSON takes before its value: a picture can take two minutes, and a
 * live preview's door gives up on an answer not begun in 55 s. A failure ends it on the visitor's sentence (`AiRefusal`) from
 * `failed`, which logs its cause.
 */
export function drawPicture(feature: PictureFeature, setup: { instructions: string; picture?: AiPictureSetup }, words: string,
  failed: (error: unknown) => string, headers: Record<string, string> = {}): Response {
  const drawn = generateImage({
    model: feature.model === "default" ? picture() : picture(feature.model),
    prompt: `${setup.instructions}\n\n${words}`,
    size: setup.picture?.size ?? "1024x1024",
    providerOptions: { openai: { quality: setup.picture?.quality ?? pictureQuality() } },
    headers: { ...headers, ["x-app-ai-feature"]: feature.id, ["x-app-ai-turn"]: crypto.randomUUID() },
  }).then(({ image }): AiPictureAnswer => ({ picture: `data:${image.mediaType};base64,${image.base64}` }),
    (error: unknown): AiRefusal => ({ error: failed(error) }));
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined, left = false;
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      const beat = () => {
        controller.enqueue(encoder.encode(" "));
        timer = setTimeout(beat, aiStreamKeepAliveMs);
      };
      timer = setTimeout(beat, aiStreamKeepAliveMs);
      void drawn.then(answer => {
        clearTimeout(timer);
        if (left) return;
        controller.enqueue(encoder.encode(JSON.stringify(answer)));
        controller.close();
      });
    },
    // A visitor who leaves stops the line's spaces; the picture is still drawn and charged, as a written answer is.
    cancel() {
      left = true;
      clearTimeout(timer);
    },
  }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
