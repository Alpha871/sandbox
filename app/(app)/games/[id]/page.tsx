import { auth } from "@clerk/nextjs/server"

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Même protection que `app/(app)/page.tsx` : le groupe (app) n'a pas de
  // garde commune, chaque page doit la poser.
  await auth.protect()

  const { id } = await params

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <p className="font-mono text-sm text-muted-foreground">{id}</p>
    </div>
  )
}
