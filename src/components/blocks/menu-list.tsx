import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { BlockContainer, BlockHeading, BlockSection, displayHeading, quietText, useBlockTone, type BlockTone } from "./parts";

/** One dish, drink or treatment on the menu, with its price and short tags (vegan, new) as the request gives them. */
export type MenuItem = { name: string; description?: string; price?: string; tags?: readonly string[] };

/** A part of the menu (Coffee, Pastries, Lunch) and what it holds. */
export type MenuCategory = { name: string; description?: string; items: readonly MenuItem[] };

function MenuItems({ items }: { items: readonly MenuItem[] }) {
  const tone = useBlockTone();
  return (
    <ul className="flex flex-col divide-y">
      {items.map((item) => (
        <li key={item.name} className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0">
          <div className="flex items-baseline gap-3">
            <span className="font-medium">{item.name}</span>
            {item.price && (
              <>
                <span aria-hidden className="min-w-6 flex-1 translate-y-[-0.25em] border-b border-dotted border-current opacity-30" />
                <span className="font-medium whitespace-nowrap tabular-nums">{item.price}</span>
              </>
            )}
          </div>
          {item.description && <p className={cn("text-sm text-pretty", quietText(tone))}>{item.description}</p>}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * A menu or price list: its parts each with a heading and their items, the price set off by a dotted line. The parts sit
 * two to a row on a wide window, or behind tabs (`tabs`) where there are many; a phone shows one column.
 */
export function MenuList({
  id,
  eyebrow,
  title,
  description,
  categories,
  note,
  tabs = false,
  tone = "default",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  categories: readonly MenuCategory[];
  /** Small print under the menu, such as allergens or how prices are given. */
  note?: string;
  tabs?: boolean;
  tone?: BlockTone;
}) {
  const heading = useId();
  const part = (category: MenuCategory) => (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className={cn(displayHeading, "text-2xl")}>{category.name}</h3>
        {category.description && <p className={cn("text-sm", quietText(tone))}>{category.description}</p>}
      </div>
      <MenuItems items={category.items} />
    </div>
  );
  return (
    <BlockSection id={id} tone={tone} aria-labelledby={heading}>
      <BlockContainer className="flex flex-col gap-10 md:gap-12">
        <BlockHeading id={heading} eyebrow={eyebrow} title={title} description={description} />
        {tabs && categories.length > 1 ? (
          <Tabs defaultValue={categories[0]!.name} className="gap-8">
            <TabsList className="h-auto max-w-full justify-start overflow-x-auto">
              {categories.map((category) => (
                <TabsTrigger key={category.name} value={category.name} className="px-4 py-1.5">
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {categories.map((category) => (
              <TabsContent key={category.name} value={category.name} className="max-w-3xl">
                {category.description && <p className={cn("mb-5 text-sm", quietText(tone))}>{category.description}</p>}
                <MenuItems items={category.items} />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="grid gap-x-16 gap-y-12 lg:grid-cols-2">
            {categories.map((category) => (
              <div key={category.name}>{part(category)}</div>
            ))}
          </div>
        )}
        {note && <p className={cn("text-sm", quietText(tone))}>{note}</p>}
      </BlockContainer>
    </BlockSection>
  );
}
