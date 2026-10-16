"use strict";
const assert = require("node:assert/strict");

// Use the actual bottom hand/weapon controls. This deliberately does not
// recreate the removed combat picklists or dispatch a reducer command.
function choose(ui, kind, value) {
  assert(["card", "slot"].includes(kind), "a combat choice is a card or slot");
  const area = kind === "card" ? "hand" : "slots", cleared = value === "" || value === null,
    buttons = ui.el(area).querySelectorAll(`[data-${kind}]`),
    button = cleared ? buttons.find(button => button.getAttribute("aria-pressed") === "true") :
      buttons.find(button => button.dataset[kind] === String(value));
  if (cleared && !button) return;
  assert(button, `${area} offers ${kind} ${value}`);
  if (cleared || button.getAttribute("aria-pressed") !== "true") button.click();
  return button;
}
function chooseControl(ui, formerControl, value) {
  if (["combatSelectCard", "combatSelectSlot"].includes(formerControl))
    return choose(ui, formerControl === "combatSelectCard" ? "card" : "slot", value);
  const control = ui.el(formerControl); assert(control, formerControl);
  control.value = String(value); control.fire("change");
  return control;
}
module.exports = { choose, chooseControl };
