import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Image } from "@/image";
import { cn } from "@/lib/utils";
import { BlockAnchor, BlockContainer, type BlockLink, type BlockPicture } from "./parts";

/**
 * The website's header, sticky at the top of every page: the logo and name linking home, the section or page links and
 * one action. On a phone it keeps one row, the name and a menu button, whose panel holds the links and the action.
 */
export function NavBar({
  name,
  logo,
  logoShowsName = false,
  links,
  action,
  menuLabel = "Menu",
  navLabel = "Main",
  className,
}: {
  name: string;
  logo?: BlockPicture;
  /** The logo already spells the name, so the name is not set beside it. */
  logoShowsName?: boolean;
  links: readonly BlockLink[];
  action?: BlockLink;
  /** The menu button's name for screen readers, in the website's language. */
  menuLabel?: string;
  /** The links' landmark name for screen readers. */
  navLabel?: string;
  className?: string;
}) {
  return (
    <header className={cn("sticky top-0 z-40 border-b bg-background/90 backdrop-blur", className)}>
      <BlockContainer className="flex h-16 items-center justify-between gap-6">
        <BlockAnchor href="/" className="flex min-w-0 items-center gap-2.5" aria-label={logoShowsName ? name : undefined}>
          {logo && (
            <Image
              src={logo.src}
              alt={logoShowsName ? name : ""}
              width={logo.width}
              height={logo.height}
              className="h-8 w-auto shrink-0"
            />
          )}
          {!logoShowsName && (
            <span className="truncate font-heading text-lg font-semibold tracking-tight [font-synthesis-weight:none]">{name}</span>
          )}
        </BlockAnchor>
        <nav aria-label={navLabel} className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Button key={`${link.href} ${link.label}`} asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <BlockAnchor href={link.href}>{link.label}</BlockAnchor>
            </Button>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          {action && (
            <Button asChild size="sm" className="max-md:hidden">
              <BlockAnchor href={action.href}>{action.label}</BlockAnchor>
            </Button>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label={menuLabel}>
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-xs" aria-describedby={undefined}>
              <SheetHeader>
                <SheetTitle className="font-heading [font-synthesis-weight:none]">{name}</SheetTitle>
              </SheetHeader>
              <nav aria-label={navLabel} className="flex flex-col gap-1 px-4">
                {links.map((link) => (
                  <SheetClose key={`${link.href} ${link.label}`} asChild>
                    <BlockAnchor href={link.href} className="rounded-md px-3 py-3 text-base font-medium hover:bg-accent hover:text-accent-foreground">
                      {link.label}
                    </BlockAnchor>
                  </SheetClose>
                ))}
              </nav>
              {action && (
                <div className="mt-auto p-4">
                  <SheetClose asChild>
                    <Button asChild size="lg" className="h-11 w-full">
                      <BlockAnchor href={action.href}>{action.label}</BlockAnchor>
                    </Button>
                  </SheetClose>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </BlockContainer>
    </header>
  );
}
