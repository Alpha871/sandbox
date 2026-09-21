import * as THREE from "three"

import { damp, dampAngle } from "../engine/math.js"
import { createMover } from "./mover.js"

/**
 * Contrôleur défilement latéral 2.5D (platformer) : le personnage se déplace
 * sur X dans un plan fixe (`lockZ`) et la caméra le suit de profil, en
 * regardant un peu en avant.
 *
 * Le ressenti du saut est soigné : *coyote time* (on peut encore sauter un
 * instant après avoir quitté un bord), saut mis en mémoire (un appui juste
 * avant l'atterrissage compte) et saut variable (relâcher tôt = saut plus court).
 *
 * Convention : le modèle regarde vers **+Z** ; il est tourné vers ±X.
 *
 * @param {object} game
 * @param {ReturnType<import("./input.js").createInput>} input
 * @param {object} options
 * @param {THREE.Object3D} options.object
 * @param {object} [options.body] Corps physique (plateformes, murs).
 * @param {number} [options.speed]
 * @param {number} [options.sprintMultiplier]
 * @param {number} [options.jumpHeight]
 * @param {number} [options.coyoteTime] Secondes de tolérance après un bord.
 * @param {number} [options.jumpBuffer] Secondes pendant lesquelles un appui est retenu.
 * @param {number} [options.lockZ] Plan de jeu.
 * @param {number} [options.cameraDistance] Éloignement de la caméra (sur Z).
 * @param {number} [options.cameraHeight] Hauteur de la caméra au-dessus des pieds.
 * @param {number} [options.lookahead] Avance de la caméra dans le sens de la marche.
 * @param {number} [options.groundY]
 */
export function createSideScrollerController(
  game,
  input,
  {
    object,
    body = null,
    speed = 6,
    sprintMultiplier = 1.5,
    jumpHeight = 2.4,
    coyoteTime = 0.1,
    jumpBuffer = 0.12,
    lockZ = 0,
    cameraDistance = 14,
    cameraHeight = 2.5,
    lookahead = 2,
    groundY = 0,
  } = {},
) {
  if (!object) throw new Error("createSideScrollerController: `object` is required")
  if (!object.parent) game.scene.add(object)

  const mover = createMover({ object, body, groundY })
  const focus = new THREE.Vector3().copy(mover.position)
  const lookTarget = new THREE.Vector3()
  let vx = 0
  let facing = 1
  let sinceGrounded = Infinity
  let sinceJumpPressed = Infinity
  let lead = 0

  object.position.z = lockZ
  if (body) body.position.z = lockZ

  const controller = {
    object,
    mover,
    speed: 0,
    /** 1 vers +X (droite), -1 vers -X. */
    get facing() {
      return facing
    },
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

    const dir = input.move.x
    const top = speed * (input.down("sprint") ? sprintMultiplier : 1)
    const grounded = mover.grounded
    // Moins de contrôle en l'air, mais pas nul : un platformer doit rester réactif.
    vx = damp(vx, dir * top, grounded ? 20 : 9, dt)
    mover.setMove(vx, 0)

    sinceGrounded = grounded ? 0 : sinceGrounded + dt
    sinceJumpPressed = input.pressed("jump") ? 0 : sinceJumpPressed + dt
    if (jumpHeight > 0 && sinceJumpPressed <= jumpBuffer && sinceGrounded <= coyoteTime) {
      mover.jump(jumpHeight)
      sinceJumpPressed = Infinity
      sinceGrounded = Infinity
    }
    // Saut variable : relâcher pendant la montée coupe l'élan.
    if (input.released("jump") && mover.verticalVelocity > 0) {
      mover.verticalVelocity *= 0.5
    }

    mover.update(dt)
    // Le plan de jeu est fixe : rien ne doit dériver sur Z.
    mover.position.z = lockZ
    object.position.z = lockZ

    controller.speed = Math.abs(vx)
    if (Math.abs(dir) > 0.1) facing = Math.sign(dir)
    object.rotation.y = dampAngle(object.rotation.y, facing > 0 ? Math.PI / 2 : -Math.PI / 2, 16, dt)
  })

  const offLate = game.onLateUpdate((dt) => {
    lead = damp(lead, facing * lookahead, 2.5, dt)
    focus.x = damp(focus.x, mover.position.x + lead, 6, dt)
    // Verticalement la caméra est plus paresseuse : un saut ne la secoue pas.
    focus.y = damp(focus.y, mover.position.y, 3, dt)
    game.camera.position.set(focus.x, focus.y + cameraHeight, lockZ + cameraDistance)
    game.camera.lookAt(lookTarget.set(focus.x, focus.y + cameraHeight * 0.6, lockZ))
  })

  return controller
}
