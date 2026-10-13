# Bloodborne Solo 0.6.0 — Long Hunt chapter one

Open `hunt.html` after extracting the complete archive. New hunts default to **기나긴 사냥 · 챕터 1**. The same setup dialog offers the unchanged v0.5 actual-map practice mode and four separate provisional-component trials. `index.html` and `chapter.html` keep their earlier training and map-inspection roles.

## Current implementation

- `mission-engine.js` executes chapter-one cards 1–16 from the supplied campaign material. Reveals are conditional: starting mission, tile movement completion, escort delivery, rescue interaction and chase result, a player-selected rescue outcome, and final mission death. The source `reveal` arrays remain reference lists and are never treated as unconditional instructions.
- Completed white outcome/reward cards provide insight. Special-enemy revival tokens are separate: a prevented death heals the figure and spends a token without granting echoes, kill callbacks or cancelling a later attack. Reset refills those tokens and prioritizes mission spawn jobs; mission figures are protected from ordinary supply relocation.
- Fog breaks the local lamp, removes ordinary occupants and blocks their spawning, crossing and separated activation. Hunters can enter but cannot leave except through the dream until the mission finishes. Completing the mission removes fog and restores its lamp. Teleportation returns a carried survivor before evaluating movement-completion conditions.
- The escort is an optional pickup when leaving the named house space. The rescue survivor initially flees four spaces with exploration and later one space at turn end without exploration. NPC placements check shortest-path distance after all new-tile connections, preventing circular-map shortcuts from moving it toward the closest hunter. Rescue completion uses actual pursuit into the final space, then exposes only the selected outcome.
- The Central Lamp target appears after two completed insight missions. Its final defeat completes chapter one and immediately enters the final dream. Remaining echoes buy upgrades, healing and reward preparation complete, and progression is retained without advancing the hunt track or beginning an unimplemented chapter. Mandatory reward choices remain possible after simultaneous victory and hunter death.
- `rewards-engine.js` handles six chapter-one rewards: Blood Stone Shard, Lantern, Moon, Clawmark, Blood Rapture and Eye, plus acquisition/equipment of Ludwig's Rifle. Tools and runes have independent two-card equipped limits; excess cards and firearms are retained. Shard persists on its selected slot, Clawmark replaces all stat-card effects, and Moon/Rapture usage requires an explicit player choice. Ordinary rewards exhaust and recover in the dream.
- `temporary-components.js` contains user-authorized, authored **provisional** definitions for Cleric Beast's two phases, Female Beast Patient A/B and an Iosefka NPC interaction. The four trials are separate selections in the new-hunt dialog. They are not transcriptions or evidence that the actual chapter-two/three campaign is implemented. Replace this adapter when the corresponding physical sheets/cards are supplied; preserve the photographed source catalogue.

## Persistence and validation

`E.create()` retains practice as the engine default; the UI explicitly enables chapter one with its seventh-argument campaign option. Provisional trials use a separate setup option. Starting choices remain in setup for deterministic command replay. The DOM-free reducer is the authority for legality, and rejected commands leave the prior state untouched.

The save format remains `bloodborne-hunt-save` version 1. Existing v0.5 practice JSON replays without adding campaign progress. New browser storage uses `bloodborne-hunt-v06`; the old `bloodborne-hunt-v05` is preserved. The button **이 브라우저의 v0.5 사냥 불러오기** appears when that browser has an older automatic save. Export before moving folders or browsers. Chapter-one completion stores the twelve-card growth deck, consumables, rewards, firearms and completed insight cards for later work.

Run `npm test` in a Node development environment. Relevant tests cover the prior combat/map rules plus mission reveals, fog, token death prevention, escort resets, NPC exploration, chase qualification, outcome selection, reward effects/equipment and final-dream behavior. `VERIFICATION.txt` records the final delivered build's checks; documentation does not substitute for playthrough evidence.

## Current boundaries and source checks

Actual chapter-two/three mission execution and automatic transitions are not implemented, and online multiplayer remains future work. The provisional trials do not advance those chapters. Holy Chalice Church consumable exchange, Bone Ash's reward-readiness connection and the multiplayer Hunter Bell remain unsupported. Additional firearms retain the user's previously authorized Hunter Pistol behavior substitution.

The supplied Korean `블러드본한국어규칙서_압축.pdf` was checked for fog/reset, chapter completion and teleport rules (pp.24–26). The supplied campaign/figure/card/tile records and [CMON FAQ v1.0](https://www.cmon.com/wp-content/uploads/2023/06/Bloodborne_Boardgame_FAQ_v1.0.pdf) establish insight outcome cards, revival-token death prevention and Shard persistence. Raw campaign JSON/photos retain their ingestion-time metadata; current execution resides in the dedicated mission/reward/provisional modules, not rewritten source transcriptions.

Next: replace provisional component definitions with the user's real sheets, then connect chapter-two/three mission branches and chapter setup to the retained completion/growth state. Multiplayer subsequently needs a server-authoritative reducer and ownership/revision validation.

---

# Historical release v0.5.0 — actual-map combat

Open `hunt.html` after extracting the complete archive. The existing training (`index.html`) and free map inspector (`chapter.html`) remain separate and retain their save formats.

## Implemented in this release

- `hunt-data.js` uses the actual three enemy species/six faces and the user's twenty upgrade definitions. Inventory consists of twelve starting stats, sixty upgrades, and thirty-six consumables excluding the invitation. Unused cards and removed upgrades remain accounted for.
- `hunt-engine.js` is a DOM-free command reducer. It reuses the actual tile graph, shuffled chapter-one assignments, and common six-card enemy deck. Movement pays a stat card, exploration spends movement, and pursuit follows the recorded trail. Activation dynamically reevaluates eligible enemies in board-slot order; newly spawned figures can act. Beast movement overrides apply to activation and pursuit.
- Combat separates action-card kind from attack/ability semantics. Pistol legality is shared by UI and reducer. Instant abilities resolve extra card draws/choices; timed abilities participate in speed order and precede a hunter at equal speed only where the actual card specifies it. Faster kills prevent later abilities; displacement can cause the later attack to miss while attack-linked after-effects still resolve for a living hunter.
- Scourge Beast B uses a separate second-damage decision even after first-hit dodge/stagger. Block is immediate; ability damage is not increased by Frenzy. Stun, card-effect choices, free transformations, paths and figure relocation use serializable continuations.
- Real upgrade effects include Leap paths, immediate stat-placement effects, clear-slot/discard/status choices, attack/kill/dodge callbacks, speed modifiers and non-attack-action healing. Leap validates the chosen path and consumables before movement commits. The hunter retains twelve cards through dream replacements. Rejected commands leave the prior state unchanged.
- Reset orders normal spawn jobs by proximity, refills tokens and preserves assignments/behavior deck. Figure supply is four per species. New-tile population occurs before hunter entry, matching the printed rulebook.
- Saves use `bloodborne-hunt-save`, independent key `bloodborne-hunt-v05`, bounded JSON/history, and replay comparison from setup/seed. Browser UI performs only commands; it does not implement separate legality rules.

## Deliberate boundaries

This is a solo combat and growth loop using chapter-one setup, not a completed Long Hunt campaign. Missions, insight, reward use/acquisition, bosses, fog gates, chapter transitions, and online play are not connected. The starting mission remains in the source archive, not a fabricated playable mission.

Tile effects connected: Grand Cathedral healing, Oedon Chapel enemy-attack speed reduction, Great Bridge movement restriction, Tomb of Oedon consumable choice, Clinic once-per-turn trade, and Central Lamp lamp-to-lamp teleport. Holy Chalice Church consumable exchange and fog destinations remain disabled and disclosed; no assumed token/card conversion is executed.

Ambiguous enemy path/activation/supply ties remain player choices, with the rulebook's adverse-outcome guidance. Temporary firearms all retain the user's Hunter's Pistol substitution. Blood Stone/Queenly Flesh and all other reward data are preserved for the next stage.

Rules were checked against the supplied Korean rulebook (especially pp.15–24), supplied enemy/tile/card material, and CMON's official FAQ v1.0 (https://www.cmon.com/wp-content/uploads/2023/06/Bloodborne_Boardgame_FAQ_v1.0.pdf). Tests are implementation evidence for the stated scope, not proof of every campaign or expansion rule.

## Next implementation

Connect the chapter-one mission state to events already emitted by this engine (move completion, enemy death, interaction, dream and reset); then reward acquisition/equipment and boss phases. Keep hidden scenario branches unrevealed until their conditions occur. Online multiplayer subsequently requires a server-authoritative reducer, authenticated player ownership and revision checks; current solo commands are not multiplayer authentication.

---

# Historical notes through v0.4.0

# Current release: v0.4.0

`index.html` retains the training engine and v0.3 save compatibility. `chapter.html` is a separate executable **chapter-1 setup and map preview**, not a complete campaign. The map layer consumes the actual chapter/enemy/tile source JSON. This milestone closes setup/randomization and map geometry/spawn work; integration with card costs, pursuit, activation, combat, tile effects, hunt track, fog and missions remains outstanding. Never advertise the preview as full chapter play.

`enemy-deck.js` is shared by both modes: basic ×3, special ×2, ability ×1, recycle only when an empty draw pile must supply another card (rulebook p.20). Existing training RNG ordering and logs were preserved. `BBEngine.canFirearm` is the shared engine/UI legality predicate; all four firearms have basic-only testing rules. Both buttons show explicit unavailable labels for special/ability. Disabled hover styles no longer light up. A named attack is not automatically a basic attack: legality is based on the behavior kind.

`chapter-engine.js` is DOM-free and immutable at the command boundary. Setup chooses three species/one side each/one slot each, central tile plus four required and two unused random tiles, with named optional tiles eligible. A seeded avalanche precedes xorshift so nearby numeric seeds do not bias the first three-card permutation. Graphs rotate exits but retain original space IDs. Tile placement is mandatory after drawing; cross-tile edges require exits on both sides. If every orientation closes the entire map while tiles remain, another candidate is drawn and rejected tiles are shuffled back. The final tile may close the map because there is no further tile to draw.

Spawn queues enforce each four-figure supply. The hunter enters after pieces are populated (p.15), so relocation distances use the pre-entry position. Farthest ties pause for player selection. Only one hunter is supported here. Layout reset replaces map figures/tokens, leaves positions/assignments/decks unchanged and never simulates scenario reset effects. MOVE is explicitly a free inspection move, not a rule-complete movement action. DRAW_BEHAVIOR is an inspector: it shows the selected side's exact action but does not execute chains or combat. No training enemy ability is substituted for an actual enemy.

Map saves use format `bloodborne-chapter-map`, version 1, an independent browser key, a 2 MB / 2,000-command bound, and replay comparison. Initial central space is user-selectable (p.10). Preparing a new chapter overwrites only that preview session; imported training saves are rejected. The source catalogue retains `automated=false` for full campaign automation while `chapterSetupRules.chapter1SetupAutomated=true` identifies completed scope.

Next: connect this map state to the hunter/card engine, then actual six enemy faces and precise ability timing/extra draws, tile effects and chapter-1 missions. Existing tests cover map geometry, figure supply, persistence and deck/firearm boundaries. These tests are not evidence that mission or enemy combat automation is finished.

---

# Earlier implementation notes (historical)

# Bloodborne Solo Rules Lab 0.3

This is a user-requested local application, with no hosted deployment or external game services. Play by opening `index.html` after extracting the complete archive. Browser assets have no network dependencies. Node is only required for development tests.

## Boundaries

Confirmed source: the user's 28-page Korean rulebook, `블러드본한국어규칙서_압축(2).pdf`. Text was extracted and key illustrations inspected. Printed page references are in `guide.html` and `data.js`.

The base stat cards follow the rulebook. Burial Blade and Hunter’s Pistol were transcribed from the user’s four photos and text on 2026-10-11. The original training weapon, monsters, their actions, map, upgrades and mission remain **invented training fixtures**, consistently labeled in the UI. They must not be treated as official Bloodborne component data. The full rulebook is not embedded. This is not a completed campaign or general engine for every expansion.

## Layers

| File                  | Responsibility                                                             |
| --------------------- | -------------------------------------------------------------------------- |
| data.js               | Read-only definitions; content ID; graph and fixtures                      |
| engine.js             | Deterministic state transition, rules, command validation, save validation |
| app.js                | Browser rendering, selection, persistence, import/export                   |
| tests/engine.test.cjs | Critical timing, legality and persistence regressions                      |

`BBEngine.create(seed, weaponId = "burial", face = 0, startingConsumable = "blood-vial")` initializes a serializable state. `dispatch(state, command)` clones the input, validates the current phase and command, applies effects, checks invariants, and returns the next state. Rejected commands leave the input untouched. The engine works both through browser globals and CommonJS, with no DOM access, timers, network requests, or `Math.random()` calls.

Public commands carry a type and optional `hunterId`; the current build accepts only `hunter-1`. This identity field is **not authentication**. A future server must derive player identity from the authenticated room/session, validate authority, and reject stale revisions. The browser cannot be authoritative in online play.

Example:

```js
const E = require("./engine.js");
let state = E.create(20261011);
state = E.dispatch(state, {
  type: "MOVE",
  hunterId: "hunter-1",
  cardId: E.hunter(state).hand[0].id,
});
state = E.dispatch(state, { type: "STEP", node: "c1" });
```

## State and choices

State contains a hunter record, graph positions, enemy instances, card zones, RNG state, track, round, last-round flag, mission flags, active continuation and command history. Current phases are `hunter`, `move`, `combat_choose`, `combat_react`, `stun`, `activation`, `refill`, `return`, `upgrade_pick`, `upgrade_replace`, `over`.

- Combat stores the attack snapshot when a card is committed. Clearing that slot does not erase the already-declared attack.
- Both attacks at one speed are determined before health changes. The death of an attacker at the same speed does not cancel its attack.
- Stun pauses the resolver for a discard decision before continuing slower attacks. Same-speed stun remains payable even when the enemy died.
- An enemy's dedicated ability is not an attack. The two training abilities resolve on reveal.
- A sole eligible enemy activates automatically. Several enemies with the same rank would prompt a choice, but the present fixtures have one per rank.
- Pursuit happens only after a movement action. The demo graph is a tree with one route between any pair of spaces; ambiguous shortest paths are not implemented.
- Entering the dream immediately advances the track. Finishing the round advances it again. Reaching the final track position mid-round does not retroactively mark that round as final.
- Upgrade purchases are chosen first, replacing the market each time. Then the player chooses which existing cards to replace or which purchased cards to discard. Main deck total remains 12.

## Persistence

JSON saves use format `bloodborne-solo-save`, schema 1, and the exact content ID. Every load replays all saved commands from the initial seed and compares canonicalized state, rejecting corrupted or edited files. This is a local integrity/reproducibility check, not cryptographic anti-cheat. UI imports are capped at 2 MB; history is bounded to fewer than 10,000 commands. Different content versions intentionally reject each other's saves until migration is implemented.

The app keeps browser-local automatic saves and supports explicit file export. File URL storage behavior varies by browser; the explicit JSON export is the portable save path. Never store authentication credentials in this game state.

## Unimplemented and deliberately constrained

- All actual campaigns, scenario deck transitions, weapon abilities other than Burial Blade, rewards and actual upgrade deck effects.
- Tile discovery, rotation, placement validation, finite miniature supply, central lamp teleport, fog gates, broken lamps.
- Boss phases, NPCs, multi-hit and area effects, enemy speed modifications and most card-specific timing exceptions.
- Multiple hunters, round order choice, effects on inactive hunters, enemy movement blocked by other hunters, player-count scaling.
- General event subscriptions and condition/effect DSL. Current mission flags are a fixture and need replacement with explicit scenario triggers.
- Online rooms, authority, reconnect, concurrent command ordering and server persistence.

When an effect offers equally valid outcomes, page 24 requires the outcome least favorable to hunters. No arbitrary tie-breaker should silently replace this rule. The current map avoids equal-distance routes, and one enemy per rank avoids activation order ambiguity. Future content needs explicit choice prompts or a validated deterministic rule where the adverse result can be computed.

## Next implementation milestone

1. Burial Blade and the starting pistol are now available. Next transcribe enemy card sides, chapter setup/mission and all referenced cards, tiles, upgrade/consumable pool and counts.
2. Review a structured transcription with the user, listing unresolved icons/timing separately.
3. Introduce typed effects with windows such as `on_attack`, `on_reveal`, `at_speed`, `after_attack`, `on_kill`, `on_move_end`, `on_interact`, `on_reset`.
4. Make that one chapter playable end-to-end with replayable regression scenarios before broadening content.
5. Generalize turns and state for 1–4 hunters, then run the engine on a room server. Clients submit commands, the server sequences them by revision, computes state and sends per-player views.

Do not expose secret deck order or unrevealed mission text through the network views. For online mode, replace the full-state client save with a server-side snapshot, and derive identity from the connection. Reconnection should use a current snapshot plus events after a revision. The present event log is display text; production network events should be typed and versioned.

## Verification

Run `node --test tests/engine.test.cjs`. These tests target legality, simultaneous deaths, interrupt speed comparison, dodge slot timing, card zone conservation, stun continuation, poison, dream recovery, market replenishment, last-round semantics, and save replay. Browser and full-run verification results are recorded in `VERIFICATION.txt` in the delivered package.

## Campaign source ingestion (v0.2.1)

`campaigns/long-hunt/data.json` stores 67 photographed records, normalized Korean rule text, card references, chapter entries, source filenames and original SHA-256 hashes. Narrative text remains available through all 67 resized source photos. `data.js` is the identical browser export; `campaign.html` is an offline reference viewer with a spoiler gate, search and reference navigation.

This is **reference data**, not an executable campaign. `automated` is false. The `reveal` field is a list of possible references, not an unconditional reveal instruction. Conditions remain in the corresponding `rules` paragraphs. Future rules compilation must distinguish movement completion, entering a tile, turn end, round end, before death, phase change, optional costs and reward ownership.

Resolved Q57 (user confirmation, 2026-10-11): printed `야수 사냥 하수인` means `야수 사냥 하인`. Original transcription remains intact; `enemyNameAliases` links it to `huntsmans-minion`. The confirmation remains in `questions`, while card 57 has an empty `openQuestions` list and `resolvedQuestions: ["Q57"]`. Symbols are separately mapped to lamp, brown spawn and purple hand spawn; do not conflate a scenario's lamp spawn with a normal enemy spawn point. The third chapter's photographed mission side precedes its setup side.

Next dependencies and implementation sequence are in `campaigns/long-hunt/READ_ME.txt`. No gameplay engine or save schema changes were made; v0.2 saves remain compatible. Run `npm test` for engine and reference integrity checks.

## Enemy source ingestion (v0.2.2)

Six photographs from `20261011_140211.zip` are recorded in `data.enemies`: Huntsman Mob, Scourge Beast and Huntsman's Minion, each with two distinct sides. A/B follows each species' filename order and does not claim an official front/back designation. Basic/special attacks separate speed, damage, keywords and additional printed rules. Ability timing is recorded only where a speed is explicitly printed. Movement overrides for Scourge Beast specify two spaces on activation and pursuit. `miniatureCount` is 4 for each species, confirmed by the user on 2026-10-11; `miniatureCountSource` preserves this confirmation.

These records are not connected to the executable engine. Before implementing, preserve the following exceptions: Scourge Beast's second hit persists after dodge/interrupt of the first hit; Minion's slam cannot be interrupted and affects other hunters separately; Mob's firebomb allows a different printed dodge speed from its own timing; spawned beasts depend on the figure supply; ability chains that reveal another action card require the common action-deck rules. Do not infer figure counts, default card sides or path choices from photographs.

## Burial Blade implementation (v0.2)

The front snapshots a fixed range-1 damage-1 effect onto each declared attack. It excludes the direct target, includes other enemies at distance 0 or 1 from the hunter, and resolves in the same speed group. Stat-card damage bonuses do not scale it. Interrupt cancellation prevents it, while simultaneous lethal damage still permits that speed group to finish. All defeated enemies grant one echo each, capped at three; simultaneous hunter death then clears all echoes.

The back accepts a `pullIds` array on `ATTACK` or `COUNTER`. The engine validates unique IDs against graph distance 2, moves them and commits the attack atomically. No independent pull command is provided. Failed attack validation rolls back the entire cloned state. UI checkboxes only preview selection, not move pieces. Counterattacks retain the attacking enemy as the direct target.

Interpretation boundary: the literal “before attacking” is implemented before direct-target validation, allowing a remote enemy to be pulled into the space and then attacked. The supplied card does not spell out an attack-declaration substep; this is a recorded implementation interpretation, not a claimed designer ruling. The official CMON FAQ v1.0 was checked and contains no Burial Blade-specific entry: https://www.cmon.com/wp-content/uploads/2023/06/Bloodborne_Boardgame_FAQ_v1.0.pdf . No fog gates or movement-trigger effects exist in these training fixtures; those restrictions must be added before richer scenarios use the ability.

`setup.weaponId` and `setup.face` preserve initial selection for deterministic replay. Hunter `weaponId` points into `data.weapons`; the legacy `data.weapon` alias is the original test weapon only. v0.1 saves intentionally fail the new content-ID check. v0.2 uses a separate browser storage key.

## Firearm visibility (v0.2.3)

The always-expanded equipment panel above the map displays the single equipped Hunter Pistol, live ready/exhausted status, ability, reload cost and why use is currently unavailable. Its fire/reload controls and the existing decision buttons share one availability calculation. Display metadata is in `data.firearm`; `hunter.firearmReady` remains the authoritative runtime state. No gameplay engine or save schema change. Campaign enemy figure supply is now recorded as four per species; actual campaign spawning is still pending.

## Tile atlas and setup audit (v0.2.4)

Twenty supplied photos form a reference atlas with 52 spaces, undirected internal adjacency, exits in photograph orientation, named-space identity, spawn/lamp/consumable icons and printed effects. `data.tiles` is not wired into the training engine. Thirteen tiles have a printed place name; seven do not. The Yard Lamp photo has three exits (W/E/S); use the supplied component geometry instead of copying the four-exit example illustration in the rulebook.

The requested audit confirms a missing campaign feature: rulebook pp.10/25 require a random face for each enemy type and a random permutation across the three hunting-board slots at every chapter setup. Slots define marker-to-enemy mapping and activation rank (pp.9/15/16). Store the result in chapter state and preserve it during tile discovery, combat, map reset (p.24), and save/load. A new chapter rerolls; random results may repeat. All instances of a type share its chosen face. Campaign instructions override the default. Boss phases and NPC player-count sides are separate rules.

Current executable `data.spawns`, `data.enemies`, `freshEnemies`, `resetMap` and `reveal` still use fixed training enemies and positions. Shuffling the six-card behavior deck is not enemy-face randomization. This release only records and displays the audit (`chapterSetupRules.automated = false`); it does not claim an executable chapter setup. Next implementation must also handle a figure supply of four with relocation from the farthest eligible existing figure when exhausted (p.15), special setup card 17 before the chapter-2/3 tile draw pile, and each enemy face's actual combat exceptions.

## User card catalogue and playable consumables (v0.3.0)

`components/cards.json` is the authoritative transcription of 75 definitions: base 4/12, consumables 19/37, upgrades 20/60, rewards 32/68. Its identical CommonJS/browser export feeds `data.consumables` and the searchable `components.html`. `rawRules`, timing, counts, flavor text, runtime status, and two open clarification records preserve evidence. Rune chapter-use limits and unusable quest objects remain explicit. No unprovided card effect is invented.

The training engine now has 36 distinct consumable instances (18 kinds × 2), excluding the single invitation at the user's request. Optional training starting item is removed from that pool, not generated additionally. Inventory, draw pile and discard together must contain exactly those 36 unique instances. `USE_CONSUMABLE` checks timing, ownership, range, targets and destination atomically. Loot draws from this pool, exhausted piles recycle their discard, dream/reset retain held cards. Bone Ash and Hunter Bell remain present in the pool with a visible blocked reason; they are never silently substituted or spent.

Sixteen consumables execute in the training fixture: draw/status removal, defense, echoes, slot clearing, enemy displacement, firearm preparation, movement action/pursuit, direct damage, healing, speed/damage modifiers, lamp teleport and suppression of the next activation. Pungent Blood skips the following activation phase only and never pursuit or interaction retaliation. This duration is a recorded implementation interpretation. Combat items are submitted with `ATTACK`/`COUNTER.itemIds`, before enemy reveal, following the p.26 attack-slot timing. Numbing Mist removes attack keywords but leaves speed/damage and dedicated abilities. All bonuses expire with the combat; splash remains fixed at one.

`inventory.js` owns only UI selection. Selecting an item does not mutate state; validated engine commands do. Content ID changed to `bloodborne-consumables-0.3`, with a new localStorage key. v0.2.x saves are intentionally rejected because command replay would use different inventory and RNG state. Old automatic storage is not overwritten. New saves persist the training item selection and all card zones.

Actual upgrade and reward execution, chapter randomization, real enemies/maps and campaign events remain pending. This release does not treat catalogue registration as implementation. Remaining missing chapter components are listed in campaign data; received rewards/stats/consumables are no longer requested again.

## v0.3.1 firearms and photographs
Nine photos verify the Quick dodge keyword and the printed reward text. Preserve raw transcriptions; source photographs are linked in the catalogue. No passive/exhaustion exception is inferred solely from the lack of text on the art side; actual reward execution remains pending.
Additional named firearms use the user's explicit temporary Hunter Pistol override. `data.firearms` shares ability/reload behavior while retaining names and a visible temporary flag. `setup.firearmId` and hunter firearmId are optional for backward-compatible default pistol saves. No extra RNG call or log change for old default saves. New game selection supports Ludwig Rifle, Repeating Pistol and Flamesprayer. Campaign reward acquisition remains pending.
