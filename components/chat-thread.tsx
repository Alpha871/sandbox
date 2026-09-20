"use client"

import { Chat, useChat } from "@ai-sdk/react"
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

import { ChatComposer } from "@/components/chat-composer"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageAvatar, MessageContent } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import type { Game } from "@/lib/db/schema"
import { mintChatAccessToken, startChatSession } from "@/lib/games/chat-actions"
import type { gameChat } from "@/trigger/chat"

type ChatThreadProps = {
  game: Game
}

export function ChatThread({ game }: ChatThreadProps) {
  const [message, setMessage] = useState("")

  // La base est la source de vérité du fil : l'agent recharge `games.messages`
  // à chaque tour, seul le nouveau message part du client. La session
  // enregistrée permet à un onglet neuf de se reconnecter sans en recréer une.
  const transport = useTriggerChatTransport<typeof gameChat>({
    task: "game-chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
    sessions: game.chatSession ? { [game.id]: game.chatSession } : undefined,
  })

  // Une conversation par partie, reprise depuis le fil sauvegardé. Le `Chat`
  // appartient au composant : `useChat` n'appelle `chat.stop()` au démontage
  // que pour un chat qu'il a créé lui-même, et en dev le StrictMode démonte
  // juste après le montage — ce qui annulerait l'envoi automatique ci-dessous.
  // La page passe `key={game.id}` : une autre partie remonte le composant.
  const [chat] = useState(
    () => new Chat({ id: game.id, messages: game.messages, transport })
  )
  // Le message utilisateur est enregistré dès le début du tour : un fil qui
  // se termine par lui et dont la session existe déjà a un tour en cours ou
  // interrompu. On reprend son flux plutôt que de renvoyer le message.
  const awaitingAnswer = game.messages.at(-1)?.role === "user"
  const {
    messages,
    sendMessage,
    stop: stopChat,
    status,
    error,
  } = useChat({
    chat,
    resume: awaitingAnswer && game.chatSession !== null,
  })

  const pending = status === "submitted" || status === "streaming"

  // Un fil enregistré qui se termine par un message utilisateur, sans session,
  // attend sa toute première réponse (le prompt posé par `createGame`) :
  // `sendMessage()` sans argument la demande sans ajouter de message. Le ref
  // garantit un envoi par partie.
  const submittedGameId = useRef<string | null>(null)

  useEffect(() => {
    if (submittedGameId.current === game.id) return
    submittedGameId.current = game.id

    if (awaitingAnswer && game.chatSession === null) {
      sendMessage()
    }
  }, [game.id, game.chatSession, awaitingAnswer, sendMessage])

  function handleSubmit(value: string) {
    const text = value.trim()
    if (!text || pending) return

    sendMessage({ text })
    setMessage("")
  }

  // Après un `resume`, le `stop()` de `useChat` ne ferme que le flux local :
  // `stopGeneration` prévient le run Trigger.dev, qui interrompt le modèle.
  function handleStop() {
    transport.stopGeneration(game.id)
    stopChat()
  }

  return (
    <div className="flex h-svh min-h-0 flex-col">
      <MessageScrollerProvider>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto w-full max-w-2xl p-6">
              {messages.map(({ id, role, parts }) => (
                <MessageScrollerItem key={id} messageId={id}>
                  <Message align={role === "user" ? "end" : "start"}>
                    {role === "assistant" ? (
                      <MessageAvatar className="size-8 self-start rounded-full bg-transparent">
                        <Image
                          src="/logo.svg"
                          alt="Assistant"
                          width={20}
                          height={20}
                        />
                      </MessageAvatar>
                    ) : null}
                    <MessageContent>
                      <Bubble variant={role === "user" ? "secondary" : "ghost"}>
                        <BubbleContent>
                          {parts.map((part, index) =>
                            part.type === "text" ? (
                              <span key={`${id}-${index}`}>{part.text}</span>
                            ) : null
                          )}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="mx-auto w-full max-w-2xl px-6 pb-6">
        <ChatComposer
          value={message}
          onValueChange={setMessage}
          onSubmit={handleSubmit}
          onStop={handleStop}
          pending={pending}
          error={error?.message}
        />
      </div>
    </div>
  )
}
