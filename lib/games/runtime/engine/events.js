/**
 * Petit bus d'évènements pour découpler les systèmes du jeu
 * (`events.emit("coin", { value: 10 })` → le HUD et l'audio réagissent).
 * `on` renvoie la fonction qui désabonne.
 */
export function createEvents() {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map()

  const off = (name, fn) => {
    listeners.get(name)?.delete(fn)
  }

  return {
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name).add(fn)
      return () => off(name, fn)
    },
    once(name, fn) {
      const unsubscribe = this.on(name, (payload) => {
        unsubscribe()
        fn(payload)
      })
      return unsubscribe
    },
    off,
    emit(name, payload) {
      // Copie : un listener peut se désabonner pendant l'émission.
      for (const fn of [...(listeners.get(name) ?? [])]) fn(payload)
    },
    clear() {
      listeners.clear()
    },
  }
}
