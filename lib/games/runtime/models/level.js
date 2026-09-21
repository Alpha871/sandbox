import * as THREE from "three"

import { mat } from "./palette.js"
import { group, plane } from "./shapes.js"

/**
 * Construit un niveau à partir d'un plan en texte : labyrinthe, donjon,
 * arène, niveau de puzzle. Chaque caractère est une case.
 *
 * - `#` : mur (bloc plein) ; ` ` ou `.` : sol libre ;
 * - tout autre caractère (`S` départ, `E` sortie, `C` pièce, `X` ennemi…) est un
 *   **marqueur** : la case est libre, et sa position est renvoyée dans
 *   `markers` pour y placer ce qu'on veut.
 *
 * Le niveau est centré sur l'origine. Les murs sont *instanciés* (un seul
 * draw call) et leurs collisions fusionnées par rangée (`solids`), à passer
 * à `physics.addSolid`.
 *
 * @example
 * const level = createMaze([
 *   "#########",
 *   "#S..#..E#",
 *   "#.#.#.#.#",
 *   "#.#...#C#",
 *   "#########",
 * ], { cell: 2 })
 * game.add(level.group)
 * level.solids.forEach((solid) => physics.addSolid(solid))
 * player.position.copy(level.markers.S[0])
 *
 * @param {string[] | string} rows Lignes du plan (ou un texte multiligne).
 * @param {object} [options]
 * @param {number} [options.cell] Côté d'une case en mètres.
 * @param {number} [options.wallHeight]
 * @param {string|number} [options.wallColor]
 * @param {string|number} [options.floorColor]
 * @param {boolean} [options.floor] Ajoute le sol (défaut : true).
 */
export function createMaze(rows, { cell = 2, wallHeight = 2.5, wallColor = "stone", floorColor = "dark", floor = true } = {}) {
  const lines = (Array.isArray(rows) ? rows : rows.split("\n")).filter((line, i, all) => !(line.trim() === "" && (i === 0 || i === all.length - 1)))
  const rowCount = lines.length
  const colCount = Math.max(...lines.map((line) => line.length))
  const width = colCount * cell
  const depth = rowCount * cell

  const cellToWorld = (col, row, target = new THREE.Vector3()) =>
    target.set((col + 0.5) * cell - width / 2, 0, (row + 0.5) * cell - depth / 2)
  const worldToCell = (x, z) => ({
    col: Math.floor((x + width / 2) / cell),
    row: Math.floor((z + depth / 2) / cell),
  })
  const charAt = (col, row) => lines[row]?.[col] ?? "#"
  const isWallCell = (col, row) => col < 0 || row < 0 || col >= colCount || row >= rowCount || charAt(col, row) === "#"

  const root = group([], { name: "maze" })
  const markers = {}
  const emptyCells = []
  const solids = []
  const walls = []

  for (let row = 0; row < rowCount; row++) {
    let runStart = -1
    for (let col = 0; col <= colCount; col++) {
      const wall = col < colCount && charAt(col, row) === "#"
      if (wall) {
        walls.push([col, row])
        if (runStart < 0) runStart = col
      } else {
        // Fin d'une suite de murs : une seule boîte de collision pour toute la suite.
        if (runStart >= 0) {
          const from = cellToWorld(runStart, row)
          const to = cellToWorld(col - 1, row)
          solids.push(new THREE.Box3(
            new THREE.Vector3(from.x - cell / 2, 0, from.z - cell / 2),
            new THREE.Vector3(to.x + cell / 2, wallHeight, to.z + cell / 2),
          ))
          runStart = -1
        }
        if (col < colCount) {
          const char = charAt(col, row)
          const position = cellToWorld(col, row)
          emptyCells.push(position)
          if (char !== " " && char !== ".") (markers[char] ??= []).push(position.clone())
        }
      }
    }
  }

  if (walls.length > 0) {
    const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(cell, wallHeight, cell), mat(wallColor), walls.length)
    const matrix = new THREE.Matrix4()
    walls.forEach(([col, row], i) => {
      const p = cellToWorld(col, row)
      instanced.setMatrixAt(i, matrix.makeTranslation(p.x, wallHeight / 2, p.z))
    })
    instanced.instanceMatrix.needsUpdate = true
    instanced.castShadow = true
    instanced.receiveShadow = true
    instanced.name = "walls"
    root.add(instanced)
  }
  if (floor) root.add(plane(width, depth, { color: floorColor, roughness: 1, name: "floor" }))

  return {
    group: root,
    /** Boîtes de collision des murs, à donner à `physics.addSolid`. */
    solids,
    /** Positions (centre de case, y = 0) de chaque caractère spécial : `markers.S[0]`. */
    markers,
    /** Centres de toutes les cases libres (pour semer pièces ou ennemis). */
    emptyCells,
    cell,
    cols: colCount,
    rows: rowCount,
    width,
    depth,
    cellToWorld,
    worldToCell,
    /** Le point monde `(x, z)` est-il dans un mur (ou hors du plan) ? */
    isWall: (x, z) => {
      const { col, row } = worldToCell(x, z)
      return isWallCell(col, row)
    },
  }
}
