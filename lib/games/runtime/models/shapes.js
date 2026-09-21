import * as THREE from "three"

import { mat } from "./palette.js"

const MATERIAL_KEYS = [
  "roughness",
  "metalness",
  "emissive",
  "emissiveIntensity",
  "flat",
  "unlit",
  "opacity",
  "doubleSided",
  "vertexColors",
]

/**
 * Options communes à toutes les formes :
 * `color` (défaut `"white"`), `position` / `rotation` / `scale` (tableau
 * `[x, y, z]`, `Vector3`, ou un nombre pour `scale`), `castShadow` /
 * `receiveShadow` (vrais par défaut), `name`, `material` (pour en imposer un),
 * plus toutes les options de `mat()` (`metalness`, `emissive`, `opacity`…).
 */
function build(geometry, options = {}) {
  const { color = "white", position, rotation, scale, name, material } = options
  const materialOptions = {}
  for (const key of MATERIAL_KEYS) if (key in options) materialOptions[key] = options[key]

  const mesh = new THREE.Mesh(geometry, material ?? mat(color, materialOptions))
  mesh.castShadow = options.castShadow ?? true
  mesh.receiveShadow = options.receiveShadow ?? true
  if (name) mesh.name = name
  if (position) mesh.position.set(...toArray(position))
  if (rotation) mesh.rotation.set(...toArray(rotation))
  if (scale !== undefined) {
    if (typeof scale === "number") mesh.scale.setScalar(scale)
    else mesh.scale.set(...toArray(scale))
  }
  return mesh
}

const toArray = (value) => (Array.isArray(value) ? value : value.toArray())

/** Parallélépipède centré sur son origine. */
export const box = (width = 1, height = 1, depth = 1, options) =>
  build(new THREE.BoxGeometry(width, height, depth), options)

/** Sphère facettée (16×12 segments : suffisant pour le style low-poly). */
export const sphere = (radius = 0.5, options) =>
  build(new THREE.SphereGeometry(radius, 16, 12), options)

/** Cylindre d'axe Y ; `radiusTop = 0` donne un cône. */
export const cylinder = (radiusTop = 0.5, radiusBottom = 0.5, height = 1, options) =>
  build(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 14), options)

/** Cône d'axe Y, pointe vers le haut. */
export const cone = (radius = 0.5, height = 1, options) =>
  build(new THREE.ConeGeometry(radius, height, 12), options)

/** Capsule d'axe Y ; `length` est la partie droite (hauteur totale = length + 2·radius). */
export const capsule = (radius = 0.3, length = 0.8, options) =>
  build(new THREE.CapsuleGeometry(radius, length, 4, 10), options)

/** Tore couché sur le plan XY (l'axe du trou est Z). */
export const torus = (radius = 0.5, tube = 0.15, options) =>
  build(new THREE.TorusGeometry(radius, tube, 10, 24), options)

/** Rectangle **horizontal**, face visible vers le haut (sol, plateau, eau). */
export function plane(width = 1, depth = 1, options) {
  const geometry = new THREE.PlaneGeometry(width, depth)
  geometry.rotateX(-Math.PI / 2)
  return build(geometry, { receiveShadow: true, castShadow: false, ...options })
}

/** Groupe : `group([a, b, c], { position: [0, 1, 0] })`. */
export function group(children = [], { position, rotation, scale, name } = {}) {
  const node = new THREE.Group()
  // `add()` sans argument fait afficher une erreur à Three.js : on saute le cas vide.
  if (children.length > 0) node.add(...children)
  if (name) node.name = name
  if (position) node.position.set(...toArray(position))
  if (rotation) node.rotation.set(...toArray(rotation))
  if (scale !== undefined) {
    if (typeof scale === "number") node.scale.setScalar(scale)
    else node.scale.set(...toArray(scale))
  }
  return node
}

/** Active ou coupe les ombres de tout un arbre d'objets (par défaut : émet et reçoit). */
export function setShadows(object, { cast = true, receive = true } = {}) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = cast
      child.receiveShadow = receive
    }
  })
  return object
}

/**
 * Mesh à partir de n'importe quelle `BufferGeometry`, avec les mêmes options que
 * les formes ci-dessus : `mesh(new THREE.OctahedronGeometry(0.4), { color: "cyan" })`.
 */
export const mesh = build
