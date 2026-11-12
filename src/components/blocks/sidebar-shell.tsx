import { Link } from "@tanstack/react-router";
import { Menu, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Image } from "@/image";
import { cn } from "@/lib/utils";
import type { BlockPicture } from "./parts";

/** One screen in the product's navigation, a route of its own, with a count or word beside it where the screen has one. */
export type ShellLink = { label: string; href: string; icon?: LucideIcon; badge?: string };

/** Whether a link holds another link's screen under it (`/app` over `/app/orders`), so it is open only on its own. */
const holds = (link: ShellLink, links: readonly ShellLink[]) =>
  link.href === "/" || links.some((other) => other.href.startsWith(`${link.href.replace(/\/$/, "")}/`));

function ShellNav({ links, close }: { links: readonly ShellLink[]; close?: boolean }) {
  return (
    <ul className="flex flex-col gap-1">
      {links.map((link) => {
        const Icon = link.icon;
        // The router types `to` by the website's own route tree, which a block cannot know; it marks the open screen's
        // link `data-status="active"`, a record's screen under it included.
        const item = (
          <Link
            to={link.href as "/"}
            activeOptions={{ exact: holds(link, links) }}
            className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"
          >
            {Icon && <Icon aria-hidden className="size-4 shrink-0" />}
            <span className="truncate">{link.label}</span>
            {link.badge && (
              <Badge variant="secondary" className="ml-auto">
                {link.badge}
              </Badge>
            )}
          </Link>
        );
        return <li key={`${link.href} ${link.label}`}>{close ? <SheetClose asChild>{item}</SheetClose> : item}</li>;
      })}
    </ul>
  );
}

/**
 * A product's frame for every screen: the name and the screens' links in a sidebar, the person signed in at its foot,
 * a top bar for the screen's own tools, and the screen under it. On a phone the sidebar opens from the top bar's menu
 * button. Put it in the layout route around the screens' Outlet, so each screen renders only its own content.
 */
export function SidebarShell({
  name,
  logo,
  links,
  person,
  top,
  menuLabel = "Menu",
  navLabel = "Screens",
  children,
}: {
  name: string;
  logo?: BlockPicture;
  links: readonly ShellLink[];
  /** The person signed in, where the product has sign-in. */
  person?: { name: string; detail?: string };
  /** The top bar's tools beside the menu button, such as a search or the person's menu. */
  top?: ReactNode;
  /** The menu button's name for screen readers, in the website's language. */
  menuLabel?: string;
  navLabel?: string;
  children: ReactNode;
}) {
  const brand = (
    <Link to="/" className="flex h-16 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-5">
      {logo && <Image src={logo.src} alt="" width={logo.width} height={logo.height} className="h-7 w-auto" />}
      <span className="truncate font-heading text-base font-semibold tracking-tight [font-synthesis-weight:none]">{name}</span>
    </Link>
  );
  const foot = person && (
    <div className="flex items-center gap-3 border-t border-sidebar-border p-4">
      <Avatar className="size-8">
        <AvatarFallback className="bg-sidebar-primary text-xs font-medium text-sidebar-primary-foreground">
          {person.name.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col text-sm">
        <span className="truncate font-medium">{person.name}</span>
        {person.detail && <span className="truncate text-sidebar-foreground/70">{person.detail}</span>}
      </div>
    </div>
  );
  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
        <div className="sticky top-0 flex h-svh flex-col">
          {brand}
          <nav aria-label={navLabel} className="flex-1 overflow-y-auto p-3">
            <ShellNav links={links} />
          </nav>
          {foot}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn("sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6", !top && "lg:hidden")}
        >
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label={menuLabel}>
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
              aria-describedby={undefined}
            >
              <SheetTitle className="sr-only">{name}</SheetTitle>
              {brand}
              <nav aria-label={navLabel} className="flex-1 overflow-y-auto p-3">
                <ShellNav links={links} close />
              </nav>
              {foot}
            </SheetContent>
          </Sheet>
          <span className="truncate font-heading font-semibold [font-synthesis-weight:none] lg:hidden">{name}</span>
          <div className="ml-auto flex items-center gap-2">{top}</div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
