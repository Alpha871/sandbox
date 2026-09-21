import * as THREE from "three"

import { clamp, damp } from "../engine/math.js"
import { createMover } from "./mover.js"

const MAX_PITCH = Math.PI / 2 - 0.01

/**
 * Contrôleur première personne : la souris oriente la caméra, ZQSD/WASD/flèches
 * (ou joystick) déplacent, Espace saute, Maj sprinte. Un clic verrouille le
 * pointeur ; si le navigateur refuse (iframe), on regarde en glissant.
 *
 * `object` est le joueur : un groupe positionné aux **pieds**. Sans `object`,
 * un groupe vide est créé et ajouté à la scène. La caméra est placée à
 * `eyeHeight` au-dessus.
 *
 * @param {object} game
 * @param {ReturnType<import("./input.js").createInput>} input
 * @param {object} [options]
 * @param {THREE.Object3D} [options.object]
 * @param {object} [options.body] Corps de `createPhysics().createBody` (collisions).
 * @param {number} [options.speed] Unités/s (défaut : 6).
 * @param {number} [options.sprintMultiplier]
 * @param {number} [options.jumpHeight] Hauteur de saut en unités ; 0 désactive le saut.
 * @param {number} [options.eyeHeight]
 * @param {number} [options.sensitivity] Radians par pixel de souris.
 * @param {number} [options.acceleration] Réactivité du déplacement (plus haut = plus sec).
 * @param {number} [options.groundY] Sol plat, si pas de corps physique.
 * @param {boolean} [options.lockOnClick]
 */
export function createFirstPersonController(
  game,
  input,
  {
    object = null,
    body = null,
    speed = 6,
    sprintMultiplier = 1.6,
    jumpHeight = 1.2,
    eyeHeight = 1.7,
    sensitivity = 0.0022,
    acceleration = 14,
    groundY = 0,
    lockOnClick = true,
  } = {},
) {
  const player = object ?? new THREE.Group()
  if (!player.parent) game.scene.add(player)

  const mover = createMover({ object: player, body, groundY })
  game.camera.rotation.order = "YXZ"
  input.setLookMode("lockedOrDrag")

  const controller = {
    object: player,
    mover,
    yaw: player.rotation.y,
    pitch: 0,
    speed,
    enabled: true,
    eyeHeight,
    /** Point que vise la caméra, à `distance` unités devant elle. */
    getAimPoint(distance = 10, target = new THREE.Vector3()) {
      return game.camera.getWorldDirection(target).multiplyScalar(distance).add(game.camera.position)
    },
    dispose() {
      offUpdate()
      offLate()
      canvasClick && input.canvas.removeEventListener("click", canvasClick)
    },
  }

  const canvasClick = lockOnClick ? () => input.lockPointer() : null
  if (canvasClick) input.canvas.addEventListener("click", canvasClick)

  let vx = 0
  let vz = 0

  const offUpdate = game.onUpdate((dt) => {
    if (!controller.enabled) {
      mover.setMove(0, 0)
      mover.update(dt)
      return
    }

    const { look, move } = input
    controller.yaw -= look.x * sensitivity
    controller.pitch = clamp(controller.pitch - look.y * sensitivity, -MAX_PITCH, MAX_PITCH)

    const top = controller.speed * (input.down("sprint") ? sprintMultiplier : 1)
    // Avant = (-sin yaw, -cos yaw) ; droite = (cos yaw, -sin yaw).
    const sin = Math.sin(controller.yaw)
    const cos = Math.cos(controller.yaw)
    vx = damp(vx, (cos * move.x - sin * move.y) * top, acceleration, dt)
    vz = damp(vz, (-sin * move.x - cos * move.y) * top, acceleration, dt)
    mover.setMove(vx, vz)

    if (jumpHeight > 0 && input.pressed("jump") && mover.grounded) mover.jump(jumpHeight)

    mover.update(dt)
    player.rotation.y = controller.yaw
  })

  // Après tous les `onUpdate` : la caméra suit un joueur déjà déplacé.
  const offLate = game.onLateUpdate(() => {
    const camera = game.camera
    camera.position.set(mover.position.x, mover.position.y + eyeHeight, mover.position.z)
    camera.rotation.set(controller.pitch, controller.yaw, 0)
  })

  return controller
}
