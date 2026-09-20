import { google } from "@ai-sdk/google"
import { chat, upsertIncomingMessage } from "@trigger.dev/sdk/ai"
import { createIdGenerator } from "ai"

import { createGameSandbox } from "../lib/daytona/utils"
import { gameInstructions } from "../lib/games/instructions"
import {
  loadGameMessages,
  saveGameMessages,
  saveGameTurn,
} from "./chat-store"

export const gameChat = chat.agent({
  id: "game-chat",

  // La base reste la source de vérité du fil : on la relit à chaque tour et
  // on ignore la copie du client, sauf le nouveau message utilisateur.
  hydrateMessages: async ({ chatId, trigger, incomingMessages }) => {
    const stored = await loadGameMessages(chatId)

    // Sans effet si le message est déjà stocké (le prompt posé par
    // `createGame`, renvoyé par `sendMessage()` à l'ouverture de la partie).
    if (upsertIncomingMessage(stored, { trigger, incomingMessages })) {
      await saveGameMessages(chatId, stored)
    }

    // Le modèle ne répond qu'à un message utilisateur : un message
    // `assistant` forgé côté client ne doit pas entrer dans le fil.
    if (trigger === "submit-message" && stored.at(-1)?.role !== "user") {
      throw new Error("Invalid message")
    }

    return stored
  },

  // Une fois par partie, au premier message : la sandbox vit autant qu'elle.
  onChatStart: async ({ chatId }) => {
    await createGameSandbox(chatId)
  },

  onTurnComplete: async ({ chatId, uiMessages, chatAccessToken, lastEventId }) => {
    await saveGameTurn(chatId, uiMessages, {
      publicAccessToken: chatAccessToken,
      lastEventId,
    })
  },

  uiMessageStreamOptions: {
    // Id serveur stable, pour qu'un fil rechargé garde les mêmes ids.
    generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
  },

  run: async ({ messages, signal, streamText }) =>
    streamText({
      model: google("gemini-3.8-flash"),
      system: gameInstructions,
      messages,
      abortSignal: signal,
    }),
})
