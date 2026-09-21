import * as THREE from "three"

import { resolveEase } from "./easing.js"

/**
 * Parcourt `props` et fabrique une piste d'interpolation par valeur.
 * - nombre → interpolé ;
 * - objet imbriqué (`position: { y: 3 }`) → parcouru récursivement ;
 * - nombre donné à un Vector3 (`scale: 2`) → appliqué aux trois axes ;
 * - couleur (`color: 0xff0000`, `"#f00"`, `Color`) sur une `THREE.Color` → mélangée.
 * Les valeurs de départ sont lues au démarrage effectif (après `delay`), pas à
 * la création : des tweens enchaînés partent de la valeur réellement atteinte.
 */
function buildTracks(target, props, tracks = []) {
  for (const [key, value] of Object.entries(props)) {
    const current = target[key]

    if (current?.isColor) {
      tracks.push({ color: current, to: new THREE.Color(value), from: new THREE.Color() })
    } else if (current?.isVector3 && typeof value === "number") {
      buildTracks(current, { x: value, y: value, z: value }, tracks)
    } else if (value !== null && typeof value === "object" && current && typeof current === "object") {
      buildTracks(current, value, tracks)
    } else if (typeof value === "number" && typeof current === "number") {
      tracks.push({ object: target, key, to: value, from: 0 })
    } else {
      // Typiquement une faute de frappe (`opacty`) : sans ça, on animerait vers NaN sans un mot.
      throw new Error(
        `tween: cannot animate "${key}" from ${current === undefined ? "undefined (no such property)" : typeof current} to ${typeof value}`,
      )
    }
  }
  return tracks
}

/**
 * Gestionnaire de tweens : anime des propriétés dans le temps, avec easing.
 * Avance avec le temps de jeu (figé en pause) ; `realTime: true` pour une
 * animation d'interface qui doit continuer en pause.
 *
 * @example
 * tweens.to(door.rotation, { y: Math.PI / 2 }, { duration: 1, ease: "inOutCubic" })
 * tweens.to(mesh, { position: { y: 3 }, scale: 1.5 }, { duration: 0.4, ease: "outBack" })
 * await tweens.to(light, { intensity: 0 }, { duration: 2 }).finished
 */
export function createTweens(game) {
  /** @type {Set<object>} */
  const active = new Set()

  function finish(tween, completed) {
    if (!active.delete(tween)) return
    tween.resolve(completed)
    if (completed) tween.onComplete?.(tween.root)
  }

  function apply(tween, progress) {
    for (const track of tween.tracks) {
      if (track.color) track.color.copy(track.from).lerp(track.to, progress)
      else track.object[track.key] = track.from + (track.to - track.from) * progress
    }
    tween.onUpdate?.(progress, tween.root)
  }

  const tick = (dt) => {
    for (const tween of [...active]) {
      const step = tween.realTime ? game.time.realDelta : dt
      if (step <= 0) continue

      // Le dépassement du délai (`delay` devenu négatif) compte déjà comme du temps écoulé.
      let advance = step
      if (tween.delay > 0) {
        tween.delay -= step
        if (tween.delay > 0) continue
        advance = -tween.delay
        tween.delay = 0
      }
      if (!tween.started) {
        tween.started = true
        try {
          tween.tracks = buildTracks(tween.root, tween.props)
        } catch (error) {
          // Sans ça, le tween resterait actif et relancerait l'erreur à chaque frame.
          finish(tween, false)
          throw error
        }
        for (const track of tween.tracks) {
          if (track.color) track.from.copy(track.color)
          else track.from = track.object[track.key]
        }
      }

      tween.time += advance
      while (tween.time >= tween.duration) {
        const canRepeat = tween.loop === true || tween.iteration < tween.loop
        if (!canRepeat || tween.duration === 0) {
          const endProgress = tween.yoyo && tween.iteration % 2 === 1 ? 0 : 1
          apply(tween, endProgress)
          finish(tween, true)
          break
        }
        tween.iteration++
        tween.time -= tween.duration
      }
      if (!active.has(tween)) continue

      const t = tween.time / tween.duration
      const eased = tween.ease(t)
      const reversed = tween.yoyo && tween.iteration % 2 === 1
      apply(tween, reversed ? 1 - eased : eased)
    }
  }
  game.onUpdate(tick)

  function create(root, props, options = {}) {
    const {
      duration = 0.5,
      delay = 0,
      ease,
      loop = false,
      yoyo = false,
      realTime = false,
      onUpdate,
      onComplete,
    } = options

    const tween = {
      root,
      props,
      duration,
      delay,
      ease: resolveEase(ease),
      // `loop: 2` = deux répétitions après la première lecture ; `true` = sans fin.
      loop: loop === false ? 0 : loop,
      yoyo,
      realTime,
      onUpdate,
      onComplete,
      tracks: [],
      started: false,
      time: 0,
      iteration: 0,
      resolve: () => {},
    }
    const finished = new Promise((resolve) => (tween.resolve = resolve))
    active.add(tween)

    return {
      /** Promesse : `true` si terminé, `false` si arrêté avant. */
      finished,
      get running() {
        return active.has(tween)
      },
      /** Arrête le tween ; `complete: true` saute à la valeur finale. */
      stop({ complete = false } = {}) {
        if (!active.has(tween)) return
        if (complete && tween.started) apply(tween, 1)
        finish(tween, complete)
      },
    }
  }

  const tweens = {
    /** Anime `target` vers les valeurs de `props`. */
    to: (target, props, options) => create(target, props, options),

    /** Anime `target` depuis `props` vers ses valeurs actuelles. */
    from(target, props, options) {
      const final = {}
      const start = {}
      const collect = (source, targetObject, finalOut, startOut) => {
        for (const [key, value] of Object.entries(source)) {
          const current = targetObject[key]
          if (typeof value === "number" && typeof current === "number") {
            finalOut[key] = current
            startOut[key] = value
          } else if (typeof value === "number" && current?.isVector3) {
            finalOut[key] = { x: current.x, y: current.y, z: current.z }
            startOut[key] = { x: value, y: value, z: value }
          } else if (value && typeof value === "object" && current) {
            finalOut[key] = {}
            startOut[key] = {}
            collect(value, current, finalOut[key], startOut[key])
          }
        }
      }
      collect(props, target, final, start)
      // Place la cible au départ, puis anime vers l'état d'origine.
      const place = (source, object) => {
        for (const [key, value] of Object.entries(source)) {
          if (typeof value === "number") object[key] = value
          else place(value, object[key])
        }
      }
      place(start, target)
      return create(target, final, options)
    },

    /**
     * Interpole un nombre : `tweens.value(0, 100, (v) => bar.set(v), { duration: 1 })`.
     * Pratique pour faire défiler un score ou animer autre chose qu'une propriété.
     */
    value(from, to, onValue, options) {
      const holder = { v: from }
      onValue(from)
      return create(holder, { v: to }, { ...options, onUpdate: () => onValue(holder.v) })
    },

    /** Attend `seconds` (temps de jeu) : `await tweens.wait(1).finished`. */
    wait: (seconds, options) => create({ t: 0 }, { t: 1 }, { ...options, duration: seconds, ease: "linear" }),

    /**
     * Enchaîne des étapes. Chaque étape est une fonction qui renvoie un tween,
     * une promesse ou rien ; on attend sa fin avant la suivante.
     *
     * @example
     * tweens.sequence([
     *   () => tweens.to(door.rotation, { y: 1.5 }, { duration: 1 }),
     *   () => tweens.wait(0.5),
     *   () => hud.toast("Ouvert !"),
     * ])
     */
    sequence(steps) {
      let stopped = false
      let current = null
      const finished = (async () => {
        for (const step of steps) {
          if (stopped) return false
          current = step()
          if (current?.finished) await current.finished
          else if (current?.then) await current
        }
        return !stopped
      })()
      return {
        finished,
        stop() {
          stopped = true
          current?.stop?.()
        },
      }
    },

    /** Promesse qui attend la fin de tous les tweens donnés. */
    all: (...handles) => Promise.all(handles.map((handle) => handle.finished)),

    /** Arrête tous les tweens en cours sur `target` (ou en dessous : `mesh` couvre `mesh.position`). */
    killTweensOf(target) {
      const owned = new Set()
      target.traverse?.((child) => owned.add(child))
      owned.add(target)
      for (const key of ["position", "rotation", "scale", "quaternion", "material"]) {
        if (target[key]) owned.add(target[key])
      }
      for (const tween of [...active]) {
        if (owned.has(tween.root)) finish(tween, false)
      }
    },
    stopAll() {
      for (const tween of [...active]) finish(tween, false)
    },
    get count() {
      return active.size
    },
  }

  return tweens
}
