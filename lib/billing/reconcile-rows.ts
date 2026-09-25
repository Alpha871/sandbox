import {
  addMonths,
  differenceInCalendarMonths,
  format,
  startOfMonth,
} from "date-fns"

import { BILLIONTHS_PER_DOLLAR } from "./format"

/** $10 par mois déjà payé sur un abonnement. */
export const MONTHLY_CREDIT = BigInt(10) * BILLIONTHS_PER_DOLLAR

// Statuts qui impliquent au moins un paiement réussi. `incomplete`,
// `abandoned` et `upcoming` précèdent le premier paiement ; `expired` couvre
// un essai gratuit jamais converti.
export const PAID_STATUSES = new Set(["active", "past_due", "canceled", "ended"])

/**
 * Sous-ensemble de `BillingSubscriptionItem` (Clerk) utilisé par le calcul :
 * structurellement compatible avec le type `@clerk/backend` et `@clerk/nextjs/server`,
 * pour ne pas faire dépendre ce module de l'un ou l'autre.
 */
export type ReconcileSubscriptionItem = {
  id: string
  status: string
  createdAt: string | number | Date
  endedAt?: string | number | Date | null
  periodEnd?: string | number | Date | null
  periodStart: string | number | Date
  plan?: { isDefault?: boolean } | null
}

export type ReconcileRow = {
  orgId: string
  entryKey: string
  amount: bigint
}

/**
 * Calcule les lignes de crédit mensuel dues pour un abonnement Clerk, sans
 * toucher à la base — partagé entre `lib/billing/reconcile.ts` (Next, via
 * `@clerk/nextjs/server`) et `trigger/credits.ts` (worker, via `@clerk/backend`).
 * Idempotent côté appelant : chaque mois a une `entryKey` stable, à insérer
 * avec `onConflictDoNothing`.
 */
export function computeReconcileRows(
  orgId: string,
  subscriptionItems: ReconcileSubscriptionItem[]
): ReconcileRow[] {
  return subscriptionItems.flatMap((item) => {
    // Le plan par défaut (gratuit) n'a jamais été payé.
    if (!item.plan || item.plan.isDefault || !PAID_STATUSES.has(item.status)) {
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
  })
}
