"use client"

import { Chat, useChat } from "@ai-sdk/react"
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react"
import { getToolName, isToolUIPart } from "ai"
import type { DynamicToolUIPart, ToolUIPart } from "ai"
import { CheckIcon, Loader2Icon, XIcon } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { cn } from "cn"

import { ChatComposer } from "@/components/chat-composer"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker"
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
  /** Appelé quand l'agent signale la fin d'un tour (la sandbox est à jour). */
  onTurnComplete?: () => void
}

type ToolStatus = "active" | "done" | "failed"

// Verbes par outil : présent pendant l'appel, participe passé une fois fini.
const TOOL_LABELS: Record<string, { active: string; done: string }> = {
  write_file: { active: "Writing", done: "Wrote" },
  replace_text: { active: "Editing", done: "Edited" },
  read_file: { active: "Reading", done: "Read" },
  list_files: { active: "Listing", done: "Listed" },
  delete_file: { active: "Deleting", done: "Deleted" },
}

function toolStatus(part: ToolUIPart | DynamicToolUIPart): ToolStatus {
  switch (part.state) {
    case "output-available":
      return "done"
    case "output-error":
    case "output-denied":
      return "failed"
    default:
      return "active"
  }
}

// Tous les tools prennent un `path` relatif au dossier de la partie ; le
// `input` reste `unknown` tant que le fil n'est pas typé par l'agent.
function toolPath(input: unknown): string | null {
  if (typeof input !== "object" || input === null) return null
  const { path } = input as { path?: unknown }
  return typeof path === "string" && path ? path : null
}

function ToolCallMarker({ part }: { part: ToolUIPart | DynamicToolUIPart }) {
  const name = getToolName(part)
  const status = toolStatus(part)
  const path = toolPath(part.input)
  const verbs = TOOL_LABELS[name] ?? { active: `Running ${name}`, done: name }

  return (
    <Marker
      data-status={status}
      className={cn(status === "failed" && "text-destructive")}
    >
      <MarkerIcon>
        {status === "active" ? (
          <Loader2Icon className="animate-spin" />
        ) : status === "done" ? (
          <CheckIcon />
        ) : (
          <XIcon />
        )}
      </MarkerIcon>
      <MarkerContent>
        {status === "failed"
          ? `Failed: ${verbs.active.toLowerCase()}${path ? ` ${path}` : ""}${
              part.state === "output-error" ? ` — ${part.errorText}` : ""
            }`
          : `${status === "active" ? verbs.active : verbs.done}${
              path ? ` ${path}` : ""
            }${status === "active" ? "…" : ""}`}
      </MarkerContent>
    </Marker>
  )
}

export function ChatThread({ game, onTurnComplete }: ChatThreadProps) {
  const [message, setMessage] = useState("")

  // Le `Chat` n'est créé qu'une fois : son `onData` lit la dernière prop.
  const onTurnCompleteRef = useRef(onTurnComplete)
  useEffect(() => {
    onTurnCompleteRef.current = onTurnComplete
  }, [onTurnComplete])

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
    () =>
      new Chat({
        id: game.id,
        messages: game.messages,
        transport,
        // Signal transitoire émis par `onBeforeTurnComplete` (trigger/chat.ts).
        onData: (part) => {
          if (part.type === "data-preview-refresh") {
            onTurnCompleteRef.current?.()
          }
        },
      })
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

  // La sandbox est créée par le run Trigger.dev, après le rendu serveur :
  // `game.sandboxId` est périmé jusqu'à la fin du tour. On recharge alors les
  // données de la page pour faire apparaître l'aperçu.
  const router = useRouter()
  const wasPending = useRef(false)

  useEffect(() => {
    if (wasPending.current && !pending && !game.sandboxId) {
      router.refresh()
    }
    wasPending.current = pending
  }, [pending, game.sandboxId, router])

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
    <div className="flex h-full min-h-0 flex-col">
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
                      {parts.map((part, index) => {
                        const key = `${id}-${index}`

                        if (isToolUIPart(part)) {
                          return <ToolCallMarker key={key} part={part} />
                        }
                        if (part.type === "text" && part.text) {
                          return (
                            <Bubble
                              key={key}
                              variant={role === "user" ? "secondary" : "ghost"}
                            >
                              <BubbleContent>{part.text}</BubbleContent>
                            </Bubble>
                          )
                        }
                        return null
                      })}
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
