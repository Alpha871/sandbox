import { auth } from "@clerk/nextjs/server"
import { PricingTable } from "@clerk/nextjs"

export default async function BillingPage() {
  // Même protection que `app/(app)/games/[id]/page.tsx` : le groupe (app)
  // n'a pas de garde commune, chaque page doit la poser.
  await auth.protect()

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center border-b px-4 text-sm font-medium">
        Billing
      </header>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Keep the studio running</h1>
          <p className="text-sm text-muted-foreground">
            Builder adds $10.00 every month, and unused credits roll over.
          </p>
        </div>
        <PricingTable for="organization" />
      </div>
    </div>
  )
}
