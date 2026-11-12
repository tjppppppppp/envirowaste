import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BlockAnchor, BlockForm, ScreenHeading, type BlockFormSection, type BlockFormSend, type BlockFormWords, type BlockLink } from "./parts";

/**
 * A product's form screen (a new record, a record's edit, the settings): its title row and the fields in titled sections,
 * each section's title and note beside its fields on a wide window, saved through `send`, a server function that writes
 * the record and answers what came of it. The form shows saved only when `send` answers `ok`.
 */
export function FormSections({
  title,
  description,
  actions,
  sections,
  send,
  submitLabel,
  cancel,
  words,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  sections: readonly BlockFormSection[];
  send: BlockFormSend;
  submitLabel?: string;
  /** Where Cancel goes, such as back to the list. */
  cancel?: BlockLink;
  words?: BlockFormWords;
}) {
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <ScreenHeading title={title} description={description} actions={actions} />
      <Card>
        <CardContent>
          <BlockForm
            sections={sections}
            send={send}
            submitLabel={submitLabel}
            words={words}
            footer={
              cancel && (
                <Button asChild variant="ghost" size="lg">
                  <BlockAnchor href={cancel.href}>{cancel.label}</BlockAnchor>
                </Button>
              )
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
