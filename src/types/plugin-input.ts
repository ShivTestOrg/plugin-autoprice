import { StaticDecode, Type as T } from "@sinclair/typebox";

export const pluginSettingsSchema = T.Object(
  {
    globalConfigUpdate: T.Optional(
      T.Object(
        {
          excludeRepos: T.Array(T.String(), {
            examples: ["repo-name", "no-owner-required"],
            description: "List of repositories to exclude from global price updates.",
          }),
        },
        {
          description: "Updates all price labels globally when `baseRateMultiplier` changes in the config file.",
        }
      )
    ),
    maxSimilarIssues: T.Integer({
      examples: [1, 5],
      default: 5,
      description: "The maximum number of similar issues to consider for modification.",
    }),
    elevatedPriorityLabel: T.String({
      default: "Boosted",
      description: "Label for identifying issues with elevated priority.",
    }),
    crossLinkedIssueBoost: T.Boolean({
      default: false,
      description: "Enable boosting for issues that are cross-linked across repositories within the same organization.",
    }),
    priorityMultiplier: T.Number({
      examples: [1.5, 1.2, 1.1],
      default: 1.1,
      description: "Multiplier used to prioritize similar issues.",
    }),
    priorityMultiplierDebug: T.Boolean({
      default: false,
      description: "Enable debug comments for boosted linked issues.",
    }),
    basePriceMultiplier: T.Number({
      examples: [1.5],
      default: 1,
      description: "Base multiplier applied to all task prices.",
    }),
  },
  { default: {} }
);

export type AssistivePricingSettings = StaticDecode<typeof pluginSettingsSchema>;
