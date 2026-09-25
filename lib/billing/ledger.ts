import "server-only"

import { auth } from "@clerk/nextjs/server"
import { eq, sum } from "drizzle-orm"

import { db } from "@/lib/db"
import { creditLedger } from "@/lib/db/schema"

import { BILLIONTHS_PER_DOLLAR } from "./format"

/** Offert à toute organisation, sans ligne dans `credit_ledger`. */
export const FREE_CREDIT = BILLIONTHS_PER_DOLLAR

/** Solde d'une organisation : ses lignes plus le $1 offert. */
export async function getOrgBalance(orgId: string): Promise<bigint> {
  const [row] = await db
    .select({ total: sum(creditLedger.amount) })
    .from(creditLedger)
    .where(eq(creditLedger.orgId, orgId))

  return (row?.total ? BigInt(row.total) : BigInt(0)) + FREE_CREDIT
}

/**
 * Solde de l'organisation active, pour l'affichage dans la sidebar. Hors
 * organisation Clerk ne fournit pas d'`orgId` : on retombe sur le crédit
 * offert, comme pour une organisation qui n'a encore aucune ligne.
 */
export async function getActiveOrgBalance(): Promise<bigint> {
  const { orgId } = await auth()

  return orgId ? getOrgBalance(orgId) : FREE_CREDIT
}
