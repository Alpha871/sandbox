/**
 * Pool d'objets réutilisables (balles, ennemis, particules…) : évite de créer
 * et détruire des Mesh à chaque tir, source classique de saccades.
 *
 * @template T
 * @param {object} options
 * @param {() => T} options.create Fabrique un objet neuf (appelée à vide ou à court).
 * @param {(item: T, ...args: any[]) => void} [options.reset] Prépare un objet à chaque `spawn`.
 * @param {(item: T) => void} [options.release] Range un objet (ex. `visible = false`).
 * @param {number} [options.size] Nombre d'objets créés d'avance.
 */
export function createPool({ create, reset, release, size = 0 }) {
  /** @type {T[]} */
  const free = []
  /** @type {Set<T>} */
  const active = new Set()

  for (let i = 0; i < size; i++) {
    const item = create()
    release?.(item)
    free.push(item)
  }

  return {
    active,
    spawn(...args) {
      const item = free.pop() ?? create()
      active.add(item)
      reset?.(item, ...args)
      return item
    },
    despawn(item) {
      if (!active.delete(item)) return
      release?.(item)
      free.push(item)
    },
    /** Parcourt les objets actifs ; `fn` peut appeler `despawn` sans risque. */
    forEach(fn) {
      for (const item of [...active]) fn(item)
    },
    clear() {
      for (const item of [...active]) this.despawn(item)
    },
    get size() {
      return active.size
    },
  }
}
