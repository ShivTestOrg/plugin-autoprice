import { addLabelToIssue, clearAllPriceLabelsOnIssue, createLabel, findLabels, removeAllPricingLabels } from "../shared/label";
import { Context } from "../types/context";
import { convertHoursLabel, getPricing, getPriorityTime, PriorityTimeEstimate } from "./get-priority-time";
interface PricingResult {
  timeLabelValue: number;
  priorityLabel: string;
}

export const PRIORITY_REGEX = /^Priority:\s*(\d+)/i;
export const TIME_REGEX = /^Time:\s*(\d+(\.\d+)?)\s*(minute|hour|day|week|month)s?/i;

export async function onIssueCreatePricingHandler(context: Context<"issues.opened">): Promise<void> {
  const issue = getIssueFromPayload(context);
  if (!issue) {
    throw context.logger.error("No issue found in the payload.");
  }
  await clearAllPriceLabelsOnIssue(context);
  const estimate = await fetchAiEstimates(context);
  await generateTimeLabel(context, estimate);
  await generatePriorityLabel(context, estimate);
}

export async function onIssueEditPricingHandler(context: Context<"issues.edited">) {
  await clearAllPriceLabelsOnIssue(context);
  await processAiEstimation(context);
}

function convertLabelToHours(context: Context, timeLabelName: string): number {
  const timeMatch = TIME_REGEX.exec(timeLabelName);

  if (!timeMatch) {
    context.logger.warn("Could not parse time label.", { label: timeLabelName });
    return 0;
  }

  const value = parseFloat(timeMatch[1]);
  const unit = timeMatch[3].toLowerCase();
  let hours = 0;

  switch (unit) {
    case "minute":
      hours = value / 60;
      break;
    case "hour":
      hours = value;
      break;
    case "day":
      hours = value * 24;
      break;
    case "week":
      hours = value * 24 * 7;
      break;
    case "month":
      hours = value * 24 * 30;
      break;
    default:
      context.logger.warn(`Unknown time unit: ${unit}`, { unit });
      break;
  }
  return hours;
}

export async function onIssuePriorityLabelChangeHandler(context: Context<"issues.labeled" | "issues.unlabeled">): Promise<void> {
  const label = context.payload.label;

  if (label?.name.startsWith("Price:") || label?.name === context.config.elevatedPriorityLabel) {
    context.logger.info("Ignoring event caused by a Price label change.");
    return;
  }

  const labels = context.payload.issue?.labels ?? [];
  const priorityLabel = findLabels(labels, PRIORITY_REGEX);
  const timeLabel = findLabels(labels, TIME_REGEX);

  if (priorityLabel && timeLabel && label) {
    context.logger.debug("Priority label and time label found, setting price.");

    if (PRIORITY_REGEX.test(label.name) || TIME_REGEX.test(label.name)) {
      const match = PRIORITY_REGEX.exec(priorityLabel.name);
      const priorityValue = match?.[1] ?? "0";

      const timeValueInHours = convertLabelToHours(context, timeLabel.name);

      await removeAllPricingLabels(context, labels);
      context.logger.info(`Setting price with priority: ${priorityValue} and time: ${timeValueInHours} hours`);

      await setPrice(context, {
        timeLabelValue: timeValueInHours,
        priorityLabel: priorityValue,
      });
    }
  } else {
    context.logger.info("No priority or time label found, skipping price setting.");
  }
}

async function setPrice(context: Context, priceLabels: PricingResult, currency: string = "USD") {
  const { logger } = context;
  const priceLabelName = `Price: ${getPricing(context.config.basePriceMultiplier, priceLabels.timeLabelValue, priceLabels.priorityLabel)} ${currency}`;
  logger.debug(`Setting price label: "${priceLabelName}"`);
  await createAndAddLabel(context, priceLabelName);
}

async function generateTimeLabel(context: Context, estimate: PriorityTimeEstimate): Promise<number> {
  const { logger } = context;
  const timeInHours = parseFloat(estimate.time);
  const timeLabel = convertHoursLabel(estimate.time);

  logger.debug(`AI estimated time: ${timeInHours} hours. Creating label: "${timeLabel}"`);
  await createAndAddLabel(context, timeLabel);

  return timeInHours;
}

async function generatePriorityLabel(context: Context, estimate: PriorityTimeEstimate): Promise<string> {
  const { logger } = context;
  const priorityLabel = `Priority: ${estimate.priority}`;

  logger.debug(`AI estimated priority: "${priorityLabel}". Creating label.`);
  await createAndAddLabel(context, priorityLabel);

  return priorityLabel;
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
  try {
    await createLabel(context, labelName);
  } catch (error: unknown) {
    const err = error as Error;
    if (err && err.message && err.message.includes("already exists")) {
      context.logger.info(`Label "${labelName}" already exists. Skipping creation.`);
    } else {
      throw error;
    }
  }
  context.logger.info(`Adding label "${labelName}" to the issue.`);
  await addLabelToIssue(context, labelName);
}

function getIssueFromPayload(context: Context) {
  if ("issue" in context.payload && context.payload.issue) {
    return context.payload.issue;
  }

  context.logger.debug("No issue found in the payload.");
  return null;
}

async function processAiEstimation(context: Context): Promise<void> {
  const estimate = await fetchAiEstimates(context);
  const timeLabelValue = await generateTimeLabel(context, estimate);
  const priorityLabel = await generatePriorityLabel(context, estimate);
  const priceResult: PricingResult = {
    timeLabelValue,
    priorityLabel,
  };
  context.logger.debug("Generated estimate", { estimate, priceResult });
}
