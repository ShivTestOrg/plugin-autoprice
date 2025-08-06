import { addCommentToIssue } from "../shared/comment";
import { assignLabelToIssue, getCurrentPriorities, unassignLabelFromIssue } from "../shared/label";
import { Context } from "../types";
import { FetchedPriorities } from "../types/label";
import { onIssueEditPricingHandler } from "./auto-price";

async function applyPriorityBoost(context: Context, issues: FetchedPriorities[]) {
  const { logger, config } = context;

  for (const issue of issues) {
    const boostedPriority = Math.max(0, Math.min(5, parseInt(issue.priority) * config.priorityMultiplier));
    const priorityLabel = issue.labels.find((label) => /^Priority: /i.test(label.name));
    const hasElevatedLabel = issue.labels.some((label) => label.name === config.elevatedPriorityLabel);
    const { owner, name: repo } = issue.repository || {};
    const issueNumber = issue.issueNumber;

    if (priorityLabel) {
      await unassignLabelFromIssue(context, owner.login, repo, issueNumber, priorityLabel.name);
    }
    await assignLabelToIssue(context, owner.login, repo, issueNumber, `Priority: ${boostedPriority}`);
    if (!hasElevatedLabel) {
      await assignLabelToIssue(context, owner.login, repo, issueNumber, config.elevatedPriorityLabel);
    }
    logger.debug(`Boosted priority for issue #${issueNumber} to ${boostedPriority} and assigned elevated label.`);
  }

  if (config.priorityMultiplierDebug) {
    let debugComment = `Priority boost applied to similar issues (multiplier: ${config.priorityMultiplier}):`;
    for (const issue of issues) {
      const boostedPriority = Math.max(0, Math.min(5, Math.max(1, parseInt(issue.priority)) * config.priorityMultiplier));
      debugComment += `\n- #${issue.issueNumber} (${issue.repository?.owner.login}/${issue.repository?.name}): ${boostedPriority}`;
    }
    await addCommentToIssue(context, debugComment);
  }
}

async function findAndBoostIssues(context: Context, markdown: string, currentId: string) {
  const {
    logger,
    config,
    adapters: { supabase },
    payload,
  } = context;

  const similarIssues = await supabase.issue.findSimilarIssuesToMatch({
    markdown,
    threshold: 0.7,
    currentId: currentId,
    count: config.maxSimilarIssues,
  });

  logger.info(`Found ${similarIssues?.length} similar issues.`, { similarIssues });
  if (!similarIssues?.length) {
    return null;
  }

  similarIssues.sort((a, b) => b.similarity - a.similarity);

  let issues = await getCurrentPriorities(
    context,
    similarIssues.map((issue) => issue.issue_id)
  );
  logger.info(`Fetched ${issues.length} issues with current priorities.`);
  if (!config.crossLinkedIssueBoost) {
    const { login: currentOwner } = payload.repository.owner;
    const { name: currentRepo } = payload.repository;
    issues = issues.filter((issue) => issue.repository?.owner.login === currentOwner && issue.repository?.name === currentRepo);
  }

  if (issues.length > 0) {
    await applyPriorityBoost(context, issues);
  }
  return issues;
}

export async function boostPrioritySimilarIssues(context: Context<"issues.opened" | "issues.edited">) {
  const issueContent = context.payload.issue.title + context.payload.issue.body;
  await findAndBoostIssues(context, issueContent, context.payload.issue.node_id);
}

export async function handleBoostComment(context: Context<"issue_comment.created">) {
  const { command, payload } = context;
  let comment: string | undefined;

  if (payload.comment.user?.type === "Bot") {
    return;
  }

  if (command?.name === "boost") {
    comment = command.parameters.comment;
  } else if (payload.comment.body.trim().startsWith("/boost")) {
    const trimmed = payload.comment.body.trim().replace("/boost", "").trim();
    if (trimmed) {
      comment = trimmed;
    }
  }

  if (!comment) {
    await addCommentToIssue(context, "No boost comment provided.");
    return;
  }

  const boostedIssues = await findAndBoostIssues(context, comment, payload.issue.node_id);

  if (!boostedIssues) {
    await addCommentToIssue(context, "No similar issues found to boost.");
  }
}

export async function revertPriorityToNormal(context: Context<"issues.unlabeled">) {
  const currentLabel = context.payload.label?.name;
  if (currentLabel === context.config.elevatedPriorityLabel) {
    await onIssueEditPricingHandler(context as unknown as Context<"issues.edited">);
  }
}
