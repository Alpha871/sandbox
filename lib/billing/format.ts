// `n` littéraux bigint indisponibles : `tsconfig.json` cible ES2017.
const HUNDRED = BigInt(100)
const TWO = BigInt(2)

/** Un dollar, en unité de stockage de `credit_ledger.amount`. */
export const BILLIONTHS_PER_DOLLAR = BigInt(1_000_000_000)

/**
 * Formate un montant en milliardièmes de dollar, ex. `-500000000n` → `"-$0.50"`.
 * Arithmétique entière (bigint) plutôt que flottante, pour ne jamais arrondir
 * un solde de façon visible à l'utilisateur.
 */
export function formatDollars(amount: bigint): string {
  const negative = amount < BigInt(0)
  const abs = negative ? -amount : amount
  const cents =
    (abs * HUNDRED + BILLIONTHS_PER_DOLLAR / TWO) / BILLIONTHS_PER_DOLLAR
  const dollars = cents / HUNDRED
  const remainder = cents % HUNDRED

  return `${negative ? "-" : ""}$${dollars.toLocaleString("en-US")}.${remainder.toString().padStart(2, "0")}`
}
