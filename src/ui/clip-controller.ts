// Clipping plane ("cut") of the model: slider, checkbox, contrast toggle and tween.

import type * as THREE from 'three';
import { AREA_VOLUME, CLIP_EPSILON, CLIP_TWEEN, DEFAULT_CLIP_HEIGHT, WALL_HEIGHT } from '../config/constants';
import type { FloorplanModel } from '../types';
import { makeCubicBezier } from '../utils/easing';
import type { TemplateRefs } from './template';

/** Clip objects produced by the model builder. */
type ClipModel = Pick<FloorplanModel, 'clipPlane' | 'clipCaps' | 'stencilCapGroup'>;

interface ClipState extends ClipModel {
  wallHeight: number;
}

interface ClipTween {
  startHeight: number;
  endHeight: number;
  startTime: number;
}

export class ClipController {
  private state: ClipState | null = null;
  private tween: ClipTween | null = null;
  private wired = false;
  private ease = makeCubicBezier(...CLIP_TWEEN.EASING);

  constructor(
    private refs: TemplateRefs,
    private getAreaVolumes: () => THREE.Object3D[] | undefined,
  ) {}

  /** Bind to a freshly built model; DOM listeners are only added once. */
  attach(model: ClipModel) {
    const slider = this.refs.clipSlider;
    const checkbox = this.refs.toggles.toggleCut;
    const cutContrastLabel = this.refs.cutContrastLabel;
    const cutContrast = this.refs.cutContrastInput;
    const { clipPlane, clipCaps, stencilCapGroup } = model;

    this.state = {
      clipPlane,
      clipCaps,
      stencilCapGroup,
      wallHeight: WALL_HEIGHT,
    };

    slider.max = String(WALL_HEIGHT);

    if (!this.wired) {
      this.wired = true;
      slider.value = String(DEFAULT_CLIP_HEIGHT);

      slider.addEventListener('input', () => {
        this.tween = null; // dragging wins over a running transition
        this.setHeight(parseFloat(slider.value));
      });

      checkbox.addEventListener('change', () => {
        const enabled = checkbox.checked;
        slider.style.display = enabled ? '' : 'none';
        cutContrastLabel.style.display = enabled ? 'flex' : 'none';
        this.tweenTo(enabled ? parseFloat(slider.value) : WALL_HEIGHT);
      });

      cutContrast.addEventListener('change', () => {
        this.state?.clipCaps.setContrast(cutContrast.checked);
      });
    }

    // Re-apply the current checkbox state to the freshly built model.
    slider.style.display = checkbox.checked ? '' : 'none';
    this.setHeight(checkbox.checked ? parseFloat(slider.value) : WALL_HEIGHT);

    clipCaps.setContrast(cutContrast.checked);
  }

  /** Forget the current model and any running transition (model disposed). */
  reset() {
    this.state = null;
    this.tween = null;
  }

  /** Next attach() binds the DOM listeners again (card teardown). */
  detach() {
    this.wired = false;
  }

  /** Advance a running transition; call once per animation frame. */
  update() {
    const tween = this.tween;
    if (!tween || !this.state) return;

    const progress = Math.min((performance.now() - tween.startTime) / CLIP_TWEEN.DURATION_MS, 1);
    this.setHeight(tween.startHeight + (tween.endHeight - tween.startHeight) * this.ease(progress));

    if (progress >= 1) this.tween = null;
  }

  private tweenTo(endHeight: number) {
    const state = this.state;
    if (!state) return;

    const startHeight = Math.min(state.clipPlane.constant - CLIP_EPSILON, state.wallHeight);

    this.tween = { startHeight, endHeight, startTime: performance.now() };
  }

  private setHeight(planeHeight: number) {
    const state = this.state;
    if (!state) return;

    this.getAreaVolumes()?.forEach((v) => {
      v.scale.z = Math.max(planeHeight - AREA_VOLUME.SHRINK_CM / 100, 0.1);
    });

    const valueLabel = this.refs.clipValue;
    const { clipPlane, stencilCapGroup, wallHeight } = state;

    clipPlane.constant = planeHeight + CLIP_EPSILON;
    if (planeHeight >= wallHeight) {
      valueLabel.textContent = '';
      stencilCapGroup.visible = false;
    } else {
      valueLabel.textContent = `${planeHeight.toFixed(2)}m`;
      stencilCapGroup.visible = true;
      stencilCapGroup.children.forEach((child: THREE.Object3D) => {
        if (child.userData?.isClipCap) child.position.y = planeHeight + CLIP_EPSILON;
      });
    }
  }
}
