import { google } from "@ai-sdk/google"
import { auth } from "@clerk/nextjs/server"
import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  validateUIMessages,
  type UIMessage,
} from "ai"

import { getGame, saveGameMessages } from "@/lib/games/queries"

export async function POST(req: Request) {
  const { isAuthenticated } = await auth()
  if (!isAuthenticated) {
    return new Response("Unauthorized", { status: 401 })
  }

  // Le client n'envoie que le dernier message (voir `ChatThread`) : le reste
  // du fil vient de la base, le client ne peut pas réécrire l'historique.
  const { id, message }: { id: string; message: UIMessage } = await req.json()

  // Partie absente ou d'une autre organisation : même réponse.
  const game = await getGame(id)
  if (!game) {
    return new Response("Game not found", { status: 404 })
  }

  let messages: UIMessage[]
  try {
    messages = await validateUIMessages({
      messages: [...game.messages, message],
    })
  } catch {
    return new Response("Invalid message", { status: 400 })
  }

  // Seul l'utilisateur ajoute des messages : un message `assistant` forgé
  // côté client ne doit pas entrer dans le fil.
  if (message.role !== "user") {
    return new Response("Invalid message", { status: 400 })
  }

  const result = streamText({
    model: google("gemini-3.8-flash"),
    messages: await convertToModelMessages(messages),
  })

  // Pas d'await : le tour va au bout et `onEnd` sauvegarde même si le client
  // se déconnecte.
  result.consumeStream()

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      // Id serveur stable, pour qu'un fil rechargé garde les mêmes ids.
      generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
      onEnd: async ({ messages, outcome }) => {
        if (outcome.status === "failed") {
          return
        }

        await saveGameMessages({ id: game.id, orgId: game.orgId, messages })
      },
    }),
  })
}
