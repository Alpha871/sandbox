import * as THREE from "three"

import { createSpring } from "./spring.js"

const _right = new THREE.Vector3()
const _up = new THREE.Vector3()

/** Bruit lisse et déterministe dans [-1, 1] : deux sinus désaccordés, sans table. */
const noise = (t, seed) =>
  Math.sin(t * 1.0 + seed) * 0.6 + Math.sin(t * 2.31 + seed * 2.7) * 0.4

/**
 * Effets de caméra qui donnent du poids aux évènements : secousse, coup de
 * FOV, arrêt sur image, ralenti.
 *
 * Ils sont *superposés* à la caméra sans l'interférer : à chaque frame, l'effet
 * de la frame précédente est retiré (`onUpdate`), les contrôleurs placent la
 * caméra (`onLateUpdate`), puis l'effet est réappliqué juste avant le rendu
 * (`onFrameEnd`). Ça marche donc avec tous les contrôleurs, y compris
 * `OrbitControls` qui relit la position de la caméra.
 *
 * La secousse suit le modèle du « trauma » : `shake` ajoute du trauma, qui
 * décroît avec le temps ; l'amplitude est proportionnelle à son *carré*, ce
 * qui donne des petits chocs discrets et de gros chocs violents.
 *
 * @param {object} game
 * @param {{ maxOffset?: number, maxRoll?: number, frequency?: number }} [options]
 *   `maxOffset` : déplacement max en unités à trauma = 1 ; `maxRoll` : roulis max en radians.
 */
export function createCameraEffects(game, { maxOffset = 0.6, maxRoll = 0.06, frequency = 22 } = {}) {
  let trauma = 0
  let decay = 2
  let clock = 0
  let timeEffect = null

  // La FOV est un décalage (en degrés) rappelé vers `fovTarget` par un ressort.
  const fov = createSpring(0, { stiffness: 220, damping: 16 })
  const applied = { offset: new THREE.Vector3(), roll: 0, fov: 0 }

  function undo() {
    const camera = game.camera
    if (applied.roll) camera.rotateZ(-applied.roll)
    camera.position.sub(applied.offset)
    if (applied.fov && camera.isPerspectiveCamera) {
      camera.fov -= applied.fov
      camera.updateProjectionMatrix()
    }
    applied.offset.set(0, 0, 0)
    applied.roll = 0
    applied.fov = 0
  }

  const offUpdate = game.onUpdate((dt) => {
    undo()

    trauma = Math.max(0, trauma - decay * dt)
    clock += dt * frequency
    fov.update(dt)

    // Les effets de temps se mesurent en temps *réel* : un arrêt sur image à
    // échelle 0 ne doit pas figer son propre minuteur.
    if (timeEffect) {
      timeEffect.remaining -= game.time.realDelta
      if (timeEffect.remaining <= 0) {
        game.time.scale = 1
        timeEffect = null
      } else {
        game.time.scale = timeEffect.scale
      }
    }
  })

  const offEnd = game.onFrameEnd(() => {
    if (game.paused) return
    const camera = game.camera

    if (trauma > 0) {
      const power = trauma * trauma
      _right.set(1, 0, 0).applyQuaternion(camera.quaternion)
      _up.set(0, 1, 0).applyQuaternion(camera.quaternion)
      applied.offset
        .copy(_right)
        .multiplyScalar(noise(clock, 1.3) * maxOffset * power)
        .addScaledVector(_up, noise(clock, 7.1) * maxOffset * power)
      camera.position.add(applied.offset)
      applied.roll = noise(clock, 13.7) * maxRoll * power
      camera.rotateZ(applied.roll)
    }

    if (camera.isPerspectiveCamera && Math.abs(fov.value) > 1e-3) {
      applied.fov = fov.value
      camera.fov += applied.fov
      camera.updateProjectionMatrix()
    }
  })

  return {
    /**
     * Secousse. `intensity` ∈ [0, 1] s'ajoute au trauma courant (0.2 léger,
     * 0.5 net, 1 violent) ; `duration` : secondes pour retomber à zéro.
     */
    shake(intensity = 0.4, duration = 0.5) {
      trauma = Math.min(1, trauma + intensity)
      decay = Math.max(1 / duration, 0.05)
    },
    /** Élargit brièvement le champ (impact, dash). Revient seul. `degrees` > 0 = zoom arrière. */
    punchFov(degrees = 8) {
      fov.value += degrees
    },
    /** Maintient un décalage de FOV (sprint = +10) ; `0` pour revenir à la normale. */
    setFovOffset(degrees) {
      fov.target = degrees
    },
    /**
     * Arrêt sur image : fige le jeu `duration` secondes réelles (0.05–0.1 suffit
     * à donner du poids à un coup). `scale` > 0 laisse un léger mouvement.
     */
    hitStop(duration = 0.07, scale = 0) {
      timeEffect = { remaining: duration, scale }
    },
    /** Ralenti : joue à `scale` (0.3 = 30 %) pendant `duration` secondes réelles, puis reprend. */
    slowMotion(scale = 0.3, duration = 1) {
      timeEffect = { remaining: duration, scale }
    },
    /** Coupe tout et remet la caméra à plat. */
    reset() {
      undo()
      trauma = 0
      fov.snap(0)
      if (timeEffect) game.time.scale = 1
      timeEffect = null
    },
    dispose() {
      offUpdate()
      offEnd()
      undo()
    },
  }
}
