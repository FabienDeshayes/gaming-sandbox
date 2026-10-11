# The Ninth Guest

## 1. One-liner

A time-loop dinner party: relive the same evening with 6 actions, fill a notebook, and prove who poisons the Host.

## 2. Pitch

Every night at midnight the Host dies of poisoned brandy, and the evening restarts at 6 pm. Four guests follow fixed hourly schedules across five rooms; you keep nothing but your notebook. Moving an object changes a guest's schedule in a way the game tells you up front, which is how you set up the one observation that proves the case.

## 3. Core loops

1. Each hour (6 pm to 11 pm) pick one action: watch a room, ask a guest, or move an object. The preview says exactly what it will do.
2. The notebook records who was where and what they did.
3. At midnight the Host dies and the loop restarts. Reason over the notebook between nights.
4. When an entry proves it, accuse the guest and present that entry.

## 4. Core mechanics

| Mechanic | Description | Input |
|---|---|---|
| Schedules | Host and 4 guests (Dr. Reyes, Miss Calloway, Colonel Hart, Mr. Finch) each have one room and activity per hour, identical every night unless an object was moved. | — |
| Actions (6 per night) | Watch a room (note everyone there, plus the decanter's state). Ask a guest (find them, hear their one statement, and note their room). Move an object (note that room, then the object is in its new room from the next hour on). | Tap a room / guest / object, then "Do it" |
| Objects | Calloway's letter (Study to Library): if it is in the Library by 9 pm she finds it and skips the Study at 10 pm. Brandy decanter (Study to Dining Room): whoever goes to the decanter goes where it is, and the Host drinks from it at 11 pm wherever it is. | Move buttons |
| Notebook and accusation | A who-was-where grid (latest sighting per person and hour, * if an object had changed things) plus every entry from every night. Accuse = pick a guest, then the entry that proves it. | Notebook / Accuse buttons |

## 5. Constraints

- Phaser 3 text and rectangles only, no assets, no build step. 480x854 portrait, tap-first.
- Fully deterministic; nothing hidden is random.

## 6. Win / lose conditions

- **Win:** accuse Mr. Finch with an entry showing him alone at the decanter at 10 pm. By default Calloway is in the Study then too, so the entry is ambiguous; moving the letter early (by 8 pm), or moving the decanter to the Dining Room, separates them.
- **Lose:** 6 nights pass without a proven accusation. A wrong accusation ends the current night.
- **Session end:** solved or out of nights; Play again.

## 7. Controls

| Action | Input (mouse) | Input (touch) |
|---|---|---|
| Choose action | Click a room, a guest under Ask, or an object under Move | Tap |
| Commit (uses the hour) | "Do it" | Tap |
| Notebook / Accuse | Buttons at the bottom | Tap |

## 8. Scope

**Built:** 4 guests, 5 rooms, 6 hours, 2 movable objects, one mystery with two routes to the proof, notebook grid and entries, 6-night limit.

**Later:**
- Questions that depend on what you already know (show a guest a notebook entry).
- More objects that cascade through several guests; a second mystery with a twist on the first.
- Tap a grid cell to filter notebook entries.

## 9. Art & audio style

- **Visual style:** warm dark palette, serif text, rooms as framed rectangles.
- **Audio:** none.

## 10. Tech notes

- **Engine/library:** Phaser 3 from CDN, plain scripts.
- `logic.js` holds the schedules, objects, story text and rules (`window.NG`, also `require()`-able in node); `main.js` is UI only.
