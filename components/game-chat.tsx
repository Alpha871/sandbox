"use client"

import { useState } from "react"

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
  // L'URL de l'aperçu ne change pas d'un tour à l'autre : la révision sert de
  // `key` à l'iframe pour la remonter, donc recharger la page.
  const [previewRevision, setPreviewRevision] = useState(0)

  // Le groupe et le panneau du chat restent montés même sans sandbox : quand
  // l'aperçu apparaît en cours de tour, `ChatThread` (donc son `Chat` et son
  // flux) ne doit pas être remonté. Seul, le chat prend toute la largeur.
  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-0">
      <ResizablePanel
        id="chat"
        defaultSize={game.sandboxId ? "50" : "100"}
        minSize="25"
        className="min-h-0"
      >
        <ChatThread
          game={game}
          onTurnComplete={() => setPreviewRevision((revision) => revision + 1)}
        />
      </ResizablePanel>
      {game.sandboxId ? (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel id="preview" defaultSize="50" minSize="25">
            <ChatPreview gameId={game.id} revision={previewRevision} />
          </ResizablePanel>
        </>
      ) : null}
    </ResizablePanelGroup>
  )
}
