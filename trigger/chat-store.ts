import type { UIMessage } from "ai"
import { eq } from "drizzle-orm"

import { games, type GameChatSession } from "../lib/db/schema"
import { db } from "./db"

/** Fil stocké d'une partie. Lève si elle n'existe pas : `createGame` la crée. */
export async function loadGameMessages(id: string): Promise<UIMessage[]> {
  const [game] = await db
    .select({ messages: games.messages })
    .from(games)
    .where(eq(games.id, id))
    .limit(1)

  if (!game) {
    throw new Error(`Game ${id} not found`)
  }

  return game.messages
}

/**
 * Organisation propriétaire de la partie, comme `getGame` côté Next mais
 * sans `auth()` : le worker n'a pas de contexte Clerk, `chatId` (= id de la
 * partie) est la seule clé disponible. Lève si elle n'existe pas.
 */
export async function loadGameOrgId(id: string): Promise<string> {
  const [game] = await db
    .select({ orgId: games.orgId })
    .from(games)
    .where(eq(games.id, id))
    .limit(1)

  if (!game) {
    throw new Error(`Game ${id} not found`)
  }

  return game.orgId
}

/** Sandbox Daytona de la partie, `null` si elle n'a pas encore été créée. */
export async function loadGameSandboxId(id: string): Promise<string | null> {
  const [game] = await db
    .select({ sandboxId: games.sandboxId })
    .from(games)
    .where(eq(games.id, id))
    .limit(1)

  if (!game) {
    throw new Error(`Game ${id} not found`)
  }

  return game.sandboxId
}

export async function saveGameSandboxId(id: string, sandboxId: string) {
  await db.update(games).set({ sandboxId }).where(eq(games.id, id))
}

export async function saveGameMessages(id: string, messages: UIMessage[]) {
  await db.update(games).set({ messages }).where(eq(games.id, id))
}

/**
 * Fil et curseur de reprise dans un seul UPDATE, donc atomiques : un
 * rechargement entre deux écritures reprendrait depuis un curseur périmé.
 */
export async function saveGameTurn(
  id: string,
  messages: UIMessage[],
  chatSession: GameChatSession
) {
  await db.update(games).set({ messages, chatSession }).where(eq(games.id, id))
}
