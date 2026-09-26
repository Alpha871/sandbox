import { chat } from "@trigger.dev/sdk/ai"
import { createIdGenerator, isToolUIPart, stepCountIs } from "ai"
import { z } from "zod"

import { createGameSandbox } from "../lib/daytona/utils"
import { gameStreamTextSettings } from "../lib/games/agent"
import { gameInstructions } from "../lib/games/instructions"
import {
  DEFAULT_GAME_MODEL_ID,
  GAME_MODEL_IDS,
} from "../lib/games/model-catalog"
import { gameTools } from "../lib/games/tools"
import {
  gameTranscriptStorage,
  loadGameMessages,
  loadGameOrgId,
  saveGameAccessToken,
} from "./chat-store"
import { assertOrgHasCredits } from "./credits"

// L'organisation propriétaire de la partie : résolue une fois par process
// dans `onBoot` (pas dans `onChatStart`, qui saute les runs de continuation),
// puis relue dans `onChatStart`/`onTurnStart` sans requête supplémentaire.
const orgContext = chat.local<{ orgId: string }>({ id: "orgContext" })

export const gameChat = chat.agent({
  id: "game-chat",

  onBoot: async ({ chatId }) => {
    orgContext.init({ orgId: await loadGameOrgId(chatId) })
  },

  // `model` reste optionnel : un ancien client (ou un appel direct sans
  // sélecteur) n'envoie rien, et le run retombe alors sur le défaut.
  clientDataSchema: z.object({
    model: z.enum(GAME_MODEL_IDS).optional(),
  }),

  // La base reste la source de vérité du fil ; le runtime la lit une fois au
  // démarrage du run et la tient à jour via `save` (voir `chat-store.ts`).
  storage: gameTranscriptStorage,

  // Le modèle ne répond qu'à un message utilisateur : un message `assistant`
  // forgé côté client ne doit pas entrer dans le fil. Seule exception, la
  // réponse à `ask_player` : le fil se termine alors par le message assistant
  // dont l'appel attend son résultat, et le message entrant renvoyé par
  // `addToolOutput` n'est qu'une version « slim » de ce même message (state +
  // output, sans le reste des parts — voir l'avertissement HITL de la doc
  // `ai-chat/lifecycle-hooks`).
  onValidateMessages: async ({ chatId, messages, trigger }) => {
    if (trigger !== "submit-message") return messages

    const stored = await loadGameMessages(chatId)
    const last = stored.at(-1)
    const answersQuestion =
      last?.role === "assistant" &&
      last.parts.some(
        (part) => isToolUIPart(part) && part.state === "input-available"
      ) &&
      messages.some(
        (message) => message.role === "assistant" && message.id === last.id
      )

    if (last?.role !== "user" && !answersQuestion) {
      throw new Error("Invalid message")
    }

    return messages
  },

  // Une fois par partie, au premier message : la sandbox vit autant qu'elle.
  // Le crédit est vérifié avant de la créer, pas après : une organisation à
  // sec ne doit pas payer une sandbox qu'elle ne pourra pas utiliser.
  onChatStart: async ({ chatId }) => {
    await assertOrgHasCredits(orgContext.orgId)
    await createGameSandbox(chatId)
  },

  // À chaque tour, y compris le premier (après `onChatStart`) : une
  // organisation qui épuise son crédit en cours de partie est bloquée dès le
  // tour suivant, pas seulement à l'ouverture du chat.
  onTurnStart: async () => {
    await assertOrgHasCredits(orgContext.orgId)
  },

  // Les tools ont fini d'écrire dans la sandbox mais le flux est encore
  // ouvert : on prévient le client de recharger l'aperçu. `transient` : le
  // signal n'a pas à finir dans `games.messages`.
  onBeforeTurnComplete: async ({ writer }) => {
    writer.write({ type: "data-preview-refresh", data: {}, transient: true })
  },

  // Le fil et le curseur de reprise sont maintenant à la charge de `storage`
  // (`gameTranscriptStorage.save`) ; il ne reste ici que le jeton de session,
  // que `storage` ne gère pas.
  onTurnComplete: async ({ chatId, chatAccessToken }) => {
    await saveGameAccessToken(chatId, chatAccessToken)
  },

  uiMessageStreamOptions: {
    // Id serveur stable, pour qu'un fil rechargé garde les mêmes ids.
    generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
  },

  // Déclarés ici ET repassés à `streamText` : sinon `toModelOutput` est perdu
  // quand l'historique est reconverti aux tours suivants. Liés à la partie,
  // donc à sa sandbox, par le `chatId`.
  tools: ({ chatId }) => gameTools(chatId),

  run: async ({ messages, tools, clientData, signal, streamText }) =>
    streamText({
      ...gameStreamTextSettings(clientData?.model ?? DEFAULT_GAME_MODEL_ID),
      system: gameInstructions,
      messages,
      tools,
      stopWhen: stepCountIs(25),
      abortSignal: signal,
    }),
})
