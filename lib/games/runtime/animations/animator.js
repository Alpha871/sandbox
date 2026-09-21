import { ease } from "./easing.js"
import { createTweens } from "./tween.js"
import { createSpring, createSpring3 } from "./spring.js"
import { createCameraEffects } from "./camera-effects.js"
import { createProcedural } from "./procedural.js"
import { createJuice } from "./juice.js"
import { createAnimationController } from "./character.js"

/**
 * Tout ce qui anime, derrière un seul objet lié au jeu :
 *
 * - **Tweens** : `to`, `from`, `value`, `wait`, `sequence`, `all`, `killTweensOf`
 * - **Ressorts** : `spring(1)`, `spring3(vector)` (mis à jour automatiquement)
 * - **Comportements continus** : `spin`, `float`, `pulse`, `orbit`, `flicker`, `billboard`, `follow`
 * - **Game feel** : `popIn`, `popOut`, `squash`, `hitFlash`, `hop`, `fadeTo`, `wobble`
 * - **Caméra** : `shake`, `punchFov`, `setFovOffset`, `hitStop`, `slowMotion`
 * - **Modèles animés** : `controller(model, clips)`
 * - `ease` : la table des easings, pour un nom (`"outBack"`) ou un appel direct (`ease.outBack(t)`)
 *
 * Tout suit le temps de jeu : figé en pause, accéléré ou ralenti par `game.time.scale`.
 *
 * @param {object} game Résultat de `createGame`.
 */
export function createAnimator(game) {
  const tweens = createTweens(game)
  const procedural = createProcedural(game)
  const juice = createJuice(game, tweens)
  const cameraFx = createCameraEffects(game)
  const controllers = new Set()

  /** Enregistre un ressort sur la boucle : il avance tout seul. */
  const autoUpdate = (spring) => {
    const off = game.onUpdate((dt) => spring.update(dt))
    spring.dispose = off
    return spring
  }

  return {
    ease,
    tweens,
    cameraFx,

    to: tweens.to,
    from: tweens.from,
    value: tweens.value,
    wait: tweens.wait,
    sequence: tweens.sequence,
    all: tweens.all,
    killTweensOf: tweens.killTweensOf,
    stopAll: tweens.stopAll,

    /** Ressort scalaire mis à jour automatiquement (lire `.value`, écrire `.target`). */
    spring: (initial, options) => autoUpdate(createSpring(initial, options)),
    /** Ressort 3D mis à jour automatiquement. */
    spring3: (initial, options) => autoUpdate(createSpring3(initial, options)),

    ...procedural,
    ...juice,

    shake: cameraFx.shake,
    punchFov: cameraFx.punchFov,
    setFovOffset: cameraFx.setFovOffset,
    hitStop: cameraFx.hitStop,
    slowMotion: cameraFx.slowMotion,

    /** Contrôleur d'`AnimationMixer` pour un modèle animé : `controller(model, gltf.animations)`. */
    controller(root, clips, options) {
      const controller = createAnimationController(game, root, clips, options)
      controllers.add(controller)
      return controller
    },

    dispose() {
      tweens.stopAll()
      cameraFx.dispose()
      for (const controller of controllers) controller.dispose()
      controllers.clear()
    },
  }
}
