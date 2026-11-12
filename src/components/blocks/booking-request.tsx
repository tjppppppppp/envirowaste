import { useId } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
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

/** The fields a booking request asks for unless the request asks for others; pass them in the website's language. */
export const bookingFields: readonly BlockField[] = [
  { name: "date", label: "Date", type: "date", required: true, half: true },
  { name: "time", label: "Time", type: "time", required: true, half: true },
  { name: "name", label: "Name", required: true, autoComplete: "name", half: true },
  { name: "email", label: "Email", type: "email", required: true, autoComplete: "email", half: true },
  { name: "phone", label: "Phone", type: "tel", autoComplete: "tel", half: true },
  { name: "notes", label: "Anything we should know?", type: "textarea" },
];

/**
 * A booking asked for, not taken: the visitor sends the day, time and their details through `send`, a server function
 * that emails the request to the business, which confirms it itself, and the steps beside the form say so. Times that
 * fill up, or bookings visitors make and change themselves, are the data package's (its bookings skill).
 */
export function BookingRequest({
  id,
  eyebrow,
  title,
  description,
  steps,
  fields = bookingFields,
  send,
  submitLabel,
  words,
  tone = "muted",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  /** What happens after sending, in order, such as "We reply within a day to confirm". */
  steps?: readonly string[];
  fields?: readonly BlockField[];
  send: BlockFormSend;
  submitLabel?: string;
  words?: BlockFormWords;
  tone?: BlockTone;
}) {
  const heading = useId();
  return (
    <BlockSection id={id} tone={tone} aria-labelledby={heading}>
      <BlockContainer className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div className="flex flex-col gap-8">
          <BlockHeading id={heading} eyebrow={eyebrow} title={title} description={description} />
          {steps && steps.length > 0 && (
            <ol className="flex flex-col gap-4">
              {steps.map((step, index) => (
                <li key={step} className="flex items-start gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <span className={cn("pt-1 text-pretty", quietText(tone))}>{step}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <Card className="self-start sm:py-8">
          <CardContent className="sm:px-8">
            <BlockForm fields={fields} send={send} submitLabel={submitLabel} words={words} />
          </CardContent>
        </Card>
      </BlockContainer>
    </BlockSection>
  );
}
