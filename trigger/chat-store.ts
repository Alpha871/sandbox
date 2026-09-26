import type { TranscriptStorage } from "@trigger.dev/sdk/ai"
import type { UIMessage } from "ai"
import { eq } from "drizzle-orm"

import { games } from "../lib/db/schema"
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

/**
 * Jeton de session courant, tenu à jour à chaque tour (voir `onTurnComplete`
 * dans `trigger/chat.ts`). Distinct de `gameTranscriptStorage` : le curseur de
 * reprise du flux n'est pas ce jeton, c'est `chatCursors`.
 */
export async function saveGameAccessToken(
  id: string,
  publicAccessToken: string
) {
  await db
    .update(games)
    .set({ chatSession: { publicAccessToken } })
    .where(eq(games.id, id))
}

/**
 * Transcript storage d'un `chat.agent` (remplace le `hydrateMessages`
 * déprécié) : le fil vit comme un seul document JSON dans `games.messages`,
 * comme avant, donc `save` réécrit `changeset.transcript` tel quel plutôt que
 * de rejouer `changeset.changes` ligne à ligne (voir la doc `ai-chat/
 * transcript-storage` — un store « document » n'a pas besoin des deux).
 */
export const gameTranscriptStorage: TranscriptStorage = {
  // Générique comme l'exige `TranscriptStorage["load"]` ; la partie ne stocke
  // jamais que le `UIMessage` de base, d'où le cast.
  async load<TUIMessage extends UIMessage = UIMessage>({
    chatId,
  }: {
    chatId: string
  }) {
    const [game] = await db
      .select({
        messages: games.messages,
        chatState: games.chatState,
        chatCursors: games.chatCursors,
      })
      .from(games)
      .where(eq(games.id, chatId))
      .limit(1)

    if (!game) {
      throw new Error(`Game ${chatId} not found`)
    }

    return {
      messages: game.messages as TUIMessage[],
      state: game.chatState ?? null,
      cursors: game.chatCursors ?? undefined,
    }
  },

  async save({ chatId }, changeset) {
    await db
      .update(games)
      .set({
        messages: changeset.transcript.entries.map(
          (entry) => entry.message
        ) as UIMessage[],
        chatState: changeset.transcript.state,
        ...(changeset.cursors ? { chatCursors: changeset.cursors } : {}),
      })
      .where(eq(games.id, chatId))
  },
}
