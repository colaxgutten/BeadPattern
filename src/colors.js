const HAMA_COLORS = [
  { code: "01", name: "White", hex: "#ECEDED" },
  { code: "02", name: "Cream (Ivory)", hex: "#F0E8B9" },
  { code: "03", name: "Yellow", hex: "#F0B901" },
  { code: "04", name: "Orange", hex: "#E64F27" },
  { code: "05", name: "Red", hex: "#B63136" },
  { code: "06", name: "Light Pink", hex: "#E1889F" },
  { code: "07", name: "Purple", hex: "#694A82" },
  { code: "08", name: "Blue", hex: "#2C4690" },
  { code: "09", name: "Light Blue", hex: "#305CB0" },
  { code: "10", name: "Green", hex: "#256847" },
  { code: "11", name: "Aqua Green", hex: "#49AE89" },
  { code: "12", name: "Brown", hex: "#534137" },
  { code: "17", name: "Grey", hex: "#83888A" },
  { code: "18", name: "Black", hex: "#2E2F31" },
  { code: "20", name: "Burgundy", hex: "#7F332A" },
  { code: "21", name: "Beige", hex: "#A5693F" },
  { code: "22", name: "Dark Red", hex: "#A52D36" },
  { code: "26", name: "Soft Pink", hex: "#DE9B90" },
  { code: "27", name: "Light Brown (Tan)", hex: "#DEB48B" },
  { code: "28", name: "Olive Green", hex: "#363F38" },
  { code: "29", name: "Magenta", hex: "#B9395E" },
  { code: "30", name: "Plum", hex: "#592F38" },
  { code: "31", name: "Sky Blue", hex: "#6797AE" },
  { code: "33", name: "Neon Pink", hex: "#FF3956" },
  { code: "43", name: "Neon Yellow", hex: "#F0EA37" },
  { code: "44", name: "Neon Orange", hex: "#EE6972" },
  { code: "45", name: "Pastel Purple", hex: "#886DB9" },
  { code: "46", name: "Baby Blue", hex: "#629ED7" },
  { code: "47", name: "Leaf Green", hex: "#83CB70" },
  { code: "48", name: "Neon Purple", hex: "#CF70B7" },
  { code: "49", name: "Cyan", hex: "#4998BC" },
  { code: "60", name: "Neon Orange", hex: "#F49422" },
  { code: "70", name: "Lavender", hex: "#B6B6D4" },
  { code: "71", name: "Dark Brown", hex: "#464541" },
  { code: "75", name: "Ginger", hex: "#BF7B4D" },
  { code: "76", name: "Espresso", hex: "#663317" },
  { code: "77", name: "Cloud White", hex: "#EDE7DF" },
  { code: "78", name: "Apricot (Flesh)", hex: "#FFC99A" },
  { code: "79", name: "Pumpkin", hex: "#F08643" },
  { code: "82", name: "Wine", hex: "#962F5C" },
  { code: "83", name: "Ocean Blue", hex: "#0178A4" },
  { code: "84", name: "Olive Yellow", hex: "#8B924C" },
  { code: "95", name: "Pastel Pink", hex: "#F8CCE0" },
  { code: "96", name: "Pastel Violet", hex: "#D4B1E3" },
  { code: "97", name: "Pastel Blue", hex: "#A2D3FE" },
  { code: "98", name: "Pastel Mint", hex: "#9ADBB1" },
  { code: "101", name: "Pastel Green", hex: "#A9C39B" },
  { code: "102", name: "Forest Green", hex: "#356B2D" },
  { code: "103", name: "Pastel Yellow", hex: "#FFE660" },
  { code: "104", name: "Pastel Lime", hex: "#BCD122" },
  { code: "105", name: "Pastel Orange", hex: "#FFAC78" },
  { code: "106", name: "Pastel Lilac", hex: "#CCC5ED" },
  { code: "107", name: "Pastel Blue (Dark)", hex: "#6A87C1" },
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

// Find closest enabled color by CIE Lab distance (CIE76)
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

// Precompute RGB values for all colors
const HAMA_COLORS_RGB = HAMA_COLORS.map(c => ({ ...c, rgb: hexToRgb(c.hex) }));

// Find closest color by simple RGB Euclidean distance
function findClosestColorRGB(r, g, b, enabledCodes) {
  let best = null, bestDist = Infinity;
  for (const c of HAMA_COLORS_RGB) {
    if (!enabledCodes.has(c.code)) continue;
    const dr = r - c.rgb.r, dg = g - c.rgb.g, db = b - c.rgb.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) { bestDist = dist; best = c; }
  }
  return best;
}

// Find closest color by weighted RGB distance (accounts for human perception)
function findClosestColorWeightedRGB(r, g, b, enabledCodes) {
  let best = null, bestDist = Infinity;
  for (const c of HAMA_COLORS_RGB) {
    if (!enabledCodes.has(c.code)) continue;
    const dr = r - c.rgb.r, dg = g - c.rgb.g, db = b - c.rgb.b;
    const rMean = (r + c.rgb.r) / 2;
    const dist = (2 + rMean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rMean) / 256) * db * db;
    if (dist < bestDist) { bestDist = dist; best = c; }
  }
  return best;
}

// CIEDE2000 color difference
function deltaE2000(lab1, lab2) {
  const L1 = lab1.L, a1 = lab1.a, b1_ = lab1.b;
  const L2 = lab2.L, a2 = lab2.a, b2_ = lab2.b;
  const C1 = Math.sqrt(a1 * a1 + b1_ * b1_);
  const C2 = Math.sqrt(a2 * a2 + b2_ * b2_);
  const Cab = (C1 + C2) / 2;
  const Cab7 = Math.pow(Cab, 7);
  const G = 0.5 * (1 - Math.sqrt(Cab7 / (Cab7 + 6103515625)));
  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);
  const C1p = Math.sqrt(a1p * a1p + b1_ * b1_);
  const C2p = Math.sqrt(a2p * a2p + b2_ * b2_);
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  let h1p = Math.atan2(b1_, a1p) * toDeg;
  if (h1p < 0) h1p += 360;
  let h2p = Math.atan2(b2_, a2p) * toDeg;
  if (h2p < 0) h2p += 360;
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp / 2 * toRad);
  const Lp = (L1 + L2) / 2;
  const Cp = (C1p + C2p) / 2;
  let hp;
  if (C1p * C2p === 0) {
    hp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hp = (h1p + h2p + 360) / 2;
  } else {
    hp = (h1p + h2p - 360) / 2;
  }
  const T = 1
    - 0.17 * Math.cos((hp - 30) * toRad)
    + 0.24 * Math.cos(2 * hp * toRad)
    + 0.32 * Math.cos((3 * hp + 6) * toRad)
    - 0.20 * Math.cos((4 * hp - 63) * toRad);
  const Lp50sq = (Lp - 50) * (Lp - 50);
  const SL = 1 + 0.015 * Lp50sq / Math.sqrt(20 + Lp50sq);
  const SC = 1 + 0.045 * Cp;
  const SH = 1 + 0.015 * Cp * T;
  const theta = 30 * Math.exp(-((hp - 275) / 25) * ((hp - 275) / 25));
  const Cp7 = Math.pow(Cp, 7);
  const RC = 2 * Math.sqrt(Cp7 / (Cp7 + 6103515625));
  const RT = -Math.sin(2 * theta * toRad) * RC;
  const dLpSL = dLp / SL;
  const dCpSC = dCp / SC;
  const dHpSH = dHp / SH;
  return Math.sqrt(
    dLpSL * dLpSL + dCpSC * dCpSC + dHpSH * dHpSH + RT * dCpSC * dHpSH
  );
}

// Find closest color using CIEDE2000
function findClosestColorCIEDE2000(r, g, b, enabledCodes) {
  const lab = rgbToLab(r, g, b);
  let best = null, bestDist = Infinity;
  for (const c of HAMA_COLORS_LAB) {
    if (!enabledCodes.has(c.code)) continue;
    const dist = deltaE2000(lab, c.lab);
    if (dist < bestDist) { bestDist = dist; best = c; }
  }
  return best;
}

// Find closest color using specified algorithm
function findClosestColorByAlgorithm(r, g, b, enabledCodes, algorithm) {
  switch (algorithm) {
    case 'cieLab': return findClosestColor(r, g, b, enabledCodes);
    case 'ciede2000': return findClosestColorCIEDE2000(r, g, b, enabledCodes);
    case 'rgb': return findClosestColorRGB(r, g, b, enabledCodes);
    case 'weightedRgb': return findClosestColorWeightedRGB(r, g, b, enabledCodes);
    default: return findClosestColor(r, g, b, enabledCodes);
  }
}

// Build a quick lookup map: code → color
function buildColorMap() {
  const map = {};
  for (const c of HAMA_COLORS) map[c.code] = c;
  return map;
}
