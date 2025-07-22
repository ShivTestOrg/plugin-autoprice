import { autoPricingHandler, onLabelChangeAiEstimation } from "./handlers/auto-price";
import { Context } from "./types/context";

export function isLocalEnvironment() {
  return process.env.NODE_ENV === "local";
}

export function isGithubOrLocalEnvironment() {
  return isLocalEnvironment() || !!process.env.GITHUB_ACTIONS;
}

export function isWorkerOrLocalEnvironment() {
  return isLocalEnvironment() || !process.env.GITHUB_ACTIONS;
}

export async function run(context: Context) {
  const { eventName, logger } = context;
  switch (eventName) {
    case "issues.opened":
      //create labels on issue creation
      await autoPricingHandler(context as Context<"issues.opened">);
      break;
    case "issues.edited":
      await onLabelChangeAiEstimation(context as Context<"issues.edited">);
      break;
    case "issues.labeled":
    case "issues.unlabeled":
      //Update labels on issue edits
      break;
    default:
      logger.error(`Event ${eventName} is not supported`);
  }
  return { message: "OK" };
}
