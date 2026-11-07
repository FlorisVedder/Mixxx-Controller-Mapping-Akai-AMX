# Mixxx Controller Mapping Standard

This standard governs the JavaScript Components-style Mixxx controller  
mappings (Akai AMX, Denon DN-SC-2000, Vestax VCI-400, and future  
mappings). It is the single source for how a mapping is structured,  
consumed by coding agents and humans alike; deviations need a recorded  
reason.

---

## 1. Scope and core model

- Mappings are JavaScript `Components` mappings in the PR #15491 style:  
input and output bindings registered from JS (`midiIn`/`midiOut`), no XML  
`<controls>` element. The XML file only registers the mapping and defines  
GUI settings.
- Three layers, one direction of knowledge:
  1. **Layout** — the hardware signal facts (channel, control number, status  
   bytes per signal class). Knows nothing about Mixxx.
  2. **Components** — Mixxx bindings (one component per control, `inKey`/`outKey`).
  3. **Containers** — deck/channel structure (`components.Deck` subclasses,  
   `EffectUnit`s) that reconnect components to control groups.  
  Shift is cross-cutting: it rebinds components, it never re-lists hardware.
- **Hardware semantics live only in the layout; functionality semantics live**  
**only in component names; CO semantics live in the Mixxx manual.** A layout  
key names the physical control; a component name (`this.playButton`,  
`this.beatJumpForward`) names the job; an `inKey`/`outKey` names a Mixxx  
control (group + key). The authoritative reference for what controls exist  
and what they do is the Mixxx Controls appendix — complete and per-version,  
unlike the wiki (leads to verify, not gospel):  
[https://manual.mixxx.org/\[mixxx-version\]/en/chapters/appendix/mixxx\_controls](https://manual.mixxx.org/[mixxx-version]/en/chapters/appendix/mixxx_controls)  
(\[mixxx-version\] per §11 — the mapping XML's `mixxxVersion`).

## 2. Project structure

- One repository per controller mapping: `<Controller>.midi.xml` +  
`<Controller>-scripts.js`, plus `package.json` tooling.
- One namespace object per mapping (`AMXFV`, `DnSc2000`, `VCI400`); custom  
framework classes as IIFE modules inside the namespace.
- Custom library `midi-components-0-inout.js` — the stock components library  
plus the PR #15491 additions (JS-side `midiIn`/`midiOut` registration). The  
qualifier marks what the fork adds and keeps the name distinct from the  
stock `midi-components-0.js` that Mixxx itself ships. Name confirmed  
November 2026: lowercase `inout`. (The existing repos still carry the old  
name `midi-components-0-FV.js` until the rename.)
- The library is **not shipped or symlinked in the mapping repos** — each  
repository documents a setup step: fetch the file from the PR #15491 branch  
(mixxxdj/mixxx#15491) and place it next to the mapping scripts under the  
name above; the mapping XML loads it before the mapping script. One  
authoritative source (the PR), no symlink breakage on GitHub or fresh  
clones, no per-repo drift.
- Each repository carries a `README.md` describing the controller, its  
hardware facts and conventions (channels, control layout, LED  
conventions, differentiations), the setup step above, tooling, license,  
and links (this standard, the sibling mapping repositories, the Mixxx  
manual for the declared version). It is the in-repo hardware documentation  
the verification workflow references (§11), generated from the knowledge  
masters and regenerated on demand, like this file.

## 3. Hardware layout — Element objects

- Layout entries are **objects, not arrays** (the VCI-400 improvement):  
`new Element(channel, controlNumber)` exposing per-signal-class status  
getters — `noteOn`, `noteOff`, `continuesControl` — so status bytes are  
computed once at the layout level and components never assemble them.
- Structure: a `midiMapBase` defining the shared `Element` class and helpers,  
specialized by factory functions (`midiMapDecks(deck)` per deck channel  
plan, `midiMapGlobal()`), so one channel plan lives in exactly one place.  
A factory (`factory.getMidiMap(type, instance)`, VCI-proven) is the only  
place map instances are built: it constructs each instance on first  
request, caches it, and every consumer of that channel plan receives the  
same instance (VCI: Shift, Channel and Deck share the one  
`midiMapDecks('A')`; Master and Library share `midiMapGlobal`). Map  
instances carry their settings-derived context (group numbers, fx unit  
numbers). Selectors die at the construction boundary, in the factory  
call: within-channel axes (a unit axis indexed by control number) are  
resolved by the factory from the channel plan's indexed entries —  
containers never navigate into a shared map.  
- **Container topology** (settled November 2026): `init` constructs every  
container; a container receives exactly one specialized map argument (VCI:  
`new VCI400.FX(factory.getMidiMap('midiMapFX', 'left'))`) and does not  
construct containers. Nesting is allowed only as layout structure (e.g.  
per-unit FX children assigned into an fx section container at `init`),  
never as parent-construction of a child container. Selectors (channel,  
unit index, section) never reach a container signature; an index  
parameter is an old-architecture artifact: it existed only to reach into a  
shared hardware map. Settings-derived data a child needs (e.g. the fx  
unit number) rides on its map instance.
- **Naming:** layout keys identify hardware — stable across every mapping for  
the same controller, camelCase. Behavioral qualifiers are added when the  
hardware deviates from the controller's norm (`pflPressOnly`,  
`xfadeRevSwitch`); normal controls keep unqualified names.
- Layered controls (hardware-mode-switched control numbers or channels) list  
**all** variants (see §7).
- **Migration plan (settled November 2026):** AMX and DN migrate now — not  
folded into the blueprint project — staged per component group so each  
commit stays readable, loadable, and revertable. DN first: commit 1 =  
`midiMapBase` infrastructure + Global (infra alone would be dead code);  
then Library; EffectUnit (first structural test: indexed unit-axis  
entries); Deck last (jogwheel `wheel`/`touch` and pitch `msb`/`lsb`  
concentrate there — may split into two commits: flat controls first,  
multi-signal forms second). Then AMX, porting the validated pattern.  
Both binding forms (§4) coexist mid-migration — they never interact per  
control — so every commit leaves the mapping loadable. Wire-neutrality  
gate per stage: the resolved binding table must diff empty against the  
previous commit; shift on/off is smoke-tested each stage; migration  
commits carry only migration changes (fixes ship separately). Layout  
migration precedes the ShiftButton port (§6) so neither project's  
regressions can mask the other's.
  A topology pre-stage precedes the DN layout stages (settled November  
  2026): fxUnit construction moves from Deck to `init` (VCI-style fx  
  container; `fxOn` stays in Deck by preference); shift registration for  
  the fxUnits becomes explicit on the same shift button. The  
  wire-neutrality gate applies unchanged (same bindings, new construction  
  site; load-time LED trigger order may shift).

- **Migration sequencing — parents and children** (settled November 2026;  
  the DN case was later resolved by the topology pre-stage above): when a  
  container still constructs a child container, children migrate before  
  their parent. An interim parent carries the end-state signature plus  
  legacy arguments and touches the new map only at child-construction  
  lines; each stage deletes its own legacy. Prefer removing the nesting  
  instead — where the child can be constructed at `init` (DN's fxUnits),  
  the interim disappears entirely and parent/child stages become  
  independent, in any order.

## 4. Binding forms (midiIn / midiOut)

- Default: plain array form — one pair `midiIn: [status, ctrl]`, or a list of  
pairs when a control reports on several statuses; everything routes to the  
stock value-driven `input` handler (push/toggle logic). Literal (VCI-400  
sync button):
  ```js
  midiIn: [[INPUT.sync.noteOn, INPUT.sync.controlNumber],
           [INPUT.sync.noteOff, INPUT.sync.controlNumber]]
  ```

- Nested/associative form — an object whose keys name the input method each  
binding routes to: `msb`/`lsb` → `inputMSB`/`inputLSB` (stock 14-bit pot  
handlers in the library), `on`/`off` → `inputOn`/`inputOff` (press-only  
hardware latches; the mapping supplies these handlers itself — current  
user: AMX `pflPressOnly`). **Only** when the signals genuinely route to  
different methods — not for looks; picking the array form instead silently  
changes edge semantics. Literal (VCI-400 pitch fader, 14-bit):
  ```js
  midiIn: {'msb': [INPUT.pitchMSB.continuesControl, INPUT.pitchMSB.controlNumber],
           'lsb': [INPUT.pitchLSB.continuesControl, INPUT.pitchLSB.controlNumber]},
  ```

- Every LED-capable control declares `midiOut` + `outKey`.  
(currently uneven in the existing mappings: AMX declares none, DN has 7,  
VCI has 11 — the rule lands with the migrations; LED behavior per  
controller stays wire-verified.)

## 5. Component classes per signal class


| Signal class          | Component                                              | Notes                                                                                                      |
| --------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Momentary button      | `components.Button`                                    | Explicit `types.push`/`types.toggle`; both NOTE edges bound                                                |
| Hardware-latch button | `components.Button`                                    | Nested midiIn form; qualifier key                                                                          |
| Pot (absolute)        | `components.Pot`                                       | MSB/LSB pair via `{'msb','lsb'}` where hardware is 14-bit                                                  |
| Relative encoder      | `components.Encoder`                                   | Direction values are hardware facts — never assume                                                         |
| Jog wheel             | `JogWheelBasic`                                        | Software vinylMode; scratch timers documented                                                              |
| Deck                  | `components.Deck` subclass                             | `reconnectComponents` injects `currentDeck` group                                                          |
| FX section            | custom `ComponentContainer` or `components.EffectUnit` | One per unit (§8); custom container is the default, framework class where its model fits — reason recorded |


- Within a signal class, prefer the library's job-specialized subclasses  
(`PlayButton`, `CueButton`, `SyncButton`, `HotcueButton`, ...) over a plain  
component with hand-written keys and input/output logic: their defaults  
carry settled Mixxx behavior (play LED blink via `play_indicator`, sync  
long-press → `sync_enabled` lock, cue preview semantics) that  
re-implementations drift from — the VCI-400 sync button re-implements  
`SyncButton`'s long-press logic nearly verbatim. Plain classes stay  
correct for jobs the library does not model (`pfl`, `load`, `keylock`);  
when behavior must differ, override methods on the subclass rather than  
rebuild it. The available set is whatever the pinned library branch ships —  
consult it, do not assume a fixed list.
- Construction runs `unshift()` once: initial bindings live in the  
`unshift()`/`shift()` pair. **Shift bodies are idempotent `inKey`**  
**assignments — no `connectMidiOut()` in a shift body** unless the LED-rebind  
pattern (§10) is used deliberately.

## 6. Shift

- One shared, per-instance `ShiftButton` module used by all mappings (replaces  
the three current variants: AMX observer pattern, DN shared-closure  
asymmetric, VCI shared-closure ×4-duplication).  
Spec: per-instance registration collection (fixes the VCI ×4 broadcast);  
explicit `registerComponentToShift` registration; shift/unshift broadcast;  
optional LED echo per hardware convention; idempotency required (§5).
- Module API (suggestion — the starting point; adjust where practice shows a  
need, folding adjustments back into this standard):
  ```js
  const ShiftButton = function(options) {
      // standard components.Button options; midiIn binds both edges
      components.Button.call(this, options);
      this.componentsToShift = [];  // per instance — no shared closure
  };
  ShiftButton.prototype = new components.Button({
      registerComponentToShift: function(component) {
          // explicit registration; Component or ComponentContainer;
          // duplicates rejected — the VCI-400 ×4 registration is impossible
          if (this.componentsToShift.indexOf(component) === -1 &&
              (component instanceof components.Component ||
               component instanceof components.ComponentContainer)) {
              this.componentsToShift.push(component);
          }
      },
      input: function(channel, control, value, status, group) {
          // optional LED echo (hardware-driven shift LED, VCI-400 style):
          // relay the incoming edge verbatim before broadcasting
          let action = "unshift";
          if (value === VALUE_ON) {
              action = "shift";
          }
          this.componentsToShift.forEach(
              component => component[action]());
      },
  });
  ```
  - Registration is the layering decision: "shift everything" is expressed by  
  registering every container with every button; per-domain shift by scoping  
  registrations. The DN registration asymmetry also becomes impossible.
  - The broadcast is edge-driven and stateless (a lone release still broadcasts  
  unshift — benign with idempotent shift bodies, §5). Controllers with  
  hardware channel-set switching bind every channel variant of the shift  
  button (§7) so the software state tracks the hardware.
- Unwanted shifted functions are **neutralized deliberately**: rebind `inKey`  
to an inert CO (e.g. `beat_distance`) — never rely on absence of binding.

## 7. Deck and layer binding

- **Bind all hardware variants simultaneously where feasible** — every  
channel of a layer switch, every ctrl-number bank of a mode switch, both FX  
units. The hardware switch then needs no script reaction.
- Deliberate one-variant exceptions are allowed when there is a reason  
(documented example: VCI-400 track pads bind only the center switch stage);  
record the reason in a layout comment.
- Hardware switching axes change the channel, the control number, or whether  
messages are sent at all — the differentiations checklist applies before  
porting (§11).

## 8. FX sections

- CO semantics: the effects-framework section of the Mixxx Controls appendix  
(§1) —  
[https://manual.mixxx.org/\[mixxx-version\]/en/chapters/appendix/mixxx\_controls#the-effects-framework](https://manual.mixxx.org/[mixxx-version]/en/chapters/appendix/mixxx_controls#the-effects-framework)
- Unit axes come in two hardware shapes. **Hardware unit axis** — the controls  
exist per unit (different channels or ctrl numbers): handled at the layout  
(§3/§7); channel-based axes are one Element map per unit on that unit's  
channel (VCI-400: left/right FX sections, ch 13/14), ctrl-number-based axes  
are indexed Element entries per unit (DN-SC-2000's unit axis — after its  
layout migration, §3); all variants are bound simultaneously (§7 bind-all),  
so the unit switch needs no script reaction. **Software unit axis** — one  
physical section drives whichever unit is selected in software: nothing to  
bind-all; the switching lives in the container (rebinding), not the layout.
- Container-side: one `components.ComponentContainer` subclass per unit,  
constructed against explicit unit groups. This is what both current  
mappings do (`VCI400.FX`, `DnSc2000.EffectUnit`); **neither uses the**  
**framework `components.EffectUnit`**, whose focus-switching model answers a  
different hardware shape (one physical section driving whichever unit is  
focused). The framework class is allowed where that model genuinely fits,  
with the reason recorded — it is not the default.

## 9. Settings (GUI options)

- Anything hardware-configurable (e.g. MIDI channel set) or a user preference  
(deck assignment) becomes an XML `<option>` — no hardcoding what a user can  
set on the unit.
- Stored values are decoupled from GUI labels (zero-based storage behind  
human-counted labels); the script reads them via `engine.getSetting()`.
- Settings are per-controller-entry in the GUI, so multiple units of the same  
controller stay independent.

## 10. LED output

- Per-controller LED byte conventions are **hardware facts** — never assume a  
layout across controllers (AMX: ctrl = LED number; DN: swapped roles, value  
= LED number; VCI: `LED_ON 0x4A`/`LED_OFF 0x4B`).
- LED **value** semantics are hardware facts too: LEDs are not always on/off —  
some hardware encodes color in the value byte (palette ranges or bit-packed  
RGB). The encoding lives in the layout; which color a state shows is  
component logic. Wire- or reference-verify before use.
- LED responsibility split (hardware color vs software on/off) is respected,  
not fought: hardware-driven LEDs get no software output.
- Blinking is software-driven via the core indicator COs (250/500 ms timers);  
hardware flash commands are used sparingly, if at all.
- **Shift-LED rebinding default: stay on the construction-time CO.**  
Shift bodies rebind `inKey` only; the LED connection from construction  
stays bound to the unshifted CO (stale or dark while shifted — accepted).  
The follow pattern — rebind `outKey`, then `connectMidiOut()` + `trigger()`  
so the LED previews the shifted function — is an exception needing a  
recorded reason, and only in its leak-free form: disconnect  
`this.connections[0]` (guarded for undefined) *before* `connectMidiOut()`;  
the unguarded form overwrites the slot without disconnecting, leaking one  
live, undisconnectable connection per shift edge (wire-verified). Worked  
example: DN-SC-2000 `keyLock` (`keylock` ↔ `quantize`), once its planned  
leak fix lands. Why this default: it alone keeps §5's idempotent-shift rule  
intact without exceptions, and the leak is a silent bug class — invisible  
until a CO changes — exactly the kind agents reproduce without noticing.

## 11. Verification workflow (agent checklist)

Before writing or porting a mapping:

1. Run the **differentiations checklist** for the target controller: channel  
 architecture, hardware mode-select switches, shift visibility, button value  
 and release-edge conventions, encoder direction values, LED conventions  
 (message layout and value semantics: on/off vs color).  
 The evidence lives in the repository's README (hardware section) — or in
 `--controller-debug` captures when it does not.
2. Reference Mixxx documentation versioned to the target: manual URLs are  
 [https://manual.mixxx.org/\[mixxx-version\]/en/…](https://manual.mixxx.org/[mixxx-version]/en/…) (there is no versionless  
 URL); \[mixxx-version\] is the mapping's declared target — the `mixxxVersion`  
 attribute of the `<MixxxControllerPreset …>` element in the mapping XML  
 (e.g. `2.6+` → the 2.6 manual). Point to the manual instead of restating  
 its CO semantics.
3. Never trust code comments or comment blocks as wire facts (example: VCI-400  
 channel-comment block contradicts the Element definitions in several  
 places). The wire decides; comment claims are hypotheses.
4. Bind-all requires knowing all variants — if a variant is unverified, mark  
 it in the layout comments and capture it before shipping.

After changing a mapping:

5. Verify with `--controller-debug`: expected press/release pairs, LED lines  
 per state change, no unexpected reconnect lines.
6. Record new hardware facts in the repository's README (hardware
 section) — the repo carries the code, the README carries the wire facts.
 READMEs are regenerated from the knowledge masters on demand.
 facts.

## 12. Code style (cross-project section)

This section is identical across my repositories — not Mixxx-specific — and  
is maintained as one unit in the Code Quality knowledge master; do not edit one  
repo's copy without regenerating the others. Clean code is maintainability for  
humans and AI assistants alike: it gives quick context, fewer wrong inferences,  
and makes a change's impact assessable.

- **Early returns / guard clauses** as the default control flow.
- **Multi-line `if` over one-line ternaries** for conditional assignment —  
human readability first; the condition gets its own indented lines.
- **Meaningful names**: a name states the job (`this.playButton`,  
`this.beatJumpForward`); naming is design work, not labeling.
- **Small functions, single responsibility**; low duplication, low coupling.
- **Quality tooling from the start** — linter/static analysis wired into the  
project (devDependencies, config files), not bolted on afterwards.
- **Consistent project structure** — same layout and tooling pattern across  
projects of the same type.
- **Platform conventions win over generic book advice** when the two conflict;  
a mature ecosystem's own standards are evidence too.

## 13. Current state per mapping (evidence base)


| Axis         | AMX                     | DN-SC-2000                    | VCI-400                        |
| ------------ | ----------------------- | ----------------------------- | ------------------------------ |
| Layout style | arrays + `getControl`   | arrays + `getControl`         | **Element objects** ✓ standard |
| Shift        | observer module         | shared closure, asymmetric    | shared closure, ×4 duplication |
| Settings     | none                    | 7 options ✓ standard          | 6 options                      |
| LED outKeys  | 0                       | 7                             | 11                             |
| FX           | —                       | custom `EffectUnit` container | custom `FX` container          |
| Decks/layers | layered deckMappingList | 2 layers, bind-all            | 4 decks, bind-all              |

Reference code (public repositories — agents can read the other mappings  
online): [Akai AMX](https://github.com/FlorisVedder/Mixxx-Controller-Mapping-Akai-AMX)  
· [Denon DN-SC2000](https://github.com/FlorisVedder/Mixxx-Controller-Mapping-Denon-DN-SC2000)  
· [Vestax VCI-400](https://github.com/FlorisVedder/Mixxx-Controller-Mapping-Vestax-VCI400).
