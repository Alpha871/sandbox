import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { GameChat } from "@/components/game-chat"
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

  // `key` : une autre partie remonte `GameChat`, et donc le `Chat` de `ChatThread`.
  return <GameChat key={game.id} game={game} />
}
