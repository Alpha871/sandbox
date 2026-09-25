import "server-only"

import { clerkClient } from "@clerk/nextjs/server"
import {
  addMonths,
  differenceInCalendarMonths,
  format,
  startOfMonth,
} from "date-fns"

import { db } from "@/lib/db"
import { creditLedger, type NewCreditLedgerEntry } from "@/lib/db/schema"

import { BILLIONTHS_PER_DOLLAR } from "./format"

const MONTHLY_CREDIT = BigInt(10) * BILLIONTHS_PER_DOLLAR

// Statuts qui impliquent au moins un paiement réussi. `incomplete`,
// `abandoned` et `upcoming` précèdent le premier paiement ; `expired` couvre
// un essai gratuit jamais converti.
const PAID_STATUSES = new Set(["active", "past_due", "canceled", "ended"])

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

  const rows: NewCreditLedgerEntry[] = subscription.subscriptionItems.flatMap(
    (item) => {
      // Le plan par défaut (gratuit) n'a jamais été payé.
      if (
        !item.plan ||
        item.plan.isDefault ||
        !PAID_STATUSES.has(item.status)
      ) {
        return []
      }

      const start = startOfMonth(new Date(item.createdAt))
      // `periodEnd` marque jusqu'où le paiement couvre déjà — contrairement à
      // `periodStart`, qui ne marque que le début de la période en cours.
      const paidThrough = new Date(
        item.endedAt ?? item.periodEnd ?? item.periodStart
      )
      const monthsPaid = differenceInCalendarMonths(paidThrough, start) + 1

      return Array.from({ length: Math.max(monthsPaid, 0) }, (_, i) => ({
        orgId,
        entryKey: `sub:${item.id}:${format(addMonths(start, i), "yyyy-MM")}`,
        amount: MONTHLY_CREDIT,
      }))
    }
  )

  if (rows.length === 0) {
    return
  }

  await db.insert(creditLedger).values(rows).onConflictDoNothing()
}
