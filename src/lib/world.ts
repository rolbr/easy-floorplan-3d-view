// three.js stage setup: renderer, camera, controls, lights and ground plane

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA, CAMERA_LIMITS, DAYLIGHT, DEBUG, STAGE } from '../config/constants';
import type { ResizeHandler } from '../types';

/**
 * Radial ground gradient (CSS-like): floor colour at the centre, then three ring colours that are
 * fully reached at STAGE.RING_STOPS, then a fade to the horizon colour at the outer edge.
 */
function applyGroundGradient(floor: THREE.Mesh<THREE.CircleGeometry, THREE.MeshStandardMaterial>) {
  const base = new THREE.Color(STAGE.GROUND_COLOR);
  const uniforms = {
    uRadius: { value: STAGE.GROUND_SIZE / 2 },
    uRingStops: { value: [...DAYLIGHT.RING_STOPS] },
    uRingColors: {
      value: DAYLIGHT.RING_FALLBACK_DARKEN.map((k) => base.clone().multiplyScalar(k)),
    },
    uHorizon: { value: new THREE.Vector3() }, // sRGB, matches scene.background
  };
  floor.userData.groundUniforms = uniforms;
  setGroundHorizon(floor, new THREE.Color(STAGE.BACKGROUND));

  floor.material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGroundXY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGroundXY = position.xy;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vGroundXY;\nuniform float uRadius;\nuniform float uRingStops[3];\nuniform vec3 uRingColors[3];\nuniform vec3 uHorizon;',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float gRad = clamp(length(vGroundXY) / uRadius, 0.0, 1.0);
        vec3 gCol = diffuseColor.rgb;
        gCol = mix(gCol, uRingColors[0], clamp(gRad / uRingStops[0], 0.0, 1.0));
        gCol = mix(gCol, uRingColors[1], clamp((gRad - uRingStops[0]) / (uRingStops[1] - uRingStops[0]), 0.0, 1.0));
        gCol = mix(gCol, uRingColors[2], clamp((gRad - uRingStops[1]) / (uRingStops[2] - uRingStops[1]), 0.0, 1.0));
        diffuseColor.rgb = gCol;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uHorizon, clamp((gRad - uRingStops[2]) / (1.0 - uRingStops[2]), 0.0, 1.0));`,
      );
  };
}

/** Update the ring colours (call with DaylightState.ring). */
export function setGroundRing(floor: THREE.Object3D, colors: THREE.Color[]) {
  const target = floor.userData.groundUniforms.uRingColors.value as THREE.Color[];
  colors.forEach((c, i) => {
    target[i].copy(c);
  });
}

/** Update the horizon colour at the ground's outer edge (call with scene.background). */
export function setGroundHorizon(floor: THREE.Object3D, color: THREE.Color) {
  const rgb = { r: 0, g: 0, b: 0 };
  color.getRGB(rgb, THREE.SRGBColorSpace);
  floor.userData.groundUniforms.uHorizon.value.set(rgb.r, rgb.g, rgb.b);
}

export function createWorld(container: HTMLDivElement, resizeHandlers: Set<ResizeHandler>) {
  const width = Math.max(container.clientWidth, 1);
  const height = Math.max(container.clientHeight, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(STAGE.BACKGROUND);

  const camera = new THREE.PerspectiveCamera(CAMERA.FOV, width / height, CAMERA.NEAR, CAMERA.FAR);
  camera.position.z = 1; // placeholder: the first frame sets the real view

  const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true });
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, STAGE.MAX_PIXEL_RATIO));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const rendererSettings = STAGE.RENDERER;
  // renderer.toneMapping = THREE[rendererSettings.TONE_MAPPING];
  renderer.toneMappingExposure = rendererSettings.TONE_MAPPING_EXPOSURE;

  if (DEBUG) {
    window.__efp3d_renderer = renderer;
    window.__efp3d_scene = scene;
  }

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.screenSpacePanning = false; // pan along the ground plane, target height stays
  controls.enableDamping = true;
  controls.dampingFactor = 0.1; // Higher = faster settle (default 0.25)
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.PAN,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE,
  };
  controls.touches = {
    ONE: THREE.TOUCH.PAN,
    TWO: THREE.TOUCH.DOLLY_ROTATE,
  };
  controls.minPolarAngle = THREE.MathUtils.degToRad(90 - CAMERA_LIMITS.ELEVATION_DEG_MAX); // 0 = straight down
  controls.maxPolarAngle = THREE.MathUtils.degToRad(90 - CAMERA_LIMITS.ELEVATION_DEG_MIN); // 90 = parallel to ground

  const _hemi = STAGE.HEMISPHERE;
  const hemi = new THREE.HemisphereLight(_hemi.sky, _hemi.ground, _hemi.intensity);
  scene.add(hemi);

  const _sun = STAGE.SUN;
  const sun = new THREE.DirectionalLight(_sun.color, _sun.intensity);
  sun.position.set(..._sun.position);
  sun.castShadow = true;
  sun.shadow.mapSize.set(_sun.shadowMapSize, _sun.shadowMapSize);
  sun.shadow.bias = _sun.shadowBias;
  sun.shadow.normalBias = _sun.shadowNormalBias;
  //
  sun.shadow.camera.left = -_sun.shadowCameraSize;
  sun.shadow.camera.right = _sun.shadowCameraSize;
  sun.shadow.camera.top = _sun.shadowCameraSize;
  sun.shadow.camera.bottom = -_sun.shadowCameraSize;
  sun.shadow.camera.near = _sun.shadowCameraNear;
  sun.shadow.camera.far = _sun.shadowCameraFar;
  sun.shadow.camera.updateProjectionMatrix();
  //
  scene.add(sun);

  const moon = new THREE.DirectionalLight(DAYLIGHT.MOON_COLOR, 0);
  moon.castShadow = true;
  moon.shadow.mapSize.set(512, 512);
  moon.shadow.bias = _sun.shadowBias;
  moon.shadow.normalBias = _sun.shadowNormalBias;
  moon.shadow.camera.left = -_sun.shadowCameraSize;
  moon.shadow.camera.right = _sun.shadowCameraSize;
  moon.shadow.camera.top = _sun.shadowCameraSize;
  moon.shadow.camera.bottom = -_sun.shadowCameraSize;
  moon.shadow.camera.near = _sun.shadowCameraNear;
  moon.shadow.camera.far = _sun.shadowCameraFar;
  moon.shadow.camera.updateProjectionMatrix();
  scene.add(moon);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(STAGE.GROUND_SIZE / 2, 128),
    new THREE.MeshStandardMaterial({ color: STAGE.GROUND_COLOR, roughness: 1 }),
  );
  applyGroundGradient(floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const onResize = (entries: ResizeObserverEntry[]) => {
    const w = Math.max(container.clientWidth, 1);
    const h = Math.max(container.clientHeight, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);

    // Handlers refit the camera and redraw synchronously (card._renderFrame), so no blank frame is painted
    for (const fn of resizeHandlers) fn(entries);
  };
  const resizeObserver = new ResizeObserver(onResize);
  resizeObserver.observe(container);

  return {
    scene,
    camera,
    renderer,
    controls,
    resizeObserver,
    lights: { scene, sun, moon, hemi, floor },
  };
}
