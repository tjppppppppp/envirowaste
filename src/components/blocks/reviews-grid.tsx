import { Star } from "lucide-react";
import { useId } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Image } from "@/image";
import { cn } from "@/lib/utils";
import { BlockContainer, BlockHeading, BlockSection, displayHeading, quietText, type BlockPicture, type BlockTone } from "./parts";

/** A review a real customer gave, in their words, as the request quotes it. */
export type Review = {
  quote: string;
  name: string;
  /** Who they are or where the review was left, such as "Regular since 2021" or "Google review". */
  detail?: string;
  /** Stars out of five, only where the review gave them. */
  rating?: number;
  /** Their own photo, only where the request gives it. */
  avatar?: BlockPicture;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");

function Stars({ rating, label }: { rating: number; label: string }) {
  const whole = Math.round(Math.min(Math.max(rating, 0), 5));
  return (
    <div className="flex gap-0.5" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} aria-hidden className={cn("size-4", star <= whole ? "fill-primary text-primary" : "text-muted-foreground/40")} />
      ))}
    </div>
  );
}

/**
 * What customers said, as cards of their words with their name, in columns that fill from the top. An overall score
 * (`summary`) sits beside the heading where the request gives one.
 */
export function ReviewsGrid({
  id,
  eyebrow,
  title,
  description,
  reviews,
  summary,
  ratingLabel = (rating) => `Rated ${rating} out of 5`,
  tone = "muted",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  reviews: readonly Review[];
  /** The overall score and where it comes from, such as { score: "4.9", label: "from 212 Google reviews" }. */
  summary?: { score: string; label: string; rating?: number };
  /** What a row of stars says to a screen reader, in the website's language. */
  ratingLabel?: (rating: number) => string;
  tone?: BlockTone;
}) {
  const heading = useId();
  return (
    <BlockSection id={id} tone={tone} aria-labelledby={heading}>
      <BlockContainer className="flex flex-col gap-10 md:gap-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <BlockHeading id={heading} eyebrow={eyebrow} title={title} description={description} />
          {summary && (
            <div className="flex shrink-0 flex-col gap-1.5">
              <span className={cn(displayHeading, "text-4xl tabular-nums")}>{summary.score}</span>
              {summary.rating !== undefined && <Stars rating={summary.rating} label={ratingLabel(summary.rating)} />}
              <span className={cn("text-sm", quietText(tone))}>{summary.label}</span>
            </div>
          )}
        </div>
        <ul className="columns-1 gap-6 md:columns-2 lg:columns-3">
          {reviews.map((review) => (
            <li key={`${review.name} ${review.quote.slice(0, 24)}`} className="mb-6 break-inside-avoid">
              <Card className="gap-5">
                <CardContent className="flex flex-col gap-4">
                  {review.rating !== undefined && <Stars rating={review.rating} label={ratingLabel(review.rating)} />}
                  <blockquote className="text-base leading-relaxed text-pretty">“{review.quote}”</blockquote>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9">
                      {review.avatar ? (
                        <Image
                          src={review.avatar.src}
                          alt=""
                          width={review.avatar.width}
                          height={review.avatar.height}
                          sizes="36px"
                          className="size-full object-cover"
                        />
                      ) : (
                        <AvatarFallback className="text-xs font-medium">{initials(review.name)}</AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium">{review.name}</span>
                      {review.detail && <span className="text-sm text-muted-foreground">{review.detail}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </BlockContainer>
    </BlockSection>
  );
}
