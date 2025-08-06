import { LOG_LEVEL, LogLevel } from "@ubiquity-os/ubiquity-os-logger";
import { createPlugin } from "@ubiquity-os/plugin-sdk";
import { Manifest } from "@ubiquity-os/plugin-sdk/manifest";
import { ExecutionContext, Hono } from "hono";
import manifest from "../manifest.json";
import { AssistivePricingSettings, Env, envSchema, pluginSettingsSchema, SupportedEvents } from "./types";
import { run } from "./run";
import { createAdapters } from "./adapters";

export default {
  async fetch(request: Request, env: Env, executionCtx?: ExecutionContext) {
    const app = new Hono();
    if (!env.LOG_LEVEL && !env.KERNEL_PUBLIC_KEY) {
      env = process.env as unknown as Env;
    }
    const plugin = createPlugin<AssistivePricingSettings, Env, null, SupportedEvents>(
      (context) => {
        return run({
          ...context,
          adapters: {} as ReturnType<typeof createAdapters>,
        });
      },
      manifest as Manifest,
      {
        envSchema: envSchema,
        postCommentOnError: true,
        settingsSchema: pluginSettingsSchema,
        logLevel: (env.LOG_LEVEL as LogLevel) || LOG_LEVEL.INFO,
        kernelPublicKey: env.KERNEL_PUBLIC_KEY as string,
        bypassSignatureVerification: process.env.NODE_ENV === "local",
      }
    );
    app.route("/", plugin);
    app.onError((err, c) => {
      console.error(`[${c.req.method} ${c.req.url}]`, err);
      const statusCode = err instanceof Error ? 500 : 400;
      return c.json(
        {
          stack: process.env.NODE_ENV === "local" ? err.stack : undefined,
        },
        statusCode
      );
    });

    return app.fetch(request, env, executionCtx);
  },
};
