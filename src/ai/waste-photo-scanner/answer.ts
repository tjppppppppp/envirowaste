import { z } from "zod";

export const MATERIALS = ["plastic", "glass", "unknown / mixed", "metal", "paper", "cardboard", "organic"] as const;

export const answer = z.object({
  label: z.enum(MATERIALS).describe("The material category the photo most looks like"),
  reason: z.string().nullable().describe("One short sentence on what in the photo suggests it, or says it is unclear"),
});
export type Answer = z.infer<typeof answer>;
