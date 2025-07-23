import { createClient } from "@supabase/supabase-js";
import { onIssueCreatePricingHandler, onIssueEditPricingHandler } from "./handlers/auto-price";
import { Context } from "./types/context";
import { VoyageAIClient } from "voyageai";
import { createAdapters } from "./adapters";

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
      break;
    case "issues.edited":
      await onIssueEditPricingHandler(context as Context<"issues.edited">);
      break;
    case "issue_comment.created":
      //Handle commands
      // /priority increase priority to all issues working on XP.
      break;
    case "issues.labeled":
      //Find Similar Issue then prioritize all of them.
      break;
    case "issues.unlabeled":
      //Proceed only if "Boosted" label is present,
      //if yes then revert the priority to normal;
      break;
    default:
      logger.error(`Event ${eventName} is not supported`);
  }
  return { message: "OK" };
}
