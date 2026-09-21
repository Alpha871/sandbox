import * as THREE from "three"

import { damp, dampAngle } from "../engine/math.js"
import { createMover } from "./mover.js"
import { pointerOnPlane } from "./picker.js"

/**
 * Contrôleur vue du dessus (twin-stick, arcade, RPG, stratégie légère) :
 * la caméra surplombe le joueur en le suivant. Le déplacement est aligné sur
 * les axes du monde (haut de l'écran = -Z). Avec `faceMouse`, le personnage
 * se tourne vers le curseur et `controller.aim` donne le point visé sur le sol.
 * Fonctionne aussi avec une caméra orthographique (`createGame({ camera: "orthographic" })`).
 *
 * Convention : le modèle regarde vers **+Z**.
 *
 * @param {object} game
 * @param {ReturnType<import("./input.js").createInput>} input
 * @param {object} options
 * @param {THREE.Object3D} options.object Le joueur, origine aux pieds.
 * @param {object} [options.body] Corps physique.
 * @param {number} [options.speed]
 * @param {number} [options.sprintMultiplier]
 * @param {number} [options.jumpHeight] 0 (défaut) : pas de saut.
 * @param {number} [options.cameraDistance] Éloignement de la caméra du joueur.
 * @param {number} [options.cameraAngle] Angle d'inclinaison au-dessus de l'horizon, en radians
 *   (π/2 = pile à la verticale ; défaut ≈ 62°).
 * @param {number} [options.followLambda] Souplesse du suivi (plus haut = plus rigide).
 * @param {boolean} [options.faceMouse] Le personnage regarde vers le curseur.
 * @param {number} [options.aimHeight] Hauteur du plan de visée (défaut : 0.5, hauteur d'un tir).
 * @param {number} [options.groundY]
 */
export function createTopDownController(
  game,
  input,
  {
    object,
    body = null,
    speed = 7,
    sprintMultiplier = 1.5,
    jumpHeight = 0,
    cameraDistance = 18,
    cameraAngle = 1.08,
    followLambda = 6,
    faceMouse = false,
    aimHeight = 0.5,
    groundY = 0,
  } = {},
) {
  if (!object) throw new Error("createTopDownController: `object` is required")
  if (!object.parent) game.scene.add(object)

  const mover = createMover({ object, body, groundY })
  const focus = new THREE.Vector3().copy(mover.position)
  const aim = new THREE.Vector3()
  const aimDirection = new THREE.Vector3(0, 0, 1)
  let vx = 0
  let vz = 0
  let heading = object.rotation.y

  const controller = {
    object,
    mover,
    /** Point du sol visé par le curseur (à jour si le pointeur a bougé). */
    aim,
    /** Direction unitaire joueur → curseur dans le plan XZ. */
    aimDirection,
    speed: 0,
    enabled: true,
    dispose() {
      offUpdate()
      offLate()
    },
  }

  const offUpdate = game.onUpdate((dt) => {
    if (!controller.enabled) {
      mover.setMove(0, 0)
      mover.update(dt)
      return
    }

    const move = input.move
    const top = speed * (input.down("sprint") ? sprintMultiplier : 1)
    // Haut de l'écran = -Z : avancer (move.y > 0) va vers -Z.
    const targetX = move.x * top
    const targetZ = -move.y * top
    vx = damp(vx, targetX, 16, dt)
    vz = damp(vz, targetZ, 16, dt)
    mover.setMove(vx, vz)

    if (jumpHeight > 0 && input.pressed("jump") && mover.grounded) mover.jump(jumpHeight)
    mover.update(dt)
    controller.speed = Math.hypot(vx, vz)

    if (pointerOnPlane(game, input, mover.position.y + aimHeight, aim)) {
      aimDirection.set(aim.x - mover.position.x, 0, aim.z - mover.position.z)
      if (aimDirection.lengthSq() > 1e-6) aimDirection.normalize()
    }

    if (faceMouse) heading = Math.atan2(aimDirection.x, aimDirection.z)
    else if (Math.hypot(targetX, targetZ) > 0.1) heading = Math.atan2(targetX, targetZ)
    object.rotation.y = dampAngle(object.rotation.y, heading, 16, dt)
  })

  const offLate = game.onLateUpdate((dt) => {
    focus.x = damp(focus.x, mover.position.x, followLambda, dt)
    focus.y = damp(focus.y, mover.position.y, followLambda, dt)
    focus.z = damp(focus.z, mover.position.z, followLambda, dt)
    // Caméra en arrière (+Z) et en hauteur : le haut de l'écran reste -Z.
    game.camera.position.set(
      focus.x,
      focus.y + Math.sin(cameraAngle) * cameraDistance,
      focus.z + Math.cos(cameraAngle) * cameraDistance,
    )
    game.camera.lookAt(focus)
  })

  return controller
}
