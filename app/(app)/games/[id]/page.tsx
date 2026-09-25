import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { GameChat } from "@/components/game-chat"
import { GameHeader } from "@/components/game-header"
import { getGame } from "@/lib/games/queries"

export default async function GamePage({ params }: PageProps<"/games/[id]">) {
  // Même protection que `app/(app)/page.tsx` : le groupe (app) n'a pas de
  // garde commune, chaque page doit la poser.
  await auth.protect()

  const { id } = await params
  const game = await getGame(id)

  if (!game) {
    notFound()
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <GameHeader game={game} />
      {/* `flex-1 min-h-0` : `GameChat` a besoin d'un ancêtre à hauteur
          définie pour que son `h-full` (panneaux redimensionnables) se
          résolve. `key` : une autre partie remonte `GameChat`, et donc le
          `Chat` de `ChatThread`. */}
      <div className="min-h-0 flex-1">
        <GameChat key={game.id} game={game} />
      </div>
    </div>
  )
}
