import builtins from '../config/furniture-symbols.json';
import type { FloorplanFurniture, FurnitureSourceSettings } from '../types';
import { type ModelPart, normalizeModel } from './symbol-model';

const height = (v: unknown, allowZero = false): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v <= 10000 && (allowZero ? v >= 0 : v > 0);

/** Undefined requests fallback geometry; an empty array means the model is fully above the cut. */
export function detailedFurniture(f: FloorplanFurniture, settings: FurnitureSourceSettings = {}): ModelPart[] | undefined {
  if (settings.furniture3d !== true) return;
  const catalog: FurnitureSourceSettings['symbols'] = builtins;
  const symbol = settings.symbols?.[f.type] ?? catalog?.[f.type];
  const model = normalizeModel(symbol?.model3d);
  if (!model) return;
  if (![f.x, f.y, f.w, f.h].every(Number.isFinite) || f.w <= 0 || f.h <= 0) return [];
  const bottom = height(f.elevation?.from, true) ? f.elevation.from : height(symbol?.elevation?.from, true) ? symbol.elevation.from : 0;
  const scale = (height(f.height3d) ? f.height3d : model.size.height) / model.size.height;
  const requestedCut = settings.furnitureSeparateSection === true ? (settings.furnitureSectionHeight ?? 180) : settings.wallHeight;
  const cut = typeof requestedCut === 'number' && Number.isFinite(requestedCut) ? Math.max(0, Math.min(400, requestedCut)) : 60;
  return model.parts.flatMap((part) => {
    const z0 = bottom + part.z0 * scale;
    const z1 = Math.min(cut, bottom + part.z1 * scale);
    if (z0 >= z1) return [];
    return [
      {
        ...part,
        z0,
        z1,
        base: part.base.map(([x, y]): [number, number] => [(x / model.size.width - 0.5) * f.w, (y / model.size.depth - 0.5) * f.h]),
      },
    ];
  });
}
