import type { LucideIcon } from "lucide-react";
import { useId } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  accentText,
  BlockAnchor,
  BlockContainer,
  BlockForm,
  BlockHeading,
  BlockSection,
  quietText,
  type BlockField,
  type BlockFormSend,
  type BlockFormWords,
  type BlockTone,
} from "./parts";

/** One way to reach the business, as the request gives it: its phone, email, address or a social page, with its link. */
export type ContactDetail = { label: string; value: string; href?: string; icon?: LucideIcon };

/** The fields a contact form asks for unless the request asks for others; pass them in the website's language. */
export const contactFields: readonly BlockField[] = [
  { name: "name", label: "Name", required: true, autoComplete: "name", half: true },
  { name: "email", label: "Email", type: "email", required: true, autoComplete: "email", half: true },
  { name: "message", label: "Message", type: "textarea", required: true },
];

/**
 * How to reach the business: its details and hours beside a message form. The form is there only with `form.send`, a
 * server function that emails each message to the business, so a visitor's message always goes somewhere; without one
 * the details take the whole section.
 */
export function ContactSplit({
  id,
  eyebrow,
  title,
  description,
  details,
  hours,
  hoursTitle = "Opening hours",
  form,
  tone = "default",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  details: readonly ContactDetail[];
  /** Opening hours as the request gives them, one row a line ("Mon–Fri", "7:00–17:00"). */
  hours?: readonly { days: string; hours: string }[];
  hoursTitle?: string;
  form?: { send: BlockFormSend; fields?: readonly BlockField[]; title?: string; submitLabel?: string; words?: BlockFormWords };
  tone?: BlockTone;
}) {
  const heading = useId();
  return (
    <BlockSection id={id} tone={tone} aria-labelledby={heading}>
      <BlockContainer className={cn("grid gap-12", form && "lg:grid-cols-2 lg:gap-16")}>
        <div className="flex flex-col gap-10">
          <BlockHeading id={heading} eyebrow={eyebrow} title={title} description={description} />
          <dl className={cn("grid gap-6", !form && "sm:grid-cols-2 lg:grid-cols-3")}>
            {details.map((detail) => {
              const Icon = detail.icon;
              return (
                <div key={`${detail.label} ${detail.value}`} className="flex items-start gap-4">
                  {Icon && (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon aria-hidden className="size-5" />
                    </span>
                  )}
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <dt className={cn("text-sm", quietText(tone))}>{detail.label}</dt>
                    <dd className="font-medium break-words">
                      {detail.href ? (
                        <BlockAnchor href={detail.href} className={cn("underline-offset-4 hover:underline", accentText(tone))}>
                          {detail.value}
                        </BlockAnchor>
                      ) : (
                        detail.value
                      )}
                    </dd>
                  </div>
                </div>
              );
            })}
          </dl>
          {hours && hours.length > 0 && (
            <div className="flex max-w-sm flex-col gap-3">
              <h3 className="font-medium">{hoursTitle}</h3>
              <dl className="flex flex-col divide-y text-sm">
                {hours.map((row) => (
                  <div key={row.days} className="flex justify-between gap-6 py-2">
                    <dt className={quietText(tone)}>{row.days}</dt>
                    <dd className="font-medium tabular-nums">{row.hours}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
        {form && (
          <Card className="self-start sm:py-8">
            <CardContent className="flex flex-col gap-6 sm:px-8">
              {form.title && <h3 className="text-lg font-semibold">{form.title}</h3>}
              <BlockForm fields={form.fields ?? contactFields} send={form.send} submitLabel={form.submitLabel} words={form.words} />
            </CardContent>
          </Card>
        )}
      </BlockContainer>
    </BlockSection>
  );
}
