import { auth } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"

import { ChatThread } from "@/components/chat-thread"
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

  // `key` : une autre partie remonte `ChatThread`, et donc son `Chat`.
  return <ChatThread key={game.id} game={game} />
}
