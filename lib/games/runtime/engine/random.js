/**
 * Aléatoire à graine (mulberry32) : un niveau généré avec la même graine est
 * toujours identique, pratique pour les mondes procéduraux, le « seed du
 * jour » et le débogage. Sans graine, `Math.random()` est utilisé.
 */
export function createRandom(seed) {
  let state = seed === undefined ? null : seed >>> 0

  const next = () => {
    if (state === null) return Math.random()
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    /** Flottant dans [0, 1[. */
    next,
    /** Flottant dans [min, max[. */
    range: (min, max) => min + next() * (max - min),
    /** Entier dans [min, max] inclus. */
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    /** `true` avec la probabilité `p`. */
    chance: (p = 0.5) => next() < p,
    /** Élément au hasard d'un tableau. */
    pick: (items) => items[Math.floor(next() * items.length)],
    /** Point uniforme dans un disque du plan XZ. */
    inCircle(radius = 1) {
      const angle = next() * Math.PI * 2
      const r = Math.sqrt(next()) * radius
      return { x: Math.cos(angle) * r, z: Math.sin(angle) * r }
    },
    /** Copie mélangée (Fisher-Yates). */
    shuffle(items) {
      const copy = [...items]
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
      }
      return copy
    },
  }
}

/** Générateur global non déterministe, pour les cas simples. */
export const random = createRandom()
