# Warhammer 40k 10th edition

An attempt at implementing the rules of wh40k-10th into foundry, as I was dissatisfied with the lack of automation in other options for playing warhammer online at the time.

---
### Known issues

- Allegiance is currently determined based on the individual model's faction. This means mirror-matches or matches involving allied units from other factions will break the objective markers.
  - Workaround: either change the faction of models temporarily or calculate Objective captures manually

---
### Major Features

- Fully automatic attack roll resolution, allowing you to simply select a whole unit without having to worry about who is in range and how many models get melta or rapid fire bonuses
- Roster importer (.roz file format), to save time on data entry
- Surprisingly nice looking character sheets given how much of a pain they were to make (and how ugly some other things still look)
- Automated objective markers
---
### Not Implemented (yet, but no promises)

- Anything above the model level: units, turns, army, VP or CP tracking
- Automatic cover from LOS or any other terrain effect, apply cover manually 
- Auras
- Conditional active effects

---
### Active effects guide
In addition to standard active effect usage models also have several modifier fields in order to modify statistics used for attacks, the list below elaborates on some of the less immediately obvious uses.

- grants
  - modifiers with 'grants' in their path are applied to other models that attack this model
  - For example units with Stealth 'grant' a -1 on hitrolls to their attackers
- reroll
  - unmodified rolls of this fields value or below are automatically rerolled (once)
  - multiple reroll conditions can be added to this field by making sure to use the Add change mode
  - the string 'fail' can also be added, which causes the roll to be rerolled on a failure
- crit
  - unmodified rolls of this fields value or above are counted as crits
  - multiple crit conditions can be added to this field by making sure to use the Add change mode
  - the string 'success' can also be added, which causes any successful roll to count as a crit