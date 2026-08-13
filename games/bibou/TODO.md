# TODO

random list of things. Agents, do not use this list as something you need to implement. It is here as a note for me to not forget things, don't over analyse this.

* concept of destructible for entities: if crashed again an obstacle like a wall, they would be destroyed. consider what would happen in that case
* add ennemies: will need to decide how they move, what actions they have available, how that is shown to the player, and the play order. For example ennemies can attack after each action, but this needs to show clearly in the UI. it should also not be just a copy of Into the Breach as it would be too complex. Maybe ennemies have different movements and if they reach the character, the game is over?
* add a "collectible" entity type: unlike crates, it wouldn't block or get pushed — moving/pushing another entity onto its tile would just pick it up. Everything currently on the entity layer (character, crates) blocks and gets pushed; collectibles are the intended exception, not yet implemented. Outstanding question: what if crates pick up a collectible? should they also be moved? Then only the character can pick up collectibles...