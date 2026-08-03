import { z } from "zod";
import generatedDefinitions from "./cardData.generated.json";

export const CardColorSchema = z.enum(["W", "B", "Y", "R", "Special"]);
export type CardColor = z.infer<typeof CardColorSchema>;
export const MaterialColorSchema = z.enum(["W", "B", "Y", "R"]);
export type MaterialColor = z.infer<typeof MaterialColorSchema>;
export const EffectCodeSchema = z.enum(["material-limit"]);
export type EffectCode = z.infer<typeof EffectCodeSchema>;

export const TreasureDefinitionSchema = z.object({
  name: z.string().trim().min(1),
  color: CardColorSchema,
  priority: z.number().int().nullable(),
  category: z.string().trim().min(1).nullable(),
  effect: z.string().trim().min(1),
  effectCode: EffectCodeSchema.nullable().optional(),
  additionalAcquireMethod: z.string().trim().min(1).nullable().optional(),
  additionalAcquireColor: MaterialColorSchema.nullable().optional(),
  quantity: z.number().int().positive(),
  synthesisScore: z.number().int().nonnegative(),
  difficulty: z.number().int().nonnegative(),
}).superRefine((definition, context) => {
  const hasMethod = definition.additionalAcquireMethod != null;
  const hasColor = definition.additionalAcquireColor != null;
  if (hasMethod !== hasColor) {
    context.addIssue({
      code: "custom",
      message: "额外获取方式与结构化颜色条件必须同时提供",
      path: hasMethod ? ["additionalAcquireColor"] : ["additionalAcquireMethod"],
    });
  }
  if (hasMethod && definition.color !== "Special") {
    context.addIssue({
      code: "custom",
      message: "只有稀有宝物可以设置额外获取方式",
      path: ["additionalAcquireMethod"],
    });
  }
});

export const TreasureCatalogSchema = z.array(TreasureDefinitionSchema).min(1);
export type TreasureDefinition = z.infer<typeof TreasureDefinitionSchema>;

export const defaultTreasureDefinitions = TreasureCatalogSchema.parse(generatedDefinitions);

export function countCards(definitions: readonly TreasureDefinition[]): number {
  return definitions.reduce((total, definition) => total + definition.quantity, 0);
}

export interface DifficultyStat {
  difficulty: number;
  count: number;
  cumulativePercentage: number;
}

export function getDifficultyStats(definitions: readonly TreasureDefinition[]): DifficultyStat[] {
  const counts = new Map<number, number>();
  for (const definition of definitions) {
    counts.set(definition.difficulty, (counts.get(definition.difficulty) ?? 0) + definition.quantity);
  }

  const total = countCards(definitions);
  let cumulativeCount = 0;
  return [...counts.entries()]
    .sort(([left], [right]) => left - right)
    .map(([difficulty, count]) => {
      cumulativeCount += count;
      return {
        difficulty,
        count,
        cumulativePercentage: total === 0 ? 0 : Math.round((cumulativeCount / total) * 100),
      };
    });
}
