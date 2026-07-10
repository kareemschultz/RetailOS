import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_SERVER_URL: z.url(),
    // Frontend-only preview switch. When "true", the app shell renders without
    // a live backend session (no redirect to /login) so the rebuilt UI can be
    // reviewed against the typed mock layer. MUST be unset/false in production.
    VITE_PREVIEW_NO_AUTH: z
      .string()
      .optional()
      .transform((v) => v === "true"),
  },
  runtimeEnv: (
    import.meta as unknown as { env: Record<string, string | undefined> }
  ).env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
