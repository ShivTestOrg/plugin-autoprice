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
    mode: T.Enum(
      {
        full: "full", // Estimate both time and priority
        partial: "partial", // Expects either time or priority label to be present
      },
      {
        default: "full",
        description: "The mode for automatic labeling.",
      }
    ),
    basePriceMultiplier: T.Number({ examples: [1.5], default: 1, description: "The base price multiplier for all tasks" }),
  },
  { default: {} }
);

export type AssistivePricingSettings = StaticDecode<typeof pluginSettingsSchema>;
