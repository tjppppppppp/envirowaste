import { useId } from "react";
import { Image } from "@/image";
import { cn } from "@/lib/utils";
import { BlockActions, BlockContainer, displayHeading, type BlockLink, type BlockPicture } from "./parts";

/**
 * The first screen as one photograph filling it, with the headline, lead and actions over it. The photograph is shaded
 * black under white words, the one colour outside the theme's roles, as the kit's own overlays are, since a light
 * theme's foreground or a dark theme's background would wash it out. On a phone the words sit at the foot of the picture.
 */
export function HeroFullBleed({
  id,
  eyebrow,
  title,
  description,
  actions,
  picture,
  align = "start",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: readonly BlockLink[];
  /** A photograph whose subject sits away from where the words go (the right, or the top on a phone). */
  picture: BlockPicture;
  align?: "start" | "center";
}) {
  const heading = useId();
  const centred = align === "center";
  return (
    <section
      id={id}
      aria-labelledby={heading}
      className="relative isolate flex min-h-[calc(100svh-4rem)] scroll-mt-16 items-end overflow-hidden bg-black text-white md:items-center"
    >
      <Image
        src={picture.src}
        alt={picture.alt}
        width={picture.width}
        height={picture.height}
        priority
        sizes="100vw"
        className="absolute inset-0 -z-10 h-full w-full object-cover"
      />
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 -z-10 bg-linear-to-t from-black/85 via-black/45 to-black/10",
          centred ? "md:from-black/75 md:via-black/40" : "md:bg-linear-to-r md:from-black/80 md:via-black/40 md:to-transparent",
        )}
      />
      <BlockContainer className="py-16 md:py-24">
        <div className={cn("flex max-w-2xl flex-col gap-6", centred && "mx-auto items-center text-center")}>
          {eyebrow && <p className="text-sm font-medium tracking-wide text-white/85 uppercase">{eyebrow}</p>}
          <h1 id={heading} className={cn(displayHeading, "text-4xl sm:text-6xl lg:text-7xl")}>
            {title}
          </h1>
          {description && <p className="max-w-xl text-lg text-pretty text-white/85 sm:text-xl">{description}</p>}
          <BlockActions links={actions} onPicture className={cn("w-full sm:w-auto", centred && "sm:justify-center")} />
        </div>
      </BlockContainer>
    </section>
  );
}
