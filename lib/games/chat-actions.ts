"use server"

import { auth } from "@trigger.dev/sdk"
import { chat, type ChatStartSessionParams } from "@trigger.dev/sdk/ai"

import { getGame, initGameChatSession } from "@/lib/games/queries"
import type { gameChat } from "@/trigger/chat"

const start = chat.createStartSessionAction<typeof gameChat>("game-chat")

// `chatId` vient du navigateur : une session Clerk ne suffit pas, la partie
// doit appartenir à l'organisation active. `getGame` rend `null` dans les deux
// cas (absente ou d'une autre organisation), comme l'ancienne route.
async function requireGame(chatId: string) {
  const game = await getGame(chatId)

  if (!game) {
    throw new Error("Game not found")
  }

  return game
}

/**
 * Crée la session et son premier run, puis rend un jeton limité à cette
 * session. Idempotent sur (environnement, chatId).
 */
export async function startChatSession(
  params: ChatStartSessionParams<typeof gameChat>
) {
  const game = await requireGame(params.chatId)
  const session = await start(params)

  // Un rechargement pendant le premier tour doit reprendre le flux, pas
  // renvoyer le prompt : la session doit donc être connue de la base.
  await initGameChatSession({
    id: game.id,
    orgId: game.orgId,
    publicAccessToken: session.publicAccessToken,
  })

  return session
}

/** Simple émission de jeton : le transport l'appelle sur 401/403 pour renouveler. */
export async function mintChatAccessToken(chatId: string) {
  await requireGame(chatId)

  return auth.createPublicToken({
    scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
    expirationTime: "1h",
  })
}
