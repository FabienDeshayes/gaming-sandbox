# Open Hand

## 1. One-liner

A card battler where nothing is ever shuffled: your deck is a queue you put in order, and the enemy's queue is face up.

## 2. Pitch

You fight four enemies in a row with a 10-card deck. You choose the order of your queue before each fight, and you can see every move the enemy will make, so each fight is a puzzle about timing your blocks and hits. After each win you add one card and retire one, so the deck stays at 10.

## 3. Core loops

**Turn loop**
1. You draw the top 3 cards of your queue and get 3 energy.
2. You play cards. Each played card goes to the bottom of the queue.
3. The preview line shows what the enemy's next intent will do to you, given your current block.
4. When you end the turn, unplayed cards go back on top of the queue, and the enemy does its front intent, which then moves to the back of its queue.

**Run loop**
1. Arrange: tap two deck cards to swap them and set the queue order for the next fight.
2. Fight the enemy.
3. Reward: heal 10, then add one of 4 fixed offers and retire one deck card (or skip).
4. Repeat for 4 fights.

## 4. Core mechanics

| Mechanic | Description | Input |
|---|---|---|
| Queue deck | No shuffle. Draw the top 3. Played cards go to the bottom, unplayed cards go back on top. | Arrange screen: tap two cards to swap them |
| Face-up enemy queue | Each enemy repeats a fixed list of intents: Attack N, Block N, or Str +N (adds to all its attacks). Enemy block lasts until its next action. | Read it |
| Queue cards | Swap, Skip, Dig, Echo (copy the top card's effect) and Feint (pushes the enemy's next intent to the back) change either queue | Tap the card to play it |
| Add one, retire one | The deck is always 10 cards. Retired cards are listed on the arrange screen. | Reward screen |

The pool has 15 cards: Strike, Guard, Jab, Heavy, Wall, Riposte, Pierce, Mend, Momentum, Swap, Skip, Dig, Echo, Feint and Disarm. Each card's cost and text are printed on it. All the rules are in `logic.js`, which has no Phaser code. `main.js` holds the scenes.

## 5. Constraints

- Phaser 3 from the CDN, no build step, no external assets. The canvas is 480x854 portrait.
- There is no randomness. The enemies, their queues and the reward offers are fixed.

## 6. Win / lose conditions

- **Win:** beat all 4 enemies: Rat Swarm (20 HP), Bandit (32), Golem (44), Warden (60).
- **Lose:** your HP (40, carried between fights) reaches 0.
- **Session end:** a run of 4 fights. The end screen has Play again and Title buttons.

## 7. Controls

| Action | Input (keyboard/mouse) | Input (touch/gamepad, if any) |
|---|---|---|
| Swap two queue cards (arrange) | Click one card, then another | Tap one card, then another |
| Play a card | Click it in hand | Tap it |
| End turn | End turn button | Tap |
| Pick a reward | Click an offer, then a deck card, then confirm | Tap |

## 8. Scope

**Ideas for later:**
- Let the player reorder the queue in a limited way during a fight, and add more queue-bending cards.
- Branching enemy choice or longer runs, and enemy cards that tamper with your queue.
- A dedicated "retired cards" shelf view, and a run summary.
- Tune the numbers with a simulator. A greedy bot currently wins with about half its HP left.

## 9. Art & audio style

- **Visual style:** flat coloured rectangles. Red cards are attacks, blue cards block, purple cards bend the queue and green cards are utility.
- **Audio:** none.

## 10. Theme

Hardly any. It is a mechanics-first prototype.

## 11. Tech notes

- **Platform:** Web (2D)
- **Engine/library:** Phaser 3. `logic.js` and `main.js` are plain scripts.
- **Screen size / aspect ratio:** 480x854, scaled to fit the window.
