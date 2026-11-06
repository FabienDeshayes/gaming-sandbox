// Every colour the game draws with, and nothing else may be drawn in.
//
// Thirty-two colours in ramps (dark to light within a hue), so a sprite can be
// shaded without leaving the palette. `key` is the one character a sprite in
// src/data/sprites.js writes for that colour; `name` is what src/config.js and
// the dev pages call it. Change a hex and every sprite and every panel follows.
//
// Written by palette.html (dev/serialize.js) — edit it there, or by hand in
// exactly this shape.

export const PALETTE = [
  { key: 'a', name: 'ink', hex: '#14101e' },
  { key: 'b', name: 'night', hex: '#2a2440' },
  { key: 'c', name: 'slate', hex: '#45405e' },
  { key: 'd', name: 'dusk', hex: '#6b6585' },
  { key: 'e', name: 'mist', hex: '#a29bb8' },
  { key: 'f', name: 'bone', hex: '#e6dfd0' },
  { key: 'g', name: 'white', hex: '#fffaf0' },
  { key: 'h', name: 'wine', hex: '#5c1a33' },
  { key: 'i', name: 'crimson', hex: '#a3283c' },
  { key: 'j', name: 'red', hex: '#e04545' },
  { key: 'k', name: 'coral', hex: '#ff8a70' },
  { key: 'l', name: 'bark', hex: '#4a2c22' },
  { key: 'm', name: 'rust', hex: '#8c4a2f' },
  { key: 'n', name: 'orange', hex: '#e8852f' },
  { key: 'o', name: 'peach', hex: '#ffc48a' },
  { key: 'p', name: 'ochre', hex: '#b8892a' },
  { key: 'q', name: 'gold', hex: '#f2c53d' },
  { key: 'r', name: 'lemon', hex: '#fff27a' },
  { key: 's', name: 'forest', hex: '#1f4a35' },
  { key: 't', name: 'green', hex: '#3a8a45' },
  { key: 'u', name: 'leaf', hex: '#76c442' },
  { key: 'v', name: 'mint', hex: '#b6eb8a' },
  { key: 'w', name: 'teal', hex: '#1f6b72' },
  { key: 'x', name: 'cyan', hex: '#3cc2c9' },
  { key: 'y', name: 'navy', hex: '#1d2f6b' },
  { key: 'z', name: 'blue', hex: '#3463c9' },
  { key: 'A', name: 'sky', hex: '#6fa8ff' },
  { key: 'B', name: 'ice', hex: '#c2e2ff' },
  { key: 'C', name: 'plum', hex: '#4b2366' },
  { key: 'D', name: 'violet', hex: '#8448b8' },
  { key: 'E', name: 'lilac', hex: '#c48ef0' },
  { key: 'F', name: 'pink', hex: '#f28cc4' },
];
