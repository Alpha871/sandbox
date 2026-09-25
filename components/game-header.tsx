"use client"

import { GameActionsMenu } from "@/components/game-actions-menu"
import { Button } from "@/components/ui/button"
import type { Game } from "@/lib/db/schema"

export function GameHeader({ game }: { game: Game }) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4 text-sm font-medium">
      <span className="truncate">{game.title}</span>
      <GameActionsMenu
        game={game}
        trigger={<Button variant="ghost" size="icon-sm" />}
      />
    </header>
  )
}
