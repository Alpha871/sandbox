import * as THREE from "three"

/**
 * Physique minimale pour un jeu d'arcade : gravité, sol et solides
 * (boîtes alignées sur les axes). Pas de rotation, pas de rebond réaliste :
 * juste ce qu'il faut pour un joueur qui saute, marche et se cogne.
 *
 * Un corps est une boîte dont `position` est le **centre des pieds** ; son
 * `mesh` (optionnel) est recopié dessus à chaque pas. À appeler depuis
 * `game.onFixedUpdate((dt) => world.step(dt))`.
 *
 * @param {object} [options]
 * @param {number} [options.gravity] Accélération vers le bas, en unités/s² (défaut : 25).
 * @param {number|((x: number, z: number) => number)} [options.ground] Hauteur du sol,
 *   ou fonction `(x, z) => y` pour un terrain (défaut : 0). `-Infinity` : pas de sol.
 */
export function createPhysics({ gravity = 25, ground = 0 } = {}) {
  /** @type {THREE.Box3[]} */
  const solids = []
  const bodies = new Set()
  const box = new THREE.Box3()
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()

  const groundAt = (x, z) => (typeof ground === "function" ? ground(x, z) : ground)

  // Chevauchement strict : `Box3.intersectsBox` compte un simple contact, ce
  // qui repousserait de côté un corps posé sur une plateforme dès qu'il avance.
  const EPSILON = 1e-4
  const overlaps = (a, b) =>
    a.max.x - EPSILON > b.min.x &&
    a.min.x + EPSILON < b.max.x &&
    a.max.y - EPSILON > b.min.y &&
    a.min.y + EPSILON < b.max.y &&
    a.max.z - EPSILON > b.min.z &&
    a.min.z + EPSILON < b.max.z

  const bodyBox = (body) => {
    center.set(
      body.position.x,
      body.position.y + body.size.y / 2,
      body.position.z,
    )
    return box.setFromCenterAndSize(center, body.size)
  }

  function resolveAxis(body, axis) {
    const half = body.size[axis] / 2
    const b = bodyBox(body)
    for (const solid of solids) {
      if (!overlaps(b, solid)) continue
      const v = body.velocity[axis]
      // Repousse le corps du côté d'où il venait ; à l'arrêt, du côté le plus proche.
      const fromBelow =
        v > 0 || (v === 0 && b.getCenter(size)[axis] < solid.getCenter(center)[axis])
      if (axis === "y") {
        body.position.y = fromBelow ? solid.min.y - body.size.y : solid.max.y
        if (!fromBelow) body.grounded = true
      } else {
        body.position[axis] = fromBelow ? solid.min[axis] - half : solid.max[axis] + half
      }
      body.velocity[axis] = 0
      body.hit[axis] = true
      bodyBox(body)
    }
  }

  const world = {
    solids,
    bodies,
    gravity,

    /** Ajoute un obstacle : un `Box3` ou un objet (sa boîte au moment de l'appel). */
    addSolid(boxOrObject) {
      const solid = boxOrObject.isBox3
        ? boxOrObject
        : new THREE.Box3().setFromObject(boxOrObject)
      solids.push(solid)
      return solid
    },
    removeSolid(solid) {
      const index = solids.indexOf(solid)
      if (index >= 0) solids.splice(index, 1)
    },

    /**
     * @param {object} options
     * @param {THREE.Vector3} [options.position] Centre des pieds.
     * @param {[number, number, number]} [options.size] Largeur, hauteur, profondeur.
     * @param {THREE.Object3D} [options.mesh] Recopié sur `position` à chaque pas.
     * @param {number} [options.drag] Frottement horizontal par seconde (0 = aucun).
     * @param {number} [options.gravityScale]
     */
    createBody({
      position = new THREE.Vector3(),
      size: bodySize = [1, 1, 1],
      mesh = null,
      drag = 0,
      gravityScale = 1,
    } = {}) {
      const body = {
        position: position.clone(),
        velocity: new THREE.Vector3(),
        size: new THREE.Vector3(...bodySize),
        mesh,
        drag,
        gravityScale,
        grounded: false,
        /** Axes sur lesquels une collision a eu lieu pendant le dernier pas. */
        hit: { x: false, y: false, z: false },
        /** Vitesse verticale d'un saut de `height` unités de haut. */
        jump(height = 2) {
          body.velocity.y = Math.sqrt(2 * world.gravity * height)
          body.grounded = false
        },
      }
      if (mesh) mesh.position.copy(body.position)
      bodies.add(body)
      return body
    },
    removeBody(body) {
      bodies.delete(body)
    },

    step(dt) {
      for (const body of bodies) {
        body.grounded = false
        body.hit.x = body.hit.y = body.hit.z = false
        body.velocity.y -= world.gravity * body.gravityScale * dt

        if (body.drag > 0) {
          const k = Math.max(0, 1 - body.drag * dt)
          body.velocity.x *= k
          body.velocity.z *= k
        }

        // Axe par axe : on sait ainsi contre quelle face on se cogne, et on
        // glisse le long des murs au lieu de s'y coller.
        for (const axis of ["x", "z", "y"]) {
          body.position[axis] += body.velocity[axis] * dt
          resolveAxis(body, axis)
        }

        const floor = groundAt(body.position.x, body.position.z)
        if (body.position.y <= floor) {
          body.position.y = floor
          if (body.velocity.y < 0) body.velocity.y = 0
          body.grounded = true
        }

        body.mesh?.position.copy(body.position)
      }
    },
  }

  return world
}
