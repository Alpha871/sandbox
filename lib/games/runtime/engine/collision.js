import * as THREE from "three"

const _box = new THREE.Box3()
const _center = new THREE.Vector3()
const _size = new THREE.Vector3()
const _raycaster = new THREE.Raycaster()
const _ndc = new THREE.Vector2()

/** Boîte englobante monde d'un objet (recalculée à chaque appel). */
export function boxOf(object, target = new THREE.Box3()) {
  return target.setFromObject(object)
}

/** Boîte centrée sur `center` ; `size` est `[largeur, hauteur, profondeur]`. */
export function boxAt(center, size, target = new THREE.Box3()) {
  _size.set(...size)
  return target.setFromCenterAndSize(center, _size)
}

export function boxesOverlap(a, b) {
  return a.intersectsBox(b)
}

/** Deux sphères (ou cercles, si les Y sont égaux) se touchent-elles ? */
export function spheresOverlap(centerA, radiusA, centerB, radiusB) {
  const r = radiusA + radiusB
  return centerA.distanceToSquared(centerB) <= r * r
}

/** Distance dans le plan XZ, en ignorant la hauteur (jeux vus de dessus). */
export function distanceXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/** Deux objets se touchent-ils (boîtes englobantes) ? */
export function objectsOverlap(a, b) {
  return boxOf(a).intersectsBox(_box.setFromObject(b))
}

/** Rayon de `origin` vers `direction` ; renvoie l'impact le plus proche ou `null`. */
export function raycast(origin, direction, targets, maxDistance = Infinity) {
  _raycaster.set(origin, direction.clone().normalize())
  _raycaster.far = maxDistance
  const list = Array.isArray(targets) ? targets : [targets]
  return _raycaster.intersectObjects(list, true)[0] ?? null
}

/**
 * Rayon depuis la caméra vers un point d'écran (souris, tap, réticule).
 * `x`/`y` en pixels dans le canvas ; sans eux, vise le centre de l'écran.
 */
export function raycastFromCamera(game, targets, x, y) {
  const rect = game.canvas.getBoundingClientRect()
  const px = x ?? rect.left + rect.width / 2
  const py = y ?? rect.top + rect.height / 2
  _ndc.set(
    ((px - rect.left) / rect.width) * 2 - 1,
    -((py - rect.top) / rect.height) * 2 + 1,
  )
  _raycaster.setFromCamera(_ndc, game.camera)
  _raycaster.far = Infinity
  const list = Array.isArray(targets) ? targets : [targets]
  return _raycaster.intersectObjects(list, true)[0] ?? null
}

/** Centre d'un objet dans le monde (vecteur partagé : à copier si conservé). */
export function centerOf(object) {
  return _box.setFromObject(object).getCenter(_center)
}
