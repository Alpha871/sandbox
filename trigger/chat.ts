import { google } from "@ai-sdk/google"
import { chat, upsertIncomingMessage } from "@trigger.dev/sdk/ai"
import { createIdGenerator, stepCountIs } from "ai"

import { createGameSandbox } from "../lib/daytona/utils"
import { gameInstructions } from "../lib/games/instructions"
import { gameTools } from "../lib/games/tools"
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

  // Les tools ont fini d'écrire dans la sandbox mais le flux est encore
  // ouvert : on prévient le client de recharger l'aperçu. `transient` : le
  // signal n'a pas à finir dans `games.messages`.
  onBeforeTurnComplete: async ({ writer }) => {
    writer.write({ type: "data-preview-refresh", data: {}, transient: true })
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

  // Déclarés ici ET repassés à `streamText` : sinon `toModelOutput` est perdu
  // quand l'historique est reconverti aux tours suivants. Liés à la partie,
  // donc à sa sandbox, par le `chatId`.
  tools: ({ chatId }) => gameTools(chatId),

  run: async ({ messages, tools, signal, streamText }) =>
    streamText({
      model: google("gemini-3.8-flash"),
      system: gameInstructions,
      messages,
      tools,
      stopWhen: stepCountIs(25),
      abortSignal: signal,
    }),
})
