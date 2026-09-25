import { createClerkClient } from "@clerk/backend"
import { eq, sum } from "drizzle-orm"

import { BILLIONTHS_PER_DOLLAR } from "../lib/billing/format"
import { computeReconcileRows } from "../lib/billing/reconcile-rows"
import { creditLedger } from "../lib/db/schema"
import { db } from "./db"

/** Offert à toute organisation, sans ligne dans `credit_ledger` — même règle que `lib/billing/ledger.ts`. */
const FREE_CREDIT = BILLIONTHS_PER_DOLLAR

// Le worker n'a pas de contexte Next : `@clerk/backend` plutôt que
// `@clerk/nextjs/server`, qui a besoin d'une requête pour résoudre ses clés.
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
})

/** Solde d'une organisation, calculé côté worker (pas d'`auth()` disponible ici). */
async function getOrgBalance(orgId: string): Promise<bigint> {
  const [row] = await db
    .select({ total: sum(creditLedger.amount) })
    .from(creditLedger)
    .where(eq(creditLedger.orgId, orgId))

  return (row?.total ? BigInt(row.total) : BigInt(0)) + FREE_CREDIT
}

/** Même logique que `lib/billing/reconcile.ts`, via `@clerk/backend`. */
async function reconcileOrgCredits(orgId: string): Promise<void> {
  const subscription =
    await clerkClient.billing.getOrganizationBillingSubscription(orgId)

  const rows = computeReconcileRows(orgId, subscription.subscriptionItems)

  if (rows.length === 0) {
    return
  }

  await db.insert(creditLedger).values(rows).onConflictDoNothing()
}

/**
 * Bloque un build quand l'organisation n'a plus de crédit. Ne resynchronise
 * l'abonnement Clerk qu'une fois, et seulement si le solde est vide : un mois
 * a pu se renouveler depuis la dernière lecture. Appelée aux frontières d'un
 * tour (avant le démarrage de la session, avant chaque tour) — jamais pendant
 * `streamText`, donc un build déjà lancé va au bout même s'il passe sous zéro.
 */
export async function assertOrgHasCredits(orgId: string): Promise<void> {
  let balance = await getOrgBalance(orgId)

  if (balance <= BigInt(0)) {
    await reconcileOrgCredits(orgId)
    balance = await getOrgBalance(orgId)
  }

  if (balance <= BigInt(0)) {
    throw new Error(
      "This organization is out of credits. Add credits in Billing to keep building."
    )
  }
}
