import { StaticDecode, Type as T } from "@sinclair/typebox";

export const pluginSettingsSchema = T.Object(
  {
    globalConfigUpdate: T.Optional(
      T.Object(
        {
          excludeRepos: T.Array(T.String(), {
            examples: ["repo-name", "no-owner-required"],
            description: "List of repositories to exclude from being updated",
          }),
        },
        { description: "Updates all price labels across all tasks based on `baseRateMultiplier` changes within the config file." }
      )
    ),
    maxSimilarIssues: T.Integer({
      examples: [1, 5],
      default: 5,
      description: "Maximum number of similar issues for modifications.",
    }),
    elevatedPriorityLabel: T.String({
      default: "Boosted",
      description: "Label Name to identify boosted priority issues,",
    }),
    priorityMultiplier: T.Integer({
      examples: [1.5, 1.2, 1.1],
      default: 1.1,
      description: "Multiplier applied to prioritize similar issues.",
    }),
    basePriceMultiplier: T.Number({ examples: [1.5], default: 1, description: "The base price multiplier for all tasks" }),
  },
  { default: {} }
);

export type AssistivePricingSettings = StaticDecode<typeof pluginSettingsSchema>;
