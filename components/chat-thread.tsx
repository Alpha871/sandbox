"use client"

import { Chat, useChat } from "@ai-sdk/react"
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react"
import {
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai"
import type { DynamicToolUIPart, ToolUIPart, UIMessage } from "ai"
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
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireItem,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire"
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
  ask_player: { active: "Preparing a question", done: "Asked a question" },
}

const ASK_PLAYER = "ask_player"

// Miroir de l'`inputSchema` / `outputSchema` d'`ask_player` (lib/games/tools.ts).
// Le fil n'est pas typé par l'agent : on valide à la main ce que le modèle a
// écrit avant d'en faire une interface.
type AskPlayerOption = { id: string; label: string; description: string }
type AskPlayerInput = {
  topic: string
  question: string
  options: AskPlayerOption[]
}
type AskPlayerAnswer = { id: string; label: string }

// Ajoutée à chaque question par l'interface, pas par le modèle. Son `id` est
// cité dans les instructions (lib/games/instructions/workflow.ts) : le
// modèle sait alors qu'il doit trancher lui-même pour cet axe.
const YOU_DECIDE: AskPlayerOption = {
  id: "you_decide",
  label: "You decide",
  description: "Pick whatever fits the game best.",
}

function isAskPlayerInput(input: unknown): input is AskPlayerInput {
  if (typeof input !== "object" || input === null) return false
  const { topic, question, options } = input as Partial<AskPlayerInput>

  return (
    typeof topic === "string" &&
    typeof question === "string" &&
    Array.isArray(options) &&
    options.length > 0 &&
    options.every(
      (option) =>
        typeof option?.id === "string" && typeof option.label === "string"
    )
  )
}

function isAskPlayerAnswer(output: unknown): output is AskPlayerAnswer {
  if (typeof output !== "object" || output === null) return false
  const { id, label } = output as Partial<AskPlayerAnswer>
  return typeof id === "string" && typeof label === "string"
}

// Une question est « ouverte » tant que l'appel attend sa réponse : le tour
// est fini, la sandbox ne bouge pas, et on ne peut pas envoyer d'autre message
// (le modèle refuserait un appel d'outil sans résultat).
function hasOpenQuestion(messages: UIMessage[]): boolean {
  const last = messages.at(-1)
  return (
    last?.role === "assistant" &&
    last.parts.some(
      (part) =>
        isToolUIPart(part) &&
        getToolName(part) === ASK_PLAYER &&
        part.state === "input-available"
    )
  )
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

function AskPlayerQuestion({
  input,
  onAnswer,
}: {
  input: AskPlayerInput
  onAnswer: (answer: AskPlayerAnswer) => void
}) {
  const [choice, setChoice] = useState<string | null>(null)
  const options = [
    ...input.options.filter(({ id }) => id !== YOU_DECIDE.id),
    YOU_DECIDE,
  ]

  return (
    <Questionnaire
      className="rounded-xl border bg-card p-4"
      shortcuts="numbers"
      onSubmit={(event) => {
        event.preventDefault()
        const option = options.find(({ id }) => id === choice)
        if (option) onAnswer({ id: option.id, label: option.label })
      }}
    >
      <QuestionnaireItem name="answer" required>
        <QuestionnaireTitle>{input.question}</QuestionnaireTitle>
        <QuestionnaireDescription>Topic: {input.topic}</QuestionnaireDescription>
        <QuestionnaireChoices>
          {options.map((option) => (
            <QuestionnaireChoice
              key={option.id}
              value={option.id}
              onChange={() => setChoice(option.id)}
            >
              <span className="font-medium">{option.label}</span>
              {option.description ? (
                <QuestionnaireChoiceDescription>
                  {option.description}
                </QuestionnaireChoiceDescription>
              ) : null}
            </QuestionnaireChoice>
          ))}
        </QuestionnaireChoices>
      </QuestionnaireItem>
      <QuestionnaireActions>
        <QuestionnaireSubmit disabled={choice === null}>Answer</QuestionnaireSubmit>
      </QuestionnaireActions>
    </Questionnaire>
  )
}

// L'appel `ask_player` a trois vies : la question à choix (`input-available`,
// en attente de la réponse), la réponse choisie (`output-available`), et un
// simple marqueur le reste du temps (saisie en cours, erreur).
function AskPlayerPart({
  part,
  onAnswer,
}: {
  part: ToolUIPart | DynamicToolUIPart
  onAnswer: (toolCallId: string, answer: AskPlayerAnswer) => void
}) {
  if (part.state === "input-available" && isAskPlayerInput(part.input)) {
    return (
      <AskPlayerQuestion
        input={part.input}
        onAnswer={(answer) => onAnswer(part.toolCallId, answer)}
      />
    )
  }

  if (part.state === "output-available" && isAskPlayerAnswer(part.output)) {
    const question = isAskPlayerInput(part.input) ? part.input.question : null

    return (
      <Marker data-status="done">
        <MarkerIcon>
          <CheckIcon />
        </MarkerIcon>
        <MarkerContent>
          {question ? `${question} — ` : "Answered: "}
          {part.output.label}
        </MarkerContent>
      </Marker>
    )
  }

  return <ToolCallMarker part={part} />
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
        // `ask_player` n'a pas d'`execute` : la réponse de l'utilisateur
        // (`addToolOutput`) complète l'appel et relance le tour toute seule.
        sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
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
    addToolOutput,
    stop: stopChat,
    status,
    error,
  } = useChat({
    chat,
    resume: awaitingAnswer && game.chatSession !== null,
  })

  const pending = status === "submitted" || status === "streaming"
  const questionOpen = !pending && hasOpenQuestion(messages)
  // Vrai après un envoi refusé pendant une question ouverte ; l'astuce
  // disparaît d'elle-même quand la question reçoit sa réponse.
  const [triedWhileOpen, setTriedWhileOpen] = useState(false)

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
    if (questionOpen) {
      setTriedWhileOpen(true)
      return
    }

    sendMessage({ text })
    setMessage("")
  }

  function handleAnswer(toolCallId: string, answer: AskPlayerAnswer) {
    addToolOutput({ tool: ASK_PLAYER, toolCallId, output: answer })
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
                          if (getToolName(part) === ASK_PLAYER) {
                            return (
                              <AskPlayerPart
                                key={key}
                                part={part}
                                onAnswer={handleAnswer}
                              />
                            )
                          }
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
          error={
            error?.message ??
            (triedWhileOpen && questionOpen
              ? "Answer the question above first."
              : null)
          }
        />
      </div>
    </div>
  )
}
