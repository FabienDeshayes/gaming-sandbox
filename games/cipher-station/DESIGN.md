# Cipher Station

## 1. One-liner

A night radio operator decodes a tiny, perfectly consistent alien language, using a handful of replies per night as experiments.

## 2. Pitch

Transmissions arrive as strings of unfamiliar glyphs. Nothing is unlocked by items, only by understanding: the station answers every reply you send, so each reply is both an answer attempt and a costly experiment. Three short nights, each adding a few signs, end with one sign turning out to mean something other than what you assumed.

## 3. Core loops

1. Read the log (RX = them, TX = you); the transmission to answer is outlined.
2. Form a guess about a sign, build a reply from the glyph keyboard, TRANSMIT (costs 1 reply).
3. The station answers deterministically; update your guess.
4. Answer the outlined prompt(s) to decode the night; the log carries into the next night.

## 4. Core mechanics

| Mechanic | Description | Input |
|---|---|---|
| The language | 9 glyphs, one consistent grammar (below). Meanings are never shown. | Read |
| Replies | 3 / 4 / 4 replies per night. Every transmission costs one. | TRANSMIT |
| Station answers | A number (expression) is an answer attempt: correct → "true" and the next prompt; wrong → "not true". A statement is graded "true" / "not true". Anything ungrammatical → "unknown". | Automatic |
| Keyboard grows | Only glyphs you have seen in the log are on the keyboard. | Tap a glyph |

**Grammar** (`logic.js`): `one` repeated counts (three dots = 3); `zero`; `plus` adds terms; `eq` makes a statement; `not` negates the whole statement after it; `yes` = true/correct; `unk` is the blank in a prompt; `send X` = "send me X"; `chan` = the current channel number.

**Nights:**
1. Channel 1: counting, equals, true / not-true from examples. Prompt: 2 + 1 = ?
2. Channel 2: zero and `not` over a whole statement. Prompts: "send 3", then ? + 2 = 2.
3. Channel 3: a sign that seems to mean "three". Prompts: C + ? = 5, then "send C + 1". Answering retunes the station to channel 4 and they confirm C = 4: the sign was "this channel".

## 5. Constraints

- Fully deterministic; same reply, same answer, every time.
- Glyphs drawn with Phaser graphics primitives (no fonts or assets), 480×854 portrait, tap-friendly.
- Pure language and night logic in `logic.js` (no Phaser), checkable in node.

## 6. Win / lose conditions

- **Win:** answer the last prompt of night 3 (opens channel 4).
- **Lose (a night):** run out of replies. Retry replays that night from its start; earlier nights stay in the log.
- **Session end:** after night 3, back to the title.

## 7. Controls

| Action | Input (keyboard/mouse) | Input (touch) |
|---|---|---|
| Add a glyph to the reply | Click a glyph key | Tap a glyph key |
| Delete last / clear | DEL (or Backspace) / CLEAR | DEL / CLEAR |
| Send | TRANSMIT (or Enter) | TRANSMIT |
| Scroll the log | Drag or mouse wheel | Drag |

## 8. Scope

**Built:** title with how-to-play; 3 nights with intro examples, 1-2 prompts each, reply budget, deterministic grading of answers and experiments, cumulative log across nights, growing keyboard, end-of-night and final screens.

**Ideas for later:**
- A notebook where the player tags each glyph with a guessed meaning.
- More nights: repetition as emphasis or plural, a tense marker, questions the aliens ask about you.
- Branching replies: different correct answers open different frequencies.
- Carry unused replies over to the next night.

## 9. Art & audio style

- **Visual style:** green phosphor terminal; their lines green, yours amber.
- **Audio:** none.

## 10. Theme

A lone listening post at night, slowly realising the signal is a conversation.

## 11. Tech notes

- **Platform:** Web (2D), Phaser 3 from CDN, plain scripts (`logic.js`, `main.js`), no build step.
- **Screen size:** 480×854 portrait, scaled to fit.
