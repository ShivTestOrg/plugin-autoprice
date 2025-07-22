import { Context } from "../types/context";
import { UserType } from "../types/github";
import { isIssueLabelEvent } from "../types/typeguards";
import { isUserAdminOrBillingManager } from "./issue";

export async function labelAccessPermissionsCheck(context: Context) {
  if (!isIssueLabelEvent(context)) {
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

export async function handlePermissionCheck(context: Context): Promise<boolean> {
  const hasPermission = await labelAccessPermissionsCheck(context);
  if (!hasPermission && context.eventName === "issues.labeled" && context.payload.sender?.type !== "Bot") {
    await context.commentHandler.postComment(context, context.logger.warn("You are not allowed to set labels."));
  }
  return hasPermission;
}
