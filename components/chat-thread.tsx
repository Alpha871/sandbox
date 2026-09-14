"use client"

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

type MockMessage = {
  id: string
  role: "user" | "assistant"
  content: string
}

// Conversation factice : aucun envoi ni chargement réel pour l'instant.
const messages: MockMessage[] = [
  {
    id: "1",
    role: "user",
    content: "Build me a voxel survival game set on a floating island.",
  },
  {
    id: "2",
    role: "assistant",
    content:
      "Great pick! I'll start with a small floating island made of grass, dirt and stone blocks, a day/night cycle, and a basic inventory. Should the player be able to fall off the edge?",
  },
  {
    id: "3",
    role: "user",
    content: "Yes, and respawn them at the center of the island.",
  },
  {
    id: "4",
    role: "assistant",
    content:
      "Done. Falling below the island now respawns the player at the center with their inventory intact. Next, do you want hostile mobs at night or a peaceful mode?",
  },
  {
    id: "5",
    role: "user",
    content: "Add a few slimes that only spawn at night.",
  },
  {
    id: "6",
    role: "assistant",
    content:
      "Slimes now spawn in dark areas after sunset and despawn at dawn. They bounce toward the player and split into two smaller slimes when hit. Try it out and tell me what to tweak!",
  },
]

export function ChatThread() {
  const [message, setMessage] = useState("")

  // Temporaire : pas encore d'envoi réel, on se contente de logger la valeur.
  function sendMessage(value: string) {
    console.log(value)
    setMessage("")
  }

  return (
    <div className="flex h-svh min-h-0 flex-col">
      <MessageScrollerProvider>
        <MessageScroller className="flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="mx-auto w-full max-w-2xl p-6">
              {messages.map(({ id, role, content }) => (
                <MessageScrollerItem key={id} messageId={id}>
                  <Message align={role === "user" ? "end" : "start"}>
                    {role === "assistant" ? (
                      <MessageAvatar className="rounf size-8 self-start bg-transparent">
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
                        <BubbleContent>{content}</BubbleContent>
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
          onSubmit={sendMessage}
        />
      </div>
    </div>
  )
}
