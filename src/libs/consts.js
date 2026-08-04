// Sample rate used by the EQ curve visualizer. The original FiiO Control app
// draws its curve at 48 kHz (FS_48000), so the visualizer matches it.
export const SAMPLE_RATE = 48000;
// Frequency range of the EQ curve visualizer, matching the original FiiO
// Control app (n6e(128, 10, 24e3)) so the rendered shape coincides.
export const MIN_FREQ = 10;
export const MAX_FREQ = 24000;
export const MIN_GAIN = -12;
export const MAX_GAIN = 12;

export const TYPE_MAP = { PK: 0, LSC: 1, HSC: 2 };
export const REV_TYPE_MAP = { 0: "PK", 1: "LSC", 2: "HSC" };
export const BAND_ORDER = ["PK", "LSC", "HSC"];

export const DEFAULT_BANDS = [
  { type: "PK", gain: 0, freq: 100, q: 0.7 },
  { type: "PK", gain: 0, freq: 500, q: 0.7 },
  { type: "PK", gain: 0, freq: 1000, q: 0.7 },
  { type: "PK", gain: 0, freq: 2500, q: 0.7 },
  { type: "PK", gain: 0, freq: 10000, q: 0.7 },
];
