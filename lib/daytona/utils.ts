import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import {
  SandboxState,
  type FileUpload,
  type Sandbox,
} from "@daytona/sdk"

import { loadGameSandboxId, saveGameSandboxId } from "../../trigger/chat-store"
import { daytona } from "./client"

export const GAME_DIR = "/home/daytona/game"
/**
 * Fichiers posés dans `GAME_DIR` à la création de chaque sandbox. Relatif à la
 * racine du projet : `additionalFiles` (trigger.config.ts) en conserve le
 * chemin dans le build déployé, donc `process.cwd()` marche en dev comme en prod.
 */
const RUNTIME_DIR = path.join(process.cwd(), "lib/games/runtime")
/** Port sur lequel le serveur de la partie sert `GAME_DIR`. */
export const GAME_PORT = 3000

const HEALTH_CHECK_ATTEMPTS = 10
const HEALTH_CHECK_DELAY_MS = 500

/**
 * Parcourt `RUNTIME_DIR` récursivement. Renvoie les fichiers à envoyer et les
 * dossiers (chemins relatifs, séparés par `/`) : `uploadFiles` ne crée pas les
 * dossiers vides, il faut donc les créer à part.
 */
async function readRuntimeDir(): Promise<{
  files: FileUpload[]
  folders: string[]
}> {
  const files: FileUpload[] = []
  const folders: string[] = []

  const walk = async (relativeDir: string) => {
    const entries = await readdir(path.join(RUNTIME_DIR, relativeDir), {
      withFileTypes: true,
    })

    for (const entry of entries) {
      const relativePath = path.posix.join(relativeDir, entry.name)

      if (entry.isDirectory()) {
        folders.push(relativePath)
        await walk(relativePath)
      } else if (entry.isFile()) {
        files.push({
          source: await readFile(path.join(RUNTIME_DIR, relativePath)),
          destination: `${GAME_DIR}/${relativePath}`,
        })
      }
    }
  }

  await walk("")
  return { files, folders }
}

/**
 * Crée la sandbox Daytona d'une partie, y copie le contenu de
 * `lib/games/runtime` (dont un `index.html` minimal) et enregistre son id sur
 * la partie. Si la partie en a déjà une, la renvoie sans
 * en créer : une reprise de run ne doit pas laisser de sandbox orpheline
 * (facturée). La sandbox renvoyée n'est pas forcément démarrée.
 */
export async function createGameSandbox(
  gameId: string
): Promise<{ sandbox: Sandbox }> {
  const existing = await loadGameSandboxId(gameId)
  if (existing) return { sandbox: await daytona.get(existing) }

  const sandbox = await daytona.create({ labels: { gameId } })

  try {
    const { files, folders } = await readRuntimeDir()

    await sandbox.fs.createFolder(GAME_DIR, "755")
    for (const folder of folders) {
      await sandbox.fs.createFolder(`${GAME_DIR}/${folder}`, "755")
    }
    await sandbox.fs.uploadFiles(files)
    await saveGameSandboxId(gameId, sandbox.id)
  } catch (error) {
    // Sans id enregistré, personne ne pourrait la supprimer plus tard.
    await sandbox.delete().catch(() => {})
    throw error
  }

  return { sandbox }
}

async function ensureStarted(sandbox: Sandbox): Promise<{ sandbox: Sandbox }> {
  // Une sandbox inactive est arrêtée par Daytona ; son disque est conservé.
  if (sandbox.state !== SandboxState.STARTED) {
    await sandbox.start()
  }

  return { sandbox }
}

/**
 * Renvoie la sandbox de la partie, démarrée, en la créant si la partie n'en
 * a pas encore. Point d'entrée des tools de l'agent : ils reçoivent toujours
 * une instance utilisable, sans se soucier de son cycle de vie. Ne lance pas
 * le serveur de la partie (voir `startGameServer`). Lève une erreur si la
 * sandbox enregistrée n'existe plus côté Daytona.
 */
export async function getGameSandbox(
  gameId: string
): Promise<{ sandbox: Sandbox }> {
  const { sandbox } = await createGameSandbox(gameId)
  return ensureStarted(sandbox)
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
  const { sandbox } = await ensureStarted(await daytona.get(sandboxId))

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
