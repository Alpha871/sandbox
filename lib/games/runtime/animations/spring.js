import * as THREE from "three"

const MAX_SUBSTEP = 1 / 120

/**
 * Intègre un ressort amorti par sous-pas : un gros `dt` (onglet ralenti) ne
 * fait ainsi pas diverger un ressort raide.
 * Force = -raideur·(x - cible) - amortissement·v, divisée par la masse.
 */
function step(state, target, { stiffness, damping, mass }, dt) {
  let remaining = dt
  while (remaining > 1e-9) {
    const h = Math.min(remaining, MAX_SUBSTEP)
    const force = -stiffness * (state.x - target) - damping * state.v
    state.v += (force / mass) * h
    state.x += state.v * h
    remaining -= h
  }
}

const resolve = ({ stiffness = 170, damping = 18, mass = 1, precision = 0.001 } = {}) => ({
  stiffness,
  damping,
  mass,
  precision,
})

/**
 * Ressort scalaire : la valeur est *attirée* vers `target` avec une inertie,
 * donc dépasse puis se stabilise. Idéal pour ce qui doit « réagir » avec du
 * poids : rebond d'un bouton, recul, échelle d'un objet touché, suivi mou.
 *
 * Réglage : raideur ↑ = plus vif ; amortissement ↑ = moins de rebonds
 * (≈ 2·√(raideur·masse) donne un retour sans dépassement).
 *
 * `update(dt)` est à appeler à chaque frame (ou utiliser `animator.spring`).
 *
 * @example
 * const scale = createSpring(1, { stiffness: 300, damping: 12 })
 * onHit: scale.impulse(6)
 * onUpdate: mesh.scale.setScalar(scale.update(dt))
 */
export function createSpring(initial = 0, options) {
  const config = resolve(options)
  const state = { x: initial, v: 0 }

  const spring = {
    target: initial,
    get value() {
      return state.x
    },
    set value(next) {
      state.x = next
    },
    get velocity() {
      return state.v
    },
    /** Avance d'un pas et renvoie la valeur. */
    update(dt) {
      step(state, spring.target, config, dt)
      return state.x
    },
    /** Coup de vitesse instantané (la valeur est ensuite rappelée vers la cible). */
    impulse(velocity) {
      state.v += velocity
    },
    /** Saute à `value` (défaut : la cible) sans transition. */
    snap(value = spring.target) {
      spring.target = value
      state.x = value
      state.v = 0
    },
    /** Vrai quand la valeur est sur la cible et ne bouge plus. */
    get settled() {
      return Math.abs(state.x - spring.target) < config.precision && Math.abs(state.v) < config.precision
    },
  }
  return spring
}

/**
 * Ressort 3D : mêmes réglages, sur un `Vector3`. `value` et `target` sont des
 * `THREE.Vector3` (copiés à la création) ; `value` est mis à jour en place, on
 * peut donc le copier tel quel sur une position.
 *
 * @example
 * const follow = createSpring3(player.position, { stiffness: 60, damping: 12 })
 * onUpdate: follow.target.copy(player.position); follow.update(dt); camera.position.copy(follow.value)
 */
export function createSpring3(initial = new THREE.Vector3(), options) {
  const config = resolve(options)
  const value = initial.clone()
  const target = initial.clone()
  const states = ["x", "y", "z"].map((axis) => ({ axis, s: { x: value[axis], v: 0 } }))

  return {
    value,
    target,
    update(dt) {
      for (const { axis, s } of states) {
        // `value` fait foi : `snap()` ou une écriture directe sont ainsi respectés.
        s.x = value[axis]
        step(s, target[axis], config, dt)
        value[axis] = s.x
      }
      return value
    },
    impulse(vector) {
      for (const { axis, s } of states) s.v += vector[axis]
    },
    snap(position = target) {
      target.copy(position)
      value.copy(position)
      for (const { s } of states) s.v = 0
    },
    get settled() {
      return states.every(
        ({ axis, s }) =>
          Math.abs(value[axis] - target[axis]) < config.precision && Math.abs(s.v) < config.precision,
      )
    },
  }
}
