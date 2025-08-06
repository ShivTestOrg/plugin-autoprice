import { Context } from "../types";

export async function addCommentToIssue(context: Context, comment: string) {
  const payload = context.payload;
  if (!("issue" in payload) || !payload.issue) {
    return;
  }

  try {
    await context.commentHandler.postComment(context, context.logger.debug(comment), { updateComment: true });
  } catch (err: unknown) {
    throw context.logger.error("Adding a comment to issue failed!", { err, payload, comment });
  }
}
