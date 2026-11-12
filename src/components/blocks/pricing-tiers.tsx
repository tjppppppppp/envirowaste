import { Check } from "lucide-react";
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BlockAnchor, BlockContainer, BlockHeading, BlockSection, displayHeading, quietText, type BlockLink, type BlockTone } from "./parts";

/**
 * One plan or package, its price as the request gives it, what it includes and the one thing to do next, whose link
 * really goes somewhere: a checkout, the booking or contact section, a phone number.
 */
export type PricingTier = {
  name: string;
  price: string;
  /** After the price, such as "a month" or "per visit". */
  period?: string;
  description?: string;
  features: readonly string[];
  action: BlockLink;
  /** The one plan the business recommends, set apart and named by `badge`. */
  featured?: boolean;
  badge?: string;
};

const layouts = {
  1: "mx-auto w-full max-w-md",
  2: "mx-auto grid w-full max-w-4xl gap-6 md:grid-cols-2",
  3: "grid gap-6 md:grid-cols-2 lg:grid-cols-3",
  4: "grid gap-6 md:grid-cols-2 xl:grid-cols-4",
} as const;

/** Plans or packages side by side under the section's heading, one recommended plan set apart. */
export function PricingTiers({
  id,
  eyebrow,
  title,
  description,
  tiers,
  note,
  tone = "default",
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  tiers: readonly PricingTier[];
  /** Small print under the plans, such as what prices include. */
  note?: string;
  tone?: BlockTone;
}) {
  const heading = useId();
  const count = Math.min(Math.max(tiers.length, 1), 4) as keyof typeof layouts;
  return (
    <BlockSection id={id} tone={tone} aria-labelledby={heading}>
      <BlockContainer className="flex flex-col gap-10 md:gap-12">
        <BlockHeading id={heading} eyebrow={eyebrow} title={title} description={description} align="center" />
        <ul className={layouts[count]}>
          {tiers.map((tier) => (
            <li key={tier.name} className="flex">
              <Card className={cn("w-full", tier.featured && "border-primary shadow-lg ring-1 ring-primary")}>
                <CardHeader className="gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle>
                      <h3 className="text-lg">{tier.name}</h3>
                    </CardTitle>
                    {tier.featured && tier.badge && <Badge>{tier.badge}</Badge>}
                  </div>
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className={cn(displayHeading, "text-4xl tabular-nums")}>{tier.price}</span>
                    {tier.period && <span className="text-sm text-muted-foreground">{tier.period}</span>}
                  </p>
                  {tier.description && <CardDescription className="text-pretty">{tier.description}</CardDescription>}
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="flex flex-col gap-3 text-sm">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button asChild size="lg" variant={tier.featured ? "default" : "outline"} className="h-11 w-full">
                    <BlockAnchor href={tier.action.href}>{tier.action.label}</BlockAnchor>
                  </Button>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
        {note && <p className={cn("text-center text-sm", quietText(tone))}>{note}</p>}
      </BlockContainer>
    </BlockSection>
  );
}
