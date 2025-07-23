import { Context } from "../types/context";
import { UserType } from "../types/github";
import { isUserAdminOrBillingManager } from "./issue";

export async function labelAccessPermissionsCheck(context: Context<"issues.unlabeled">) {
  if (context.eventName !== "issues.unlabeled") {
    context.logger.debug("Not an issue event");
    return false;
  }
  const { logger, payload } = context;
  if (!payload.label?.name) {
    logger.debug("The label has no name.");
    return false;
  }

  if (payload.sender?.type === UserType.Bot) {
    logger.info("Bot has full control over all labels");
    return true;
  }
  const sender = payload.sender?.login;
  if (!sender) {
    throw logger.error("No sender found in the payload");
  }

  const repo = payload.repository;
  const sufficientPrivileges = await isUserAdminOrBillingManager(context, sender);

  if (sufficientPrivileges) {
    logger.info("Admin and billing managers have full control over all labels", {
      repo: repo.full_name,
      user: sender,
    });
    return true;
  }
  return false;
}

export async function handlePermissionCheck(context: Context<"issues.unlabeled">): Promise<boolean> {
  const hasPermission = await labelAccessPermissionsCheck(context as Context<"issues.unlabeled">);
  if (!hasPermission && context.eventName === "issues.unlabeled" && context.payload.sender?.type !== "Bot") {
    await context.commentHandler.postComment(context, context.logger.warn("You are not allowed to remove labels."));

    const labelName = context.payload.label?.name;
    const issueNumber = context.payload.issue?.number;
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;

    if (labelName && issueNumber && owner && repo) {
      await context.octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels: [labelName],
      });
    }
  }
  return hasPermission;
}
