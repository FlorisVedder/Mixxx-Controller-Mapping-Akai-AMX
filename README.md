# Akai AMX — Mixxx controller mapping

A custom Mixxx controller mapping for the Akai AMX, written with the  
Components JS framework and JavaScript-side MIDI binding (`midiIn`/  
`midiOut`): the XML file registers the mapping, and every control  
binding lives in the script — no `<controls>` element. Written and  
wire-verified against Mixxx 2.6 (the XML declares `2.6+`).  
The mapping is complete and usable; it is under active development (see  
[Known issues](#known-issues-fixes-planned)).

## The controller

The Akai AMX is a compact two-channel DJ mixer controller designed as a  
DVS companion: two channel strips with gain trim, three-band EQ and  
filter knobs, line faders and PFL buttons, a crossfader with a hardware  
reverse switch, per-deck transport buttons (play, cue, sync, load), a  
browse knob, and VU meters for both channels and the master. It has no  
jog wheels; nine of its knobs are touch-capacitive, behind a hardware  
Touch Mode gate.  

## How the mapping is structured

With few buttons, the mapping layers the controls instead of assuming  
hardware it does not have:  

- **Mixer and master controls are always active** — EQ, filter, line  
  faders, crossfader, cue mix/gain, master volume.  
- **Base layer** — per deck: transport (play/cue/sync), load, PFL, gain  
  trim; plus the library controls (browse knob, load buttons).  
- **Search/DVS layer** — hold a Search/DVS button to switch both sides'  
  basic buttons into loop, beat-jump and tempo functions for the  
  corresponding deck; releasing returns to the base layer.  
- **SHIFT** modifies the active layer — details in the controls  
  reference below.  

## Hardware facts and conventions

Wire-verified against the unit with `--controller-debug`; this section is  
the evidence record the verification workflow in AGENTS.md refers to.  
Control names and callout numbers follow the official AMX User Guide.  

### MIDI channel

All controls send on one fixed MIDI channel (channel 1); per-deck  
controls are distinguished by control number, not by channel. Control  
numbers are reused across status bytes (buttons on NOTE ON/OFF vs.  
absolute values on CONTROL_CHANGE) — no conflicts in practice, but a  
fact to respect when extending the mapping.  

### Buttons

Default (momentary): NOTE ON `0x90` with value `0x7F` on press, NOTE OFF  
`0x80` with value `0x00` on release.  

Two hardware-latch exceptions signal **on press only** — first press  
sends the on signal, the next press the off signal, release sends  
nothing; the toggle logic lives in the hardware: the **PFL buttons**  
(the hardware also enforces one-PFL-at-a-time itself) and the **Touch**  
button. The **Crossfader Reverse** switch is a physical left-right  
switch reporting on CONTROL_CHANGE (`0xB0`), one message per flip  
(`0x01` right / `0x00` left).  

### Touch controls

Nine controls have touch-capacitive surfaces: the browse encoder and the  
six EQ and two filter knobs. They are inactive by default — the Touch  
button toggles a **hardware gate**: enabled, touching a surface sends  
MIDI; disabled, touching sends nothing. The gate state lives in the  
hardware (it persists across restarts and is unknown at script load),  
and the button's LED is hardware-driven.  

Unlike the buttons, both edges of a touch arrive as NOTE ON (`0x90`):  
touch = value `0x7F`, release = value `0x00` — a velocity-zero note-on,  
not a NOTE OFF. This mapping does not bind the touch surfaces yet (see  
[Known issues](#known-issues-fixes-planned)).  

### Relative encoders

One CONTROL_CHANGE (`0xB0`) per tick with a fixed direction value  
(no position, **no acceleration** — the value is the same at any turn  
speed): **CCW = `0x7F`, CW = `0x01`**.  

### Absolute controls

High-resolution controls report as **14-bit MSB/LSB pairs** on  
CONTROL_CHANGE: `(MSB << 7) | LSB`, full range `0x0000`–`0x3FFF`, the  
MSB climbing monotonically with position. The EQ knobs, filter knobs,  
line faders and crossfader are 14-bit; **Cue Mix, Cue Gain and Master  
Volume are 7-bit** single-byte controls (`0x00`–`0x7F`).  

### Outputs (VU meters)

The only mapping-driven outputs are the four VU meters (CC, one ctrl per  
strip, value = level `0x00`–`0x7F`). The PFL and Touch button LEDs are  
hardware-driven — the mapping sends nothing for them.  

Each deck strip has 5 LEDs — 3 green, orange, red — with three states  
(off, half, full power). The thresholds are bottom-dense; the half-power  
steps sit exactly 20 apart:  

| Wire value    | LEDs lit                        |
|---------------|---------------------------------|
| `0x00`        | none                            |
| `0x01`–`0x09` | green 1 half                    |
| `0x10`–`0x14` | green 1 full                    |
| `0x15`–`0x1D` | green 1 full + green 2 half     |
| `0x1E`–`0x28` | greens 1–2 full                 |
| `0x29`–`0x31` | greens 1–2 full + green 3 half  |
| `0x32`–`0x3C` | greens 1–3 full                 |
| `0x3D`–`0x45` | greens 1–3 full + orange half   |
| `0x46`–`0x50` | greens 1–3 + orange full        |
| `0x51`–`0x54` | greens + orange full + red half |
| `0x55`–`0x7F` | all LEDs full                   |

The mapping drives the meters through direct unbuffered connections with  
a tuned curve that deliberately tops out at **red half** — the  
"riding the top" state for loud passages; red full is never sent.  

### Control numbers

Layout keys are the entries of the script's layout object. The unbound  
controls are included for completeness.  

Buttons:

| Control                      | Layout key                   | Ctrl   | Wire pattern                    |
|------------------------------|------------------------------|--------|---------------------------------|
| Panel / View (#8)            | `panel`                      | `0x01` | momentary pair; unbound         |
| Search / DVS 1 (#9, deck 1)  | `search` [0]                 | `0x02` | momentary pair                  |
| Search / DVS 2 (#9, deck 2)  | `search` [1]                 | `0x03` | momentary pair                  |
| Load 1 (#17, deck 1)         | `load` [0]                   | `0x04` | momentary pair                  |
| Load 2 (#17, deck 2)         | `load` [1]                   | `0x05` | momentary pair                  |
| Sync 1 (#28, deck 1)         | `sync` [0]                   | `0x06` | momentary pair                  |
| Sync 2 (#28, deck 2)         | `sync` [1]                   | `0x07` | momentary pair                  |
| Cue 1 (#27, deck 1)          | `cue` [0]                    | `0x08` | momentary pair                  |
| Cue 2 (#27, deck 2)          | `cue` [1]                    | `0x09` | momentary pair                  |
| Play / Pause 1 (#26, deck 1) | `play` [0]                   | `0x0A` | momentary pair                  |
| Play / Pause 2 (#26, deck 2) | `play` [1]                   | `0x0B` | momentary pair                  |
| PFL 1 (#25, deck 1)          | `pflPressOnly` [0]           | `0x0C` | press-only toggle               |
| PFL 2 (#25, deck 2)          | `pflPressOnly` [1]           | `0x0D` | press-only toggle               |
| Shift (#6)                   | `shift`                      | `0x00` | momentary pair                  |
| Browse Knob, push (#10)      | `browseClick`                | `0x1A` | momentary pair                  |
| Crossfader Reverse (#13)     | `xfadeRevSwitch`             | `0x3A` | CC switch, one message per flip |
| Touch (#7)                   | — (not in reference mapping) | `0x19` | press-only toggle; unbound      |

Relative encoders:

| Control                   | Layout key   | Ctrl   |
|---------------------------|--------------|--------|
| Gain Trim 1 (#20, deck 1) | `gain` [0]   | `0x3C` |
| Gain Trim 2 (#20, deck 2) | `gain` [1]   | `0x3D` |
| Browse Knob, turn (#10)   | `browseTurn` | `0x3B` |

Absolute controls, 14-bit (MSB and LSB control numbers):

| Control                        | Layout key                              | MSB    | LSB    |
|--------------------------------|-----------------------------------------|--------|--------|
| Channel Treble 1 (#21, deck 1) | `eqTrebleMSB` [0] / `eqTrebleLSB` [0]   | `0x0A` | `0x2A` |
| Channel Treble 2 (#21, deck 2) | `eqTrebleMSB` [1] / `eqTrebleLSB` [1]   | `0x0E` | `0x2E` |
| Channel Mid 1 (#22, deck 1)    | `eqMidMSB` [0] / `eqMidLSB` [0]         | `0x09` | `0x29` |
| Channel Mid 2 (#22, deck 2)    | `eqMidMSB` [1] / `eqMidLSB` [1]         | `0x0D` | `0x2D` |
| Channel Bass 1 (#23, deck 1)   | `eqBassMSB` [0] / `eqBassLSB` [0]       | `0x08` | `0x28` |
| Channel Bass 2 (#23, deck 2)   | `eqBassMSB` [1] / `eqBassLSB` [1]       | `0x0C` | `0x2C` |
| Filter 1 (deck 1)              | `filterMSB` [0] / `filterLSB` [0]       | `0x0F` | `0x2F` |
| Filter 2 (deck 2)              | `filterMSB` [1] / `filterLSB` [1]       | `0x10` | `0x30` |
| Channel Fader 1 (#24, deck 1)  | `lineFaderMSB` [0] / `lineFaderLSB` [0] | `0x07` | `0x27` |
| Channel Fader 2 (#24, deck 2)  | `lineFaderMSB` [1] / `lineFaderLSB` [1] | `0x0B` | `0x2B` |
| Crossfader (#11)               | `crossFaderMSB` / `crossFaderLSB`       | `0x01` | `0x21` |

Absolute controls, 7-bit:

| Control             | Layout key | Ctrl   |
|---------------------|------------|--------|
| Cue Mix (#16)       | `cueMix`   | `0x37` |
| Cue Gain (#15)      | `cueGain`  | `0x33` |
| Master Volume (#14) | `master`   | `0x32` |

VU meters:

| Control         | Layout key       | Ctrl   |
|-----------------|------------------|--------|
| Deck 1 VU meter | `vuMeter` [0]    | `0x40` |
| Deck 2 VU meter | `vuMeter` [1]    | `0x41` |
| Master VU L     | `vuMeterMasterL` | `0x3E` |
| Master VU R     | `vuMeterMasterR` | `0x3F` |

Touch surfaces (not bound by this mapping):

| Touch surface          | Ctrl   |
|------------------------|--------|
| Browse Knob (#10)      | `0x0E` |
| Channel Treble 1 (#21) | `0x11` |
| Channel Treble 2 (#21) | `0x12` |
| Channel Mid 1 (#22)    | `0x13` |
| Channel Mid 2 (#22)    | `0x14` |
| Channel Bass 1 (#23)   | `0x15` |
| Channel Bass 2 (#23)   | `0x16` |
| Channel Filter 1 (#29) | `0x17` |
| Channel Filter 2 (#29) | `0x18` |
## Controls reference

What each control does in Mixxx, by layer. The Mixxx control names are in  
the script (`AGENTS.md` documents how it is structured).  

### Deck and library controls (base layer)

| Control           | Function                                             | With SHIFT                                |
|-------------------|------------------------------------------------------|-------------------------------------------|
| PLAY/PAUSE 1 / 2  | play/pause that deck                                 | —                                         |
| CUE 1 / 2         | cue                                                  | —                                         |
| SYNC 1 / 2        | tap: one-shot sync; hold: sync lock                  | —                                         |
| LOAD 1 / 2        | load the selected track into that deck               | move the library focus backward / forward |
| GAIN TRIM 1 / 2   | channel pregain                                      | tempo (rate)                              |
| PFL 1 / 2         | headphone cue on/off (hardware-latch, one at a time) | —                                         |
| Browse knob, turn | move through the track list                          | move across the columns                   |
| Browse knob, push | open the selected item / load the selected track     | sort the focused column                   |

### Mixer and master (always active)

| Control                        | Function                                                             |
|--------------------------------|----------------------------------------------------------------------|
| EQ knobs (treble / mid / bass) | channel equalizer                                                    |
| FILTER knob                    | channel filter                                                       |
| LINE fader                     | channel volume                                                       |
| Crossfader                     | crossfader position                                                  |
| Crossfader Reverse switch      | mirror the hardware switch into Mixxx (negates the crossfader value) |
| CUE MIX / CUE GAIN             | headphone mix / headphone gain                                       |
| Master volume                  | main output gain                                                     |

### Search/DVS layer (hold a Search/DVS button)

Holding Search/DVS 1 (or 2) switches the basic buttons of both sides into  
loop, beat-jump and tempo functions **for the corresponding deck** — the  
left and right buttons take complementary roles. Releasing the button  
returns to the base layer.  

| Control           | Function                                             | With SHIFT     |
|-------------------|------------------------------------------------------|----------------|
| Play 1 / Play 2   | tempo down / tempo up                                | smaller steps  |
| Cue 1 / Cue 2     | set the loop start / loop end                        | —              |
| Sync 1 / Sync 2   | activate a beatloop / reloop toggle                  | —              |
| Load 1 / Load 2   | beat jump backward / forward                         | —              |
| Gain 1 / Gain 2   | loop size ×2 / ÷2 per click / beat-jump size ×2 / ÷2 | —              |
| Browse knob, turn | seek the play position                               | fine seek      |
| Browse knob, push | toggle quantize                                      | toggle keylock |

### VU meters

Both deck meters and the master stereo pair follow the signal level with  
the tuned curve described above.  

## Settings

The mapping currently declares no GUI settings — the channel strips drive  
Mixxx decks 1 and 2 with a fixed assignment. Per the standard, anything a  
user would want to choose (the deck assignment being the obvious  
candidate) should become an XML option; the DN-SC-2000 mapping shows the  
pattern.  

## Installation

**1. Requirements.** Mixxx 2.6 or later.  

**2. Fetch the components library.** The mapping needs a custom copy of  
the Components JS library: the stock `midi-components-0.0.js` extended  
with JavaScript-side midiIn/midiOut registration  
([PR #15491](https://github.com/mixxxdj/mixxx/pull/15491), open upstream —  
until it ships in Mixxx, the library is fetched from the PR branch). It is  
deliberately not shipped in this repository — one authoritative source, no  
per-repo drift. Fetch it next to the mapping files, under the name the XML  
loads:  

```sh
curl -L -o midi-components-0-inout.js \
    https://raw.githubusercontent.com/FlorisVedder/mixxx/support-dynamic-binding-components/res/controllers/midi-components-0.0.js
```

The `inout` qualifier marks what the fork adds — JavaScript-side  
`midiIn`/`midiOut` registration — and keeps the name distinct from the  
stock `midi-components-0.0.js` that Mixxx itself ships.  

**3. Copy the files** into the user presets folder — Preferences →  
Controllers → *Open User Preset Folder*, or directly: Linux  
`~/.mixxx/controllers`, Windows `%LOCALAPPDATA%\Mixxx\controllers`, macOS  
`~/Library/Containers/org.mixxx.mixxx/Data/Library/Application Support/Mixxx/`  
`controllers`. Files: `Akai-AMX-FV.midi.xml`, `Akai-AMX-FV-scripts.js`,  
`midi-components-0-inout.js`.  

**4. Load the mapping.** Restart Mixxx, then Preferences → Controllers →  
the Akai AMX → load the *Akai AMX (FV)* preset.  

## Development

- [AGENTS.md](AGENTS.md) in the repository root is the standard this  
  mapping follows: project structure, code style and the verification  
  workflow.  
- The repository carries npm tooling (`package.json`, ESLint) for linting  
  the scripts during development (`npm ci` to install).  
- Binding changes are verified on the hardware with `--controller-debug`;  
  the observed wire facts live in the hardware section above and are kept  
  in sync with the mapping.  

## Known issues (fixes planned)

- **Layout still plain arrays** — the layout object maps keys to numbers/  
  per-deck arrays; the Element-object migration (standard §3) is staged  
  and reaches the AMX after the DN-SC-2000.  
- **No LED output declarations** — no component declares `midiOut`/  
  `outKey` yet; the VU meters run on direct unbuffered connections, and  
  the PFL/Touch LEDs are hardware-driven. The standard's LED-output rule  
  lands with the migration.  
- **ShiftButton to unify** — the observer-pattern ShiftButton is replaced  
  by the shared per-instance module (standard §6; the DN-SC-2000 is the  
  implementation target).  
- **Touch controls unused** — the nine capacitive surfaces and the Touch  
  button are not bound; the hardware gate still applies.  
- **Panel/View button unbound** — no function assigned yet.  
- **Repository still ships the library** — until the rename, the repo  
  carries the central `midi-components-0-FV.js` copy; it moves to the  
  fetch step documented above.  

## Links and license

- [AGENTS.md](AGENTS.md) — the mapping standard.  
- Sibling mappings: [Denon DN-SC-2000](https://github.com/FlorisVedder/Mixxx-Controller-Mapping-Denon-DN-SC2000)  
  · [Vestax VCI-400](https://github.com/FlorisVedder/Mixxx-Controller-Mapping-Vestax-VCI400)  

- [Mixxx 2.6 manual](https://manual.mixxx.org/2.6/en/) ·  
  [Mixxx Controls reference](https://manual.mixxx.org/2.6/en/chapters/appendix/mixxx_controls.html)  
- [Components JS wiki](https://github.com/mixxxdj/mixxx/wiki/Components-JS) ·  
  [MIDI scripting wiki](https://github.com/mixxxdj/mixxx/wiki/Midi-Scripting)  
- [Akai AMX downloads](https://www.akaipro.com/downloads-and-support/downloads/?product=AMX)  

License: GPL-3.0-or-later (see `package.json`).  
