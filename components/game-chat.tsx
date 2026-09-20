"use client"

import { ChatPreview } from "@/components/chat-preview"
import { ChatThread } from "@/components/chat-thread"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import type { Game } from "@/lib/db/schema"

type GameChatProps = {
  game: Game
}

export function GameChat({ game }: GameChatProps) {
  // Le groupe et le panneau du chat restent montés même sans sandbox : quand
  // l'aperçu apparaît en cours de tour, `ChatThread` (donc son `Chat` et son
  // flux) ne doit pas être remonté. Seul, le chat prend toute la largeur.
  return (
    <ResizablePanelGroup orientation="horizontal">
      <ResizablePanel
        id="chat"
        defaultSize={game.sandboxId ? "50" : "100"}
        minSize="25"
      >
        <ChatThread game={game} />
      </ResizablePanel>
      {game.sandboxId ? (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel id="preview" defaultSize="50" minSize="25">
            <ChatPreview gameId={game.id} />
          </ResizablePanel>
        </>
      ) : null}
    </ResizablePanelGroup>
  )
}
