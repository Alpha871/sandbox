import * as THREE from "three"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js"

import { setShadows } from "./shapes.js"

/**
 * Met un modèle importé aux conventions du moteur : mis à l'échelle, posé sur
 * le sol (`y = 0` sous ses pieds) et centré en X/Z. Renvoie un **groupe
 * enveloppe** : c'est lui qu'on positionne, oriente et anime ; le modèle
 * d'origine (et ses `animations`) reste à l'intérieur.
 *
 * Un modèle qui ne regarde pas vers +Z se corrige avec `rotationY` (radians).
 *
 * @param {THREE.Object3D} object
 * @param {object} [options]
 * @param {number} [options.height] Hauteur voulue en mètres (prioritaire).
 * @param {number} [options.size] Plus grande dimension voulue en mètres.
 * @param {number} [options.scale] Échelle explicite (si ni `height` ni `size`).
 * @param {"bottom"|"center"|"none"} [options.align] Où placer l'origine (défaut : `"bottom"`).
 * @param {number} [options.rotationY] Rotation corrective autour de Y.
 */
export function normalizeModel(object, { height, size, scale, align = "bottom", rotationY = 0 } = {}) {
  const wrapper = new THREE.Group()
  wrapper.name = object.name ? `${object.name}-root` : "model"
  wrapper.add(object)
  object.rotation.y += rotationY
  object.updateMatrixWorld(true)

  const box = new THREE.Box3().setFromObject(object)
  const dims = box.getSize(new THREE.Vector3())
  let factor = scale ?? 1
  if (height && dims.y > 0) factor = height / dims.y
  else if (size && Math.max(dims.x, dims.y, dims.z) > 0) factor = size / Math.max(dims.x, dims.y, dims.z)
  object.scale.multiplyScalar(factor)
  object.updateMatrixWorld(true)

  if (align !== "none") {
    const scaled = new THREE.Box3().setFromObject(object)
    const center = scaled.getCenter(new THREE.Vector3())
    object.position.x -= center.x
    object.position.z -= center.z
    object.position.y -= align === "bottom" ? scaled.min.y : center.y
  }
  wrapper.animations = object.animations ?? []
  return wrapper
}

/**
 * Gestionnaire d'assets : charge des modèles GLTF/GLB et des textures
 * en parallèle, avec progression, puis en fournit des copies.
 *
 * Les fichiers se chargent depuis le dossier du jeu (chemins relatifs :
 * `./models/hero.glb`). Les GLB compressés (Draco, KTX2) ne sont pas
 * supportés ici : exporter sans compression.
 *
 * @example
 * const assets = createAssets({ onProgress: (p) => bar.set(p * 100) })
 * await assets.load({
 *   models: { hero: "./models/hero.glb" },
 *   textures: { brick: "./textures/brick.png" },
 * })
 * const hero = assets.model("hero", { height: 1.8 })
 * const mixer = anim.controller(hero, hero.animations)
 *
 * @param {{ onProgress?: (progress: number, url: string) => void }} [options]
 */
export function createAssets({ onProgress } = {}) {
  const manager = new THREE.LoadingManager()
  manager.onProgress = (url, loaded, total) => onProgress?.(total > 0 ? loaded / total : 1, url)

  const gltfLoader = new GLTFLoader(manager)
  const textureLoader = new THREE.TextureLoader(manager)
  /** @type {Map<string, import("three/addons/loaders/GLTFLoader.js").GLTF>} */
  const gltfs = new Map()
  /** @type {Map<string, THREE.Texture>} */
  const textures = new Map()

  const describe = (kind, name, url, error) =>
    new Error(`Failed to load ${kind} "${name}" from ${url}: ${error?.message ?? error}`)

  const assets = {
    /** Charge tout en parallèle ; rejette avec le nom et l'URL du premier fichier en échec. */
    async load({ models = {}, textures: textureUrls = {} } = {}) {
      await Promise.all([
        ...Object.entries(models).map(async ([name, url]) => {
          try {
            gltfs.set(name, await gltfLoader.loadAsync(url))
          } catch (error) {
            throw describe("model", name, url, error)
          }
        }),
        ...Object.entries(textureUrls).map(async ([name, url]) => {
          try {
            const texture = await textureLoader.loadAsync(url)
            texture.colorSpace = THREE.SRGBColorSpace
            textures.set(name, texture)
          } catch (error) {
            throw describe("texture", name, url, error)
          }
        }),
      ])
      return assets
    },

    has: (name) => gltfs.has(name) || textures.has(name),

    /**
     * Nouvelle copie d'un modèle chargé, prête à l'emploi (ombres actives,
     * mise à l'échelle et posée au sol selon `options`, voir `normalizeModel`).
     * Les squelettes sont clonés correctement : plusieurs copies animées indépendamment.
     * `copy.animations` contient les clips, à donner à `animator.controller`.
     */
    model(name, options = {}) {
      const gltf = gltfs.get(name)
      if (!gltf) {
        throw new Error(`Model "${name}" not loaded. Loaded: ${[...gltfs.keys()].join(", ") || "(none)"}`)
      }
      const clone = SkeletonUtils.clone(gltf.scene)
      clone.animations = gltf.animations
      setShadows(clone)
      return normalizeModel(clone, options)
    },

    /** Clips d'animation d'un modèle chargé. */
    animations(name) {
      const gltf = gltfs.get(name)
      if (!gltf) throw new Error(`Model "${name}" not loaded`)
      return gltf.animations
    },

    /**
     * Texture chargée. Avec des options, on obtient une copie réglée (le
     * `repeat` d'un sol n'affecte ainsi pas la même image utilisée ailleurs).
     * @param {{ repeat?: [number, number], pixelated?: boolean }} [options]
     */
    texture(name, { repeat, pixelated = false } = {}) {
      const base = textures.get(name)
      if (!base) {
        throw new Error(`Texture "${name}" not loaded. Loaded: ${[...textures.keys()].join(", ") || "(none)"}`)
      }
      if (!repeat && !pixelated) return base
      const texture = base.clone()
      if (repeat) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping
        texture.repeat.set(...repeat)
      }
      if (pixelated) texture.magFilter = texture.minFilter = THREE.NearestFilter
      texture.needsUpdate = true
      return texture
    },

    dispose() {
      for (const texture of textures.values()) texture.dispose()
      textures.clear()
      gltfs.clear()
    },
  }
  return assets
}
