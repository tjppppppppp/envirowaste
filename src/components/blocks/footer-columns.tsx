import { Image } from "@/image";
import { cn } from "@/lib/utils";
import { BlockAnchor, BlockContainer, quietText, toneClasses, type BlockLink, type BlockPicture, type BlockTone } from "./parts";

/**
 * The website's footer: the name and a line about the business beside columns of links (pages, ways to reach it, where
 * it is), and a last line for the small print the request gives. The columns stack two to a row on a phone.
 */
export function FooterColumns({
  name,
  logo,
  logoShowsName = false,
  description,
  columns,
  note,
  tone = "muted",
}: {
  name: string;
  logo?: BlockPicture;
  logoShowsName?: boolean;
  description?: string;
  columns: readonly { title: string; links: readonly BlockLink[] }[];
  /** The last line, such as `© ${new Date().getFullYear()} Copper Drum Roasters`, its year today's. */
  note?: string;
  tone?: BlockTone;
}) {
  return (
    <footer className={cn("border-t", toneClasses[tone])}>
      <BlockContainer className="flex flex-col gap-10 py-12 md:flex-row md:justify-between md:gap-16 md:py-16">
        <div className="flex max-w-sm flex-col gap-3">
          <BlockAnchor href="/" className="flex items-center gap-2.5" aria-label={logoShowsName ? name : undefined}>
            {logo && (
              <Image src={logo.src} alt={logoShowsName ? name : ""} width={logo.width} height={logo.height} className="h-8 w-auto" />
            )}
            {!logoShowsName && (
              <span className="font-heading text-lg font-semibold tracking-tight [font-synthesis-weight:none]">{name}</span>
            )}
          </BlockAnchor>
          {description && <p className={cn("text-sm text-pretty", quietText(tone))}>{description}</p>}
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:gap-12">
          {columns.map((column) => (
            <div key={column.title} className="flex min-w-0 flex-col gap-3">
              <h2 className="text-sm font-semibold">{column.title}</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {column.links.map((link) => (
                  <li key={`${link.href} ${link.label}`}>
                    <BlockAnchor href={link.href} className={cn("break-words hover:underline", quietText(tone))}>
                      {link.label}
                    </BlockAnchor>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </BlockContainer>
      {note && (
        <div className="border-t">
          <BlockContainer className={cn("py-6 text-sm", quietText(tone))}>{note}</BlockContainer>
        </div>
      )}
    </footer>
  );
}
