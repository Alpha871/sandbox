import { posix } from "node:path"

import { tool } from "ai"
import { z } from "zod"

import { GAME_DIR, getGameSandbox } from "../daytona/utils"

/** Au-delà, un fichier lu est tronqué pour ne pas saturer le contexte. */
const MAX_READ_CHARS = 100_000

/**
 * Résout un chemin donné par le modèle vers un chemin absolu dans `GAME_DIR`.
 * Un chemin relatif part de `GAME_DIR` ; un chemin absolu ou un `..` qui
 * sortirait du dossier de la partie est refusé. Le contrôle est lexical : les
 * tools ne créent pas de lien symbolique, et l'agent n'a pas de shell pour
 * en poser un.
 */
function resolveGamePath(path: string): string {
  const resolved = posix.resolve(GAME_DIR, path)

  if (resolved !== GAME_DIR && !resolved.startsWith(`${GAME_DIR}/`)) {
    throw new Error(`Path "${path}" is outside the game directory`)
  }

  return resolved
}

/** Les axes d'une partie sur lesquels le modèle peut interroger l'utilisateur. */
const ASK_USER_TOPICS = [
  "loop",
  "goal",
  "world",
  "look",
  "feel",
  "controls",
  "difficulty",
  "audio",
] as const

function countOccurrences(text: string, search: string): number {
  return text.split(search).length - 1
}

/**
 * Les tools de l'agent sur la sandbox de la partie `gameId`. Chacun résout
 * son chemin dans `GAME_DIR` puis obtient une sandbox démarrée via
 * `getGameSandbox`. Une erreur levée ici revient au modèle comme résultat
 * d'outil : il peut la lire et corriger son appel.
 */
export function gameTools(gameId: string) {
  return {
    write_file: tool({
      description: `Create a file, or fully overwrite it, in the game directory. Missing parent folders are created. Prefer replace_text for small edits to an existing file.`,
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            'Path relative to the game directory, e.g. "index.html" or "assets/sprites.js".'
          ),
        content: z.string().describe("The complete new content of the file."),
      }),
      execute: async ({ path, content }) => {
        const target = resolveGamePath(path)
        if (target === GAME_DIR) throw new Error("Path must be a file")

        const { sandbox } = await getGameSandbox(gameId)
        await sandbox.fs.uploadFile(Buffer.from(content, "utf8"), target)

        return { path: posix.relative(GAME_DIR, target), bytes: content.length }
      },
    }),

    replace_text: tool({
      description: `Edit an existing file by replacing an exact piece of text. "old_text" must match the file exactly (whitespace included) and appear exactly once, unless replace_all is true. Include enough surrounding lines to make it unique.`,
      inputSchema: z.object({
        path: z.string().describe("Path relative to the game directory."),
        old_text: z.string().min(1).describe("The exact text to replace."),
        new_text: z.string().describe("The text to put in its place."),
        replace_all: z
          .boolean()
          .optional()
          .describe("Replace every occurrence instead of requiring a unique one."),
      }),
      execute: async ({ path, old_text, new_text, replace_all }) => {
        const target = resolveGamePath(path)
        const { sandbox } = await getGameSandbox(gameId)

        const original = (await sandbox.fs.downloadFile(target)).toString("utf8")
        const occurrences = countOccurrences(original, old_text)

        if (occurrences === 0) {
          throw new Error(`old_text was not found in "${path}"`)
        }
        if (occurrences > 1 && !replace_all) {
          throw new Error(
            `old_text appears ${occurrences} times in "${path}"; add surrounding context to make it unique, or set replace_all`
          )
        }

        const updated = original.split(old_text).join(new_text)
        await sandbox.fs.uploadFile(Buffer.from(updated, "utf8"), target)

        return {
          path: posix.relative(GAME_DIR, target),
          replacements: occurrences,
        }
      },
    }),

    read_file: tool({
      description: `Read a text file from the game directory. Very large files are truncated.`,
      inputSchema: z.object({
        path: z.string().describe("Path relative to the game directory."),
      }),
      execute: async ({ path }) => {
        const target = resolveGamePath(path)
        const { sandbox } = await getGameSandbox(gameId)

        const content = (await sandbox.fs.downloadFile(target)).toString("utf8")
        const truncated = content.length > MAX_READ_CHARS

        return {
          path: posix.relative(GAME_DIR, target),
          content: truncated ? content.slice(0, MAX_READ_CHARS) : content,
          truncated,
        }
      },
    }),

    list_files: tool({
      description: `List the files and folders of the game directory, or of a folder inside it.`,
      inputSchema: z.object({
        path: z
          .string()
          .optional()
          .describe("Folder relative to the game directory. Defaults to the root."),
        depth: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe("How many levels to list. 1 (default) lists direct entries only."),
      }),
      execute: async ({ path, depth }) => {
        const target = resolveGamePath(path ?? ".")
        const { sandbox } = await getGameSandbox(gameId)

        const entries = await sandbox.fs.listFiles(target, { depth: depth ?? 1 })

        return entries.map((entry) => ({
          path: posix.relative(GAME_DIR, entry.path ?? posix.join(target, entry.name)),
          type: entry.isDir ? "directory" : "file",
          size: entry.size,
        }))
      },
    }),

    // Pas d'`execute`, volontairement : `streamText` s'arrête sur l'appel, le
    // tour se termine, et la réponse revient plus tard du client via
    // `addToolOutput` (human-in-the-loop). `outputSchema` type cette réponse.
    ask_player: tool({
      description: `Ask the player ONE multiple-choice question about ONE topic of a new game that their request has not decided yet. Call it once per open topic (loop, goal, world, look, feel, controls, difficulty, audio), one call at a time, until every topic is settled; do not ask the same topic twice. A "You decide" option (id "you_decide") is added to every question automatically, so never write one yourself; if the player picks it, choose for them. Pick the "topic" first, then write a question about that single area, with 2 to 4 options. The turn pauses until the player picks one; you then receive the chosen option's id and label. Call it alone, with no other tool call in the same step.`,
      inputSchema: z.object({
        topic: z
          .enum(ASK_USER_TOPICS)
          .describe(
            "The area the question is about, chosen before writing it: loop (core gameplay cycle), goal (win/lose conditions), world (setting, level layout), look (art style, colors), feel (game feel, pacing, juice), controls, difficulty, audio."
          ),
        question: z
          .string()
          .describe("The question, about the chosen topic only. One sentence."),
        options: z
          .array(
            z.object({
              id: z.string().describe('Short stable id, e.g. "arcade".'),
              label: z.string().describe("Short text shown on the choice."),
              description: z
                .string()
                .describe("One sentence on what picking this option means."),
            })
          )
          .min(2)
          .max(4),
      }),
      outputSchema: z.object({
        id: z.string().describe("The id of the option the user chose."),
        label: z.string().describe("The label of the option the user chose."),
      }),
    }),

    delete_file: tool({
      description: `Delete a file, or a folder and everything in it, from the game directory. The game directory itself cannot be deleted.`,
      inputSchema: z.object({
        path: z.string().describe("Path relative to the game directory."),
      }),
      execute: async ({ path }) => {
        const target = resolveGamePath(path)
        if (target === GAME_DIR) {
          throw new Error("The game directory itself cannot be deleted")
        }

        const { sandbox } = await getGameSandbox(gameId)
        await sandbox.fs.deleteFile(target, true)

        return { path: posix.relative(GAME_DIR, target), deleted: true }
      },
    }),
  }
}
