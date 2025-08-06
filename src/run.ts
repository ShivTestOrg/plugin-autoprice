import { createClient } from "@supabase/supabase-js";
import { onIssueCreatePricingHandler, onIssueEditPricingHandler, onIssuePriorityLabelChangeHandler } from "./handlers/auto-price";
import { Context } from "./types/context";
import { VoyageAIClient } from "voyageai";
import { createAdapters } from "./adapters";
import { boostPrioritySimilarIssues, handleBoostComment, revertPriorityToNormal } from "./handlers/pricing-modifier";

export async function run(context: Context) {
  const { eventName, logger, env } = context;
  if (!context.adapters?.supabase && !context.adapters?.voyage) {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
    const voyageClient = new VoyageAIClient({
      apiKey: env.VOYAGEAI_API_KEY,
    });
    context.adapters = createAdapters(supabase, voyageClient, context);
    //Check the supabase adapter
    const isConnectionValid = await context.adapters.supabase.super.checkConnection();
    context.logger[isConnectionValid ? "ok" : "error"](`Supabase connection ${isConnectionValid ? "successful" : "failed"}`);
  }
  switch (eventName) {
    case "issues.opened":
      await onIssueCreatePricingHandler(context as Context<"issues.opened">);
      await boostPrioritySimilarIssues(context as Context<"issues.opened">);
      break;
    case "issues.edited":
      await onIssueEditPricingHandler(context as Context<"issues.edited">);
      await boostPrioritySimilarIssues(context as Context<"issues.edited">);
      break;
    case "issue_comment.created":
      //Handle commands
      // /priority increase priority to all issues working on XP.
      await handleBoostComment(context as Context<"issue_comment.created">);
      break;
    case "issues.labeled":
      await onIssuePriorityLabelChangeHandler(context as Context<"issues.labeled">);
      break;
    case "issues.unlabeled":
      await revertPriorityToNormal(context as Context<"issues.unlabeled">);
      break;
    default:
      logger.error(`Event ${eventName} is not supported`);
  }
  return { message: "OK" };
}
