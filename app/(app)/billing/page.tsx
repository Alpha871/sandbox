import { auth } from "@clerk/nextjs/server"
import { PricingTable } from "@clerk/nextjs"

import { formatDollars } from "@/lib/billing/format"
import { getActiveOrgBalance } from "@/lib/billing/ledger"
import { reconcileOrgCredits } from "@/lib/billing/reconcile"

export default async function BillingPage() {
  // Même protection que `app/(app)/games/[id]/page.tsx` : le groupe (app)
  // n'a pas de garde commune, chaque page doit la poser.
  const { orgId } = await auth.protect()

  // La réconciliation n'a lieu qu'ici, pas dans le layout : elle appelle
  // l'API Clerk et ne doit pas tourner à chaque navigation.
  if (orgId) {
    await reconcileOrgCredits(orgId)
  }

  const balance = await getActiveOrgBalance()

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
          <p className="mt-2 text-sm">
            Current balance:{" "}
            <span className="font-medium">{formatDollars(balance)}</span>
          </p>
        </div>
        <PricingTable for="organization" />
      </div>
    </div>
  )
}
