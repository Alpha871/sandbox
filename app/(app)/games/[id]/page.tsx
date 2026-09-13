import { auth } from "@clerk/nextjs/server"

import { ChatThread } from "@/components/chat-thread"

export default async function GamePage() {
  // Même protection que `app/(app)/page.tsx` : le groupe (app) n'a pas de
  // garde commune, chaque page doit la poser.
  await auth.protect()

  return <ChatThread />
}
