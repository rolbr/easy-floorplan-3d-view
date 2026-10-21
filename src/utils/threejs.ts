import type * as THREE from 'three';

/** An Object3D that may carry geometry and material (Mesh, Line, Points, Sprite...). */
type Renderable = THREE.Object3D & {
  geometry?: THREE.BufferGeometry;
  material?: THREE.Material | THREE.Material[];
};

type Disposable = { isTexture?: boolean; dispose(): void };

/**
 * Recursively dispose all geometries, materials and textures under `root`
 * @param `skip` Set of shared geometries/ materials that must survive a model rebuild
 */
export function disposeObject3D(root: THREE.Object3D, skip: Set<unknown> = new Set()) {
  root.traverse((node) => {
    const object = node as Renderable;
    if (object.geometry && !skip.has(object.geometry)) {
      object.geometry.dispose();
    }

    const material = object.material;
    const materials = Array.isArray(material) ? material : material ? [material] : [];

    for (const mat of materials) {
      if (skip.has(mat)) continue;

      disposeMaterialTextures(mat);
      mat.dispose();
    }
  });
}

/** Dispose every texture assigned to a material property (map, etc.). */
function disposeMaterialTextures(material: THREE.Material) {
  const props = material as unknown as Record<string, Disposable | undefined>;
  for (const key of Object.keys(props)) {
    const value = props[key];
    if (value?.isTexture) value.dispose();
  }
}
