/**
 * Fonctions d'accélération : `t` ∈ [0, 1] → progression ∈ [0, 1] (peut
 * déborder pour `back` et `elastic`, c'est voulu : dépassement puis retour).
 *
 * Trois variantes par famille : `in` (démarre doucement), `out` (finit
 * doucement, le choix par défaut pour un mouvement naturel) et `inOut`.
 * Familles : `quad`, `cubic`, `quart`, `expo`, `sine`, `circ`, `back`,
 * `elastic`, `bounce`. Noms : `"outCubic"`, `"inOutSine"`, `"outBack"`… et `"linear"`.
 */

const C1 = 1.70158
const C3 = C1 + 1
const C4 = (2 * Math.PI) / 3

const outBounce = (t) => {
  const n = 7.5625
  const d = 2.75
  if (t < 1 / d) return n * t * t
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375
  return n * (t -= 2.625 / d) * t + 0.984375
}

// Formes « in » ; `out` et `inOut` en sont dérivées par symétrie.
const IN = {
  quad: (t) => t * t,
  cubic: (t) => t * t * t,
  quart: (t) => t * t * t * t,
  expo: (t) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
  sine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  circ: (t) => 1 - Math.sqrt(1 - t * t),
  back: (t) => C3 * t * t * t - C1 * t * t,
  elastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * C4)),
  bounce: (t) => 1 - outBounce(1 - t),
}

const capitalize = (word) => word[0].toUpperCase() + word.slice(1)

/** @type {Record<string, (t: number) => number>} */
export const ease = { linear: (t) => t }

for (const [family, fn] of Object.entries(IN)) {
  const name = capitalize(family)
  const out = (t) => 1 - fn(1 - t)
  ease[`in${name}`] = fn
  ease[`out${name}`] = family === "bounce" ? outBounce : out
  ease[`inOut${name}`] = (t) => (t < 0.5 ? fn(2 * t) / 2 : 1 - fn(2 - 2 * t) / 2)
}

/** Nom, fonction ou rien (→ `outCubic`) vers une fonction. Nom inconnu : erreur qui liste les choix. */
export function resolveEase(value) {
  if (value === undefined || value === null) return ease.outCubic
  if (typeof value === "function") return value
  const found = ease[value]
  if (!found) {
    throw new Error(`Unknown easing "${value}". Available: ${Object.keys(ease).join(", ")}`)
  }
  return found
}
