import { clearAllPriceLabelsOnIssue } from "../shared/label";
import { Label } from "../types/github";
import { Context } from "../types/context";

export async function handleParentIssue(context: Context, labels: Label[]) {
  const issuePrices = labels.filter((label) => label.name.toString().startsWith("Price:"));
  if (issuePrices.length) {
    await clearAllPriceLabelsOnIssue(context);
    throw context.logger.warn("Pricing is disabled on parent issues, so the price labels have been cleared.");
  } else if (context.eventName === "issues.labeled") {
    throw context.logger.warn("Pricing is not supported on parent issues, no price will be set.");
  }
}
