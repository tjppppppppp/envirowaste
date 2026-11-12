import type { LucideIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Image } from "@/image";
import { cn } from "@/lib/utils";
import { BlockAnchor, BlockContainer, BlockHeading, BlockSection, type BlockLink, type BlockPicture, type BlockTone } from "./parts";

/** One thing the business offers: a picture or an icon, its name, a line or two, and its price or link where the request gives one. */
export type ServiceItem = {
  title: string;
  description?: string;
  /** An icon from lucide-react, shown where the item has no picture. */
  icon?: LucideIcon;
  picture?: BlockPicture;
  price?: string;
  link?: BlockLink;
};

const columnClasses = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" } as const;

/**
 * What the business offers (its services, products or features) as a grid of cards under the section's heading. Cards
 * with pictures show them on top; one row on a wide window holds two to four, a phone shows one.
 */
export function ServicesGrid({
  id,
  eyebrow,
  title,
  description,
  services,
  columns = 3,
  align = "start",
  tone = "default",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  services: readonly ServiceItem[];
  columns?: 2 | 3 | 4;
  align?: "start" | "center";
  tone?: BlockTone;
}) {
  const heading = useId();
  return (
    <BlockSection id={id} tone={tone} aria-labelledby={heading}>
      <BlockContainer className="flex flex-col gap-10 md:gap-12">
        <BlockHeading id={heading} eyebrow={eyebrow} title={title} description={description} align={align} />
        <ul className={cn("grid gap-6", columnClasses[columns])}>
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <li key={service.title} className="flex">
                <Card className={cn("w-full", service.picture && "overflow-hidden pt-0")}>
                  {service.picture ? (
                    <Image
                      src={service.picture.src}
                      alt={service.picture.alt}
                      width={service.picture.width}
                      height={service.picture.height}
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="aspect-[4/3] h-auto w-full object-cover"
                    />
                  ) : (
                    Icon && (
                      <div className="px-(--card-space)">
                        <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon aria-hidden className="size-5" />
                        </span>
                      </div>
                    )
                  )}
                  <CardHeader>
                    <CardTitle>
                      <h3 className="text-lg leading-snug">{service.title}</h3>
                    </CardTitle>
                    {service.description && <CardDescription className="text-base text-pretty">{service.description}</CardDescription>}
                  </CardHeader>
                  {(service.price || service.link) && (
                    <CardFooter className="mt-auto flex-wrap justify-between gap-3">
                      {service.price && <span className="font-medium tabular-nums">{service.price}</span>}
                      {service.link && (
                        <Button asChild variant="link" className="h-auto px-0">
                          <BlockAnchor href={service.link.href}>{service.link.label}</BlockAnchor>
                        </Button>
                      )}
                    </CardFooter>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      </BlockContainer>
    </BlockSection>
  );
}
