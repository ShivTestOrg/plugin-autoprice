import { Context as PluginContext } from "@ubiquity-os/plugin-sdk";
import { Env } from "./env";
import { AssistivePricingSettings } from "./plugin-input";

export type SupportedEvents = "issues.labeled" | "issues.unlabeled" | "issues.opened" | "issues.edited";

export type Context<T extends SupportedEvents = SupportedEvents> = PluginContext<AssistivePricingSettings, Env, null, T>;
