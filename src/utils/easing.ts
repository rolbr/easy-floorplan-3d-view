/**
 * Cubic-bezier easing, same math as CSS cubic-bezier(p1x, p1y, p2x, p2y)
 * Returns a function mapping time x in [0, 1] to eased progress y in [0, 1]
 */
export function makeCubicBezier(p1x: number, p1y: number, p2x: number, p2y: number): (x: number) => number {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-5) break;
      const derivative = sampleDX(t);
      if (Math.abs(derivative) < 1e-6) break;
      t -= error / derivative;
    }
    return sampleY(t);
  };
}
