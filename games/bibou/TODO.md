# TODO

random list of things. Agents, do not use this list as something you need to implement. It is here as a note for me to not forget things, don't over analyse this.

* concept of destructible for entities: if crashed again an obstacle like a wall, they would be destroyed. consider what would happen in that case
* add ennemies: will need to decide how they move, what actions they have available, how that is shown to the player, and the play order. For example ennemies can attack after each action, but this needs to show clearly in the UI. it should also not be just a copy of Into the Breach as it would be too complex. Maybe ennemies have different movements and if they reach the character, the game is over? once they exist, they should be able to pick up collectibles same as the character.
* decide what other collectibles do beyond the key (new actions, bonuses, purely symbolic ones, etc) — the `required`-gates-the-goal mechanic is only one use of the collectible system.