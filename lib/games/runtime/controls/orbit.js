import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"

/**
 * Caméra libre autour d'un point (jeux de plateau, stratégie, puzzles 3D,
 * visionneuse). Glisser = tourner, molette = zoom, clic droit = déplacer
 * (si `pan`). Amortie, et empêchée de passer sous le sol par défaut.
 *
 * `controls.target` est le point regardé : le modifier pour suivre un objet.
 *
 * @param {object} game
 * @param {object} [options]
 * @param {THREE.Vector3 | [number, number, number]} [options.target]
 * @param {number} [options.distance] Distance initiale caméra-cible.
 * @param {number} [options.minDistance]
 * @param {number} [options.maxDistance]
 * @param {number} [options.maxPolarAngle] Angle max depuis la verticale (π/2 = horizon, jamais sous le sol).
 * @param {boolean} [options.pan] Autorise le déplacement latéral.
 * @param {boolean} [options.autoRotate] Rotation automatique (écran titre, vitrine).
 * @param {number} [options.autoRotateSpeed]
 */
export function createOrbitCamera(
  game,
  {
    target = [0, 0, 0],
    distance = 12,
    minDistance = 3,
    maxDistance = 60,
    maxPolarAngle = Math.PI / 2 - 0.05,
    pan = false,
    autoRotate = false,
    autoRotateSpeed = 1.5,
  } = {},
) {
  const controls = new OrbitControls(game.camera, game.canvas)
  controls.target.set(...(Array.isArray(target) ? target : target.toArray()))
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = pan
  controls.minDistance = minDistance
  controls.maxDistance = maxDistance
  controls.maxPolarAngle = maxPolarAngle
  controls.autoRotate = autoRotate
  controls.autoRotateSpeed = autoRotateSpeed

  // Place la caméra à `distance` de la cible, en gardant sa direction actuelle.
  const offset = new THREE.Vector3().subVectors(game.camera.position, controls.target)
  if (offset.lengthSq() < 1e-6) offset.set(0, 0.6, 1)
  game.camera.position.copy(controls.target).addScaledVector(offset.normalize(), distance)
  controls.update()

  // `update` est requis à chaque frame pour l'amortissement et l'auto-rotation.
  const off = game.onLateUpdate(() => controls.update())

  return {
    controls,
    get target() {
      return controls.target
    },
    set enabled(value) {
      controls.enabled = value
    },
    get enabled() {
      return controls.enabled
    },
    dispose() {
      off()
      controls.dispose()
    },
  }
}
