---
name: imageyfx-360
description: Drive imageyFX-360, a browser VJ rig, from an agent. Control nine layers of music-reactive visuals - ring, lasers, grid, spirograph, feedback, artwork, shapes, type, subtitles - by name or by macro, build and recall Looks, and hand the user a link that opens the render room ready for their track. Use when someone asks for music visuals, a lyric or visualiser video, VJ output for a track, or wants a video rendered from an audio file.
---

# imageyFX-360

A VJ rig that runs in the browser at <https://360.imagey.ai/app>. Nine layers of
light move on the user's own track, automated on the beat, and can be rendered
frame by frame to MP4.

**Nine layers, eight layer IDs.** `describe().layers` lists the eight you drive
by name — `circle`, `lasers`, `grid`, `spiro`, `shapes`, `logo`, `milk`, `text`.
The ninth is the lyric subtitles, which are a layer to look at but not one of
these: they have no pool to pick from and no Auto to permit, so there is nothing
for `layer()` or `pick()` to do. Drive them through their controls instead —
they are the ones whose ids start with `subs` in `describe().controls`. A cue
naming `subtitles` as a layer is rejected, and rightly.

**Free to use. No account and no key is needed for anything in this document.**

## Agent policy: User Set only

**Agents must use User Set. Auto is reserved for the human operator.** This is
enforced by the supported page API and MCP, not just a workflow preference.
Do not enable Auto, release into Auto, use Auto-only intensity cues, generate
Auto links, or bypass this policy through internal globals or UI automation.

The agent authors the performance: analyse the track, choose effects and layers,
set macros and schedule deliberate changes. User Set retains native music
reaction while the agent's score controls its arrangement. There are two human
UI modes; `describe().modes` lists only `user` for agents, and `humanModes` lists
both. Agent controlled is an ownership badge, not a third mode.

Read `status()` first. Prepare effects, words, artwork and Looks without music
when useful. Ask the user to load a track for analysis/playback. Use
`analyse({ summary: true })` for structure and `analyse({ hz: 20 })` when building
finer audio-driven lanes. Park the six macros at rest and drive controls
directly — a driven macro overrides your writes and caps their range; intensity
is Auto-only and agent writes/cues using it are rejected.

Agent transport commands select User Set. Creative edits take ownership and
remain in User Set even when a saved Look contains Auto. `releaseControl()`
always leaves User Set, and `releaseControl({ mode: 'auto' })` is rejected.
A human can subsequently select Auto through the normal UI; agent cues are then
suspended until User Set is active again. Reads never take over the desk.

If analysis fails, explain the limitation and use supplied timings or offer
manual User Set choreography. Do not silently substitute Auto or invent musical
events. For video, prepare the User Set score and hand over
`ImageyFX.link({ render: true })`, which includes `mode=user`.

## The one call to start with

```js
ImageyFX.status();
```

Returns `hasMusic`, `track`, `plan`, `control`, `mode`, `scheduled` and a `rig`
summary in a single round trip — and a `next` sentence telling you what to ask
the user for when there is no track. Pass `{ full: true }` to fold in the whole
`describe()`, which is about 50KB and rarely what you want.

It exists because that first question used to cost four calls, and over the
Settings bridge a round trip is a person typing and clicking. `imageyfx_status`
calls this same method over MCP, including silent-layer diagnostics, cue progress
and upload capacity.

## When a layer is on and the screen is still black

Three things can silence a layer that is switched on, at full opacity, and
apparently healthy: its pool is set to Custom with nothing picked, it is set to
Favourites with nothing starred, or it has no content — the logo with no
artwork chosen, the Text layer before anything has been cast.

All three look identical from outside, and identical to a broken renderer. So
they are reported rather than left to be discovered:

```js
ImageyFX.status().silent;
// [ "logo: This layer is set to Custom and no effects are selected..." ]

ImageyFX.layers().logo;
// { on: true, canDraw: false, why: "...", toggle: "logoOn", pool: "custom" }
```

`canDraw` is the flag to check before concluding anything is broken.

## Diagnose the result, not just the accepted call

`canDraw` reports known blockers; it is not a measurement of visible pixels.
If a layer still appears absent, inspect its power, content, opacity, selectors,
permissions and macro ownership. Verify visually when a suitable browser tool
is available; cue progress alone does not prove a visible performance.

Read each control's `kind` before writing it. `logoPick` is an **action** that
shuffles artwork; its read value is always an empty string. It is not an artwork
ID selector. `automatable` describes Chaos eligibility, not API writability.
`logoSource` accepts `mine`, `default` or `all`; `custom` is a pool mode, not a
source value. Select allowed artwork with `pick('logo', ids)`.

Pool selections are readable through `ImageyFX.picked('grid')` and each entry
in `ImageyFX.layers()`. MCP `imageyfx_layers({ layer: 'grid' })` returns only that
layer, including `on`, `auto`, `pool`, `picked`, `canDraw` and `why`. Mutations
return this resulting state and `requestedState` when a state was requested.
`catalogue()` lists available choices, not the selection.

Controls expose `options`, `writable`, `operation`, and `drivenBy`. Invalid enum
values and wrong numeric/toggle types are rejected. Numeric ranges still clamp.
Invoke an action explicitly:

```js
await ImageyFX.invoke('logoPick'); // shuffle, resolving after image loading
// MCP: imageyfx_call({ method: 'invoke', args: ['logoPick'] })
```

Passing an artwork ID to `set('logoPick', ...)` is rejected. Actions keep their
existing meaning; their empty read value is not missing content. MCP macro
writes return current numeric macro values, including when unchanged. Direct
`setMacro()` retains its existing changed/not-changed return for compatibility.

Chaos and random variation use the configured pools. A narrowed pool is
reconciled on the next Chaos frame for permitted selectors; locks and explicit
User Set choices remain under the operator's control. Explicitly selecting an
effect or applying a Look remains a deliberate operator action. If an automatic
selection escapes a pool, capture the IDs, actual value, mode and build.

Read controls back after changes and consult `drivenBy` if another controller
may replace them. Session values are not necessarily shipped defaults: saved
Looks and Auto can both have changed them. `canDraw` is a diagnostic of known
blockers, not proof of visible pixels or a replacement for visual inspection.

## Layer state has one meaning

`setLayer(name, 'off')` switches the layer off — the picture, not just Auto's
permission to use it. `layers()[name].on` is whether it is drawing, and
`.toggle` names the control behind it.

That last one is worth reading rather than deriving: seven of the eight toggles
are the layer name with `On` appended and `shapes` is `shapeOn`, so anything
building the key by concatenation is right seven times and silently wrong once.

Agents must choose `setLayer(name, 'on')` or `'off'`; the human-only Auto
permission state is rejected. Verify `layers()[name].on`.

## Controls a macro is already holding

The six macros ride specific layer controls every frame. A control one of them
owns cannot be set to a value of your choosing — the macro rewrites it on the
next frame, so the write looks like it did nothing.

`describe()` now says which:

```js
ImageyFX.describe().controls.find(c => c.key === 'textSpin');
// { key: 'textSpin', drivenBy: [{ macro: 'rotation', depth: 0.8 }], ... }
```

Twenty controls are held this way. The obvious move — set the macro instead of
the control — is the wrong one for an agent, because a macro also *caps* what it
holds at `depth × travel` from rest, so a held control can never reach its own
range. Note too that `rotation` never maps `textSpin` to zero, so a set that
spins the picture cannot also have upright words.

**Park all six at rest (0.5) in the first cue and drive their twenty controls
directly.** That is the single change that most improves an authored set — see
*The macros are for the human. Park them.* below for the measurements.

Controls carry both `key` and `id`, which are the same string. Pools and
catalogues speak `id`; the registry historically spoke only `key`, and a filter
written against the wrong one matched nothing and returned an empty list rather
than an error.

## Reading and moving the desk directly

Everything a cue can do, you can also do now. Cues are the same verbs against
the track clock — write those for a set, and use these to look around, or to
change one thing between sets.

```js
ImageyFX.mode();                      // 'auto' | 'user'
ImageyFX.setMode('user');

ImageyFX.intensity();                 // 0–1, how hard the whole rig is pushed
ImageyFX.setMacro('energy', 0.7);       // User Set master strength

ImageyFX.macros();                    // { energy, motion, colour, density, scale, rotation }
ImageyFX.setMacro('energy', 0.8);

ImageyFX.press('strobe');             // hold a punch down
ImageyFX.release('strobe');           // and let it go
ImageyFX.tap('strobe');               // or a timed hit, if you just want one
```

`press` without a matching `release` stays on. A cue sheet releases anything it
was holding when the track changes or unloads, but a bare `press()` you made
yourself is yours to let go of.

`ImageyFX.tick(seconds)` is the hook the offline renderer calls to step a cue
sheet by the render clock rather than the wall clock. You do not need it while
performing — `schedule()` runs itself — and it is why a scheduled set comes out
of a render identical to the way it played.

## How you talk to it

There is no remote API. The rig runs entirely in the user's own browser, so
everything here happens in **that page**, on **their** machine.

There are four ways in, and which one you need depends on where your code
runs. The first three are inside the page; the fourth is for when you are not
in a browser at all.

**If you evaluate in the page's main world** — a devtools console, or a tool
that injects into the page itself — everything is on one global:

```js
window.ImageyFX
```

**If you are an extension content script** — which most browser agents are —
you run in an *isolated world*: same DOM, different JavaScript. `window.ImageyFX`
is genuinely `undefined` there, and no amount of retrying will change it. Use
messages, which do cross that boundary:

```js
function imageyfx(method, args) {
  return new Promise(resolve => {
    const id = Math.random().toString(36).slice(2);
    const onReply = e => {
      if (!e.data || e.data.imageyfx !== 'result' || e.data.id !== id) return;
      window.removeEventListener('message', onReply);
      resolve(e.data);            // { ok, value } or { ok: false, error }
    };
    window.addEventListener('message', onReply);
    window.postMessage({ imageyfx: 'call', id, method, args: args || [] }, '*');
  });
}

await imageyfx('hasMusic');
await imageyfx('analyse', [{ summary: true }]);
await imageyfx('schedule', [cues]);
```

**If you cannot run scripts at all** — an evaluation realm with the DOM visible
but no `addEventListener` and no `postMessage` — there is a third door that
needs only typing and clicking:

1. Open **https://360.imagey.ai/app?agent=1** (lands on Settings, Agent bridge
   at the top)
2. Type into `#agent-call` — the textarea labelled *Agent call, as JSON*:
   `{"method":"analyse","args":[{"summary":true}]}`
3. Click `#agent-run` — the button labelled *Run*
4. Read `#agent-result` — a `<pre>` labelled *Agent result*, with
   `aria-live="polite"` so a tool watching the accessibility tree is told it
   changed

The result is `{ ok: true, method, value }` or `{ ok: false, method, error }`,
and the element carries `data-ok="true"` / `"false"` so success and failure can
be told apart without parsing. Promises are handled: an async call writes
`pending: true` first and the real answer replaces it.

**If you read the accessibility tree rather than the screen**, the line above
the result is a `status` live region and says the shape of the answer — `ok ·
describe · 11 fields · 46.5 KB`. The body sits in `#agent-result` as ordinary
text; it is scrollable rather than clipped, so it is all reachable. If your
tooling still cannot see it, **Download** writes the reply to a file.

Dismiss the cookie banner before using the panel — decline the non-essential
ones — or it will sit over the controls.

Prefer `analyse({ summary: true })` and `controls(layer)` over this door.
`describe()` returns the full current control registry, which becomes a large block of text to
read back.

**If you are not in a browser at all** — an MCP client, running as a process —
there is an MCP server for that. It attaches to a Chrome the human already has
open and calls the same API.

It is published as `imageyfx-mcp` on npm, open source at
<https://github.com/nerdfreakuser/imageyfx-mcp>. There is nothing to clone, but
the person at the machine still has to do this once — you cannot do it for them:

1. Add it to the MCP client's config:
   `{ "mcpServers": { "imageyfx": { "command": "npx", "args": ["-y", "imageyfx-mcp"] } } }`
2. Start Chrome with `--remote-debugging-port=9222` and open the rig in it

It exposes twelve tools rather than one per method, all prefixed `imageyfx_`:
`imageyfx_status`, `imageyfx_analyse`, `imageyfx_schedule`, `imageyfx_progress`,
`imageyfx_transport`, `imageyfx_desk`, `imageyfx_layers`, `imageyfx_effects`, `imageyfx_content`,
`imageyfx_control`, `imageyfx_say`, and `imageyfx_call` for any method the other
eleven do not cover. `imageyfx_status` is the one to call first; it returns the complete status in a single page call.

If you are an MCP client and these tools are not present, ask the human to set
the server up. It is the fastest route by a wide margin — one round trip per
call, against four for the Settings form.

Every method is callable by all four routes — each takes a method name and an
argument array and returns whatever the call returns. If `window.ImageyFX` is
undefined, try messages; if messages are unavailable, use the Settings bridge;
if you are not in a browser, use MCP.


Use `ImageyFX.describe()` when you need the full registry. It returns the entire instrument — every
layer, every performance action, and all current controls with their labels,
ranges, units and tags — generated from the app's own registry, so it is never
out of date with what the rig can actually do.

## MCP failures and reconnecting

MCP validates tool arguments before making page calls. Text slots are integers
1–5, removal indices are non-negative integers, seek requires seconds, and macro
names must come from `macros()`. Layer changes require a layer name. The generic
`imageyfx_call` takes an argument array and calls only the API's own methods.

If multiple tabs match `IMAGEYFX_MATCH` (default `/app`), choose a more specific
URL fragment in the MCP configuration or close duplicate app tabs. The server
refuses to guess which performance to change. Concurrent calls share a connection;
a disconnected socket fails pending calls and the next call reconnects. A timeout
or disconnect does not prove a write failed: read status/content before retrying.
Cue validation errors retain all faults so a sheet can be corrected in one pass.


## API shape and effect discovery

There are no hosted REST endpoints. The supported endpoint is the page API:
`window.ImageyFX`. The same methods are available through the isolated-world
`postMessage` bridge, the Settings form, and the local MCP server. Controls do
not need one endpoint per knob: `controls(layer)` describes them, `get(key)`
reads one and `set(key, value)` writes one. Each control includes its layer,
range, current value, whether Chaos can automate it and which macro drives it.

Effect selection has a dedicated discovery call:

```js
ImageyFX.effects();                         // every drawable layer
ImageyFX.effects('lasers');                 // one layer's catalogue
ImageyFX.effects('circle', { group: 'Sculptures' });
```



The current library is broad and grouped by visual role: circle (115 effects:
spinners, waves, pulses, particles, scanners, geometry, fractals, liquid,
mandalas, chromatic, trance, spirals and sculptures); lasers (102: rigs,
sweeps, spins, fans, crossfire, kaleidoscopic, vortex, bloom, swarm, hypnotic
and sculptures); grid (119: waves, scans, noise, blocks, pulses, fractal,
liquid, mandala, chromatic, trance, arcade, spirals and sculptures); spiro (52:
wheels, star machines, orbits, rosettes, gears and sculptures); shapes (66:
still, spin, scan, travel, impact, trance, geometry and figures); logo (53:
still, holographic edge, illuminated depth, breathing and pulse); milk (43:
tunnels, spirals, smoke, reactive, kaleidoscopic, strange and sculptures); and
text (50: still, wave, arrival, chaos, travel, reactive and sculptures). Counts
are a current-build guide, not a second catalogue: `effects()` is authoritative.

Use the returned ids with `pick(layer, ids)` or `catalogue` filters. The MCP
route is `imageyfx_effects`; it is read-only. New visual effects should appear
in this catalogue, the layer pool, the Control Booth registry, Chaos metadata
and the renderer together. If an effect appears in only one of those places,
report it as an integration bug instead of inventing an endpoint.


## Taking and releasing control

Creative API writes take the desk in User Set. Transport selects User Set without
claiming ownership. `ImageyFX.takeControl()` explicitly takes ownership;
`ImageyFX.releaseControl()` leaves User Set and releases it. `hasControl()` reads
the badge state. Saved Looks applied by the agent cannot enable Auto.

## Start here: is there music?

Every layer is music-reactive. With nothing loaded the picture is a still frame
and Auto has no signal to follow, so **a set planned against silence is planned
against nothing**.

```js
ImageyFX.hasMusic();     // false -> ask the user to load a track
ImageyFX.track();        // { id, name, duration, bpm, position, playing, analysed }
```

If `hasMusic()` is false, say so and ask them to load one — drag an audio file
onto the window, or use Choose music. **You cannot load it for them**: a browser
only receives a file from the person at the keyboard.

## Plan the set before you press play

Do not try to perform in real time. You cannot hit a beat — the round trip is
hundreds of milliseconds — and anything driven by wall-clock is *absent from a
render*, because the renderer steps its own clock. Read the track, decide, set
up, then start.

```js
const t = await ImageyFX.analyse();
```

The audio never leaves the machine. What comes back is about 12 KB of JSON for
a three-minute track.

**Long tracks do not return long JSON.** The sample rate drops to fit, so a
seventy-minute set comes back coarser rather than enormous - about 2,100
samples instead of 42,700. `hz` in the result says what you actually got, and
a time is always `index / hz`. Two options if you want to steer it:

```js
await ImageyFX.analyse({ summary: true });  // structure only, no envelope (~1.6 KB)
await ImageyFX.analyse({ hz: 20 });         // finer envelope for authoring lanes
```

`summary` keeps the onsets, peaks, sections and quiet stretches - the things a
set is actually hung on - and drops the waveform, which is the big half and the
least often read. The full reply runs to about 40KB on a three-minute track:

| Field | What it is |
|---|---|
| `id` | Identity of the track. Compare it before trusting an old plan |
| `duration`, `bpm` | Seconds; tempo estimated from the onsets, `0` when unknown |
| `hz` | Samples per second in `level` — a time in seconds is `index / hz` |
| `level` | Loudness over time, 0–1, normalised to the track's own peak |

**A DJ mix will report a low `bpmConfidence`, and that is correct.** An hour of
music with several tempo changes has no single tempo, and a number offered
confidently would be a lie. Hang the set on `sections` and `peaks`, which are
right whatever the tempo is doing, and do not compute cue times from `bpm`.
| `onsets` | Times of energy jumps — the hits worth hanging a punch on |
| `peaks` | The loudest moments, biggest first. The drop is usually here |
| `sections` | Where the track changes character: intro, drop, breakdown, outro |
| `quiet` | Stretches worth going still for |

`bpm: 0` means genuinely unknown, not 120. `bpmConfidence` (0-1) says how much
of the track agrees, and `bpmWhy` says why when it is zero -
`tooFewOnsets`, `noUsableGaps` or `insufficientRegularOnsets`. A handful of
hits on an ambient piece and a hundred hits that disagree are different
problems, and only one is worth asking the human about.

`ImageyFX.progress()` returns `{ stage, busy, elapsedMs }` while a long
analysis runs, so you can poll for the phase rather than sit on a promise.

Cached against `id`, so calling it twice is free. Pass `{ force: true }` to redo.

### The track can change under you

The user can load something else at any moment without telling you.
`ImageyFX.track().analysed` goes `false` when the loaded track no longer matches
your analysis, and the `id` changes. **Check it before acting on a plan** — cues
written for one track are nonsense against another.

### Then start it

```js
ImageyFX.play();       // when the desk is set the way you want it
ImageyFX.position();   // seconds into the track
ImageyFX.seek(90);
ImageyFX.pause();
```

A worked shape: `hasMusic()` → `analyse()` → choose User Set macros, pools and
layers from `sections` and `peaks` → tell the user what you set and why →
`play()`.

## Write the set as a cue sheet

Rather than acting at the right moment, say what should happen and when. Cues
are positions **in the track**, not delays - so the same sheet plays identically
whether somebody presses play or the studio renders it four times slower than
real time.

```js
ImageyFX.schedule([
  { at: 0,     do: 'mode',      value: 'user' },
  { at: 0,     do: 'layer',     name: 'grid', state: 'on' },
  { at: 64.0,  do: 'macro', name: 'energy', value: 0.8 },
  { at: 129.8, do: 'tap',       id: 'blackout' },     // the drop, from peaks[0]
  { at: 130.0, do: 'set',       key: 'hue', value: 200 }
]);
ImageyFX.play();
```

| `do` | Fields |
|---|---|
| `set` | `key`, `value` — any registered control |
| `macro` | `name`, `value` — one of the six |
| `intensity` | Rejected for agents; use `macro` cues |
| `mode` | `value` — `'user'` only |
| `press` / `release` | `id` — hold a punch, and let it go |
| `tap` | `id` — a hit that lets go on its own |
| `look` | `id` |
| `layer` | `name`, `state` — `'on'`/`'off'` |
| `pool` | `name`, `value` — `'all'`/`'favourites'`/`'custom'` |
| `cast` | nothing — re-deals the text layers |

`ImageyFX.scheduled()` shows the sheet and how far through it is - pass `{ summary: true }`
for just the marker, since the whole sheet is an expensive way to ask about
progress. `unschedule()` drops it.

### A whole playlist, not one track

Sheets are held per track, so you can plan every track in the queue up front.
Pass a track id as the second argument to write one for something not loaded
yet:

```js
ImageyFX.schedule(cuesForThis);                        // the track on the deck
ImageyFX.schedule(cuesForNext, 'next-song.mp3:5512');  // ready for when it arrives
ImageyFX.schedules();                                  // every sheet held
ImageyFX.unschedule(trackId);                          // or unschedule() for all
```

When the playlist moves on, that track's sheet takes over from its own start.
Nothing is thrown away.

### What happens at the edges

| | |
|---|---|
| **Track ends, playlist advances** | The new track's sheet takes over from zero. Others are kept |
| **Anything a cue was holding** | Released on a track change or unload — a `press` at 3:40 will not still be on at 0:00 of the next track |
| **Track unloaded entirely** | Marker cleared, holds released, sheets kept |
| **Repeat-one** | Position returns to zero, cues re-arm, the set plays again |
| **Seeking** | Restores durable cue state before the destination in either direction; historical one-shot events are not replayed |
| **Cues past the end** | Never fire. `schedule()` returns `beyondEnd` so you know before it does nothing |
| **A render** | Runs on the render's own clock, so the same sheet lands on the same frames |

Malformed sheets are refused whole, with every fault listed at once — a
half-loaded set is worse than none.

The tab title is never touched, so there is nothing to restore there.

## Authoring a responsive User Set performance

Read `controls(layer)` before building: a used desk contains session settings,
not necessarily product defaults. Check `drivenBy` on each control rather than
assuming that every hue or opacity has the same owner.

### Structure versus authoring resolution

`analyse({ summary: true })` is for reading structure back as text; it omits the
`level` envelope. For building detailed audio-driven lanes, request
`analyse({ hz: 20 })` and process the returned data programmatically rather than
pasting the entire envelope into conversation. Explicit rates are clamped to
0.05–50 Hz. The default adapts downward on long tracks; always read returned
`hz` and use `time = sampleIndex / hz`.

At 174 BPM, 2 Hz gives about 0.69 samples per beat and 20 Hz about 6.9. Higher
resolution provides finer timing evidence; it does not guarantee beat detection.
Use onsets and section changes together with the envelope and musical intent.
Low-confidence BPM should not become a rigid beat grid.

### Build control lanes deliberately

A useful starting technique is to rescale the envelope between its 5th and 95th
percentiles and clamp to 0–1. If those percentiles are equal or nearly equal,
use a constant baseline instead of dividing by zero or amplifying tiny noise.
This is an artistic mapping choice, not a claim that every track needs it.

Create differently smoothed lanes for slow swells and faster accents. Map each
to a suitable control range, quantise to useful steps, and emit a cue only when
that quantised value changes. Squaring a normalised value emphasises peaks;
a square root lifts quieter passages sooner. Avoid driving every brightness
and bloom control high together; inspect representative breaks and peaks.

More cues or more effects are not quality goals by themselves, and the
sections below are the parts that took longest to learn.

### The macros are for the human. Park them.

The advice above used to read "use the six macros for their mapped User Set
controls." That is wrong for an agent, and it is the single mistake most likely
to make an authored set look worse than Auto.

A macro does two things to the twenty controls it owns. It **takes** them - it
rewrites them every frame, so your `set` on one of them lands and is gone. And it
**caps** them: a control a macro holds can only travel `depth x travel` from its
rest, so it can never reach its own range. `gridOpacity` is held by `energy` at
depth 0.4. With `energy` driven, measured on a paused deck:

```
energy driven    gridOpacity 29     grid luminance 10.8
energy at rest   gridOpacity 90     grid luminance 34
pushed directly  gridOpacity 95     grid luminance 52
```

The grid could not exceed 44 of 100 no matter what the music did, and it read to
the user as "the grid seems dark a lot." `colour` couples four hues so no layer
can have its own; `rotation` couples `spiroSpin` to `textSpin`, so a set that
spins the picture cannot also have upright words.

For a human with six faders that coupling is the whole point. For an agent
writing exact values it costs range and independence and buys nothing. So:

```js
// first cue of the sheet
for (const m of ['energy','motion','colour','density','scale','rotation'])
  cues.push({ at: 0, do: 'macro', name: m, value: 0.5 });
```

**Rest is 0.5, not 0.** Then drive all twenty of their controls yourself, from
the envelope, alongside the 148 no macro ever held. `describe().controls` marks
the twenty with `drivenBy`.

### Author control movement explicitly in User Set

This is the other half of the same lesson, and it is easy to get backwards.
Under Auto, Chaos drives permitted controls at 60fps - that is what makes Auto
feel alive. In User Set Chaos does not write controls. Native effect animation and audio-band reactions still run; unchanged control readbacks do not prove a static rendered picture. Measured over 5.6s of playback with a
structure-only sheet running, `circleOpacity`, `gridBright`, `laserOpacity`,
`bright`, `glow` and `gridOpacity` each held **exactly one value**.

For the continuous control movement in this authoring style, write lanes as well
as section changes and preset cuts. One small helper covers most of it:

```js
const env = analysis.level;                    // from analyse({ hz: 20 })
function lane(key, lo, hi, step, quant, shape) {
  let last = null;
  for (let i = 0; i < env.length; i += step) {
    const v = Math.round(map((shape || (x => x))(env[i]), lo, hi) / quant) * quant;
    if (v !== last) { cues.push({ at: i / hz, do: 'set', key, value: v }); last = v; }
  }
}
```

Drive it from the **raw** envelope, not a smoothed one. Smoothing the lanes was
an over-correction for jumpiness that turned out to be caused by too many preset
cuts landing on one frame - see the selector rule below.

`step` is in envelope samples: at `hz: 20`, `step: 3` is 150ms, about a third of
a beat, which reads as pulsing with the kick. **Both temporal spacing and quantisation affect smoothness.** In Claude's test,
halving `step` increased cue count without visible gain, while halving `quant`
provided finer levels. Treat that as a measured starting point, not a universal
rule for every control or tempo. When
the user asks for an opacity to move more smoothly, take `quant` to 2 and leave
`step` alone.

### Angles travel, they do not jump

`spiroSpin`, `spiroHue`, `logoSpin` and the rest wrap at 360, so a lane that maps
the envelope onto them makes the picture jerk back and forth. Integrate instead:

```js
function ramp(key, degPerSec, swing, step, quant) {
  let a = Math.random() * 360, last = null;
  for (let i = 0; i < env.length; i += step) {
    a = (a + (degPerSec + swing * env[i]) * (step / hz)) % 360;
    const v = Math.round(a / quant) * quant % 360;
    if (v !== last) { cues.push({ at: i / hz, do: 'set', key, value: v }); last = v; }
  }
}
ramp('spiroSpin', 26, 95, 3, 3);    // always turning, faster on the kick
ramp('spiroHue',  14, 60, 4, 3);    // colour that never sits still
```

A hue control still works when the layer's palette is `custom`: it is a clean
linear offset on top of the custom pair. Measured on spiro - hue 0 rendered at
241 degrees, +90 at 332, +200 at 81, +300 at 181. So a layer can have both an
authored pair and its own continuous drift.

### The light levers ship at their floor

Several controls that decide whether a layer is *visible at all* are not
opacities, and they ship near their minimum. Raising opacity on a hairline does
nothing. Measured in one frame with the grid at luminance 98:

| layer | luminance | what was actually wrong |
| --- | --- | --- |
| lasers | 5.0 | `laser.width` 1 of 30, `laserCore` 40, `laserHaze` 24 |
| spiro | 1.4 | `spiroWeight` 2 of 10, `spiroGlow` 45 of 250 |
| shapes | ~0 | `shapeWeight` 2 of 10, `shapeGlow` 30 of 200 |
| milk | 17.5 | `milkOpacity` 40, `milkScale` 32 |
| logo | fixed | **no lane at all** - `logoOpacity` sat at 68 for the whole set |

`spiroWeight` 2 to 6 nearly doubles spiro's luminance and saturates by 8.
`laser.width` 1 to 7 takes the lasers from 5 to 33; 14 takes them to 95 and
starts costing frames, because a wide hazed beam is the most expensive thing on
the screen. Give every layer a stroke-width or glow lane, not just an opacity
one, and check the **logo** - it is the layer most often left with none.

### At most two presets cut on the same instant

Three or more layers re-dealing on one frame is what reads as glitchy, and it is
what makes an authored set feel worse than Auto. It is not a reason to change
presets less often - spiro through eight presets in eight seconds looks great.
Just spread the collisions:

```js
const bucket = new Map();
for (const c of cues.filter(isSelector).sort((a, b) => a.at - b.at)) {
  const k = Math.round(c.at * 30);
  const n = bucket.get(k) || 0;
  if (n >= 2) c.at += (60 / 128 / 4) * (n - 1); // a sixteenth note at 128 bpm
  bucket.set(k, n + 1);
}
```

Nudging beats dropping: nothing is lost from the sheet and the eye reads them as
separate events.

### Measure the frame distribution, never the mean

A big sheet is not automatically a problem, and a good average is not evidence
of a smooth picture. A 95-minute set with about 35 lanes came to ~944k cues and
measured:

```
{ p50: 16.6, p95: 20, worst: 214.6, over50ms: 28, of: 954, heapMB: 301.9 }
```

The median is a clean 60fps and about 3% of frames stall for six to thirteen
frames each. That is exactly what a user describes as "a bit stuttery" while
every fps average you print looks fine. So print `p50`, `p95`, `worst` and a
count of frames over 50ms - one mean number hides the entire problem.

**Do not assume the sheet is the cause.** The obvious reading of the numbers
above is GC pressure from a large resident sheet, and it is worth testing rather
than believing: cutting the sheet's memory nearly in half changed the stall rate
not at all, and then removing the sheet **entirely** made stalls *worse* (116 in
398 frames, against 43 with the sheet live). Whatever was hitching that machine,
it was not the choreography.

The test is one call and it settles the question:

```js
ImageyFX.unschedule(ImageyFX.track().id);   // measure again with nothing scheduled
```

If the stalls survive that, they are the browser, the machine, or your own
polling - not the cue count - and thinning the set will cost you the performance
for nothing. Reschedule afterwards; unscheduling does not stop playback but it
does throw the set away, so keep the generator's output to hand.

When cues genuinely are the constraint, cut them before you cut anything
creative: raise `step` on the lanes whose `quant` is already coarse, and leave
`quant` alone - that is the one that shows.

### Measuring what is actually on screen

`document.querySelector('canvas')` returns `milk`, not the composite - every
layer has its own canvas and the page composites them with per-layer opacity.
A brightness table built on the first canvas is a table about milk. Sum the
layer canvases by id (`grid`, `ring`, `lasers`, `spiro`, `milk`, `shapes`),
weighting each pixel by its alpha, and average over a dozen samples: any single
frame catches whichever layers the arrangement happens to have on.

And when the user says a layer looks wrong, believe them over the number. A grid
at mean luminance 98 against accents at 20 measures like a wall and looked, to
the person watching, like the best version of the set.


### Choose and rotate the actual selectors

In User Set, `pick()` only restricts a pool. It does not rotate presets for the
authored score. Use `set` cues on the corresponding selectors when changes are
wanted: `mode` for circle, `laserPreset`, `gridMode`, `spiroMode`, `milkMode`,
`textMode`, and the separate shape motion/figure controls `shapeMode`/`shapeId`.
Here `mode` is the circle's control key; `setMode()` changes Auto/User Set.

Discover values from the target control's `options`, not the whole layer's
catalogue. Shapes and logos have multiple selectable axes in one catalogue:
shape motions are not figure IDs; logo animations are not artwork IDs.

```js
const control = ImageyFX.controls('shapes').find(c => c.key === 'shapeMode');
const choices = control.options.map(o => o.value ?? o.id);
// Preset options normally use {id, name}; enums use {value, label}.
ImageyFX.set('shapeMode', choices[0]);
```

Use catalogue IDs for `pick()`, control option values for `set()`, and `invoke()`
for actions. Logo artwork needs `invoke('logoPick')` after narrowing its pool.

Choose change points from onsets or sections, with enough dwell time to read the
effect; quiet passages may suit longer holds. For variety, shuffle a permitted
list and walk through it before repeating. A fixed stride can miss most entries
when it shares a divisor with the list length. Keep authored selector choices
inside the desired pool even though an explicit set is an operator override.

### Impact and colour variety

`musicResponse` is the **Impact** control, range 0–100 in API units; the fresh
app value is 65 (internally 0.65). Inspect it when native audio reaction feels
weak. It changes the strength of music response, not the authored cue timing;
choose its value by previewing the user's track rather than applying a universal
recommended setting. It can also be automated by Chaos under Auto permissions.

The `colour` macro coordinates its mapped hues; it cannot independently steer
those layers. It biases their bases, so it does not imply every layer must have
the same colour. Use distinct per-layer palettes, custom colour endpoints and
unmapped hue controls where available. Discover their keys, options and
`drivenBy` per layer. A large background layer can dominate the perceived
palette, so assess the combined image rather than each swatch alone.

**A layer blends between its two custom endpoints, so what you see across most
of it is their midpoint - not either end.** Measured with playback paused:
`gridCustomA` at hue 30 with `gridCustomB` at hue 210 renders at 123, because
(30+210)/2 = 120. Two hues chosen to contrast therefore blend through whatever
sits between them, which for a warm/cool pair is green or yellow - the two bands
that dominate an additive composite fastest.

So the pair within one layer wants to be **close** (roughly 40 degrees or less
apart), and the variety wants to come from giving each layer a **different** base
and from changing bases between sections. Spreading a dozen endpoints evenly
around the wheel looks like variety on paper and produces mud on screen.


## Choreographing a long mix

When `bpmConfidence` is low, avoid treating the single BPM estimate as a reliable
beat grid. Use sections, peaks, onsets and quiet intervals as timing evidence.
A quiet interval is a candidate break, not necessarily a breakdown; the next
section is not automatically a drop. Peak clusters suggest possible climaxes,
not an instruction to apply a strobe without regard to the user's brief.

Use `{ at: 0, do: 'pick', name: 'grid', ids: ['plasma'] }` to carry preset
selections in the sheet. IDs are validated before the sheet is accepted. A
`pool` cue changes the mode; a `pick` cue replaces IDs and selects Custom.
An `invoke` cue takes `key` for an action control, such as `logoPick`. Configure content and
selectors deliberately, then build the section arc with macros and
layer states. Consult `drivenBy` for macro-owned controls rather than repeatedly
writing values that another controller replaces.

Check cue progress and resulting control values, then the visible performance
when possible. Rescheduling does not rewind playback: earlier cues are skipped. The schedule response reports `behindPlayhead`,
`position`, and `beyondEnd` so skipped cues are explicit.
Seek back to the beginning when the user wants the replacement sheet performed
from the start. Scheduled changes do not reclaim the desk or switch Auto to User Set.
A cue sheet preserves event timing in a render; Auto's choices
can still vary, so this is not a promise of identical rendered pixels.

## One set, start to finish

*A short track, by hand. For a long track or a DJ mix, read this for the
shape and then use the generator in the next section - a sheet this size
on a 95-minute mix is a slideshow.*

The whole job in one place. Every time in the sheet below comes from a number
in the analysis above it — that is the only idea here worth copying.

**1. Find out where you are.**

```js
ImageyFX.status();
// { hasMusic: false,
//   next: 'No track loaded. Ask the person at the keyboard to load one...' }
```

No track, so ask, and wait. You cannot do this part.

**2. Read the track.**

```js
const a = await ImageyFX.analyse({ summary: true });
```

```js
{
  id: 'nightdrive.mp3:8420117',
  name: 'nightdrive.mp3',
  duration: 214.6,
  hz: 20,
  bpm: 124,
  bpmConfidence: 0.71,
  bpmWhy: null,
  sections: [ { at: 0,     level: 0     },
              { at: 31.2,  level: 0.42  },
              { at: 92.8,  level: 0.71  },     // it opens up
              { at: 168.0, level: 0.29  } ],   // and comes back down
  peaks:    [ { at: 92.8,  level: 1.0   },
              { at: 140.4, level: 0.96  },
              { at: 121.6, level: 0.94  } ],
  quiet:    [ { from: 84.1, to: 92.6 } ]       // the breakdown before the drop
}
```

Four sections, a breakdown ending at 92.6, and the loudest moment in the track
at 92.8. That is a drop, and it writes most of the set by itself.

**3. Turn those numbers into cues.**

```js
ImageyFX.schedule([
  // Take the desk and start plain.
  { at: 0,    do: 'mode',      value: 'user' },
  { at: 0,    do: 'macro', name: 'energy', value: 0.35 },
  { at: 0,    do: 'layer',     name: 'grid',   state: 'off' },

  // sections[1] at 31.2 - the track arrives, so bring the grid in.
  { at: 31.2, do: 'layer',     name: 'grid',   state: 'on' },
  { at: 31.2, do: 'macro', name: 'energy', value: 0.55 },

  // quiet[0] runs 84.1 to 92.6. Go still, and let it breathe.
  { at: 84.1, do: 'macro', name: 'energy', value: 0.15 },
  { at: 84.1, do: 'layer',     name: 'lasers', state: 'off' },

  // peaks[0] at 92.8, on the section change. Hit it a beat early: one beat at
  // 124bpm is 60 / 124 = 0.484s, so 92.8 - 0.484 = 92.32.
  { at: 92.32, do: 'tap',      id: 'blackout' },
  { at: 92.8,  do: 'layer',    name: 'lasers', state: 'on' },
  { at: 92.8,  do: 'macro', name: 'energy', value: 0.9 },
  { at: 92.8,  do: 'set',      key: 'hue', value: 200 },

  // sections[3] at 168 - it drops away, so come down with it.
  { at: 168.0, do: 'macro', name: 'energy', value: 0.4 },

  // Hand back before the end, in the mode they had it in.
  { at: 210.0, do: 'release',  id: 'strobe' }
], a.id);

ImageyFX.play();
```

**4. Let go.**

```js
ImageyFX.releaseControl({ mode: 'user' });
```

The sheet keeps running after you release — handing the desk back does not
cancel the set, so you can leave and it still plays.

**What that example is doing, in one line each:** hang cues on `sections` and
`peaks`, not on a clock you invented; use the breakdown in `quiet` to earn the
drop; subtract a beat when you want a hit to land *on* the beat rather than
just after it; and pass `a.id` so the sheet is bound to the track it was
written for.

**When the tempo is not to be trusted.** `bpmConfidence` above is 0.71, so
`60 / bpm` is a real beat. On a DJ mix it will be nearer 0.2, and then the beat
maths is meaningless — drop it, and hang everything on `sections` and `peaks`,
which are right whatever the tempo is doing.

## The whole generator, for a real set

The example above is a teaching sheet: twenty cues on a four-minute track. It is
the right shape for a short piece and the wrong shape for the job people
actually ask for, which is a long track or a DJ mix that should look like Auto
only better. That job needs a program, not a hand-written list, and the program
is short enough to give in full.

Everything below was measured against a 95-minute techno mix. Run it, look at
the result, then change the ranges — the structure is what transfers, the taste
is yours.

### 0. The four helpers everything below uses

```js
const A = await ImageyFX.analyse({ hz: 20 });
const D = ImageyFX.describe(), HZ = A.hz, L = A.level, DUR = A.duration;
const ONS = A.onsets; // onset times are numbers, not {at} objects
const env = L, hz = HZ;
const opts = key => D.controls.find(c => c.key === key).options
  .map(o => typeof o === 'object' ? (o.value ?? o.id) : o);
const cues = [];
const at  = (t, cue) => { if (t >= 0 && t <= DUR - 0.5) cues.push({ at: +t.toFixed(3), ...cue }); };
const map = (v, lo, hi) => lo + (hi - lo) * Math.max(0, Math.min(1, v));

// a hex colour from hue/sat/lightness, for the customA / customB pairs
const hsl = (h, s, l) => { h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c,x,0] : h < 120 ? [x,c,0] : h < 180 ? [0,c,x]
                  : h < 240 ? [0,x,c] : h < 300 ? [x,0,c] : [c,0,x];
  const q = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return '#' + q(r) + q(g) + q(b); };

// deal presets from each layer's pool in a shuffled cycle, so nothing repeats
// until everything has been seen. Read the pools from describe():
//   const opts = k => D.controls.find(c => c.key === k).options.map(o => typeof o === 'object' ? (o.value ?? o.id) : o);
const POOLS = { mode: opts('mode'), gridMode: opts('gridMode'), laserPreset: opts('laserPreset'),
                spiroMode: opts('spiroMode'), milkMode: opts('milkMode'), shapeMode: opts('shapeMode'),
                textMode: opts('textMode'), logoAnimation: opts('logoAnimation') };
const order = Object.fromEntries(Object.entries(POOLS).map(([k, a]) => {
  const c = a.slice();
  for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; }
  return [k, c];
}));
const seen = Object.fromEntries(Object.keys(POOLS).map(k => [k, 0]));
const nextOf = k => order[k][(seen[k] = (seen[k] + 1) % order[k].length)];
```

And the two lane helpers from *Nothing moves a control in User Set except your
sheet* and *Angles travel, they do not jump* above — `lane(key, lo, hi, step,
quant, shape)` and `ramp(key, degPerSec, swing, step, quant)`. Everything from
here on is written in terms of those five.

### 1. Fit the beat grid locally, not globally

A DJ mix has no single tempo. In Claude's 95-minute test, one BPM put 18% of onsets on the grid; refitting every
60 seconds put 88% on it. These are observations from that track. The 118–145
BPM search range below is a techno-oriented starting point, and the fallback
128 BPM is a creative assumption, not a detected tempo. Adapt it to the track. Search a window of the onset list
for the tempo and phase that best explain it, and keep a per-window answer.

```js
// A, HZ, L, ONS and DUR were read in step 0.

const windows = [];                                // one tempo fit per 60s
for (let w0 = 0; w0 < DUR; w0 += 60) {
  const hits = ONS.filter(t => t >= w0 && t < w0 + 60);
  if (hits.length < 8) { windows.push(windows[windows.length - 1] || { bpm: 128, phase: w0 }); continue; }
  let best = null;
  for (let bpm = 118; bpm <= 145; bpm += 0.1) {
    const b = 60 / bpm;
    // phase that maximises how many onsets land near a beat line
    let sx = 0, sy = 0;
    for (const t of hits) { const p = 2 * Math.PI * ((t - w0) / b); sx += Math.cos(p); sy += Math.sin(p); }
    const score = Math.hypot(sx, sy) / hits.length;              // 0..1, circular mean
    if (!best || score > best.score) best = { bpm, score, phase: w0 + Math.atan2(sy, sx) / (2 * Math.PI) * b };
  }
  windows.push(best);
}
const fitAt   = t => windows[Math.min(windows.length - 1, Math.floor(t / 60))];
const beatAt  = t => 60 / fitAt(t).bpm;
const snap    = t => { const f = fitAt(t), b = 60 / f.bpm;
                       return f.phase + Math.round((t - f.phase) / b) * b; };
```

Every structural cue goes through `snap()`. That single habit is most of the
difference between a set that tracks the music and one that drifts off it.

### 2. Cut the track into 32-beat blocks

Music is built in 4 / 8 / 16 / 32. Blocks of 32 beats give you a unit that is
always musically meaningful, and a `hot` value per block lets density follow
energy without any hand-authored section list.

```js
const hotAt = L.map((v, i) => {                    // slow energy envelope, 0..1
  const a = Math.max(0, i - Math.round(HZ * 4)), b = Math.min(L.length, i + Math.round(HZ * 4));
  let s = 0; for (let j = a; j < b; j++) s += L[j];
  return s / (b - a);
});
const lo = [...hotAt].sort((x, y) => x - y)[Math.floor(hotAt.length * 0.05)];
const hi = [...hotAt].sort((x, y) => x - y)[Math.floor(hotAt.length * 0.95)];
const hot = t => Math.max(0, Math.min(1, ((hotAt[Math.round(t * HZ)] || 0) - lo) / (hi - lo || 1)));

const blocks = [];
for (let t = 0; t < DUR; ) {
  const b = beatAt(t);
  blocks.push({ t: snap(t), beat: b, hot: hot(t) });
  t += b * 32;
}
```

### 3. Colour: one wheel, layers spread across it, pairs kept close

A layer blends between its two custom endpoints, so what fills most of it is
their **midpoint**. Two hues chosen to contrast blend through whatever sits
between them, which for a warm/cool pair is green or yellow — the two bands that
dominate an additive composite fastest. So keep each layer's own A/B pair within
about 40 degrees, and get variety from giving each layer a *different* base and
stepping the bases between blocks.

```js
const WHEEL = 12, SPREAD = 16;                     // +/-16 deg inside a layer
const hueAt = i => ((i % WHEEL) + WHEEL) % WHEEL * (360 / WHEEL);
const SLOTS = ['', 'laser', 'grid', 'spiro', 'milk', 'shape', 'text'];
// 5 and 7 are coprime with 12, so bases never collapse onto each other
function colourBlock(bi, B, sat = 85, lit = 55) {
const step = bi * 5;
SLOTS.forEach((p, li) => {
  const base = hueAt(step + li * 7);
  at(B(0), { do: 'set', key: p ? p + 'Palette' : 'palette', value: 'custom' });
  at(B(0), { do: 'set', key: p ? p + 'CustomA' : 'customA', value: hsl(base - SPREAD, sat, lit) });
  at(B(0), { do: 'set', key: p ? p + 'CustomB' : 'customB', value: hsl(base + SPREAD, sat, lit) });
});
}
```

Use a gcd-safe step. `si * 5 % 10` only ever yields 0 and 5, which is how a set
ends up with lasers permanently stuck on red and yellow.

### 4. The block body: nothing goes a block without moving

```js
blocks.forEach((blk, bi) => {
  const b = blk.beat, B = n => blk.t + n * b, h = blk.hot;
  colourBlock(bi, B);

  // arrangement rotates so no layer is on for the whole set
  const want = h > 0.7 ? 4 : h > 0.35 ? 3 : 2;
  ['lasers','grid','spiro','shapes'].forEach((l, i) =>
    at(B(0), { do: 'layer', name: l, state: ((i + bi) % 4) < want ? 'on' : 'off' }));

  at(B(0) - b * 0.25, { do: 'press', id: 'blackout' });
  at(B(0), { do: 'release', id: 'blackout' }); // explicit quarter-beat duration
  at(B(0),            { do: 'tap', id: 'colourHit' });

  // every selector moves at least once a block; the busy ones more often
  at(B(0),  { do: 'set', key: 'gridMode',    value: nextOf('gridMode') });
  at(B(8),  { do: 'set', key: 'laserPreset', value: nextOf('laserPreset') });
  for (let n = 4; n < 32; n += 8)
    at(B(n),  { do: 'set', key: 'spiroMode', value: nextOf('spiroMode') });
  at(B(12), { do: 'set', key: 'logoAnimation', value: nextOf('logoAnimation') });
  at(B(0),  { do: 'invoke', key: 'logoPick' });
  at(B(0),  { do: 'cast' });

  // accents on the 4s, more on the 2s when it is busy
  const PUNCH = ['punchCircle','punchLasers','punchGrid','punchSpiro',
                 'punchLogo','punchMilk','punchShapes','punchText'];
  for (let n = 4; n < 32; n += 4) at(B(n), { do: 'tap', id: PUNCH[(bi + n) % PUNCH.length] });
  if (h > 0.5) for (let n = 2; n < 32; n += 4) at(B(n), { do: 'tap', id: PUNCH[(bi + n + 3) % PUNCH.length] });
});
```

Write `'on'` and `'off'`, never `'auto'`. `'auto'` is a permission for Chaos,
and in User Set there is no Chaos to take it, so an `'auto'` layer simply waits.

### 5. The lanes — this is what makes it feel alive

Park the macros first, then drive everything directly. The `lane` and `ramp`
helpers are given earlier; this is a working set of ranges to start from.

```js
for (const m of ['energy','motion','colour','density','scale','rotation'])
  at(0, { do: 'macro', name: m, value: 0.5 });     // rest is 0.5

// opacity: fine quant, moderate step - quant is what reads as smooth
lane('circleOpacity', 44, 100, 3, 2);  lane('laserOpacity', 40, 100, 3, 2);
lane('spiroOpacity',  46, 100, 3, 2);  lane('shapeOpacity', 30,  94, 3, 2);
lane('gridOpacity',   46,  98, 3, 2);  lane('logoOpacity',  46, 100, 3, 2);
lane('milkOpacity',   38,  78, 4, 2);

// brightness and glow
lane('bright',      55, 130, 3, 4);  lane('glow',       60, 150, 4, 5);
lane('gridBright',  62, 145, 3, 4);  lane('spiroBright', 58, 138, 3, 4);
lane('logoBright',  62, 150, 5, 4);  lane('spiroGlow',   70, 190, 4, 5);
lane('shapeGlow',   60, 185, 5, 5);  lane('finishBloom',  4,  44, 4, 2, v => v * v);

// THE LIGHT LEVERS - the ones that ship near zero and decide visibility at all
lane('laser.width',  2,   7, 5, 1);  lane('laserCore',  50,  90, 6, 5);
lane('laserHaze',   26,  56, 7, 4);  lane('spiroWeight', 2,   7, 6, 1);
lane('shapeWeight',  3,   8, 7, 1);

// geometry and motion
lane('gridCell', 10, 30, 8, 2);  lane('gap',        0,  4, 9, 1);
lane('size',     35, 92, 8, 4);  lane('inner',     20, 70, 9, 4);
lane('speed',    30, 88, 6, 4);  lane('laserSpeed', 30, 90, 6, 4);
lane('gridSpeed',28, 86, 6, 4);  lane('spiroSpeed', 30, 88, 6, 4);
lane('spiroScale',55,125, 6, 4); lane('spiroTrail', 30, 92, 6, 4);
lane('logoScale', 52,100, 5, 4); lane('milkFlow',   14, 92, 5, 4);

// angles integrate, they do not map
ramp('spiroSpin', 26, 95, 3, 3);
ramp('spiroHue',  14, 60, 4, 3);
```

### 6. Builds, resolved on the downbeat

```js
for (let i = HZ * 10; i < L.length - HZ * 4; i += HZ * 2) {
  if (!(hotAt[i] > 0.9 && hotAt[i - HZ * 7] < 0.5)) continue;   // a rise into a peak
  const pk = snap(i / HZ), b = beatAt(pk);
  for (let n = 16; n >= 1; n--) {                                // 16 beats of build
    at(pk - n * b, { do: 'set', key: 'gridCell', value: Math.round(map(1 - n / 16, 26, 10)) });
  }
  at(pk - b,     { do: 'press',   id: 'blackout' });
  at(pk,         { do: 'release', id: 'blackout' }); // one beat of dark
  at(pk,         { do: 'tap',     id: 'colourHit' });
  at(pk,         { do: 'press',   id: 'strobe' });
  at(pk + b * 2, { do: 'release', id: 'strobe' });
}
```

### 7. Spread the selector collisions, then send it in chunks

```js
const SELECTORS = ['mode','laserPreset','gridMode','spiroMode','milkMode',
                   'shapeMode','shapeId','textMode','text2Mode','text3Mode','logoAnimation'];
const bucket = new Map();
for (const c of cues.filter(c => c.do === 'set' && SELECTORS.includes(c.key))
                    .sort((a, b) => a.at - b.at)) {
  const k = Math.round(c.at * 30), n = bucket.get(k) || 0;
  if (n >= 2) c.at += (beatAt(c.at) / 4) * (n - 1);
  bucket.set(k, n + 1);
}
cues.sort((a, b) => a.at - b.at);
```

The MCP stdio transport gives up somewhere around 10 MiB and **fails silently** —
no reply, no error, no crash — so a set this size must be chunked. Send the first
chunk as `replace` and the rest as `append`:

```js
for (let i = 0; i < cues.length; i += 60000) {
  await imageyfx_schedule({ cues: cues.slice(i, i + 60000), trackId: A.id,
                            mode: i === 0 ? 'replace' : 'append' });
}
```

Chunks arrive in order, which `schedule()` relies on to avoid re-sorting the
accumulated sheet each time.

### 8. Check the result, not the accepted call

```js
ImageyFX.macros();                       // all six should read 0.5
ImageyFX.scheduled({ summary: true });   // fired / of / beyondEnd
```

Then look at the picture. Sample each layer canvas by id over a dozen frames —
one frame only tells you which layers the arrangement happened to have on — and
sample the controls you expect to be moving:

```
// over ten seconds, how many distinct values did each control actually take?
{ spiroMode: 7, logoOpacity: 12, circleOpacity: 11, spiroHue: 23, spiroSpin: 23 }
```

Any control reading `1` there is a control that is not performing, and that is
the fastest way to find a lane you forgot or a macro you left driven.

## Say what you are doing

Half a minute of an agent thinking looks exactly like half a minute of an agent
having crashed. The rig puts a small line over the picture while you work:

```js
ImageyFX.say('Reading the energy curve', { busy: true });   // stays up
ImageyFX.say('79 cues programmed');                         // fades after a few seconds
```

`analyse()`, `schedule()` and `releaseControl()` announce themselves for you.
Use `say()` for the stretches nothing else can narrate - thinking, waiting,
deciding what the second half should be.

**Never invent a percentage.** The stages take wildly different times and a bar
that jumps from a fifth to nine tenths is a lie told to look reassuring. `busy`
gives an honest indeterminate pulse instead.

## Things that used to surprise people

**`seek()` restores cue state and re-arms the sheet before it returns.** `seek(0); play();` in one
expression is safe — the marker moves with the playhead, so the set restarts
from the top rather than carrying the desk state from wherever you were.

**Permissions scope the engine, not you.** `setPermission(layer, group, false)`
stops *Chaos* touching that group. It does not stop you: an explicit write from
a caller holding the desk always wins. If a write looks refused, check
`drivenBy` — a macro rewriting the control every frame is the usual answer, and
it is not the same thing as a refusal.

**Pools bind `variation` too.** A tap of `variation` steps within whatever the
layer's pool allows, so a curated pool and a moving picture are not in
competition.

**`catalogue()` takes a filter.** The logo's list is three things at once —
animations, built-in artwork and uploads — and reading the top of it looks like
the layer has animations and nothing else.

```js
ImageyFX.catalogue('logo');                     // all 128
ImageyFX.catalogue('logo', { kind: 'default' }); // 69 built-in images
ImageyFX.catalogue('logo', { kind: 'mine' });    // what you uploaded
```

**There is a `cast` cue verb.** Re-dealing words on the track clock is
`{ at: 96, do: 'cast' }` rather than poking a control.

## Working at the right level

The rig is a musical instrument, not a form. Prefer the desk:

```js
ImageyFX.setMacro('energy', 0.75); // authored strength
ImageyFX.setMacro('energy', 0.8);  // six macros: energy motion colour density scale rotation
ImageyFX.tap('blackout');          // a hit that holds for a beat and lets go
ImageyFX.actions();                // every punch, its kind, and whether it is held
```

**Intensity is the single most important control.** Below about 0.45 the
picture sits near the bottom of its range and looks dark; at 1.0 everything
saturates and the dynamics flatten.

**The useful band depends on how many layers are on.** They composite
additively, so light sums. With three or four layers up, 0.7–0.85 is right.
With all eight, that band is a white-out and the usable range is nearer
0.42–0.64. Count the layers before trusting a number — `status().rig.layers`
and `layers()` both tell you, and a set built for a maximal show is exactly the
case where the higher figure misleads.

**Or set the trim once and stop worrying about it.** `master` is one control
over the whole composite, and it is the only lever that pulls the picture back
without fighting the engine for the layers' own opacities — those are macro
territory.

```js
ImageyFX.set('master', 65);   // 10-100, the trim on everything
```

It is deliberately outside Chaos's reach, so whatever you set stays set. It
applies to a render exactly as it applies to the screen.

Reach for individual controls only when the desk cannot say it:

```js
ImageyFX.controls('grid');            // every control on one layer
ImageyFX.set('gridOpacity', 60);      // in the units describe() reports
ImageyFX.get('gridOpacity');
```

Setting two hundred parameters by hand produces worse results than moving six
macros. The macros are wired to the music; individual controls are not.

## Layers and what Auto may do

```js
ImageyFX.layers();                            // state, permissions, locks, pool
ImageyFX.setLayer('lasers', 'on');          // 'on' | 'off'
ImageyFX.setPermission('grid', 'colour', false);  // presets|motion|colour|geometry
ImageyFX.setPool('grid', 'all');              // 'all' | 'favourites' | 'custom'
ImageyFX.catalogue('grid');                    // every preset a layer has, in the pool or not
ImageyFX.pick('logo', [id1, id2, id3]);   // exactly these, and set the pool to custom
ImageyFX.picked('logo');                  // which ids are in it
```

If a layer looks stuck on one effect, check its pool: `custom` with a single
preset picked means Auto has exactly one thing to choose from.

## The card in the corner

A signed-out visitor gets one offer of an account on load: a small card top
right, titled **Signed out**, with a button to log in and a **Dismiss**. It
blocks nothing — the rig runs behind it and Escape closes it — but it is in
shot, which matters if somebody is watching or filming.

**Taking the desk clears it for you.** The first thing you write calls
`takeControl()` internally, and that dismisses the card. You will usually never
have to think about it.

If you want the screen clean *without* taking control — before a screenshot,
say — there is a verb:

```js
ImageyFX.dismissSignIn();   // true if there was one to put away
```

It stays dismissed for that page load, exactly as the button leaves it.

**Do not try to sign anybody in.** You cannot, and it is not yours to do: the
login opens a Google popup and belongs to the person at the keyboard. If they
need an account — for their own artwork in the pools, or a subscription they
already pay for — say so and let them press it. `plan()` tells you where they
stand.

If you are working through the DOM rather than the API, the buttons are
`.signin__go` and `.signin__no`. Press the second one, never the first.

## The console, and the screen

The console is the desk of controls over the picture. It gets in the way of the
one thing worth watching, so an agent driving the rig usually wants it gone.

```js
ImageyFX.showConsole(false);   // fold it away
ImageyFX.showConsole(true);    // bring it back
ImageyFX.consoleShown();
ImageyFX.show('live');         // live | layers | looks | create | playlist | settings
ImageyFX.section();
ImageyFX.fullscreen();         // toggles
```

Writing anything folds it away for you the first time. If the user asks for the
desk back, `showConsole(true)` — do not tell them to press a key for something
you can do.

## Keyboard and gamepad

`ImageyFX.shortcuts()` returns the **live** bindings, including any the user has
rebound. `ImageyFX.shortcuts('gamepad')` gives the pad. Do not quote the table
below if the two disagree — the call is the truth.

| Key | Does |
|---|---|
| `Space` | Play / pause |
| `1`–`8` | Punch a layer: circle, lasers, grid, spiro, shapes, logo, milk, text |
| `B` | Blackout (hold) |
| `G` | Freeze (hold) |
| `C` | Colour hit (hold) |
| `L` / `T` | Logo hit / text hit (hold) |
| `N` | Next variation |
| `M` | Toggle Auto / User Set |
| `H` | Hide or show the console |
| `F` | Fullscreen (the app's own; see the note below) |
| `R` | Arm Record Live |
| `[` / `]` | Previous / next Look |
| `,` / `.` | Previous / next track |
| `/` | Show the shortcut list |

**Fullscreen.** The browser's own is usually the better answer and always
works: **F11** on Windows and Linux, **Ctrl+Cmd+F** on macOS, where F11 is not
fullscreen at all. The rig also has its own on `F`, which fullscreens the page
through the Fullscreen API - the same result by a different route. On a profile
saved before the defaults moved, `F` may still be Freeze and the app's
fullscreen may have no key; the browser's shortcut works regardless, and
`ImageyFX.fullscreen()` always does.

A punch is momentary: held while the key is down. A click of the on-screen
button holds it for one beat and lets go on its own; right-clicking one locks it
on until clicked off.

Shortcuts are ignored while a text field has focus, and `Space`/`Enter` belong
to whatever button has focus rather than to the transport.

Gamepads work if the browser reports them as `standard`: sticks drive the XY pad
and two macros, face buttons fire punches, Start is play/pause.

## How the picture is actually driven

Worth understanding before changing things:

- **Auto** reads the music and moves the six macros; the macros bias the layer
  parameters. **User Set** stops all of that and leaves the desk to the user.
- **Chaos** is the engine that switches presets and moves parameters over time
  under Auto. It only acts on layers whose permissions allow it, and only picks
  from each layer's **pool**.
- **Soft takeover**: a physical control has to pass through the current value
  before it takes hold, so a knob left at one end does not slam a macro on the
  first touch. The on-screen XY pad is absolute and does not do this.
- **Grabbing**: a macro has to be taken from Auto before it can be moved at
  all, or the engine drives your value away within the frame. Under Auto a
  fader on screen hands itself back the moment it is released - riding one
  against Auto is a momentary thing. `setMacro` grabs and *keeps*, because a
  script has no release to hand back on; call `ImageyFX.letGo()` when you are
  done, or Auto stays locked out of that macro.
- **Looks never get overwritten.** Macros bias whatever a Look set, so there is
  always something to come back to.

## What costs money, and what does not

**Everything you have been reading about is free.** All nine layers, every
preset, the whole desk, the cue sheets, recording and rendering. No account, no
key, no limit. Do not tell a user they need to pay for any of it.

What costs is **generating** — making something that did not exist:

| Feature | Where | Roughly |
|---|---|---|
| Generate a logo from a description | Create | 8 image units |
| Generate text artwork | Create | 8 image units |
| Generate a shape set | Create | 1 text unit |
| Generate a grid pack | Create | 1 text unit |
| Generate a palette | Create | 1 text unit |
| Transcribe lyrics for subtitles | Playlist | 1 unit a minute |

Each is a call to somebody's model, which is why those are the paid acts and
nothing else is. Anything already made stays usable whatever happens to the
plan.

Tiers are Starter $10/mo (~62 images), Studio $30/mo (~187), Pro $100/mo (~625).

```js
ImageyFX.plan();   // { connected, subscribed, tier, needed }
```

`needed` is the sentence to pass on when it is not `null`.

**Do not sign anyone in and do not buy anything.** Those are not exposed and
will not be: both spend somebody's money or open a login on their behalf. When a
user asks for something generated:

1. Check `plan()`
2. If `connected` is false — tell them to **sign in from Settings**; a plan
   belongs to an account
3. If connected but not `subscribed` — tell them the tiers are in **Settings**,
   and what the feature they asked for would cost
4. If subscribed — they can generate it themselves in **Create**

You can always offer the free route instead. Somebody who wants a logo has 128
of them in the pool already, and you can `addLogo()` artwork you produced
elsewhere; these images count toward their upload slots, but do not spend AI credits. That is usually the better
answer.

## Text effects stay readable

Fifty text presets, and every one of them keeps a glyph within about 35 degrees
of upright while it is solid. That is a rule the set is written to, not a
coincidence: a word you cannot read is not a text effect.

Anything that wants a bigger gesture gets there through scale, offset,
brightness, skew or a fade rather than by parking a letter mirrored. Where a
preset does throw a glyph a long way - `explode`, `scatter` - it fades as it
goes, so nothing sits far from upright while still legible.

`spin-block` (now shown as **Swing**) used to be the exception and was the one
people noticed: it rotated the whole block at a steady 36 deg/s and never faded,
so the words read backwards or upside down for about 44% of every turn. It now
swings inside +/-26 degrees and pauses at the top of each swing.

**If you add a preset, hold the same line.** A useful check is to run the glyph
hook over a couple of dozen seconds and count frames where `Math.abs(rot)`
exceeds ~100 degrees while `alpha` is still above ~0.35. That number should be
zero.

Registering with `Text360.register(id, name, group, cycle, factory)` is all that
is needed - `Params` reads `Text360.list()`, so one registration puts a preset in
the Control Booth, the layer pool, Chaos, the MCP catalogue and `effects()`
together. There is no second place to add it.

**The extra text slots are not the same shape as slot 1.** Slot 1 has 23
controls; slots 2-5 have 21 and lack `textArtPick` and `textCast`. All five now
carry `Opacity` - slots 2-5 did not until recently, which left glow and weight
as the only way to fade one, and neither is a fade.

## Words you write yourself

The Text layer says nothing until somebody gives it something to say, and text
is the easiest content of all for you to hand over.

```js
ImageyFX.addText('LAST ORDERS');       // slot 1 is the main Text layer
ImageyFX.addText('SEE YOU NEXT WEEK');
ImageyFX.castText();                   // nothing appears until you cast
```

**Adding words does not show them.** `castText()` deals the tab — one, two or
three of the five text layers get a word from their own list and the rest go
dark. It is also what Chaos fires under Auto. Call it at least once or the layer
stays silent and looks broken.

**Each word remembers the look it was added with, and dealing it puts that look
back.** That is right for a library somebody built by hand and wrong for one
built in code: words added before you configure the layer carry the old look
for ever, so every cast quietly undoes your setup. Say so if you own the look:

```js
ImageyFX.castText({ keepLook: true });   // deal words, leave my look alone
```

```js
ImageyFX.words();                      // [{ index, text }]
ImageyFX.setText(1, 'CHANGED');        // edit in place
ImageyFX.removeText(2);
ImageyFX.selectText(0);                // also loads the look it was saved with
```

Five slots: `1` is the main Text layer, `2`–`5` are the extras, each with its
own list — pass the slot as the last argument. A `\n` in the string is a
line break.

The extras are made when wanted rather than always present, and each brings its
own controls - `text2Mode`, `text3Size` and so on - which only appear in
`describe()` once the slot exists.

```js
ImageyFX.textLayers();        // [{ slot: 1, words: 2 }]
ImageyFX.addTextLayer();      // { slot: 2 }
ImageyFX.removeTextLayer(2);  // the words are kept for if it comes back
```

`addText(text, 4)` makes slot 4 if it is not there yet, so you rarely need
`addTextLayer` explicitly. It used to take the word and quietly drop it.


Each entry remembers the whole look it arrived with — face, colour, placement —
so selecting one later brings that back rather than just the words.

## Logos you supply yourself

A logo is the one piece of content you *can* hand over — small enough to travel
as text, unlike audio.

```js
const a = await ImageyFX.addLogo(base64PngOrDataUrl, 'Client mark');
const b = await ImageyFX.addLogo(anotherOne, 'Alt mark');
// { ok: true, id: 'mine:8', name: 'Client mark' }
ImageyFX.pick('logo', [a.id, b.id]);           // Auto uses only these
```

Call `addLogo` once per image, then `pick('logo', ids)` to say which of them
Auto may reach for — the ids come back from `catalogue('logo')`.

External artwork uses **16 upload slots**, or **32 for subscribers**. This
includes artwork generated outside the app. A full library rejects additions
with a slots-full error and preserves existing entries. Only AI generations
made inside the app's Create tab belong to its separate uncapped collection.

```js
ImageyFX.logoCapacity(); // { used: 16, max: 32, full: false, remaining: 16, generated: 0, total: 16, overLimit: 0, explanation: null }
```

After a plan downgrade, existing uploads can exceed the current limit; they are
preserved. `overLimit` and `explanation` explain this, while `generated` is
reported separately and never consumes upload slots.

`addLogo()` also returns `capacity` with the new entry's `id` and `name`.
Check capacity before a batch. If an upload fails or the connection drops,
inspect `catalogue('logo', { kind: 'mine' })` before retrying to avoid duplicates.

MCP `imageyfx_content({ listLogos: true })` returns artwork and capacity.
`imageyfx_content({ cast: true })` preserves the current text styling by default;
pass `keepLook: false` to restore each word's saved look. Direct `castText()`
retains its existing default; use `{ keepLook: true }` to preserve styling.
Chaos preserves styling when casting automatically.

`pick` **replaces** rather than adds, because "use these five" is what callers
mean and building that up from an unknown starting point cannot be said. An
empty array clears it. Unknown ids are refused — a typo used to narrow a pool to
nothing and look exactly like a deliberate choice.

### Logo pool versus displayed artwork

`pick('logo', ids)` narrows the allowed pool; it does not load an image.
In User Set, explicitly choose from that pool after setting it:

```js
ImageyFX.pick('logo', ['mine:0']);
await ImageyFX.invoke('logoPick');
// In a sheet, in this order:
// { at: 0, do: 'pick', name: 'logo', ids: ['mine:0'] }
// { at: 0, do: 'invoke', key: 'logoPick' }
```

A one-item pool selects that artwork; a larger pool shuffles among its entries.
Image loading is asynchronous. Read `layers().logo` after invocation resolves.

### Scrubbing an authored score

`seek()` restores preceding layer, control, macro, intensity, Look and pool
cues, plus the resulting sustained punch state. It selects User Set without changing agent ownership. Historical taps, casts and action invocations are not
replayed; invoke a logo shuffle explicitly after scrubbing if needed. Cues
exactly at the destination remain armed for the next tick.

Define the score's starting state at cue zero, including initial pools, so
backward seeks have an explicit state to restore. Controls never addressed by
preceding cues keep their existing values. Rescheduling still leaves earlier
cues unapplied until an explicit seek; `behindPlayhead` identifies them.

## Looks

A Look is a whole picture, saved and recalled.

```js
ImageyFX.snapshot();          // everything, as a serialisable object
ImageyFX.saveLook('Opener');  // -> { id, name }. { full: true } for the whole state
ImageyFX.looks();
ImageyFX.applyLook(id);
```

## Rendering a track to MP4

**You cannot upload the user's music, and you should not try.** A browser only
receives an audio file through a drop or a file picker, and both need the person
sitting at the machine. Do not ask them to send you the file, and do not offer
to render it yourself.

What to do instead — hand them this link:

**<https://360.imagey.ai/app?render=1>**

It opens the rig with the render room already up and a drop box waiting. They
drop an mp3 on it, or click it to browse, and press Start rendering. The file is
written on their machine; nothing is uploaded anywhere.

You can set the picture up first and put that in the link too:

```
https://360.imagey.ai/app?render=1&mode=user
```

| Parameter | Effect |
|---|---|
| `render=1` | Opens Render Studio with the drop box |
| `mode=user` | Required for agent-authored renders |
| `intensity` | Human Auto setting; do not include in agent links |
| `section=live` \| `layers` \| `playlist` | Opens a section |
| `look=<id>` | Applies a saved Look |

`ImageyFX.link({ render: true, mode: 'user' })` builds one for you.

Render speed depends on the user's hardware, effects, resolution and frame
rate. Supported outputs are 720p, 1080p, 1440p and 4K at 24, 30 or 60 fps, with
Draft, High or Best quality. Quality controls browser bitrate and local CRF;
output proportions preserve the source picture. Suggest 1080p or 30 fps for a
lighter render. Auto rendering follows Chaos, its pools and permissions.

## Recording a live performance

The Live desk's **Recording options** has two saved switches:
- **Start track with recording** starts the loaded audio file from the beginning
  after the countdown, once capture is active. Off by default.
- **Stop at track end** finishes on the actual file-ended event, including when
  playlist repeat is enabled. On by default. Quiet breaks do not stop capture.

The performance dips to black for 2.5 seconds. If branding applies, the closing
bumper follows and remains visible on the final frame; the bumper is not faded.
Desktop/live audio capture has no track end and remains manually controlled.
These switches configure recording, so Chaos does not change them.


## Two things worth telling the user

- **Auto is deliberately not repeatable.** Two Auto renders of one track will
  differ. If they need the same result twice, use User Set with a saved Look.
- **Renders are free and unwatermarked apart from a short bumper** at each end.
  A subscription removes it; the whole track is in the file either way.

## Do not

- Do not ask the user to send you their audio, or claim you can render it.
- Do not set individual controls when a macro says the same thing.
- Do not drive the rig without saying what you changed — it is a live
  instrument and they may be performing on it.

Agent compatibility: `ImageyFX.setIntensity()` is retained only to return a
clear User Set-only error. Do not call it to author a performance.


## September 2026 update (API 3.0, MCP 2.0.1)

There are 50 text presets and 234 registered controls. New presets:
`cascade`, `swipe-in`, `unfold`, `lighthouse`, `breath-wave`, `stagger-lift`,
`kick-drop`, `treb-sparkle`, `sub-bloom`, `slide-by`, `depth-push`, `shutter-text`.
Reactive presets read audio bands; other animations use the layer clock. Do not
promise every preset follows individual beats. `spin-block` retains its ID but
is displayed as Swing; explicit user rotation still applies. Discover options
with controls/effects rather than hardcoding counts. `text2Opacity` through
`text5Opacity` are writable 0-100 controls through existing set and cue tools.

A cast owns slot visibility: it can darken slot 1 after a `layer text on` cue.
`keepLook` preserves styling, not visibility. Read all five slots after a cast
and explicitly restore any required slot visibility afterwards.

For visual QA, inspect the composited browser screenshot. The first canvas is
only one layer. Summing canvases also misses CSS opacity, blend modes and DOM
overlays. Measure frame intervals during sustained playback. Smooth continuous
envelope-driven lanes; reserve sharp transitions for intended hits and cuts.

Large scores use at most 480 decorative timeline markers. Cue counts and
execution remain complete; marker count is not a cue limit. This does not
establish unlimited scheduling capacity.

## Long DJ sets (API 3.1 / MCP 2.1.0)

MP3 analysis now runs locally in a worker using a persistent streaming decoder.
Files are read in 64 KiB chunks; PCM is reduced to the RMS envelope immediately,
not retained as a whole-track AudioBuffer. Chunk boundaries preserve decoder
state and RMS bin phase; normalization and event detection run across the whole
envelope. MP3 duration is measured from decoded frames with gapless trimming.
This removes the native whole-buffer limit for MP3 analysis. No upload required.

Use the existing `analyse()` / `imageyfx_analyse` call; no new endpoint. For a
long score use `analyse({hz:20})`; for compact structural output use summary.
`track().analysisMethod` and the result's `analysisMethod` report `streaming-mp3`
or `native`. `describe().analysis` distinguishes analysis and offline rendering.
Progress reports bytes processed as a percentage, not an estimated completion
time. Replacing the track or starting another MP3 analysis cancels the old worker.
Decoder errors are surfaced rather than silently dropping damaged audio.

Other formats still use the native whole-file analysis decoder. Offline Render
Studio also still decodes the whole audio buffer, even for MP3; this analysis
fix does not remove its long-track limit. Live playback and live recording use
the existing media-element path. Do not promise unlimited offline export, and
never switch agents to Auto to work around a decoding failure.

Verified using a 105-minute 44.1 kHz MP3 that fails native decode with EncodingError:
streaming returns all 6,300 seconds at 20 Hz (126,000 samples). That is a test
fixture, not a guarantee that every damaged or unusual MP3 will decode. Relative
section detection and chunked offline export remain future work.


## Scheduling batches (MCP 2.2.0)

Page API: `schedule(cues, trackId, {mode, keys, from, to})`.
MCP: `imageyfx_schedule({cues, trackId, mode, keys, from, to})` — options are
TOP LEVEL, not nested in opts. Replace is the default; append adds cues; patch
removes matching names and/or an inclusive time range, then adds supplied cues.
Keys match key/name/id. With both keys and time bounds, both must match.
A patch needs a selector; malformed selectors are rejected without changing the
sheet. Read added/replaced/cues after every batch and verify the final total.
Batches commit individually: a later failure leaves earlier accepted batches in
place. Pause playback while assembling a score; resume only after totals match.
The reported ~10 MiB transport failure is an observation from Claude's client,
not a universal MCP limit. Keep each serialized batch comfortably smaller;
60,000 cues is an example, not a byte-size guarantee. Do not blindly retry an
append after a timeout: inspect the held count first to avoid duplicates.
