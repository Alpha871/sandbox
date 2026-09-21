import * as THREE from "three"

const _raycaster = new THREE.Raycaster()
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const _ndc = new THREE.Vector2()

/**
 * Point où le pointeur touche le plan horizontal `y = planeY` (sol, table de
 * jeu). Sert à viser à la souris ou à placer un objet. Renvoie `null` si le
 * rayon est parallèle au plan ou le coupe derrière la caméra.
 *
 * @param {object} game
 * @param {{ pointer: { ndc: { x: number, y: number } } }} input
 * @param {number} [planeY]
 * @param {THREE.Vector3} [target] Vecteur réutilisé, pour éviter une allocation par frame.
 */
export function pointerOnPlane(game, input, planeY = 0, target = new THREE.Vector3()) {
  _ndc.set(input.pointer.ndc.x, input.pointer.ndc.y)
  _raycaster.setFromCamera(_ndc, game.camera)
  _plane.constant = -planeY
  return _raycaster.ray.intersectPlane(_plane, target)
}

/**
 * Sélection à la souris ou au doigt : survol et clic sur des objets 3D.
 *
 * `objects` est une liste, ou une fonction qui la renvoie (utile quand les
 * objets changent : `() => enemies`). Le rayon traverse les enfants ; `hit.target`
 * est l'objet *de la liste* touché (même si c'est un de ses enfants qui l'est)
 * et `hit.point` le point d'impact. Un clic est un appui suivi d'un relâchement
 * presque au même endroit : glisser pour tourner la caméra n'en déclenche pas.
 *
 * @param {object} game
 * @param {object} options
 * @param {THREE.Object3D[] | (() => THREE.Object3D[])} options.objects
 * @param {(hit: { target: THREE.Object3D, point: THREE.Vector3, distance: number, object: THREE.Object3D } , event: PointerEvent) => void} [options.onClick]
 * @param {(hit: object | null, previous: THREE.Object3D | null) => void} [options.onHover]
 * @param {boolean} [options.pointerCursor] Curseur « main » au survol (défaut : true).
 * @param {number} [options.clickTolerance] Déplacement max en pixels pour un clic.
 */
export function createPicker(
  game,
  { objects, onClick, onHover, pointerCursor = true, clickTolerance = 6 },
) {
  const canvas = game.canvas
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  let hovered = null
  let downAt = null
  let hoverDirty = false
  let lastEvent = null

  const list = () => (typeof objects === "function" ? objects() : objects)

  function pick(event) {
    const rect = canvas.getBoundingClientRect()
    ndc.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(ndc, game.camera)
    const targets = list()
    const hit = raycaster.intersectObjects(targets, true)[0]
    if (!hit) return null
    let target = hit.object
    while (target && !targets.includes(target)) target = target.parent
    return { ...hit, target: target ?? hit.object }
  }

  const onPointerMove = (event) => {
    lastEvent = event
    hoverDirty = true
  }
  const onPointerDown = (event) => {
    downAt = { x: event.clientX, y: event.clientY }
  }
  const onPointerUp = (event) => {
    if (!downAt) return
    const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y)
    downAt = null
    if (moved > clickTolerance) return
    const hit = pick(event)
    if (hit) onClick?.(hit, event)
  }

  canvas.addEventListener("pointermove", onPointerMove)
  canvas.addEventListener("pointerdown", onPointerDown)
  canvas.addEventListener("pointerup", onPointerUp)

  // Le survol est évalué une fois par frame, pas à chaque évènement souris.
  const offUpdate = game.onUpdate(() => {
    if (!hoverDirty || !lastEvent) return
    hoverDirty = false
    const hit = pick(lastEvent)
    const target = hit?.target ?? null
    if (target !== hovered) {
      const previous = hovered
      hovered = target
      if (pointerCursor) canvas.style.cursor = target ? "pointer" : ""
      onHover?.(hit, previous)
    }
  })

  return {
    /** Objet actuellement survolé, ou `null`. */
    get hovered() {
      return hovered
    },
    dispose() {
      offUpdate()
      canvas.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("pointerup", onPointerUp)
      canvas.style.cursor = ""
    },
  }
}
