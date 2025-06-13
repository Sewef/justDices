---
title: JustDices
description: A formula-based dice roller
author: Sewef
image: /
icon: / 
tags:
  - dice
  - automation
manifest: https://justdices.onrender.com/manifest.json
learn-more: 
---


# JustDices

### Roll the dices!

## Formula
* Based on roll20 system
* `1d20` or `d20` or `D20` will roll 1d20
* Works with ` +` and ` -` modifiers
* Example: `1d8+6`

## Commands
* Still based on roll20
* `/r d20` + `Enter` will roll 1d20 and broadcast the result
* `/gr d20` + `Enter` will roll 1d20 but only GMs and the player will see the result
* With no `/r` or `/gr`, the result is broadcasted
* Example: `/r 1d20`, `1d20` are public rolls, `/gr 1d20` is private

## Buttons
* Any formula will automatically get `/gr` or `/r` prefix when pressing the "Hidden roll" or "Roll it" button
* Todo: better handling or "submit tag"...

### Rolls History

* Rolls are displayed here, in a box there are:
  - Player who rolled
  - Command used
  - Detailed roll output
  - Result
* Min roll is red, max roll is green
* The Reroll button will send the exact command used again, it can be used by all players but, by the way it's done, will stay public or private roll