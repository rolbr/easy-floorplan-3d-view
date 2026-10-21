// The <easy-floorplan-3d> custom element: orchestrates template, scene, model and controls.

import type { HomeAssistant } from 'home-assistant-frontend-types';
import { createIcons, Mouse, MouseLeft, MouseRight } from 'lucide';
import * as THREE from 'three';
import { buildAreaLayer, buildModel, disposeModel } from './builder/builder';
import { CARD_CONFIG, STATUS_COLORS, TAG_NAMES } from './config/constants';
import { applyFrameLimits, clampPanTarget, computeFrame, type Frame, refitToFrame, resetToFrame } from './lib/camera';
import { setHass } from './lib/context';
import { subLogger } from './lib/logger';
import {
  resolveMarkerSizeLimits,
  updateEntityLabels,
  updateEntityStates,
  updateEntityValues,
  updateLabelPositions,
  updateMarkerScales,
  updateSensorRipples,
  watchMarkerLimits,
} from './lib/markers';
import { setupRaycasting } from './lib/picking';
import { createWorld } from './lib/world';
import { getCachedFloor, loadFloorData, signatureOf, storeFloor } from './load-floor';
import type { AreaController, BuildIssue, CardConfig, FloorRefs, LabelOpts, LoadedFloor, ResizeHandler, World } from './types';
import { ClipController } from './ui/clip-controller';
import { setStatus, setupControls, stopPropagation, wirePanelToggle } from './ui/controls';
import { getTemplate, getTemplateRefs, type TemplateRefs } from './ui/template';
import { TimeController } from './ui/time-controller';

const _viewSize = new THREE.Vector2(); // module level, avoids a per-frame allocation

export class EasyFloorplan3DCard extends HTMLElement {
  _world: World | null;
  _config: CardConfig;
  _areaController: AreaController | null;
  _initialized: boolean;
  _loading: boolean;
  _sceneReady: boolean | undefined;
  _animationFrame: number;
  _precompileToken: number;
  _teardownTimer: number | null;
  _disposePicking: () => void;
  _areaMeshes: THREE.Object3D<THREE.Object3DEventMap>[] | null;
  _areaVolumes: THREE.Object3D<THREE.Object3DEventMap>[] | null;
  _hass: HomeAssistant;
  _loaded: LoadedFloor | null;
  _frame: Frame | null = null; // last computed camera frame, needed to rescale the view on resize
  _panRadius = Infinity; // (m) how far controls.target may move from the origin
  _floorRefs: FloorRefs | null;
  _labelOpts: LabelOpts;
  _modelGroup: THREE.Group<THREE.Object3DEventMap> | null;
  _refs: TemplateRefs;
  _controls: ReturnType<typeof setupControls>;
  _clip: ClipController;
  _time: TimeController;
  _markerLimits: ReturnType<typeof watchMarkerLimits>;

  _id: string;
  _log: ReturnType<typeof subLogger>;

  constructor() {
    super();
    this._id = Math.random().toString(36).slice(2, 6);
    this._log = subLogger(this._id); // use subLogger so each card instance can log with its unique _id
  }

  static getConfigElement() {
    return document.createElement(TAG_NAMES.editor);
  }

  static getStubConfig(): CardConfig {
    return structuredClone(CARD_CONFIG);
  }

  setConfig(config: CardConfig) {
    const newConfig: CardConfig = { ...CARD_CONFIG, ...config };
    const sourceChanged = JSON.stringify(newConfig.source) !== JSON.stringify(this._config?.source);

    this._config = newConfig;

    if (!this._initialized) {
      this._render();
    } else if (sourceChanged) {
      this._loadSource();
    }
  }

  set hass(hass: HomeAssistant) {
    setHass(hass);
    this._hass = hass;
    this._time?.setLocation(hass.config?.latitude, hass.config?.longitude, hass.config?.time_zone);

    if (!this._initialized && this._config) {
      this._render(); // loads if hass.connection is ready
    } else if (this._initialized && !this._loaded && hass.connection && !this._loading) {
      this._loadSource(); // first hass arrived after render
    }

    if (this._floorRefs) {
      updateEntityStates(hass, this._floorRefs.pickableItems);
      updateEntityLabels(hass, this._floorRefs.pickableItems, this._labelOpts);
      updateEntityValues(hass, this._floorRefs.pickableItems);
    }
  }

  _render() {
    if (!this._config || this._initialized) return;
    this._initialized = true;

    this.innerHTML = getTemplate();
    this._refs = getTemplateRefs(this);
    this._clip = new ClipController(this._refs, () => this._areaVolumes ?? undefined);
    this._time = new TimeController(this._refs);

    createIcons({
      icons: { MouseLeft, MouseRight, Mouse },
      root: this,
    });

    this._refs.reload.addEventListener('click', () => {
      this._loadSource({ bypassCache: true });
    });

    this._createScene();
    wirePanelToggle(this._refs.panels);
    this._controls = setupControls(this._refs, {
      getFloorRefs: () => this._floorRefs,
      getHass: () => this._hass,
      setLabelOpts: (opts) => {
        this._labelOpts = opts;
      },
    });
    stopPropagation(this._refs.container);

    if (this._hass?.connection) this._loadSource();
  }

  _syncVisibility() {
    this._controls.syncVisibility();
  }

  _syncLabels() {
    this._controls.syncLabels();
  }

  _createScene() {
    const container = this._refs.container;
    const tooltip = this._refs.tooltip;
    const resizeHandlers = new Set<ResizeHandler>();
    const world = createWorld(container, resizeHandlers);

    this._world = world;
    this._time.attach(world.lights, this._config.north_offset);
    this._time.setLocation(this._hass?.config?.latitude, this._hass?.config?.longitude, this._hass?.config?.time_zone);

    // biome-ignore lint/correctness/noUnusedFunctionParameters: keep `entries` for logging
    const handleResize = (entries: ResizeObserverEntry[]) => {
      // const { width, height } = entries[0].contentRect;
      // const containerSize = `${Math.round(width)}×${Math.round(height)}`;
      // const windowSize = `${window.innerWidth}×${window.innerHeight}`;
      // this._log.trace(`viewport ${windowSize} — #container ${containerSize} — dpr ${window.devicePixelRatio}`);
      this._refitCamera();
      this._renderFrame(); // redraw before paint: setSize cleared the canvas
    };

    resizeHandlers.add(handleResize); // attach
    // resizeHandlers.delete(handleResize);   // detach

    // Override media-query height if explicitly set in config
    if (this._config?.height) {
      container.style.height = `${this._config.height}px`;
    }

    this._markerLimits = watchMarkerLimits(this._config?.marker_size_limits);

    this._disposePicking = setupRaycasting(this, world, () => this._floorRefs?.pickableItems, tooltip, {
      getAreaMeshes: () => this._areaVolumes ?? [],
      isHoverLabelEnabled: () => this._refs?.toggles.toggleHoverLabels.checked ?? true,
      onAreaClick: (mesh) => this._areaController?.handleClick(mesh),
    });

    const animate = (now: number) => {
      this._animationFrame = requestAnimationFrame(animate);
      this._renderFrame(now); // rAF timestamp: one evenly spaced clock for the whole frame
    };
    this._animationFrame = requestAnimationFrame(animate);
  }

  /** One full update + draw. Used by the rAF loop and synchronously after a resize (setSize clears the canvas). */
  _renderFrame(now: number = performance.now()) {
    const world = this._world;
    if (!world) return;
    this._areaController?.updateTween(now); // FIX TWEEN STUTTER -- CRUCIAL: 1) move first
    world.controls.update(); // 2) then let controls resolve + lookAt
    clampPanTarget(world.camera, world.controls, this._panRadius * 2);
    updateMarkerScales(
      this._floorRefs?.pickableItems,
      world.camera,
      world.renderer.getSize(_viewSize).y, // CSS px, independent of devicePixelRatio
      this._markerLimits?.get() ?? resolveMarkerSizeLimits(undefined, false),
    );
    this._clip.update();
    updateSensorRipples(this._hass, this._floorRefs?.pickableItems, world.camera, performance.now() / 1000);
    updateLabelPositions(this._floorRefs?.pickableItems, world.camera);
    if (this._sceneReady !== false) {
      world.renderer.render(world.scene, world.camera);
    }
  }

  async _loadSource({ bypassCache = false } = {}) {
    const world = this._world;
    if (!world || this._loading) return; // card torn down / not built yet

    this._loading = true;

    performance.mark('efp3d:load');

    const source = this._config.source;
    const hit = bypassCache ? null : getCachedFloor(source);

    try {
      // 1. Paint instantly from cache
      if (hit) {
        this._applyFloor(hit.data);
      } else {
        this._setStatus('Loading model…', STATUS_COLORS.IDLE);
      }

      // 2. Always revalidate
      const fresh = await loadFloorData(this._hass, source);
      performance.mark('efp3d:load-complete');
      if (this._world !== world) return; // disconnected meanwhile

      const sig = signatureOf(fresh);
      if (!hit || hit.sig !== sig) {
        storeFloor(source, fresh, sig);
        this._applyFloor(fresh); // rebuild only when changed
      }
    } catch (error) {
      this._log.error(`_loadSource failed:`, error.message);
      this._setStatus(`Error: ${error.message}`, STATUS_COLORS.ERROR);
    } finally {
      this._loading = false;
      performance.mark('efp3d:load-complete');
    }
  }

  _applyFloor(loaded: LoadedFloor) {
    const { floor } = loaded;
    this._sceneReady = false;
    this._loaded = loaded;
    const issues = this._rebuildModel(loaded);
    updateEntityStates(this._hass, this._floorRefs?.pickableItems);
    updateEntityValues(this._hass, this._floorRefs?.pickableItems);
    const summary =
      `Loaded: ${floor.walls?.length ?? 0} walls, ` + `${floor.openings?.length ?? 0} openings, ` + `${floor.items?.length ?? 0} items.`;
    const errors = issues.slice(0, 3).map((issue) => issue.message);
    if (issues.length > errors.length) {
      errors.push(`+${issues.length - errors.length} more entity errors, see console.`);
    }
    this._setStatus(summary, STATUS_COLORS.OK, errors);
    performance.mark('efp3d:apply-floor-complete');
    this._precompile();
  }

  async _precompile() {
    performance.mark('efp3d:precompile-start');
    const world = this._world;
    if (!world) return;
    this._precompileToken = (this._precompileToken ?? 0) + 1;
    const token = this._precompileToken;

    try {
      await world.renderer.compileAsync(world.scene, world.camera);
    } catch (error) {
      this._log.warn(`compileAsync failed`, error);
    }
    if (this._world !== world || token !== this._precompileToken) return;

    world.renderer.render(world.scene, world.camera);

    this._sceneReady = true;
    performance.mark('efp3d:precompile-end');
  }

  _rebuildModel(loaded: LoadedFloor): BuildIssue[] {
    const { floor } = loaded;
    this._disposeModel();
    if (!this._world) {
      this._log.error(`_rebuildModel: three scene is not initialized`);
      return [];
    }

    const model = buildModel(this._world, floor, this._config);
    this._modelGroup = model.group;
    this._loaded = loaded;
    this._frameCamera();

    const areas = buildAreaLayer(this._world, model.group, floor, this._config?.source?.area_id, this._id);
    this._areaMeshes = areas.areaMeshes;
    this._areaVolumes = areas.areaVolumes;
    this._areaController = areas.areaController;
    this._floorRefs = {
      pickableItems: model.pickableItems,
      furnitureGroup: model.furnitureGroup,
      itemsGroup: model.itemsGroup,
      glowGroup: model.glowGroup,
      areaLabelGroup: areas.areaLabelGroup,
    };

    this._syncVisibility();
    this._clip.attach(model);
    this._time.setClipCaps(model.clipCaps);
    return model.issues;
  }

  _disposeModel() {
    if (!this._modelGroup) return;
    disposeModel(this._world, this._modelGroup);

    this._modelGroup = null;
    this._floorRefs = null;
    this._clip.reset();
    this._time.setClipCaps(null);
    this._areaMeshes = null;
    this._areaVolumes = null;
    this._areaController = null;
  }

  _refitCamera() {
    if (!this._modelGroup || !this._loaded || !this._world) return;
    const previous = this._frame;
    if (!previous) return this._frameCamera();
    const { camera, controls } = this._world;
    const next = computeFrame(camera, this._loaded.floor, this._loaded.rotation);
    if (!next) return;

    if (this._areaController?.getActiveAreaId()) {
      // Focused area: limits first (zoomToArea respects minDistance), then re-fit the area to the new aspect
      applyFrameLimits(camera, controls, next);
      this._areaController.refit(next.view.distance / previous.view.distance, this._areaVolumes ?? []);
    } else {
      refitToFrame(camera, controls, previous, next);
    }
    this._frame = next;
    this._panRadius = next.extent.radius;
  }

  _frameCamera() {
    if (!this._modelGroup || !this._loaded || !this._world) return;
    const { camera, controls } = this._world;
    const frame = computeFrame(camera, this._loaded.floor, this._loaded.rotation);
    if (!frame) return;
    resetToFrame(this._modelGroup, camera, controls, frame);
    this._frame = frame;
    this._panRadius = frame.extent.radius;
    // Re-framing reset the camera, so the saved default view is obsolete; re-apply an active area focus on the new one.
    this._areaController?.clearSavedView();
    const activeArea = this._areaController?.getActiveAreaId();
    if (activeArea) this._areaController?.focusArea(activeArea, this._areaVolumes ?? []);
  }

  _setStatus(text: string, color?: string, errors?: string[]) {
    setStatus(this._refs.status, text, color, errors);
  }

  /**
   * Switching to dashboard edit mode and back, the card is re-parented by HA into an edit-mode wrapper.
   * This will fire `disconnectedCallback` and tear everything down. When re-parented, `setConfig` is NOT called,
   * so nothing is drawn. The card stays empty until the next `hass` update arrives, which calls `_render`.
   * Fix:
   * 1) Skip teardown if reconnect is result of a DOM re-parent
   * 2) Rebuild on reconnect
   * @returns
   */
  connectedCallback() {
    this._log.trace(`connectedCallback`, performance.now());

    // 1) Skip teardown if reconnect is result of a DOM re-parent
    // `_teardownTimer` ONLY exists after a re-parent, NOT when the component is first mounted
    if (this._teardownTimer) {
      clearTimeout(this._teardownTimer);
      this._teardownTimer = null;
      return; // keep current scene alive, don't re-initiate
    }
    // 2) Rebuild on reconnect
    if (this._config && !this._initialized) this._render();

    // log performance
    // setTimeout(() => {
    //   const marks = performance
    //     .getEntriesByType('mark')
    //     .filter((m) => m.name.startsWith('efp3d'))
    //     .sort((a, b) => a.startTime - b.startTime);

    //   const first = marks[0]?.startTime ?? 0;
    //   console.table(
    //     marks.map((m, i) => ({
    //       mark: m.name,
    //       'at ms': Math.round(m.startTime),
    //       own: i ? Math.round(m.startTime - marks[i - 1].startTime) : 0,
    //       total: Math.round(m.startTime - first),
    //     })),
    //   );
    // }, 500);
  }

  disconnectedCallback() {
    performance.clearMarks();
    this._teardownTimer = setTimeout(() => {
      this._teardownTimer = null;
      this._teardown();
    }, 0);
  }

  _teardown() {
    this._log.trace(`_teardown`, performance.now());
    cancelAnimationFrame(this._animationFrame);
    this._disposePicking?.();
    this._disposeModel();
    this._world?.resizeObserver?.disconnect();
    this._world?.controls?.dispose();
    this._world?.renderer?.dispose();
    this._world = null;
    this._initialized = false;
    this._clip.detach();
    this._time?.dispose();
    this._loaded = null;
    this._loading = false;
    this._sceneReady = undefined;
    this._markerLimits?.dispose();
  }

  getCardSize() {
    return this._config?.card_size;
  }
}
