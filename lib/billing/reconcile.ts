import "server-only"

import { clerkClient } from "@clerk/nextjs/server"

import { db } from "@/lib/db"
import { creditLedger } from "@/lib/db/schema"

import { computeReconcileRows } from "./reconcile-rows"

/**
 * Crédite $10 par mois déjà payé sur l'abonnement Clerk de l'organisation.
 * Idempotent : chaque mois a une `entryKey` stable et l'insertion ignore les
 * conflits sur `unique(org_id, entry_key)`, donc un mois n'est jamais crédité
 * deux fois même si cette fonction tourne plusieurs fois pour le même mois.
 */
export async function reconcileOrgCredits(orgId: string): Promise<void> {
  const client = await clerkClient()
  const subscription =
    await client.billing.getOrganizationBillingSubscription(orgId)

  const rows = computeReconcileRows(orgId, subscription.subscriptionItems)

  if (rows.length === 0) {
    return
  }

  await db.insert(creditLedger).values(rows).onConflictDoNothing()
}
