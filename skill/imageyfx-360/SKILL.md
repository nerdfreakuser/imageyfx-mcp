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

## What the agent is here to do

imageyFX-360 turns a user's music into a live visual performance: layered light,
colour, motion, artwork and words react to the track and can be recorded locally.
The agent is the creative assistant at the desk. It translates the user's brief
into a look, chooses or configures effects, adds supplied text or artwork, and
can schedule beat-timed changes. **Chaos is the performer** when Auto is on: it
moves permitted controls from the music, respects pools and pins, and also drives
renders. The user chooses the music, watches the result, supplies creative
intent, and approves sign-in or paid generation. The app owns playback and local
recording. Do not pretend to be a remote render server or ask for the audio file.

Choose the smallest workflow that matches the request:

- **Make it react:** check `status()`, inspect `effects()` if a layer needs a
  specific family, set mode Auto, then let Chaos perform.
- **Make a specific look:** take control, inspect `effects(layer)` and
  `controls(layer)`, apply a Look or set a few controls, then release control.
- **Choreograph a track:** analyse it, write cues against its seconds, schedule
  them, and leave the desk in the user's requested mode.
- **Make a video:** hand the user the render link; their browser supplies the
  track and writes the file locally.

## Modes and agent ownership

There are two modes: Auto and User Set. **Agent controlled** is an ownership
badge, not a third mode. For a precisely authored cue sheet, prefer User Set:
the cues specify the performance. Use Auto when the user wants Chaos to vary
permitted controls alongside those cues. Do not repeatedly reassert values to
fight Chaos; choose User Set or narrow automation permissions instead.

`play()`, `pause()` and `seek()` preserve mode and agent ownership, including
backward seeks that re-arm cues. Creative edits still take the desk. Explicitly
use `takeControl()` when you want ownership, and release in the requested mode.

## Start with the user's intent

1. Call `ImageyFX.status()` through the connected MCP or page bridge. There is
   no hosted REST API or hosted MCP endpoint to probe.
2. You can discover effects, configure pools, add artwork or words and prepare
   a Look without music. Ask the user to load a track only when playback,
   analysis or rendering needs it, using <https://360.imagey.ai/app>.
3. For an automatic performance, configure the look and pools and release the
   desk to Auto. Chaos follows the music in both live playback and rendering.
   A cue sheet is optional, for deliberate changes at particular track times.
4. For choreography, use `analyse({ summary: true })`, then schedule track-time
   cues. Prefer intensity and macros where they express the intended change.
5. After editing, release control in the mode the user requested. Do not
   unconditionally switch a deliberately fixed User Set performance to Auto.
6. For a video, prepare the look and hand over
   <https://360.imagey.ai/app?render=1>; the user's browser renders locally.

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

`setLayer(name, 'auto')` grants Chaos permission to choose whether the layer
appears; it does not guarantee that it is on now. For an arrangement that must
include a layer, use `setLayer(name, 'on')`, leaving effect permissions available
to Chaos as desired. Use `'off'` for an intentional absence. Read
`layers()[name].on` to confirm the current power state.

## Controls a macro is already holding

The six macros ride specific layer controls every frame. A control one of them
owns cannot be set to a value of your choosing — the macro rewrites it on the
next frame, so the write looks like it did nothing.

`describe()` now says which:

```js
ImageyFX.describe().controls.find(c => c.key === 'textSpin');
// { key: 'textSpin', drivenBy: [{ macro: 'rotation', depth: 0.8 }], ... }
```

Twenty controls are held this way. If you need one of them at a specific value,
move its macro rather than the control — and note that `rotation` never maps
`textSpin` to zero, so a set that spins the picture cannot also have upright
words.

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
ImageyFX.setIntensity(0.7);

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
text (40: still, wave, arrival, chaos, travel, reactive and sculptures). Counts
are a current-build guide, not a second catalogue: `effects()` is authoritative.

Use the returned ids with `pick(layer, ids)` or `catalogue` filters. The MCP
route is `imageyfx_effects`; it is read-only. New visual effects should appear
in this catalogue, the layer pool, the Control Booth registry, Chaos metadata
and the renderer together. If an effect appears in only one of those places,
report it as an integration bug instead of inventing an endpoint.


## Taking control puts the rig in User Set

The first time you write anything, three things happen: the rig switches to
**User Set**, folds its console away, and puts **AGENT HAS CONTROL** across the
screen for a couple of seconds.

The mode switch is the important one. **Two things cannot drive one desk.**
Under Auto the engine is already choosing — Chaos switches presets, layers come
and go on their own, and the macros are driven from the music sixty times a
second. A value you set there is a suggestion, overwritten within the frame
unless you also grab it, and everything you did not grab keeps moving underneath
whatever you thought you had arranged. In User Set, what you set stays set.

If you genuinely want the engine driving, `ImageyFX.setMode('auto')` still
works — this only decides which mode you start from.

Reading — `describe()`, `get()`, `controls()`, `track()`, `analyse()` — never
triggers any of it. Looking at a desk is not playing it.

`ImageyFX.hasControl()` says whether you have it. `ImageyFX.takeControl()`
claims it without changing anything - worth calling before a long read, so
the user is told what is about to happen rather than surprised by it.

`ImageyFX.releaseControl()` hands the desk back: the console reopens and the
mode returns to whatever it was before you arrived.

`ImageyFX.releaseControl({ mode: 'auto' })` says where to leave it instead. Use
this when you have been asked to set the room up and then get out of the way -
restoring the old mode and *then* calling `setMode` is another write, which
takes the desk straight back, so "leave it in Auto and let go" needs to be one
move.

Say what you changed; do not drive silently.

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
await ImageyFX.analyse({ hz: 2 });          // your own rate
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

A worked shape: `hasMusic()` → `analyse()` → choose a mode, intensity, pools and
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
  { at: 64.0,  do: 'intensity', value: 0.8 },
  { at: 129.8, do: 'tap',       id: 'blackout' },     // the drop, from peaks[0]
  { at: 130.0, do: 'set',       key: 'hue', value: 200 }
]);
ImageyFX.play();
```

| `do` | Fields |
|---|---|
| `set` | `key`, `value` — any registered control |
| `macro` | `name`, `value` — one of the six |
| `intensity` | `value` |
| `mode` | `value` — `'auto'` or `'user'` |
| `press` / `release` | `id` — hold a punch, and let it go |
| `tap` | `id` — a hit that lets go on its own |
| `look` | `id` |
| `layer` | `name`, `state` — `'auto'`/`'on'`/`'off'` |
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
| **Seeking** | Backwards re-arms the cues behind you; forwards fires everything skipped |
| **Cues past the end** | Never fire. `schedule()` returns `beyondEnd` so you know before it does nothing |
| **A render** | Runs on the render's own clock, so the same sheet lands on the same frames |

Malformed sheets are refused whole, with every fault listed at once — a
half-loaded set is worse than none.

The tab title is never touched, so there is nothing to restore there.

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
selectors deliberately, then build the section arc with macros, intensity and
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
  { at: 0,    do: 'intensity', value: 0.35 },
  { at: 0,    do: 'layer',     name: 'grid',   state: 'off' },

  // sections[1] at 31.2 - the track arrives, so bring the grid in.
  { at: 31.2, do: 'layer',     name: 'grid',   state: 'on' },
  { at: 31.2, do: 'intensity', value: 0.55 },

  // quiet[0] runs 84.1 to 92.6. Go still, and let it breathe.
  { at: 84.1, do: 'intensity', value: 0.15 },
  { at: 84.1, do: 'layer',     name: 'lasers', state: 'off' },

  // peaks[0] at 92.8, on the section change. Hit it a beat early: one beat at
  // 124bpm is 60 / 124 = 0.484s, so 92.8 - 0.484 = 92.32.
  { at: 92.32, do: 'tap',      id: 'blackout' },
  { at: 92.8,  do: 'layer',    name: 'lasers', state: 'on' },
  { at: 92.8,  do: 'intensity', value: 0.9 },
  { at: 92.8,  do: 'set',      key: 'hue', value: 200 },

  // sections[3] at 168 - it drops away, so come down with it.
  { at: 168.0, do: 'intensity', value: 0.4 },

  // Hand back before the end, in the mode they had it in.
  { at: 210.0, do: 'release',  id: 'strobe' }
], a.id);

ImageyFX.play();
```

**4. Let go.**

```js
ImageyFX.releaseControl({ mode: 'auto' });
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

**`seek()` re-arms the sheet before it returns.** `seek(0); play();` in one
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
ImageyFX.setIntensity(0.75);       // how hard Auto drives, if you hand it back
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
ImageyFX.setLayer('lasers', 'auto');          // 'auto' | 'on' | 'off'
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
https://360.imagey.ai/app?render=1&mode=auto&intensity=80
```

| Parameter | Effect |
|---|---|
| `render=1` | Opens Render Studio with the drop box |
| `mode=auto` \| `user` | Auto follows the music; User Set renders exactly what is set |
| `intensity=0..100` | How hard Auto drives, also accepts 0–1 |
| `section=live` \| `layers` \| `playlist` | Opens a section |
| `look=<id>` | Applies a saved Look |

`ImageyFX.link({ render: true, intensity: 0.8 })` builds one for you.

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
