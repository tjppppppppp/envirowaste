import { Link } from "@tanstack/react-router";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { createContext, useContext, useState, type ComponentProps, type ReactNode } from "react";
import { useForm, type RegisterOptions } from "react-hook-form";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// The parts Foundable's blocks share. Every colour is one of the theme's roles and every corner its radius, so the
// website's theme restyles a block without an edit; every word a visitor reads comes from the block's props.

/** A link a block shows: `#section` on this page, `/a-route` of this website, `tel:`, `mailto:` or an `https://` address. */
export type BlockLink = { label: string; href: string };

/** A picture a block shows, as the website's Image takes it: alt says what it shows, width and height are its own size. */
export type BlockPicture = { src: string; alt: string; width: number; height: number };

/**
 * A section's background, one of the theme's roles; the parts inside read it to keep their words and buttons legible.
 * `field` is the first screen's ground, which the design gives one section.
 */
export type BlockTone = "default" | "muted" | "secondary" | "primary" | "field";

/** Each tone's background and words. */
export const toneClasses: Record<BlockTone, string> = {
  default: "bg-background text-foreground",
  muted: "bg-muted text-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  primary: "bg-primary text-primary-foreground",
  field: "bg-field text-field-foreground",
};
const quietWords: Record<BlockTone, string> = {
  default: "text-muted-foreground",
  muted: "text-muted-foreground",
  secondary: "text-secondary-foreground/75",
  primary: "text-primary-foreground/80",
  field: "text-field-foreground/80",
};
const ToneContext = createContext<BlockTone>("default");

/** The tone of the section a part sits in. */
export const useBlockTone = () => useContext(ToneContext);
/** Supporting words' colour on the section's background. */
export const quietText = (tone: BlockTone) => quietWords[tone];
/** An accent's colour (an eyebrow, a tick) on the section's background. */
export const accentText = (tone: BlockTone) =>
  tone === "primary" ? "text-primary-foreground" : tone === "field" ? "text-field-foreground" : "text-primary";

/**
 * A page section: its background from the theme, the theme's section spacing (`--section-space`, which the website's
 * density sets; less on a phone) and room above it for the sticky NavBar when a link jumps to it.
 */
export function BlockSection({ tone = "default", className, children, ...props }: ComponentProps<"section"> & { tone?: BlockTone }) {
  return (
    <ToneContext.Provider value={tone}>
      <section
        data-block-tone={tone}
        className={cn("scroll-mt-16 py-[calc(var(--section-space,6rem)*0.7)] md:py-[var(--section-space,6rem)]", toneClasses[tone], className)}
        {...props}
      >
        {children}
      </section>
    </ToneContext.Provider>
  );
}

const widths = { narrow: "max-w-3xl", default: "max-w-6xl", wide: "max-w-7xl" } as const;

/** The page's one content column, centred, with the same side room on every section. */
export function BlockContainer({ width = "default", className, ...props }: ComponentProps<"div"> & { width?: keyof typeof widths }) {
  return <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", widths[width], className)} {...props} />;
}

/**
 * A heading in the display face. A display face with one weight is shown at it rather than thickened by the browser, so
 * `font-semibold` is the weight only where the face has one.
 */
export const displayHeading = "font-heading font-semibold tracking-tight text-balance [font-synthesis-weight:none]";

/** A section's eyebrow, title and lead, start-aligned or centred. */
export function BlockHeading({
  eyebrow,
  title,
  description,
  align = "start",
  id,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "start" | "center";
  /** The heading's id, which the section names as its label. */
  id?: string;
  className?: string;
}) {
  const tone = useBlockTone();
  return (
    <div className={cn("flex max-w-2xl flex-col gap-3", align === "center" && "mx-auto items-center text-center", className)}>
      {eyebrow && <p className={cn("text-sm font-medium tracking-wide uppercase", accentText(tone))}>{eyebrow}</p>}
      <h2 id={id} className={cn(displayHeading, "text-3xl sm:text-4xl")}>
        {title}
      </h2>
      {description && <p className={cn("text-lg text-pretty", quietText(tone))}>{description}</p>}
    </div>
  );
}

/** A product screen's title row: its one h1, a line under it and its actions. */
export function ScreenHeading({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  /** The screen's own buttons, such as one opening its form. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className={cn(displayHeading, "text-2xl sm:text-3xl")}>{title}</h1>
        {description && <p className="text-pretty text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const ownRoute = (href: string) => href.startsWith("/") && !href.startsWith("//");

/** A link: a route of this website opens in place through the router; anything else as the browser opens it. */
export function BlockAnchor({ href, children, ...props }: Omit<ComponentProps<"a">, "href"> & { href: string }) {
  if (ownRoute(href)) {
    const [path, hash] = href.split("#", 2);
    // The router types `to` by the website's own route tree, which a block cannot know.
    return (
      <Link to={path as "/"} hash={hash} {...props}>
        {children}
      </Link>
    );
  }
  const away = /^https?:\/\//i.test(href);
  return (
    <a href={href} {...(away ? { target: "_blank", rel: "noreferrer" } : {})} {...props}>
      {children}
    </a>
  );
}

/**
 * A row of links as buttons: the first is the main action, the rest quieter. `onPicture` keeps them legible over a
 * photograph. On a phone they stack at full width, each a thumb's height.
 */
export function BlockActions({
  links,
  size = "lg",
  onPicture = false,
  className,
}: {
  links?: readonly BlockLink[];
  size?: "default" | "lg";
  onPicture?: boolean;
  className?: string;
}) {
  const tone = useBlockTone();
  if (!links?.length) return null;
  const quiet = onPicture
    ? "border-white/60 bg-transparent text-white hover:bg-white/15 hover:text-white"
    : tone === "primary"
      ? "border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
      : tone === "field"
        ? "border-field-foreground/40 bg-transparent text-field-foreground hover:bg-field-foreground/10 hover:text-field-foreground"
        : "";
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap", className)}>
      {links.map((link, index) => (
        <Button
          key={`${link.href} ${link.label}`}
          asChild
          size={size}
          variant={index > 0 ? "outline" : tone === "primary" ? "secondary" : "default"}
          className={cn("max-sm:h-11 max-sm:w-full", index > 0 && quiet)}
        >
          <BlockAnchor href={link.href}>{link.label}</BlockAnchor>
        </Button>
      ))}
    </div>
  );
}

/** One field of a block's form. A `half` field sits beside its neighbour on a wide screen. */
export type BlockField = {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "number" | "date" | "time" | "textarea" | "select" | "checkbox";
  required?: boolean;
  /** A select's choices. */
  options?: readonly string[];
  placeholder?: string;
  description?: string;
  autoComplete?: string;
  half?: boolean;
};

/** A titled group of a form's fields. */
export type BlockFormSection = { title?: string; description?: string; fields: readonly BlockField[] };

export type BlockFormValues = Record<string, string | boolean>;

/** What came of a send: only `ok` shows the form as sent. */
export type BlockFormOutcome = { ok: true; message?: string } | { ok: false; message: string };

/** Where a form's entry goes: a server function that saves it or emails it, answering what came of it. */
export type BlockFormSend = (values: BlockFormValues) => Promise<BlockFormOutcome>;

/** The form's own words, in the website's language: pass all of them when it is not English. */
export type BlockFormWords = {
  submit: string;
  sending: string;
  sent: string;
  again: string;
  required: string;
  email: string;
  failed: string;
  choose: string;
};

export const blockFormWords: BlockFormWords = {
  submit: "Send",
  sending: "Sending…",
  sent: "Thank you, it's on its way.",
  again: "Send another",
  required: "Please fill this in.",
  email: "Please enter an email address.",
  failed: "It could not be sent. Please try again.",
  choose: "Choose one",
};

const emailShape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function rulesFor(field: BlockField, words: BlockFormWords): RegisterOptions<BlockFormValues> {
  if (field.type === "checkbox") return field.required ? { validate: (value) => value === true || words.required } : {};
  return {
    ...(field.required ? { required: words.required } : {}),
    ...(field.type === "email" ? { pattern: { value: emailShape, message: words.email } } : {}),
  };
}

type Sending = { status: "idle" } | { status: "sending" } | { status: "sent"; message?: string } | { status: "failed"; message: string };

/**
 * A form that sends its entry through `send` and shows it sent only when `send` answers `ok`: nothing a visitor types is
 * dropped or pretends to go anywhere. Its fields come in sections; a titled section takes a row of its own on a wide
 * screen, its title beside its fields.
 */
export function BlockForm({
  fields,
  sections,
  send,
  words = blockFormWords,
  submitLabel,
  footer,
  className,
}: {
  fields?: readonly BlockField[];
  sections?: readonly BlockFormSection[];
  send: BlockFormSend;
  words?: BlockFormWords;
  submitLabel?: string;
  /** Beside the submit button, such as a Cancel link. */
  footer?: ReactNode;
  className?: string;
}) {
  const groups = sections ?? [{ fields: fields ?? [] }];
  const all = groups.flatMap((group) => group.fields);
  const empty = Object.fromEntries(all.map((field) => [field.name, field.type === "checkbox" ? false : ""]));
  const form = useForm<BlockFormValues>({ defaultValues: empty });
  const [sending, setSending] = useState<Sending>({ status: "idle" });

  const submit = form.handleSubmit(async (values) => {
    setSending({ status: "sending" });
    try {
      const outcome = await send(values);
      setSending(outcome.ok ? { status: "sent", message: outcome.message } : { status: "failed", message: outcome.message });
    } catch {
      setSending({ status: "failed", message: words.failed });
    }
  });

  if (sending.status === "sent") {
    return (
      <div role="status" className={cn("flex flex-col items-start gap-4", className)}>
        <Alert>
          <CircleCheck />
          <AlertTitle>{sending.message ?? words.sent}</AlertTitle>
        </Alert>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            form.reset(empty);
            setSending({ status: "idle" });
          }}
        >
          {words.again}
        </Button>
      </div>
    );
  }

  const control = (field: BlockField, input: { value: string | boolean; onChange: (value: unknown) => void; onBlur: () => void; name: string }) => {
    if (field.type === "textarea")
      return <Textarea placeholder={field.placeholder} {...input} value={String(input.value)} className="min-h-28" />;
    return (
      <Input
        type={field.type ?? "text"}
        autoComplete={field.autoComplete}
        placeholder={field.placeholder}
        {...input}
        value={String(input.value)}
      />
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={submit} noValidate className={cn("flex flex-col gap-8", className)}>
        {groups.map((group, index) => (
          <div
            key={group.title ?? index}
            className={cn("flex flex-col gap-6", group.title && "md:grid md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-10")}
          >
            {index > 0 && group.title && <Separator className="md:col-span-2" />}
            {group.title && (
              <div className="flex flex-col gap-1">
                <h3 className="font-medium">{group.title}</h3>
                {group.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
              </div>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              {group.fields.map((field) => (
                <FormField
                  key={field.name}
                  control={form.control}
                  name={field.name}
                  rules={rulesFor(field, words)}
                  render={({ field: input }) =>
                    field.type === "checkbox" ? (
                      <FormItem className="flex flex-row items-start gap-3 sm:col-span-2">
                        <FormControl>
                          <Checkbox checked={input.value === true} onCheckedChange={(value) => input.onChange(value === true)} />
                        </FormControl>
                        <div className="grid gap-1.5 leading-none">
                          <FormLabel>{field.label}</FormLabel>
                          {field.description && <FormDescription>{field.description}</FormDescription>}
                          <FormMessage />
                        </div>
                      </FormItem>
                    ) : (
                      <FormItem className={cn(!field.half && "sm:col-span-2")}>
                        <FormLabel>{field.label}</FormLabel>
                        {field.type === "select" ? (
                          <Select value={String(input.value)} onValueChange={input.onChange} name={input.name}>
                            <FormControl>
                              <SelectTrigger className="w-full" onBlur={input.onBlur}>
                                <SelectValue placeholder={field.placeholder ?? words.choose} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(field.options ?? []).map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <FormControl>{control(field, input)}</FormControl>
                        )}
                        {field.description && <FormDescription>{field.description}</FormDescription>}
                        <FormMessage />
                      </FormItem>
                    )
                  }
                />
              ))}
            </div>
          </div>
        ))}
        {sending.status === "failed" && (
          <p role="alert" className="text-sm text-destructive">
            {sending.message}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" size="lg" disabled={sending.status === "sending"} className="max-sm:h-11">
            {sending.status === "sending" && <LoaderCircle className="animate-spin" />}
            {sending.status === "sending" ? words.sending : (submitLabel ?? words.submit)}
          </Button>
          {footer}
        </div>
      </form>
    </Form>
  );
}
