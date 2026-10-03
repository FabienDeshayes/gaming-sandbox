# Nouxinha today — screenshots for the blog post

Taken from the game as it stands at `abfa7e0` (3 October 2026), at 2× the design size (960×1708) so the
pixel art stays crisp. Each in-game shot comes from a real run. It was walked through `core/rules.js`
`step` in Node, saved into a slot the same way SAVE GAME does, then loaded through LOAD GAME in the
browser, and the last steps were tapped on the real D-pad. Nothing in `src/` was changed. Cheats were
off for every shot.

The four worlds are the same seeds throughout: temperate `-1640531535`, frozen `-609154949`, desert
`-1587889288`, mystical realm `-626627309`.

## Header images

| | |
|---|---|
| ![](today/00-four-worlds.png) | **The four kinds of world.** Each is the same moment: standing at the nearest landmark late in a campaign, with all three colours brought home. |
| ![](today/00-colour-comes-back.png) | **The colour comes back.** The same spot in the temperate world on a first expedition (no gems, a small torch) and late in the campaign (three gems, every landmark's standing, a lantern). |

## Title and slots

| | |
|---|---|
| ![](today/01-title.png) | The title screen. The wizard's flair colour is random on every visit. |
| ![](today/02-slots.png) | LOAD GAME on a campaign two worlds in. |

## Before and after, in every world

Each pair is the same tile. On the left is a first walk: no colours held, a small torch, and the world
drawn in its own two colours. On the right is the same spot carrying all three gems, where the
landmark, the chest and the keys take back their colours.

| Before | After |
|---|---|
| ![](today/10-temperate-before.png) | ![](today/11-temperate-after.png) |
| ![](today/10-frozen-before.png) | ![](today/11-frozen-after.png) |
| ![](today/10-desert-before.png) | ![](today/11-desert-after.png) |
| ![](today/10-mystic-before.png) | ![](today/11-mystic-after.png) |

## Wisps: lights nobody is carrying

Walked under the smallest torch, so the wisp's own round light stands out.

| | | | |
|---|---|---|---|
| ![](today/20-wisp-temperate.png) | ![](today/20-wisp-frozen.png) | ![](today/20-wisp-desert.png) | ![](today/20-wisp-mystic.png) |

## Reading the world

| | |
|---|---|
| ![](today/30-signpost.png) | Bumping into a signpost reads it on the text panel. |
| ![](today/31-carved-stone.png) | A carved stone. What it says depends on how many worlds the campaign has finished. |
| ![](today/32-landmark-bell.png) | The Bell, in the desert. |

## Sanctums, the merchant, the inventory

| | |
|---|---|
| ![](today/40-sanctum-temperate.png) | Inside the third sanctum, with its gem still on the floor. Temperate world. |
| ![](today/40-sanctum-frozen.png) | Frozen. |
| ![](today/40-sanctum-desert.png) | Desert. |
| ![](today/40-sanctum-mystic.png) | Mystical realm. |
| ![](today/41-sanctum-wall.png) | Outside a sanctum's wall in the mystical realm. |
| ![](today/50-merchant-stall.png) | The merchant's stall, out in the dark. |
| ![](today/51-merchant-shop.png) | The stall's counter. |
| ![](today/52-inventory.png) | The inventory: three lights, three gems, three keys. |

## The map

Each map comes from one long walk: every landmark and sanctum in the world in turn, then back to the hut.

| | | | |
|---|---|---|---|
| ![](today/60-map-temperate.png) | ![](today/60-map-frozen.png) | ![](today/60-map-desert.png) | ![](today/60-map-mystic.png) |

![](today/61-coming-home.png)

Coming home to the hut at the end of that walk.

## The hall, and the end of the game

| | |
|---|---|
| ![](today/70-the-hall.png) | Nouxinha himself, in the middle of the hall. |
| ![](today/71-sorcerer.png) | Walking into him. |
| ![](today/72-sorcerer-speaks.png) | He talks about the landmarks you brought with you. |
| ![](today/80-ending-words.png) | The fourth kind of world finished. |
| ![](today/81-ending-light.png) | The light going off from the character. |
| ![](today/82-credits.png) | The credits, in the inverted colours. |

## The tutorial

| | | | |
|---|---|---|---|
| ![](today/90-tutorial-you.png) | ![](today/91-tutorial-hut.png) | ![](today/92-tutorial-water.png) | ![](today/93-tutorial-signpost.png) |

## Behind the scenes: the dev tools

The game's art and words are made in a set of development pages, all drawn in the game's own palette.

| | |
|---|---|
| ![](today/95-dev-tiles.png) | `tiles.html`: the tile sheet with coordinates. |
| ![](today/95-dev-draw.png) | `draw.html`: drawing a tile's pixels. |
| ![](today/95-dev-paint.png) | `paint.html`: painting a tile's colour zones. |
| ![](today/95-dev-biomes.png) | `biomes.html`: which tile each biome draws. |
| ![](today/95-dev-states.png) | `states.html`: every sprite in every state it can be drawn in. |
| ![](today/95-dev-distances.png) | `distances.html`: the world from above, and how far everything really is to walk. |
| ![](today/95-dev-text.png) | `text.html`: every word in the game, for review. |
