import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

import { GAME_PORT, startGameServer } from "@/lib/daytona/utils"
import { getGame } from "@/lib/games/queries"

/** Durée de validité de l'URL signée remise au navigateur. */
const PREVIEW_URL_TTL_SECONDS = 3600

// Sert d'intermédiaire à Daytona : la clé d'API reste côté serveur et le
// navigateur ne reçoit qu'une URL signée, limitée au port de la partie.
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/games/[id]/preview">
) {
  // `proxy.ts` ne protège pas les routes : le contrôle se fait ici.
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await ctx.params
  const game = await getGame(id)

  if (!game?.sandboxId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const { sandbox } = await startGameServer(game.sandboxId)
    const { url } = await sandbox.getSignedPreviewUrl(
      GAME_PORT,
      PREVIEW_URL_TTL_SECONDS
    )

    return NextResponse.json({ url })
  } catch (error) {
    console.error("[games] startGameServer a échoué", error)

    return NextResponse.json({ error: "Preview unavailable" }, { status: 502 })
  }
}
