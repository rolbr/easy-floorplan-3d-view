import type { Scene, WebGLRenderer } from 'three';

export interface CustomCardEntry {
  type: string;
  name: string;
  description?: string;
  preview?: boolean;
  documentationURL?: string;
}

declare global {
  interface Window {
    customCards?: CustomCardEntry[];
    __efp3d_renderer?: WebGLRenderer;
    __efp3d_scene?: Scene;
  }
}
