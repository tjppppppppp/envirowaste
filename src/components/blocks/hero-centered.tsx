import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Image } from "@/image";
import { cn } from "@/lib/utils";
import {
  BlockActions,
  BlockContainer,
  BlockSection,
  displayHeading,
  quietText,
  type BlockLink,
  type BlockPicture,
  type BlockTone,
} from "./parts";

/**
 * The first screen led by its words: a large centred headline, its lead and actions, with an optional wide picture
 * under them that may run past the first screen. For a business whose name and promise carry the page.
 */
export function HeroCentered({
  id,
  eyebrow,
  title,
  description,
  actions,
  picture,
  tone = "default",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: readonly BlockLink[];
  /** Shown wide under the words, cut to 16:9, so its subject belongs in the middle. */
  picture?: BlockPicture;
  tone?: BlockTone;
}) {
  const heading = useId();
  return (
    <BlockSection id={id} tone={tone} aria-labelledby={heading}>
      <BlockContainer width="narrow" className="flex flex-col items-center gap-6 text-center">
        {eyebrow && <Badge variant="secondary">{eyebrow}</Badge>}
        <h1 id={heading} className={cn(displayHeading, "text-4xl sm:text-6xl lg:text-7xl")}>
          {title}
        </h1>
        {description && <p className={cn("max-w-2xl text-lg text-pretty sm:text-xl", quietText(tone))}>{description}</p>}
        <BlockActions links={actions} className="w-full sm:w-auto sm:justify-center" />
      </BlockContainer>
      {picture && (
        <BlockContainer width="wide" className="mt-12 md:mt-16">
          <div className="overflow-hidden rounded-2xl border">
            <Image
              src={picture.src}
              alt={picture.alt}
              width={picture.width}
              height={picture.height}
              priority
              sizes="(min-width: 1280px) 1280px, 100vw"
              className="aspect-video h-auto w-full object-cover"
            />
          </div>
        </BlockContainer>
      )}
    </BlockSection>
  );
}
