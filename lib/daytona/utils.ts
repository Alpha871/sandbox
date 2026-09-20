import { SandboxState, type Sandbox } from "@daytona/sdk"

import { loadGameSandboxId, saveGameSandboxId } from "../../trigger/chat-store"
import { daytona } from "./client"

export const GAME_DIR = "/home/daytona/game"
/** Port sur lequel le serveur de la partie sert `GAME_DIR`. */
export const GAME_PORT = 3000

const HEALTH_CHECK_ATTEMPTS = 10
const HEALTH_CHECK_DELAY_MS = 500

/**
 * Crée la sandbox Daytona d'une partie, y pose un `index.html` minimal et
 * enregistre son id sur la partie. Sans effet si la partie en a déjà une :
 * une reprise de run ne doit pas laisser de sandbox orpheline (facturée).
 */
export async function createGameSandbox(gameId: string): Promise<string> {
  const existing = await loadGameSandboxId(gameId)
  if (existing) return existing

  const sandbox = await daytona.create({ labels: { gameId } })

  try {
    await sandbox.fs.uploadFile(
      Buffer.from("New game"),
      `${GAME_DIR}/index.html`
    )
    await saveGameSandboxId(gameId, sandbox.id)
  } catch (error) {
    // Sans id enregistré, personne ne pourrait la supprimer plus tard.
    await sandbox.delete().catch(() => {})
    throw error
  }

  return sandbox.id
}

/**
 * Démarre le serveur qui sert `index.html` dans la sandbox de la partie et
 * renvoie la sandbox, prête à servir sur `GAME_PORT`. Ne relance rien si un
 * serveur répond déjà : on interroge d'abord, on ne démarre qu'en cas d'échec.
 * Fabriquer l'URL de prévisualisation revient à l'appelant.
 */
export async function startGameServer(
  sandboxId: string
): Promise<{ sandbox: Sandbox }> {
  const sandbox = await daytona.get(sandboxId)

  // Une sandbox inactive est arrêtée par Daytona ; son disque est conservé.
  if (sandbox.state !== SandboxState.STARTED) {
    await sandbox.start()
  }

  const isServing = async () => {
    const { exitCode } = await sandbox.process.executeCommand(
      `curl -sf -o /dev/null http://localhost:${GAME_PORT}/`
    )
    return exitCode === 0
  }

  if (!(await isServing())) {
    await sandbox.process.executeCommand(
      `nohup python3 -m http.server ${GAME_PORT} > /tmp/game-server.log 2>&1 &`,
      GAME_DIR
    )

    let ready = false
    for (
      let attempt = 0;
      attempt < HEALTH_CHECK_ATTEMPTS && !ready;
      attempt++
    ) {
      await new Promise((resolve) => setTimeout(resolve, HEALTH_CHECK_DELAY_MS))
      ready = await isServing()
    }

    if (!ready) {
      throw new Error(`Game server did not start in sandbox ${sandboxId}`)
    }
  }

  return { sandbox }
}
