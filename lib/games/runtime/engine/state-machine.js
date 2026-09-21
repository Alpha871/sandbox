/**
 * Machine à états : écrans du jeu (`menu`, `playing`, `gameover`) ou
 * comportement d'un ennemi (`idle`, `chase`, `attack`).
 *
 * Chaque état est `{ enter?(from, data), update?(dt), exit?(to) }`.
 * `go(name, data)` change d'état ; `update(dt)` appelle celui en cours.
 *
 * @example
 * const flow = createStateMachine({
 *   menu:     { enter: () => hud.showScreen("Play") },
 *   playing:  { update: (dt) => movePlayer(dt) },
 *   gameover: { enter: () => hud.showScreen("Game over") },
 * }, "menu")
 */
export function createStateMachine(states, initial) {
  let current = null
  let currentName = null
  let elapsed = 0

  const machine = {
    get state() {
      return currentName
    },
    /** Secondes passées dans l'état courant. */
    get elapsed() {
      return elapsed
    },
    is(name) {
      return currentName === name
    },
    go(name, data) {
      const next = states[name]
      if (!next) throw new Error(`Unknown state "${name}"`)
      if (name === currentName) return
      const from = currentName
      current?.exit?.(name)
      current = next
      currentName = name
      elapsed = 0
      next.enter?.(from, data)
    },
    update(dt) {
      elapsed += dt
      current?.update?.(dt)
    },
  }

  if (initial) machine.go(initial)
  return machine
}
