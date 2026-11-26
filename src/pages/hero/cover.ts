/** Where a point of a photo (fractions px, py) lands inside a container with object-fit: cover, centred. */
export function coverPoint(cw: number, ch: number, iw: number, ih: number, px: number, py: number) {
  const s = Math.max(cw / iw, ch / ih);
  const dw = iw * s;
  const dh = ih * s;
  return { x: (cw - dw) / 2 + px * dw, y: (ch - dh) / 2 + py * dh };
}
