import type { ComponentProps } from "react";

// The widths a published site carries a size of each generated picture at, smallest first, each at its `?w=` address; a
// wider ask, or one of a picture without that size, answers the picture itself. This copies pageImageSizes in Build's
// page-image-sizes.ts (server/src/build/), which an app cannot import: keep the two in step.
const generatedImageWidths = [320, 640, 960, 1280] as const;

// A picture Foundable generated for the site, named by its own SHA-256, at the address its pages use. This copies
// isGeneratedImagePath in Build's runner/source-bundle.mjs (server/src/build/), which an app cannot import: keep the
// two in step.
const generatedPicture = /^\/generated-assets\/[0-9a-f]{64}\.(?:webp|png)$/;

// The width and height attributes reserve a picture's shape and never stretch it: any page rule or Tailwind utility that
// sizes a picture (`h-48`) wins over this one, whose specificity is zero, in Tailwind's base layer, which every utility
// follows. It names Tailwind's layer order first, so the order holds whether it or the stylesheet reaches the head first.
// React writes it into the head once, however many pictures render.
const shapeRule = "@layer theme,base,components,utilities;@layer base{:where(img[data-image]){height:auto}}";

type ImageProps = Omit<
  ComponentProps<"img">,
  "src" | "alt" | "width" | "height" | "srcSet" | "loading" | "decoding" | "fetchPriority"
> & {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** The picture the first screen shows: fetched at once at high priority, and the one picture React preloads. */
  priority?: boolean;
};

/**
 * A picture, with next/image's props: alt, width and height are required, and every picture but the one marked
 * `priority` loads lazily and decodes off the main thread. A generated picture also offers every size its site carries,
 * whatever width its page gives it: Build draws a picture wider than its place (twice it, for high-density screens), so a
 * phone takes a size near its screen's width rather than the whole picture.
 */
export function Image({ src, alt, width, height, priority = false, sizes, ...img }: ImageProps) {
  // The picture itself is described as wider than the widest size (a site carries that size only of a wider picture) and
  // no narrower than its page shows it, so a screen needing more than every size takes the picture itself, and never a
  // size narrower than it needs.
  const widest = generatedImageWidths[generatedImageWidths.length - 1];
  const srcSet = generatedPicture.test(src)
    ? [...generatedImageWidths.map((candidate) => `${src}?w=${candidate} ${candidate}w`),
      `${src} ${Math.max(Math.ceil(width), widest + 1)}w`].join(", ")
    : undefined;
  return (
    <>
      <style href="image" precedence="image">
        {shapeRule}
      </style>
      <img
        {...img}
        data-image=""
        src={src}
        alt={alt}
        width={width}
        height={height}
        srcSet={srcSet}
        sizes={srcSet ? (sizes ?? (priority ? "100vw" : "auto, 100vw")) : sizes}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? undefined : "async"}
        fetchPriority={priority ? "high" : undefined}
      />
    </>
  );
}
