import { ArrowLeft, Inbox, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Image } from "@/image";
import { cn } from "@/lib/utils";
import { BlockAnchor, ScreenHeading, type BlockLink, type BlockPicture } from "./parts";

/** One record in the list, as the product's own records give it. */
export type ListItem = {
  id: string;
  title: string;
  subtitle?: string;
  /** A short fact at the row's end, such as a date or an amount. */
  meta?: string;
  badge?: string;
  picture?: BlockPicture;
};

/** A record's facts as labelled rows, for the detail pane. */
export function DetailFields({ fields }: { fields: readonly { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.label} className="flex min-w-0 flex-col gap-1">
          <dt className="text-sm text-muted-foreground">{field.label}</dt>
          <dd className="break-words">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * A screen of records: a searchable list beside the open record's detail, which `detail` writes. On a phone the list
 * fills the screen and a record opens over it, with a way back. With no records yet it says so in `empty`, with the
 * first thing to do. To give each record an address of its own, keep `selected` in the route's search and set it in
 * `onSelect`.
 */
export function ListDetail({
  title,
  description,
  actions,
  items,
  detail,
  selected,
  onSelect,
  search,
  empty,
  noMatches = "Nothing matches that search.",
  backLabel = "Back",
  listLabel,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  items: readonly ListItem[];
  detail: (item: ListItem) => ReactNode;
  selected?: string;
  onSelect?: (id: string) => void;
  /** A search box over the list, with its label in the website's language. */
  search?: { label: string; placeholder?: string };
  empty: { title: string; description?: string; action?: BlockLink };
  noMatches?: string;
  backLabel?: string;
  /** The list's name for screen readers; the title otherwise. */
  listLabel?: string;
}) {
  const [own, setOwn] = useState(selected ?? items[0]?.id);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = selected ?? own;
  const words = query.trim().toLowerCase();
  const shown = words
    ? items.filter((item) => [item.title, item.subtitle, item.meta].some((text) => text?.toLowerCase().includes(words)))
    : items;
  const item = items.find((candidate) => candidate.id === current);
  const choose = (id: string) => {
    setOwn(id);
    setOpen(true);
    onSelect?.(id);
  };

  return (
    <div className="flex flex-col gap-6">
      <ScreenHeading title={title} description={description} actions={actions} />
      {items.length === 0 ? (
        <Card className="items-center gap-3 px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Inbox aria-hidden className="size-5" />
          </span>
          <h2 className="font-semibold">{empty.title}</h2>
          {empty.description && <p className="max-w-sm text-sm text-pretty text-muted-foreground">{empty.description}</p>}
          {empty.action && (
            <Button asChild className="mt-2">
              <BlockAnchor href={empty.action.href}>{empty.action.label}</BlockAnchor>
            </Button>
          )}
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden py-0 lg:grid lg:min-h-[32rem] lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className={cn("flex min-w-0 flex-col lg:border-r", open && "max-lg:hidden")}>
            {search && (
              <div className="border-b p-3">
                <div className="relative">
                  <Search aria-hidden className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    aria-label={search.label}
                    placeholder={search.placeholder ?? search.label}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            )}
            {shown.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">{noMatches}</p>
            ) : (
              <ul aria-label={listLabel ?? title} className="flex flex-col divide-y overflow-y-auto">
                {shown.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      aria-current={entry.id === current ? "true" : undefined}
                      onClick={() => choose(entry.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/60 aria-[current=true]:bg-accent aria-[current=true]:text-accent-foreground"
                    >
                      {entry.picture && (
                        <Image
                          src={entry.picture.src}
                          alt=""
                          width={entry.picture.width}
                          height={entry.picture.height}
                          sizes="40px"
                          className="size-10 shrink-0 rounded-md object-cover"
                        />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{entry.title}</span>
                        {entry.subtitle && <span className="truncate text-sm text-muted-foreground">{entry.subtitle}</span>}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        {entry.meta && <span className="text-xs text-muted-foreground tabular-nums">{entry.meta}</span>}
                        {entry.badge && <Badge variant="secondary">{entry.badge}</Badge>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={cn("flex min-w-0 flex-col gap-6 p-5 sm:p-6", !open && "max-lg:hidden")}>
            <Button type="button" variant="ghost" size="sm" className="self-start lg:hidden" onClick={() => setOpen(false)}>
              <ArrowLeft />
              {backLabel}
            </Button>
            {item && detail(item)}
          </div>
        </Card>
      )}
    </div>
  );
}
