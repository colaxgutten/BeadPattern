const HAMA_COLORS = [
  { code: "01", name: "White", hex: "#FFFFFF" },
  { code: "02", name: "Cream", hex: "#FFF5CC" },
  { code: "03", name: "Yellow", hex: "#FFEC00" },
  { code: "04", name: "Orange", hex: "#F5A623" },
  { code: "05", name: "Red", hex: "#E8202A" },
  { code: "06", name: "Purple", hex: "#8B1A8C" },
  { code: "07", name: "Blue", hex: "#0057A8" },
  { code: "08", name: "Pastel Blue", hex: "#7EC8E3" },
  { code: "09", name: "Light Green", hex: "#9ECC4D" },
  { code: "10", name: "Green", hex: "#007A3D" },
  { code: "11", name: "Black", hex: "#1A1A1A" },
  { code: "12", name: "Brown", hex: "#6B3A2A" },
  { code: "13", name: "Beige", hex: "#D4B896" },
  { code: "14", name: "Light Pink", hex: "#F9B8CE" },
  { code: "15", name: "Pink", hex: "#EE3F8E" },
  { code: "16", name: "Light Grey", hex: "#C0C0C0" },
  { code: "17", name: "Grey", hex: "#808080" },
  { code: "18", name: "Dark Grey", hex: "#404040" },
  { code: "19", name: "Turquoise", hex: "#00A693" },
  { code: "20", name: "Pastel Green", hex: "#B5E6A2" },
  { code: "21", name: "Pastel Yellow", hex: "#FFF3A3" },
  { code: "22", name: "Pastel Lavender", hex: "#D4A0E0" },
  { code: "23", name: "Skin", hex: "#F5C89E" },
  { code: "24", name: "Caramel", hex: "#C47C2B" },
  { code: "25", name: "Lilac", hex: "#B57EDC" },
  { code: "26", name: "Neon Yellow", hex: "#E8F000" },
  { code: "27", name: "Neon Orange", hex: "#FF6600" },
  { code: "28", name: "Neon Green", hex: "#00FF6A" },
  { code: "29", name: "Neon Red", hex: "#FF0033" },
  { code: "30", name: "Dark Brown", hex: "#3D1C0A" },
  { code: "31", name: "Olive", hex: "#7A8B2D" },
  { code: "32", name: "Midnight Blue", hex: "#1B2A6B" },
  { code: "33", name: "Rust", hex: "#B84A1E" },
  { code: "34", name: "Peach", hex: "#FFAA80" },
  { code: "35", name: "Magenta", hex: "#C0006A" },
  { code: "36", name: "Navy Blue", hex: "#002868" },
  { code: "37", name: "Dark Green", hex: "#1A5E20" },
  { code: "38", name: "Maize", hex: "#F5D020" },
  { code: "39", name: "Pastel Pink", hex: "#FFD1DC" },
  { code: "40", name: "Sand", hex: "#C8A97E" },
  { code: "41", name: "Cobalt Blue", hex: "#0047AB" },
  { code: "42", name: "Teal", hex: "#008080" },
  { code: "43", name: "Salmon", hex: "#FA8072" },
  { code: "44", name: "Violet", hex: "#7F00FF" },
  { code: "45", name: "Forest Green", hex: "#228B22" },
  { code: "46", name: "Ivory", hex: "#FFFFF0" },
  { code: "47", name: "Burgundy", hex: "#800020" },
  { code: "48", name: "Coral", hex: "#FF6B6B" },
  { code: "49", name: "Sky Blue", hex: "#87CEEB" },
  { code: "50", name: "Mint", hex: "#98FF98" }
];

// Convert hex string to {r,g,b}
function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// sRGB linearize
function linearize(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

// RGB → CIE Lab
function rgbToLab(r, g, b) {
  const rl = linearize(r), gl = linearize(g), bl = linearize(b);
  // D65 reference white
  let X = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) / 0.95047;
  let Y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750) / 1.00000;
  let Z = (rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041) / 1.08883;

  function f(t) {
    return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  }
  const fx = f(X), fy = f(Y), fz = f(Z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

// Precompute Lab values for all colors
const HAMA_COLORS_LAB = HAMA_COLORS.map(c => {
  const { r, g, b } = hexToRgb(c.hex);
  return { ...c, lab: rgbToLab(r, g, b) };
});

// Find closest enabled color by CIE Lab distance
function findClosestColor(r, g, b, enabledCodes) {
  const lab = rgbToLab(r, g, b);
  let best = null, bestDist = Infinity;
  for (const c of HAMA_COLORS_LAB) {
    if (!enabledCodes.has(c.code)) continue;
    const dL = lab.L - c.lab.L, da = lab.a - c.lab.a, db = lab.b - c.lab.b;
    const dist = dL * dL + da * da + db * db;
    if (dist < bestDist) { bestDist = dist; best = c; }
  }
  return best;
}

// Build a quick lookup map: code → color
function buildColorMap() {
  const map = {};
  for (const c of HAMA_COLORS) map[c.code] = c;
  return map;
}
