import type { UIMessage } from "ai"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { games, type GameChatSession } from "../lib/db/schema"

// Le worker Trigger.dev n'est pas Next : ni `server-only`, ni Clerk, ni
// `lib/db`. Client créé une fois par process, un run n'exécute ses requêtes
// qu'en séquence (voir la doc « Database connections »).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5_000,
})

// Une connexion inactive peut échouer en asynchrone : sans handler,
// l'événement `error` fait tomber le worker.
pool.on("error", (error) => console.error("[chat-store] pool error", error))

const db = drizzle(pool)

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
