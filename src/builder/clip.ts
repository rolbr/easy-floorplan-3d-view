// Stencil clip caps for the cut-height plane
// Cap geometry lives on the cap meshes inside the model group, so it is freed automatically when the model is disposed

import * as THREE from 'three';
import { CLIP_CAP } from '../config/constants';
import type { ClipCaps } from '../types';

/**
 * Create a per-build clip-cap system for one clipping plane.
 * Call rebuildClipCaps(group, stencilCapGroup) once per model build.
 */
export function createClipCaps(clipPlane: THREE.Plane, contrast = false): ClipCaps {
  const capMaterialCache = new Map<string, THREE.MeshStandardMaterial>();
  const contrastFloorColor = new THREE.Color(0xffffff);
  const sharedCapGeo = new THREE.PlaneGeometry(CLIP_CAP.PLANE_SIZE, CLIP_CAP.PLANE_SIZE);

  function getCapMaterialFor(sourceMat: THREE.Material & { color?: THREE.ColorRepresentation }): THREE.MeshStandardMaterial {
    const key = sourceMat.uuid;
    const cached = capMaterialCache.get(key);
    if (cached) return cached;

    const baseColor = new THREE.Color(sourceMat.color ? sourceMat.color : CLIP_CAP.MATERIAL_COLOR);

    const capMat = new THREE.MeshStandardMaterial({
      color: baseColor.clone(),
      metalness: CLIP_CAP.METALNESS,
      roughness: CLIP_CAP.ROUGHNESS,
      side: THREE.DoubleSide,
      stencilWrite: true,
      stencilRef: 0,
      stencilFunc: THREE.NotEqualStencilFunc,
      stencilFail: THREE.ReplaceStencilOp,
      stencilZFail: THREE.ReplaceStencilOp,
      stencilZPass: THREE.ReplaceStencilOp,
    });
    capMat.userData.baseColor = baseColor;
    addContrastInvert(capMat);

    capMaterialCache.set(key, capMat);
    return capMat;
  }

  function createPlaneStencilGroup(geometry: THREE.BufferGeometry, renderOrder: number) {
    const group = new THREE.Group();

    const baseMat = new THREE.MeshBasicMaterial();
    baseMat.depthWrite = false;
    baseMat.depthTest = false;
    baseMat.colorWrite = false;
    baseMat.stencilWrite = true;
    baseMat.stencilFunc = THREE.AlwaysStencilFunc;
    baseMat.clippingPlanes = [clipPlane];

    const mat0 = baseMat.clone();
    mat0.side = THREE.BackSide;
    mat0.clippingPlanes = [clipPlane];
    mat0.stencilFail = THREE.IncrementWrapStencilOp;
    mat0.stencilZFail = THREE.IncrementWrapStencilOp;
    mat0.stencilZPass = THREE.IncrementWrapStencilOp;

    const mesh0 = new THREE.Mesh(geometry, mat0);
    mesh0.renderOrder = renderOrder;
    group.add(mesh0);

    const mat1 = baseMat.clone();
    mat1.side = THREE.FrontSide;
    mat1.clippingPlanes = [clipPlane];
    mat1.stencilFail = THREE.DecrementWrapStencilOp;
    mat1.stencilZFail = THREE.DecrementWrapStencilOp;
    mat1.stencilZPass = THREE.DecrementWrapStencilOp;

    const mesh1 = new THREE.Mesh(geometry, mat1);
    mesh1.renderOrder = renderOrder;
    group.add(mesh1);

    return group;
  }

  function addCapForMesh(mesh: THREE.Mesh, renderOrderStart: number, stencilCapGroup: THREE.Group) {
    if (!mesh.geometry?.attributes?.position) return renderOrderStart;

    const stencilGroup = createPlaneStencilGroup(mesh.geometry, renderOrderStart);
    stencilGroup.position.copy(mesh.position);
    stencilGroup.quaternion.copy(mesh.quaternion);
    stencilGroup.scale.copy(mesh.scale);
    stencilCapGroup.add(stencilGroup);

    const sourceMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const capMat = getCapMaterialFor(sourceMat);

    const capMesh = new THREE.Mesh(sharedCapGeo, capMat);
    capMesh.renderOrder = renderOrderStart + 1;
    capMesh.castShadow = false;
    capMesh.receiveShadow = true;
    capMesh.userData.isClipCap = true;

    capMesh.onAfterRender = (renderer) => {
      renderer.clearStencil();

      const coplanarPoint = new THREE.Vector3();
      clipPlane.coplanarPoint(coplanarPoint);
      capMesh.position.set(mesh.position.x, coplanarPoint.y, mesh.position.z);
      capMesh.updateWorldMatrix(true, false);

      const wp = new THREE.Vector3().setFromMatrixPosition(capMesh.matrixWorld);
      capMesh.lookAt(wp.clone().sub(clipPlane.normal));

      capMesh.scale.setScalar(CLIP_CAP.SCALE);
    };

    stencilCapGroup.add(capMesh);

    return renderOrderStart + 2;
  }

  function rebuildClipCaps(group: THREE.Object3D, stencilCapGroup: THREE.Group) {
    stencilCapGroup.clear();

    let order = CLIP_CAP.RENDER_ORDER_START;
    group.children.forEach((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        order = addCapForMesh(mesh, order, stencilCapGroup);
      }
    });
  }

  /**
   * Contrast mode: the cap is lit exactly like the floor (floor colour, rough, non-metallic,
   * same lights and shadows), then the final pixel is inverted after lighting, tone mapping
   * and colour-space conversion. So it is the inverse of the rendered floor colour.
   */
  function addContrastInvert(mat: THREE.MeshStandardMaterial) {
    const uContrast = { value: contrast ? 1 : 0 };
    mat.userData.uContrast = uContrast;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uContrast = uContrast;
      // Ignore Home Assistant point lights: sun, moon and hemisphere (plus their shadows) still light the cap.
      // three.js swaps NUM_POINT_LIGHTS for a literal number, so a #define override is impossible; instead disable the point-light block inside the lights chunk.
      const lightsChunk = THREE.ShaderChunk.lights_fragment_begin.replace(
        '#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )',
        '#if ( 0 > 0 ) && defined( RE_Direct )',
      );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <lights_fragment_begin>', lightsChunk) // three 0.186.0 -- if a future three.js version calls `<lights_fragment_begin>` something else, this will silently fail
        .replace('#include <common>', '#include <common>\nuniform float uContrast;')
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
        if (uContrast > 0.5) {
          gl_FragColor.rgb = vec3(1.0) - gl_FragColor.rgb;
        }`,
        );
    };
  }

  function applyCapLook() {
    capMaterialCache.forEach((capMat) => {
      capMat.userData.uContrast.value = contrast ? 1 : 0;
      if (contrast) {
        capMat.color.copy(contrastFloorColor);
        capMat.roughness = 1;
        capMat.metalness = 0;
      } else {
        capMat.color.copy(capMat.userData.baseColor);
        capMat.roughness = CLIP_CAP.ROUGHNESS;
        capMat.metalness = CLIP_CAP.METALNESS;
      }
    });
  }

  function setContrast(value: boolean) {
    contrast = !!value;
    applyCapLook();
  }

  function setContrastFloorColor(color: THREE.Color) {
    contrastFloorColor.copy(color);
    if (contrast) applyCapLook();
  }

  return { rebuildClipCaps, setContrast, setContrastFloorColor };
}
