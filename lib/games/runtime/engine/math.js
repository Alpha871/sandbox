export const TAU = Math.PI * 2

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
export const lerp = (a, b, t) => a + (b - a) * t
export const inverseLerp = (a, b, value) => (value - a) / (b - a)
export const remap = (value, inMin, inMax, outMin, outMax) =>
  lerp(outMin, outMax, clamp(inverseLerp(inMin, inMax, value), 0, 1))
export const degToRad = (degrees) => (degrees * Math.PI) / 180
export const radToDeg = (radians) => (radians * 180) / Math.PI

/**
 * Lissage indépendant du framerate : `value = damp(value, target, 8, dt)`.
 * Préférer à `lerp(a, b, 0.1)`, dont la vitesse dépend des FPS.
 * `lambda` : plus grand = plus réactif (≈ 5 doux, ≈ 20 sec).
 */
export const damp = (current, target, lambda, dt) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt))

/** Ramène un angle dans ]-π, π]. */
export const wrapAngle = (angle) => {
  const a = ((angle + Math.PI) % TAU + TAU) % TAU
  return a - Math.PI
}

/** Interpolation d'angle par le plus court chemin (rotation d'un personnage). */
export const dampAngle = (current, target, lambda, dt) =>
  current + wrapAngle(target - current) * (1 - Math.exp(-lambda * dt))

/** Fait tourner `value` dans [0, max[ (index de tableau, coordonnée qui boucle). */
export const wrap = (value, max) => ((value % max) + max) % max

/** Avance `current` vers `target` d'au plus `maxDelta` (vitesse constante). */
export const moveToward = (current, target, maxDelta) =>
  Math.abs(target - current) <= maxDelta
    ? target
    : current + Math.sign(target - current) * maxDelta
