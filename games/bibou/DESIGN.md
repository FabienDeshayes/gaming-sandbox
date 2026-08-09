# Bibou

## 1. One-liner

A minimal Phaser title-screen skeleton for a future 2D game called Bibou.

## 2. Pitch

Not a game yet — just the bootstrap screen (title + menu buttons) that a future prompt will
build the real game on top of.

## 5. Constraints

- No build tooling: Phaser 3 loaded via CDN `<script>` tag, plain JS, no bundler/npm install.
- Portrait/mobile aspect ratio by default (~9:16).

## 8. Scope — MVP vs. cut

**MVP (must have to test if the core loop is fun):**
- Title screen showing "Bibou"
- "Load" and "Settings" buttons, visible with a hover state

**Explicitly out of scope:**
- Any actual load/settings functionality
- Any additional scenes, assets, or game logic

## 11. Tech notes

- **Platform:** Web (2D)
- **Engine/library:** Phaser 3, via CDN
- **Screen size / aspect ratio:** 480x854 (portrait, ~9:16), fixed size
- **Key technical risks:** None yet — this is a skeleton with no gameplay.
