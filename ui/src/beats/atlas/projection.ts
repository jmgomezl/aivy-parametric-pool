// Equirectangular projection clipped to the latitudes where people live, plus a
// zoom/pan view on top of it. Everything the atlas draws goes through `project`.
export const W = 1380, LAT_MAX = 78, LAT_MIN = -60;
export const H = Math.round((W * (LAT_MAX - LAT_MIN)) / 360);
export const PX_PER_DEG = H / (LAT_MAX - LAT_MIN);

export interface View { x: number; y: number; k: number } // top-left of the viewport in base px, and zoom
export const HOME: View = { x: 0, y: 0, k: 1 };
export const K_MAX = 12;

export const base = (lon: number, lat: number) => ({ x: ((lon + 180) / 360) * W, y: ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H });
export const project = (lon: number, lat: number, v: View) => { const b = base(lon, lat); return { x: (b.x - v.x) * v.k, y: (b.y - v.y) * v.k }; };
export const unproject = (x: number, y: number, v: View) => {
  const bx = x / v.k + v.x, by = y / v.k + v.y;
  return { lon: (bx / W) * 360 - 180, lat: LAT_MAX - (by / H) * (LAT_MAX - LAT_MIN) };
};

export const kmToPxY = (km: number, v: View) => (km / 111.32) * PX_PER_DEG * v.k;
export const kmToPxX = (km: number, lat: number, v: View) => kmToPxY(km, v) / Math.max(0.2, Math.cos((lat * Math.PI) / 180));

export function clampView(v: View): View {
  const k = Math.min(K_MAX, Math.max(1, v.k));
  const x = Math.min(W - W / k, Math.max(0, v.x));
  const y = Math.min(H - H / k, Math.max(0, v.y));
  return { x, y, k };
}

/** Zoom by `factor` keeping the base point under viewport pixel (px, py) fixed. */
export function zoomAt(v: View, px: number, py: number, factor: number): View {
  const k = Math.min(K_MAX, Math.max(1, v.k * factor));
  const bx = px / v.k + v.x, by = py / v.k + v.y;
  return clampView({ k, x: bx - px / k, y: by - py / k });
}

export const pan = (v: View, dx: number, dy: number): View => clampView({ ...v, x: v.x - dx / v.k, y: v.y - dy / v.k });
