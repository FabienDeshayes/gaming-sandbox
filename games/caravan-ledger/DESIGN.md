# Caravan Ledger

## 1. One-liner

A trading game where you run a caravan between four towns for one 60-day season, and every price formula and every festival date is public.

## 2. Pitch

You buy goods cheap in one town and sell them dear in another. Your own trades move the prices, so the same route pays less the second time. Since nothing is hidden, the game is about planning: you read the calendar, pick routes and time your arrivals so you reach the gold goal before the season ends.

## 3. Core loops

**Day loop**
1. Sell what pays here, then buy what will pay somewhere else.
2. Tap a town to preview its prices on the day you would arrive.
3. Buy enough food and travel there (or wait a day).

**Season loop:** 60 days, starting with 60 gold, against a goal of 500 gold.

## 4. Core mechanics

| Mechanic | Description | Input |
|---|---|---|
| Visible prices | Buy = cap − supply. Sell = buy − 2, doubled during a festival for that good in that town. Each good has a cap: Grain 16, Salt 20, Wine 30, Cloth 26. Each row shows its own working (e.g. `30−22`). | Read the market table |
| Markets react | Buying 1 lowers supply by 1, so the price rises 1. Selling raises supply by 1. Supply drifts 1 per day back toward the town's normal level. | Buy / Sell buttons |
| Cart and food | The cart holds 6 goods. Each day, travelling or waiting, eats 1 food, which costs 2 gold in any town. You can't travel without enough food. | Food +1, Wait 1 day |
| Published calendar | Six festivals, each pairing a town and a good, with double sell prices for 5 days. | Calendar list (shows NOW / in Nd) |

There are four towns: Ashford, Brinemouth, Corvale and Dunmere. Roads take 2 to 5 days, and every pair of towns is connected. The arrival preview projects supply drift and festivals up to the arrival day. All the rules are in `logic.js`, which has no Phaser code. `main.js` holds the scenes.

## 5. Constraints

- Phaser 3 from the CDN, no build step, no external assets. The canvas is 480x854 portrait.
- There is no randomness anywhere.

## 6. Win / lose conditions

- **Win:** end the season with at least 500 gold. Unsold cargo counts for nothing.
- **Lose:** end the season under 500 gold.
- **Session end:** you can't travel past day 60. "End season" takes two taps and can be used at any time. The end screen offers a new season.

Calibration: a greedy bot that only looks one leg ahead finishes with about 470 gold. Randomised route search reaches about 630, so the goal needs some calendar planning.

## 7. Controls

| Action | Input (keyboard/mouse) | Input (touch/gamepad, if any) |
|---|---|---|
| Preview / pick a destination | Click a town (click again to clear) | Tap |
| Travel | Travel button | Tap |
| Buy / sell one unit | Buy / Sell in a good's row | Tap |
| Food, wait, end season | Buttons under the cart | Tap |

## 8. Scope

**Ideas for later:**
- Loans with interest ("a small loan into a fortune").
- More event types, such as shortages, gluts and closed roads, and multi-season play.
- A way to plan a route over several legs, with projected profit.
- Buy and sell several units at once, and undo.

## 9. Art & audio style

- **Visual style:** flat shapes in earthy colours. The map is boxes joined by roads labelled with travel days.
- **Audio:** none.

## 10. Theme

A merchant's season along a small trade road. The setting shows only in the town and festival names.

## 11. Tech notes

- **Platform:** Web (2D)
- **Engine/library:** Phaser 3. `logic.js` and `main.js` are plain scripts.
- **Screen size / aspect ratio:** 480x854, scaled to fit the window.
