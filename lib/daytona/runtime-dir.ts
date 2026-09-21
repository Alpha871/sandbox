import path from "node:path"

/**
 * Segment du chemin du build de `trigger dev` : `<projet>/.trigger/tmp/build-XXXX`.
 */
const TRIGGER_DEV_BUILD_SEGMENT = `${path.sep}.trigger${path.sep}tmp${path.sep}build-`

/**
 * Dossier du kit posé dans chaque nouvelle sandbox (`lib/games/runtime`).
 *
 * En production, `additionalFiles` (trigger.config.ts) conserve le chemin dans
 * le build déployé : `cwd` convient. En développement, `trigger dev` exécute les
 * tâches depuis son dossier de build, dont la copie du kit date du démarrage du
 * worker : rien n'étant importé de ce dossier, elle n'est pas recopiée quand on
 * le modifie, et une nouvelle partie recevrait un kit périmé jusqu'au prochain
 * redémarrage. On remonte donc à la racine du projet, où sont les sources à jour.
 */
export function resolveRuntimeDir(cwd: string): string {
  const index = cwd.indexOf(TRIGGER_DEV_BUILD_SEGMENT)
  const root = index === -1 ? cwd : cwd.slice(0, index)

  return path.join(root, "lib/games/runtime")
}
