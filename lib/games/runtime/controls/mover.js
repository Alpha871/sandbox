import * as THREE from "three"

/**
 * Brique commune aux contrôleurs : déplace un objet, avec ou sans moteur
 * physique.
 *
 * - avec `body` (issu de `createPhysics().createBody`) : les vitesses sont
 *   écrites sur le corps, et c'est `world.step` qui intègre et résout les
 *   collisions ;
 * - sans : le mover intègre lui-même (gravité, sol plat à `groundY`), ce qui
 *   suffit pour un jeu sans obstacles.
 *
 * `position` est toujours la position des pieds.
 */
export function createMover({ object, body = null, groundY = 0, gravity = 25 } = {}) {
  const velocity = new THREE.Vector3()
  const wish = { x: 0, z: 0 }

  const mover = {
    object,
    body,
    /** Position des pieds (celle du corps s'il y en a un). */
    get position() {
      return body ? body.position : object.position
    },
    /** Vitesse verticale, lisible et modifiable (saut variable, rebond). */
    get verticalVelocity() {
      return body ? body.velocity.y : velocity.y
    },
    set verticalVelocity(value) {
      if (body) body.velocity.y = value
      else velocity.y = value
    },
    get grounded() {
      return body ? body.grounded : object.position.y <= groundY + 1e-4
    },
    /** Vitesse horizontale actuelle, en unités/s. */
    get speed() {
      return body ? Math.hypot(body.velocity.x, body.velocity.z) : Math.hypot(wish.x, wish.z)
    },

    /** Vitesse horizontale voulue, en unités monde par seconde. */
    setMove(vx, vz) {
      wish.x = vx
      wish.z = vz
    },
    /** Saut de `height` unités de haut (ignoré en l'air : tester `grounded`). */
    jump(height = 1.2) {
      // Avec un corps, la gravité qui compte est celle du monde physique.
      if (body) body.jump(height)
      else velocity.y = Math.sqrt(2 * gravity * height)
    },
    /** Place l'objet (respawn, téléportation) et annule la vitesse. */
    teleport(x, y, z) {
      if (body) {
        body.position.set(x, y, z)
        body.velocity.set(0, 0, 0)
      }
      object.position.set(x, y, z)
      velocity.set(0, 0, 0)
    },

    update(dt) {
      if (body) {
        body.velocity.x = wish.x
        body.velocity.z = wish.z
        // `world.step` ne recopie que `body.mesh` : on suit aussi un autre objet.
        if (body.mesh !== object) object.position.copy(body.position)
        return
      }
      const position = object.position
      velocity.x = wish.x
      velocity.z = wish.z
      velocity.y -= gravity * dt
      position.addScaledVector(velocity, dt)
      if (position.y <= groundY) {
        position.y = groundY
        if (velocity.y < 0) velocity.y = 0
      }
    },
  }

  return mover
}
