import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: import.meta.env,
});
