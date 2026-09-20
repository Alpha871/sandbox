import { loadGameSandboxId, saveGameSandboxId } from "../../trigger/chat-store"
import { daytona } from "./client"

export const GAME_DIR = "/home/daytona/game"

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
