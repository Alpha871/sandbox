import { additionalFiles } from "@trigger.dev/build/extensions/core";
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_wttyfncdbnnqlysvvvmr",
  runtime: "node-24",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["trigger"],
  build: {
    extensions: [
      // `lib/games/runtime` n'est importé nulle part : sans ceci, le déploiement
      // ne l'embarque pas et `createGameSandbox` n'aurait rien à copier.
      additionalFiles({ files: ["./lib/games/runtime/**"] }),
    ],
    // `@daytona/sdk` charge `form-data` via un `require` calculé au runtime
    // (createRequire), invisible pour l'analyse statique d'esbuild : le
    // module n'est ni bundlé ni auto-détecté comme external, et manque donc
    // au déploiement (upload de fichiers en échec en prod uniquement).
    external: ["form-data"],
  },
});
