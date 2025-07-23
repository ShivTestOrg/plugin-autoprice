import { IssueSimilaritySearchResult } from "../adapters/supabase/helpers/issues";
import { assignLabelToIssue, getCurrentPriorities, unassignLabelFromIssue } from "../shared/label";
import { Context } from "../types";
import { onIssueEditPricingHandler } from "./auto-price";

// Boost similar issues
export async function boostPrioritySimilarIssues(context: Context<"issues.opened" | "issues.edited">) {
  const {
    payload,
    adapters: { supabase },
    logger,
    config,
  } = context;
  const issueContent = payload.issue.title + payload.issue.body;
  //First find similar issues
  const similarIssues = await supabase.issue.findSimilarIssuesToMatch({
    markdown: issueContent,
    threshold: config.maxSimilarIssues,
    currentId: payload.issue.node_id,
  });
  logger.debug(`Found ${similarIssues?.length} similar issues.`, { similarIssues: similarIssues });
  if (similarIssues && similarIssues?.length > 0) {
    similarIssues.sort((a: IssueSimilaritySearchResult, b: IssueSimilaritySearchResult) => b.similarity - a.similarity);
    //Modify all the issue's priority by the multiplier
    const issues = await getCurrentPriorities(
      context,
      similarIssues.map((issue) => issue.issue_id)
    );
    // Boost
    issues.forEach(async (issue) => {
      const boostedPriority = parseInt(issue.priority) * config.priorityMultiplier;
      const priorityLabel = issue.labels.find((label: { name: string }) => /^Priority: /i.test(label.name));
      //Check if it already has the elevated priority label
      const isElevatedPriorityLabelPresent = issue.labels.find((label: { name: string }) => label.name == config.elevatedPriorityLabel);
      if (priorityLabel) {
        try {
          //@ts-expect-error expected error issue with login
          await unassignLabelFromIssue(context, issue.repository?.owner.login, issue.repository?.name, issue.issueNumber, priorityLabel.name);
          //Add updated priority
          const updatedPriorityLabel = `Priority: ${Math.max(0, Math.min(5, boostedPriority))}`;
          //@ts-expect-error expected error issue with login
          await assignLabelToIssue(context, issue.repository?.owner.login, issue.repository?.name, issue.issueNumber, updatedPriorityLabel);
          if (!isElevatedPriorityLabelPresent) {
            //@ts-expect-error expected error issue with login
            await assignLabelToIssue(context, issue.repository?.owner.login, issue.repository?.name, issue.issueNumber, config.elevatedPriorityLabel);
          }
          logger.info(`Boosted priority for issue #${issue.issueNumber} to ${Math.max(0, Math.min(5, boostedPriority))} and assigned elevated label.`);
        } catch (e) {
          logger.error("Failed to update priority or assign elevated label", { err: e, issueNumber: issue.issueNumber });
        }
      }
    });
  }
}

// Revert Boost to normal when "Boosted" label is removed
export async function revertPriorityToNormal(context: Context<"issues.unlabeled">) {
  //check if the current label being removed is con
  const currentLabel = context.payload.label?.name;
  if (currentLabel == context.config.elevatedPriorityLabel) {
    await onIssueEditPricingHandler(context as unknown as Context<"issues.edited">);
  }
}
