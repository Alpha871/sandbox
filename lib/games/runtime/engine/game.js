import * as THREE from "three"

import { createEvents } from "./events.js"
import { createPostFx } from "./postfx.js"

const MAX_FRAME_DELTA = 0.1
const MAX_FIXED_STEPS = 5

/**
 * Crée le moteur : renderer, scène, caméra, boucle de jeu et redimensionnement.
 *
 * Boucle : `onUpdate(fn)` reçoit `(dt, game)` à chaque frame (dt en secondes,
 * plafonné à 0.1 s, multiplié par `timeScale`, égal à 0 en pause) ; c'est là
 * qu'on anime et qu'on déplace. `onLateUpdate(fn)` s'exécute juste après tous
 * les `onUpdate` (caméras qui suivent un joueur déjà déplacé) et
 * `onFrameEnd(fn)` en tout dernier, juste avant le rendu (remise à zéro
 * d'évènements). `onFixedUpdate(fn)` reçoit un pas constant
 * (`fixedStep`, 1/60 s par défaut), figé en pause : c'est là que va la
 * physique. Pour une animation qui doit continuer en pause (menu, écran
 * titre), utiliser `game.time.realDelta`.
 *
 * @param {object} [options]
 * @param {HTMLElement} [options.container] Élément qui reçoit le canvas (défaut : `document.body`).
 * @param {number|string} [options.background] Couleur de fond.
 * @param {"perspective"|"orthographic"} [options.camera]
 * @param {number} [options.fov] Champ de vision vertical (perspective).
 * @param {number} [options.orthoSize] Hauteur visible en unités monde (orthographique).
 * @param {number} [options.near]
 * @param {number} [options.far]
 * @param {boolean} [options.antialias]
 * @param {boolean} [options.shadows] Active les ombres (défaut : true).
 * @param {number} [options.maxPixelRatio] Plafond du device pixel ratio (défaut : 2).
 * @param {number} [options.fixedStep] Pas de `onFixedUpdate`, en secondes.
 * @param {number} [options.toneMapping] Défaut : ACESFilmic.
 * @param {number} [options.exposure]
 * @param {false|{ strength?: number, radius?: number, threshold?: number }} [options.bloom]
 * @param {boolean} [options.autoStart] Démarre la boucle tout de suite (défaut : true).
 */
export function createGame(options = {}) {
  const {
    container = document.body,
    background = 0x0b0d12,
    camera: cameraType = "perspective",
    fov = 60,
    orthoSize = 12,
    near = 0.1,
    far = 500,
    antialias = true,
    shadows = true,
    maxPixelRatio = 2,
    fixedStep = 1 / 60,
    toneMapping = THREE.ACESFilmicToneMapping,
    exposure = 1,
    bloom = false,
    autoStart = true,
  } = options

  const renderer = new THREE.WebGLRenderer({
    antialias,
    powerPreference: "high-performance",
  })
  renderer.toneMapping = toneMapping
  renderer.toneMappingExposure = exposure
  renderer.shadowMap.enabled = shadows
  // PCFShadowMap : PCFSoftShadowMap est déprécié depuis three r186.
  renderer.shadowMap.type = THREE.PCFShadowMap

  const canvas = renderer.domElement
  canvas.style.display = "block"
  canvas.style.width = "100%"
  canvas.style.height = "100%"
  canvas.style.touchAction = "none"
  canvas.tabIndex = 0
  canvas.style.outline = "none"
  container.appendChild(canvas)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(background)

  const camera =
    cameraType === "orthographic"
      ? new THREE.OrthographicCamera(-1, 1, 1, -1, near, far)
      : new THREE.PerspectiveCamera(fov, 1, near, far)
  if (cameraType === "perspective") camera.position.set(0, 3, 8)

  const timer = new THREE.Timer()
  timer.connect(document)

  const updates = new Set()
  const lateUpdates = new Set()
  const frameEnds = new Set()
  const fixedUpdates = new Set()
  const reportedErrors = new Set()

  const game = {
    THREE,
    renderer,
    scene,
    camera,
    canvas,
    container,
    events: createEvents(),
    postfx: null,
    /** `delta`/`elapsed` suivent `timeScale` et la pause ; `real*` jamais. */
    time: { delta: 0, elapsed: 0, realDelta: 0, realElapsed: 0, scale: 1, frame: 0 },
    paused: false,
    running: false,
    width: 1,
    height: 1,
    get aspect() {
      return this.width / this.height
    },

    onUpdate(fn) {
      updates.add(fn)
      return () => updates.delete(fn)
    },
    onLateUpdate(fn) {
      lateUpdates.add(fn)
      return () => lateUpdates.delete(fn)
    },
    onFrameEnd(fn) {
      frameEnds.add(fn)
      return () => frameEnds.delete(fn)
    },
    onFixedUpdate(fn) {
      fixedUpdates.add(fn)
      return () => fixedUpdates.delete(fn)
    },
    add(...objects) {
      scene.add(...objects)
      return objects[0]
    },
    remove(...objects) {
      scene.remove(...objects)
    },
    setBackground(color) {
      scene.background = new THREE.Color(color)
    },
    setTimeScale(scale) {
      game.time.scale = Math.max(0, scale)
    },
    pause() {
      game.paused = true
      game.events.emit("pause")
    },
    resume() {
      game.paused = false
      game.events.emit("resume")
    },
    togglePause() {
      game.paused ? game.resume() : game.pause()
    },

    /** Remplace la caméra (ex. une caméra de cinématique). */
    setCamera(nextCamera) {
      game.camera = nextCamera
      game.postfx?.setCamera(nextCamera)
      resize()
    },

    /** Active ou règle le bloom à chaud. */
    setBloom(settings) {
      if (settings === false) {
        game.postfx?.dispose()
        game.postfx = null
        return
      }
      if (!game.postfx) {
        game.postfx = createPostFx(renderer, scene, game.camera, settings)
        return
      }
      Object.assign(game.postfx.bloomPass, settings)
    },

    start() {
      if (game.running) return
      game.running = true
      timer.reset()
      requestAnimationFrame(tick)
    },
    stop() {
      game.running = false
    },
    resize,
    dispose() {
      game.running = false
      resizeObserver.disconnect()
      window.removeEventListener("resize", resize)
      timer.dispose()
      game.postfx?.dispose()
      updates.clear()
      lateUpdates.clear()
      frameEnds.clear()
      fixedUpdates.clear()
      game.events.clear()
      scene.traverse(disposeObject)
      renderer.dispose()
      canvas.remove()
    },
  }

  function resize() {
    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight
    game.width = width
    game.height = height

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio))
    renderer.setSize(width, height, false)
    game.postfx?.setSize(width, height)

    const activeCamera = game.camera
    const aspect = width / height
    if (activeCamera.isPerspectiveCamera) {
      activeCamera.aspect = aspect
    } else if (activeCamera.isOrthographicCamera) {
      activeCamera.left = (-orthoSize * aspect) / 2
      activeCamera.right = (orthoSize * aspect) / 2
      activeCamera.top = orthoSize / 2
      activeCamera.bottom = -orthoSize / 2
    }
    activeCamera.updateProjectionMatrix()
  }

  // Une erreur dans un système ne doit ni figer la boucle ni inonder la
  // console : elle est loguée une seule fois par message.
  function run(fn, ...args) {
    try {
      fn(...args)
    } catch (error) {
      const key = String(error?.stack ?? error)
      if (!reportedErrors.has(key)) {
        reportedErrors.add(key)
        console.error(error)
      }
    }
  }

  let accumulator = 0

  function tick(timestamp) {
    if (!game.running) return
    requestAnimationFrame(tick)

    timer.update(timestamp)
    const realDelta = Math.min(timer.getDelta(), MAX_FRAME_DELTA)
    const delta = game.paused ? 0 : realDelta * game.time.scale

    const { time } = game
    time.realDelta = realDelta
    time.realElapsed += realDelta
    time.delta = delta
    time.elapsed += delta
    time.frame++

    if (!game.paused) {
      accumulator += delta
      for (
        let steps = 0;
        accumulator >= fixedStep && steps < MAX_FIXED_STEPS;
        steps++
      ) {
        for (const fn of fixedUpdates) run(fn, fixedStep, game)
        accumulator -= fixedStep
      }
      // Trop de retard accumulé (onglet ralenti) : on abandonne le reste.
      if (accumulator >= fixedStep) accumulator = 0
    }

    for (const fn of updates) run(fn, delta, game)
    for (const fn of lateUpdates) run(fn, delta, game)
    for (const fn of frameEnds) run(fn, delta, game)

    if (game.postfx) game.postfx.render(realDelta)
    else renderer.render(scene, game.camera)
  }

  if (bloom) game.postfx = createPostFx(renderer, scene, camera, bloom)

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)
  window.addEventListener("resize", resize)
  resize()

  if (autoStart) game.start()
  return game
}

/** Libère la géométrie, les matériaux et les textures d'un objet. */
export function disposeObject(object) {
  object.geometry?.dispose()
  const materials = Array.isArray(object.material)
    ? object.material
    : object.material
      ? [object.material]
      : []
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value?.isTexture) value.dispose()
    }
    material.dispose()
  }
}
