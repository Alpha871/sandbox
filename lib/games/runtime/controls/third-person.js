import * as THREE from "three"

import { clamp, damp, dampAngle } from "../engine/math.js"
import { createMover } from "./mover.js"

/**
 * Contrôleur troisième personne : la caméra orbite derrière le personnage
 * (souris en glissant ou pointeur verrouillé, stick droit, glisser du doigt),
 * la molette règle la distance. Le déplacement est relatif à la caméra et le
 * personnage se tourne vers sa direction de marche.
 *
 * Convention : le modèle regarde vers **+Z** (c'est le cas des modèles de
 * `models/`). `controller.speed` est la vitesse horizontale courante, utile
 * pour choisir l'animation (idle / walk / run).
 *
 * @param {object} game
 * @param {ReturnType<import("./input.js").createInput>} input
 * @param {object} options
 * @param {THREE.Object3D} options.object Le personnage, origine aux pieds.
 * @param {object} [options.body] Corps physique (collisions).
 * @param {number} [options.speed]
 * @param {number} [options.sprintMultiplier]
 * @param {number} [options.jumpHeight]
 * @param {number} [options.distance] Distance caméra-personnage.
 * @param {number} [options.minDistance]
 * @param {number} [options.maxDistance]
 * @param {number} [options.height] Hauteur du point visé au-dessus des pieds.
 * @param {number} [options.sensitivity] Radians par pixel.
 * @param {number} [options.minPitch]
 * @param {number} [options.maxPitch]
 * @param {number} [options.groundY]
 */
export function createThirdPersonController(
  game,
  input,
  {
    object,
    body = null,
    speed = 6,
    sprintMultiplier = 1.6,
    jumpHeight = 1.4,
    distance = 6,
    minDistance = 2.5,
    maxDistance = 14,
    height = 1.5,
    sensitivity = 0.005,
    minPitch = -0.15,
    maxPitch = 1.2,
    groundY = 0,
  } = {},
) {
  if (!object) throw new Error("createThirdPersonController: `object` is required")
  if (!object.parent) game.scene.add(object)

  const mover = createMover({ object, body, groundY })
  input.setLookMode("lockedOrDrag")

  const focus = new THREE.Vector3().copy(mover.position)
  const lookTarget = new THREE.Vector3()
  let vx = 0
  let vz = 0
  let heading = object.rotation.y

  const controller = {
    object,
    mover,
    yaw: 0,
    pitch: 0.35,
    distance,
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

    const { look, move } = input
    controller.yaw -= look.x * sensitivity
    controller.pitch = clamp(controller.pitch + look.y * sensitivity, minPitch, maxPitch)
    controller.distance = clamp(controller.distance + input.wheel * 0.8, minDistance, maxDistance)

    const top = speed * (input.down("sprint") ? sprintMultiplier : 1)
    // Le déplacement suit l'orientation de la caméra : avant = loin d'elle.
    const sin = Math.sin(controller.yaw)
    const cos = Math.cos(controller.yaw)
    const targetX = (cos * move.x - sin * move.y) * top
    const targetZ = (-sin * move.x - cos * move.y) * top
    vx = damp(vx, targetX, 14, dt)
    vz = damp(vz, targetZ, 14, dt)
    mover.setMove(vx, vz)

    if (jumpHeight > 0 && input.pressed("jump") && mover.grounded) mover.jump(jumpHeight)
    mover.update(dt)

    controller.speed = Math.hypot(vx, vz)
    // On ne tourne que si on avance : à l'arrêt, le personnage garde son cap.
    if (Math.hypot(targetX, targetZ) > 0.1) heading = Math.atan2(targetX, targetZ)
    object.rotation.y = dampAngle(object.rotation.y, heading, 14, dt)
  })

  const offLate = game.onLateUpdate((dt) => {
    // Le point suivi est lissé : la caméra ne saccade pas sur les sauts ni les marches.
    focus.x = damp(focus.x, mover.position.x, 12, dt)
    focus.y = damp(focus.y, mover.position.y, 8, dt)
    focus.z = damp(focus.z, mover.position.z, 12, dt)

    const { yaw, pitch } = controller
    const horizontal = Math.cos(pitch) * controller.distance
    game.camera.position.set(
      focus.x + Math.sin(yaw) * horizontal,
      focus.y + height + Math.sin(pitch) * controller.distance,
      focus.z + Math.cos(yaw) * horizontal,
    )
    game.camera.lookAt(lookTarget.set(focus.x, focus.y + height, focus.z))
  })

  return controller
}
