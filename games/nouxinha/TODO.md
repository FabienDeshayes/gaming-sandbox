# TODO

Agents, fo not use this file as a list of things to implement, ignore it unless explicitly asked to add or remove something from it.

* Overall game goal
The goal is to bring back the light and colours to the world. there are 3 gems of colour that needs to be found. every time a new gem is found, new areas might be unlocked, new collectibles are visible, etc.
you'll likely need multiple runs to gather what is needed in order to get to the three gems.
* death condition
there is the concept of food and / or water. both decrease over time (water faster than food) so you need to gather some on the way, or refill at the hut.
if you run out of food or water, you die, meaning you lose everything.
something to consider: when you die you leave a bag with some of your loot for the next run. the question here is, if the map is procedurally generated, where to place the loot bag?
* unique objects
there are unique objects (like the gems) that will spawn at a fixed distance from the hut. they will need to be accessible somehow, aka there need to be a path to them. as gems will need to be picked in order, some areas containing these unique objects will need to be inaccessible until you find the corresponding gem.
* gems
picking up a gem restores colour to the world. each of the 3 gems is assigned a colour from the 3 that are not selected in the settings panel. once picked up, the visual of the world changes to be a mix of the old colours + the new one. to be more specific, the tiles will be the same, the rocks too, the collectibles will be of both colours, the character will have the new colour.
* compass object
the player can find a compass (or buy it from the merchant) to help guide toward gems and the hut. 
* collectibles
these will be coins for the merchant, food and / or water for now.


bugs / to correct:
* water should replenish when on the hut
* when you run out of all sources of light, you don't see anything but the adjacent tiles (and they are dimmed as if they are in the fog of war)