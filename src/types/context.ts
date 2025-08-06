import { Context as PluginContext } from "@ubiquity-os/plugin-sdk";
import { Env } from "./env";
import { AssistivePricingSettings } from "./plugin-input";
import { createAdapters } from "../adapters";
import { Command } from "./command";
export type SupportedEvents = "issues.labeled" | "issues.opened" | "issues.edited" | "issues.unlabeled" | "issue_comment.created";

export type Context<T extends SupportedEvents = SupportedEvents> = PluginContext<AssistivePricingSettings, Env, Command, T> & {
  adapters: ReturnType<typeof createAdapters>;
};
