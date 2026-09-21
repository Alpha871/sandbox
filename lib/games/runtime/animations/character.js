import * as THREE from "three"

/**
 * Trouve un clip par nom, en tolérant les conventions des exporteurs :
 * exact, sans casse, préfixe d'armature (`"Armature|Walk"` ← `"Walk"`),
 * puis contenu (`"Run"` ← `"Running_Fast"`). Renvoie `undefined` sinon.
 */
export function findClip(clips, name) {
  const wanted = name.toLowerCase()
  const short = (clip) => clip.name.toLowerCase().split("|").pop()
  return (
    clips.find((clip) => clip.name === name) ??
    clips.find((clip) => clip.name.toLowerCase() === wanted) ??
    clips.find((clip) => short(clip) === wanted) ??
    clips.find((clip) => short(clip).includes(wanted))
  )
}

/**
 * Contrôleur d'animation d'un modèle animé (skinné, GLTF) : joue des clips par
 * nom avec fondu enchaîné, sur `AnimationMixer`. Avance avec le temps de jeu.
 *
 * @param {object} game
 * @param {THREE.Object3D} root Le modèle (`gltf.scene`, ou `model.object`).
 * @param {THREE.AnimationClip[]} clips Les clips (`gltf.animations`).
 * @param {{ fade?: number }} [options] `fade` : durée par défaut du fondu, en secondes.
 *
 * @example
 * const anim = createAnimationController(game, model, gltf.animations)
 * anim.play("Idle")
 * anim.playOnce("Attack", { then: "Idle" })
 */
export function createAnimationController(game, root, clips, { fade = 0.25 } = {}) {
  const mixer = new THREE.AnimationMixer(root)
  /** @type {Map<string, THREE.AnimationAction>} */
  const actions = new Map()
  let current = null
  let currentName = null

  const off = game.onUpdate((dt) => mixer.update(dt))

  function actionFor(name) {
    if (actions.has(name)) return actions.get(name)
    const clip = findClip(clips, name)
    if (!clip) return null
    const action = mixer.clipAction(clip)
    actions.set(name, action)
    return action
  }

  function getAction(name) {
    const action = actionFor(name)
    if (!action) {
      const available = clips.map((clip) => clip.name).join(", ") || "(no clips)"
      throw new Error(`Animation "${name}" not found. Available: ${available}`)
    }
    return action
  }

  const controller = {
    mixer,
    /** Noms des clips disponibles. */
    get names() {
      return clips.map((clip) => clip.name)
    },
    /** Nom de l'animation en cours. */
    get current() {
      return currentName
    },
    has: (name) => Boolean(findClip(clips, name)),

    /**
     * Joue `name` en boucle, en fondu depuis l'animation précédente. Sans effet
     * si elle joue déjà : on peut donc l'appeler à chaque frame.
     * @param {{ fade?: number, timeScale?: number, loop?: boolean }} [options]
     */
    play(name, { fade: duration = fade, timeScale = 1, loop = true } = {}) {
      const next = getAction(name)
      if (next === current && next.isRunning()) {
        next.timeScale = timeScale
        return next
      }
      next.reset()
      next.enabled = true
      next.timeScale = timeScale
      next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
      next.clampWhenFinished = !loop
      next.setEffectiveWeight(1)
      if (current && current !== next) current.crossFadeTo(next, duration, false)
      else next.fadeIn(duration)
      next.play()
      current = next
      currentName = name
      return next
    },

    /**
     * Joue `name` une seule fois (attaque, saut, réaction), puis revient à
     * `then` (par défaut l'animation qui jouait avant). La promesse se résout
     * à la fin du clip.
     * @param {{ fade?: number, then?: string, timeScale?: number }} [options]
     */
    playOnce(name, { fade: duration = fade, then, timeScale = 1 } = {}) {
      const before = then ?? currentName
      const action = controller.play(name, { fade: duration, timeScale, loop: false })
      return new Promise((resolve) => {
        const onFinished = (event) => {
          if (event.action !== action) return
          mixer.removeEventListener("finished", onFinished)
          // Si le jeu a demandé autre chose entre-temps, on ne l'écrase pas.
          if (before && currentName === name) controller.play(before, { fade: duration })
          resolve()
        }
        mixer.addEventListener("finished", onFinished)
      })
    },

    /** Vitesse de lecture globale (1 = normal) : accélère ou ralentit toutes les animations. */
    setTimeScale(scale) {
      mixer.timeScale = scale
    },
    stop() {
      mixer.stopAllAction()
      current = null
      currentName = null
    },
    dispose() {
      off()
      mixer.stopAllAction()
      mixer.uncacheRoot(root)
    },

    /**
     * Fusionne idle / marche / course selon la vitesse : à brancher sur
     * `controller.speed` d'un contrôleur de déplacement. Les trois clips jouent
     * en permanence avec un poids qui suit la vitesse, et la cadence de pas est
     * ajustée pour que les pieds ne glissent pas.
     *
     * @param {{ idle?: string, walk?: string, run?: string, walkSpeed?: number, runSpeed?: number }} [names]
     * @returns {{ setSpeed(speed: number, dt?: number): void }}
     */
    locomotion({ idle = "Idle", walk = "Walk", run = "Run", walkSpeed = 2, runSpeed = 6 } = {}) {
      const idleAction = getAction(idle)
      const walkAction = actionFor(walk)
      const runAction = actionFor(run)
      const layers = [idleAction, walkAction, runAction].filter(Boolean)
      for (const action of layers) {
        action.reset()
        action.setEffectiveWeight(0)
        action.play()
      }
      idleAction.setEffectiveWeight(1)
      currentName = idle
      current = idleAction

      const weights = { idle: 1, walk: 0, run: 0 }

      return {
        setSpeed(speed, dt = game.time.delta) {
          const target = { idle: 0, walk: 0, run: 0 }
          if (!walkAction || speed <= 0.1) {
            target.idle = 1
          } else if (!runAction || speed <= walkSpeed) {
            const t = Math.min(1, speed / walkSpeed)
            target.idle = 1 - t
            target.walk = t
          } else {
            const t = Math.min(1, (speed - walkSpeed) / Math.max(0.001, runSpeed - walkSpeed))
            target.walk = 1 - t
            target.run = t
          }
          // Les poids glissent vers leur cible : pas de saut brutal entre deux clips.
          const k = 1 - Math.exp(-12 * dt)
          for (const key of ["idle", "walk", "run"]) weights[key] += (target[key] - weights[key]) * k
          idleAction.setEffectiveWeight(weights.idle)
          walkAction?.setEffectiveWeight(weights.walk)
          runAction?.setEffectiveWeight(weights.run)
          if (walkAction) walkAction.timeScale = Math.max(0.5, speed / walkSpeed)
          if (runAction) runAction.timeScale = Math.max(0.5, speed / runSpeed)
        },
      }
    },
  }

  return controller
}
