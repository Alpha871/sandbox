import * as THREE from "three"

/**
 * Couleurs nommées : partout où une couleur est attendue, on peut écrire
 * `"orange"`, `"#ea580c"`, `0xea580c` ou une `THREE.Color`. `orange` est celui
 * du logo. Tons volontairement un peu saturés, pour un rendu lisible et
 * plaisant sous un éclairage de jeu.
 */
export const palette = {
  orange: 0xea580c,
  amber: 0xf59e0b,
  yellow: 0xfacc15,
  lime: 0x84cc16,
  green: 0x22c55e,
  grass: 0x5fae4a,
  forest: 0x2f7d3a,
  teal: 0x14b8a6,
  cyan: 0x22d3ee,
  sky: 0x60a5fa,
  blue: 0x3b82f6,
  navy: 0x1e3a8a,
  purple: 0x8b5cf6,
  pink: 0xf472b6,
  red: 0xef4444,
  crimson: 0xb91c1c,
  white: 0xf8fafc,
  cream: 0xfef3c7,
  silver: 0xcbd5e1,
  gray: 0x94a3b8,
  stone: 0x8b8f98,
  dark: 0x334155,
  black: 0x0f172a,
  brown: 0x92400e,
  wood: 0xa16207,
  sand: 0xe4c98f,
  gold: 0xfbbf24,
  skin: 0xf1c27d,
  skinDark: 0x8d5524,
  water: 0x38bdf8,
}

/** Nom, hexadécimal, chaîne CSS ou `Color` → `THREE.Color` (nouvelle instance). */
export function toColor(value) {
  if (value?.isColor) return value.clone()
  if (typeof value === "string" && value in palette) return new THREE.Color(palette[value])

  const color = new THREE.Color(value)
  // Three.js ne lève rien pour une couleur inconnue : il avertit et laisse la
  // couleur de départ (blanc), donc un objet blanc sans explication. Pour
  // détecter ce cas, on applique la chaîne sur une base noire et sur une base
  // blanche : si le résultat dépend de la base, la chaîne n'a pas été comprise.
  if (typeof value === "string") {
    const onBlack = new THREE.Color(0x000000).set(value).getHex()
    const onWhite = new THREE.Color(0xffffff).set(value).getHex()
    if (onBlack !== onWhite) {
      throw new Error(
        `Unknown color "${value}". Use a palette name (${Object.keys(palette).join(", ")}), a CSS color ("#ea580c", "hotpink") or a number (0xea580c).`,
      )
    }
  }
  return color
}

/** Éclaircit (`amount` > 0) ou assombrit (`amount` < 0) une couleur : `shade("orange", -0.25)`. */
export function shade(value, amount) {
  const color = toColor(value)
  return amount >= 0
    ? color.lerp(new THREE.Color(0xffffff), amount)
    : color.lerp(new THREE.Color(0x000000), -amount)
}

const cache = new Map()

/**
 * Matériau d'un rendu low-poly cohérent, **mis en cache** : deux appels
 * identiques renvoient le même objet, ce qui limite les changements d'état du
 * GPU. Ne pas modifier un matériau obtenu ici (le cache est partagé) : pour un
 * clignotement ou un fondu sur un objet, `hitFlash` / `fadeTo` clonent d'eux-mêmes.
 *
 * @param {string|number|THREE.Color} color
 * @param {object} [options]
 * @param {number} [options.roughness] 0 = miroir, 1 = mat (défaut : 0.75).
 * @param {number} [options.metalness]
 * @param {string|number} [options.emissive] Couleur émissive (ça brille, surtout avec le bloom).
 * @param {number} [options.emissiveIntensity]
 * @param {boolean} [options.flat] Facettes visibles, look low-poly (défaut : true).
 * @param {boolean} [options.unlit] Ignore la lumière (MeshBasicMaterial) : UI 3D, lumières, néons.
 * @param {number} [options.opacity] < 1 : matériau transparent.
 * @param {boolean} [options.doubleSided]
 * @param {boolean} [options.vertexColors]
 */
export function mat(color = "white", options = {}) {
  const {
    roughness = 0.75,
    metalness = 0,
    emissive = null,
    emissiveIntensity = 1,
    flat = true,
    unlit = false,
    opacity = 1,
    doubleSided = false,
    vertexColors = false,
  } = options

  const base = toColor(color)
  const emissiveColor = emissive === null ? null : toColor(emissive)
  const key = [
    base.getHexString(),
    roughness,
    metalness,
    emissiveColor?.getHexString() ?? "-",
    emissiveIntensity,
    flat,
    unlit,
    opacity,
    doubleSided,
    vertexColors,
  ].join("|")

  let material = cache.get(key)
  if (material) return material

  const common = {
    color: vertexColors ? 0xffffff : base,
    transparent: opacity < 1,
    opacity,
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    vertexColors,
  }
  material = unlit
    ? new THREE.MeshBasicMaterial(common)
    : new THREE.MeshStandardMaterial({
        ...common,
        roughness,
        metalness,
        flatShading: flat,
        emissive: emissiveColor ?? 0x000000,
        emissiveIntensity,
      })
  cache.set(key, material)
  return material
}

/** Vide le cache (et libère les matériaux) : au changement de niveau, pas à chaque frame. */
export function clearMaterialCache() {
  for (const material of cache.values()) material.dispose()
  cache.clear()
}
