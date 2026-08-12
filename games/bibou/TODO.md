# TODO

random list of things. Agents, do not use this list as something you need to implement. It is here as a note for me to not forget things, don't over analyse this.

* add walls: in between two tiles. Blocks moves, and can lead to interesting interactions 
* add items / things to pickup?
* add ennemies: will need to decide how they move, what actions they have available, how that is shown to the player, and the play order
* add a "collectible" entity type: unlike crates, it wouldn't block or get pushed — moving/pushing another entity onto its tile would just pick it up. Everything currently on the entity layer (character, crates) blocks and gets pushed; collectibles are the intended exception, not yet implemented