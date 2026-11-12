import { Check } from "lucide-react";
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Image } from "@/image";
import { cn } from "@/lib/utils";
import {
  accentText,
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
 * The first screen as two columns: the headline, its lead and actions beside one picture. It fills the first screen on a
 * wide window; on a phone the words and actions come first and the picture after them.
 */
export function HeroSplit({
  id,
  eyebrow,
  title,
  description,
  actions,
  highlights,
  picture,
  pictureSide = "end",
  tone = "default",
}: {
  id?: string;
  /** A short line above the headline, such as what the business is or where. */
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: readonly BlockLink[];
  /** Up to three short facts the request gives, each with a tick (opening hours, where it delivers). */
  highlights?: readonly string[];
  picture: BlockPicture;
  pictureSide?: "start" | "end";
  tone?: BlockTone;
}) {
  const heading = useId();
  return (
    <BlockSection id={id} tone={tone} aria-labelledby={heading} className="flex items-center lg:min-h-[calc(100svh-4rem)]">
      <BlockContainer className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className={cn("flex flex-col items-start gap-6", pictureSide === "start" && "lg:order-2")}>
          {eyebrow && <Badge variant="secondary">{eyebrow}</Badge>}
          <h1 id={heading} className={cn(displayHeading, "text-4xl sm:text-5xl lg:text-6xl")}>
            {title}
          </h1>
          {description && <p className={cn("max-w-xl text-lg text-pretty sm:text-xl", quietText(tone))}>{description}</p>}
          <BlockActions links={actions} className="w-full sm:w-auto" />
          {highlights && highlights.length > 0 && (
            <ul className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-x-6">
              {highlights.map((highlight) => (
                <li key={highlight} className="flex items-center gap-2">
                  <Check aria-hidden className={cn("size-4 shrink-0", accentText(tone))} />
                  {highlight}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="overflow-hidden rounded-2xl border">
          <Image
            src={picture.src}
            alt={picture.alt}
            width={picture.width}
            height={picture.height}
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="h-auto w-full object-cover lg:max-h-[calc(100svh-10rem)]"
          />
        </div>
      </BlockContainer>
    </BlockSection>
  );
}
