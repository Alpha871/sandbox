"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import Image from "next/image"
import { useState } from "react"

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

// La base est la source de vérité du fil : seul le dernier message part au
// serveur, qui recharge le reste depuis `games.messages`.
const transport = new DefaultChatTransport({
  prepareSendMessagesRequest: ({ id, messages }) => ({
    body: { id, message: messages.at(-1) },
  }),
})

type ChatThreadProps = {
  game: Game
}

export function ChatThread({ game }: ChatThreadProps) {
  const [message, setMessage] = useState("")
  // Une conversation par partie, reprise depuis le fil sauvegardé.
  const { messages, sendMessage, status, error } = useChat({
    id: game.id,
    messages: game.messages,
    transport,
  })

  const pending = status === "submitted" || status === "streaming"

  function handleSubmit(value: string) {
    const text = value.trim()
    if (!text || pending) return

    sendMessage({ text })
    setMessage("")
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
          pending={pending}
          error={error?.message}
        />
      </div>
    </div>
  )
}
