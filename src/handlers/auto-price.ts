import { addLabelToIssue, clearAllPriceLabelsOnIssue, createLabel } from "../shared/label";
import { handlePermissionCheck } from "../shared/permissions";
import { Context } from "../types/context";
import { isIssueLabelEvent } from "../types/typeguards";
import { convertHoursLabel, getPricing, getPriorityTime, PriorityTimeEstimate } from "./get-priority-time";
interface PricingResult {
  timeLabelValue: number;
  priorityLabel: string;
}

export async function autoPricingHandler(context: Context<"issues.opened">): Promise<void> {
  const issue = getIssueFromPayload(context);
  if (!issue) {
    throw context.logger.error("No issue found in the payload.");
  }
  await clearAllPriceLabelsOnIssue(context);
  const estimate = await fetchAiEstimates(context);
  const pricingResult = await generatePricingLabels(context, estimate);
  await setPrice(context, pricingResult);
}

export async function onLabelChangeAiEstimation(context: Context<"issues.edited">) {
  if (!isIssueLabelEvent(context)) {
    return;
  }
  await handlePermissionCheck(context);
  const { label, sender } = context.payload;
  if (!label || ignoreLabelChange(context, sender, label.name)) return;

  await clearAllPriceLabelsOnIssue(context);
  await processAiEstimation(context);
}

async function setPrice(context: Context, priceLabels: PricingResult, currency: string = "USD") {
  const { logger } = context;
  await clearAllPriceLabelsOnIssue(context);
  const priceLabelName = `Price: ${getPricing(context.config.basePriceMultiplier, priceLabels.timeLabelValue, priceLabels.priorityLabel)} ${currency}`;
  logger.debug(`Setting price label: "${priceLabelName}"`);
  await createAndAddLabel(context, priceLabelName);
}

async function generatePricingLabels(context: Context, estimate: PriorityTimeEstimate): Promise<PricingResult> {
  const { logger } = context;
  logger.debug("Estimating both time and priority with AI.");

  const { time: timeString, priority } = estimate;
  const timeInHours = parseFloat(timeString);
  const timeLabel = convertHoursLabel(timeString);

  const priorityLabel = `Priority: ${priority}`;

  logger.debug(`AI estimated time: ${timeInHours} hours. Creating label: "${timeLabel}"`);
  await createAndAddLabel(context, timeLabel);

  logger.debug(`AI estimated priority: "${priorityLabel}". Creating label.`);
  await addLabelToIssue(context, priorityLabel);

  return {
    timeLabelValue: timeInHours,
    priorityLabel,
  };
}

async function fetchAiEstimates(context: Context): Promise<PriorityTimeEstimate> {
  const { logger, env } = context;
  const issue = getIssueFromPayload(context);
  if (!issue || !issue.body || !issue.title) {
    throw logger.error("No issue found in the payload.");
  }

  if (!env.BASETEN_API_KEY || !env.BASETEN_API_URL) {
    throw logger.error("Missing API credentials for AI estimation.");
  }

  try {
    const estimation = await getPriorityTime(issue.body, issue.title, env.BASETEN_API_KEY, env.BASETEN_API_URL);
    if (!estimation) {
      throw logger.error("AI failed to return an estimate.");
    }
    return estimation;
  } catch (error) {
    throw logger.error("An error occurred while fetching AI estimates:", { err: error });
  }
}

async function createAndAddLabel(context: Context, labelName: string) {
  await createLabel(context, labelName);
  await addLabelToIssue(context, labelName);
}

function ignoreLabelChange(context: Context, sender: Context["payload"]["sender"], labelName: string): boolean {
  if (context.eventName == "issues.opened" && sender?.type === "Bot") {
    context.logger.debug(`Ignoring label change event for "${labelName}" on issue opened.`);
    return true;
  }
  if (sender?.type === "Bot" && labelName && (labelName.startsWith("Time:") || labelName.startsWith("Priority:") || labelName.startsWith("Price:"))) {
    context.logger.info(`Ignoring label change event for "${labelName}" from bot.`);
    return true;
  }
  return false;
}

function getIssueFromPayload(context: Context) {
  const eventName = context.eventName;
  if (eventName === "issues.labeled" || eventName === "issues.unlabeled") {
    if (!isIssueLabelEvent(context)) {
      context.logger.debug("Not an issue label event, skipping.");
      return null;
    }
    return context.payload.issue;
  }

  if ("issue" in context.payload && context.payload.issue) {
    return context.payload.issue;
  }

  context.logger.debug("No issue found in the payload.");
  return null;
}

async function processAiEstimation(context: Context): Promise<void> {
  const estimate = await fetchAiEstimates(context);
  const priceResult = await generatePricingLabels(context, estimate);

  if (priceResult) {
    await setPrice(context, priceResult);
  }
}
