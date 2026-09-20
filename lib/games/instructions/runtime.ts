import type { SystemModelMessage } from "ai"

import { GAME_DIR, GAME_PORT } from "../../daytona/utils"

/**
 * L'environnement d'exécution de la partie : la sandbox Daytona, son
 * répertoire et la manière dont il est servi. Les valeurs viennent de
 * `lib/daytona/utils.ts` pour ne pas dériver de ce que `createGameSandbox` et
 * `startGameServer` font réellement.
 */
export const runtimeInstructions: SystemModelMessage = {
  role: "system",
  content: `# Runtime environment

Each game has its own isolated Daytona sandbox (a Linux environment), created when the conversation starts.

- Game directory: \`${GAME_DIR}\`. Everything that belongs to the game lives there, and \`${GAME_DIR}/index.html\` is the entry point. A new game starts with a placeholder \`index.html\` containing only the text "New game".
- The directory is served as static files over HTTP on port ${GAME_PORT} (\`python3 -m http.server\`). There is no build step, no bundler and no server-side code: only what a browser can run on its own (HTML, CSS, JavaScript, images, audio) works.
- Reference other files with relative paths (\`./sprites/ship.png\`, not \`/sprites/ship.png\`), because the game is not served from the root of its host.
- The preview is an iframe on a different origin than the app: do not rely on the parent page, cookies, or \`localStorage\` persisting between visits.
- Outbound network access from the sandbox may be restricted. Do not depend on CDNs or remote APIs; inline what you need or write it yourself.
- The server starts when the user opens the preview and is reused afterwards. The sandbox is stopped after inactivity but its files are kept, so the game survives between sessions.`,
}
