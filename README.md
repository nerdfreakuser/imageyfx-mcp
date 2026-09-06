# imageyFX-360 over MCP

The packaged agent skill is `skill/imageyfx-360/SKILL.md`. Its canonical source
is `skill/imageyfx-360.md` in the [app repository](https://github.com/nerdfreakuser/ring-360).
The app repository's `tests/agent-skill.test.js` checks API method and MCP tool
names against that source. Port improvements there, then sync this packaged
copy; edits to an installed skill do not update npm and can be lost on upgrade.

Drives the rig from an MCP client — Claude Desktop, Claude Code, anything that
speaks the protocol — by attaching to a Chrome you already have open.

The page API (`window.ImageyFX`) and its three in-browser doorways solve
"the agent is already in a browser tab". This solves "the agent is not."

## Why it attaches rather than launches

The rig is a visualiser. The point of it is that somebody is watching, so a
headless browser would render a light show to nobody — and the person whose desk
is being driven could not see what was done to it, which is exactly what the
on-screen takeover card exists to prevent.

So: your Chrome, your screen, your rig. The server just talks to it.

## Setup

Add the published package to your MCP client's configuration:

```json
{
  "mcpServers": {
    "imageyfx": {
      "command": "npx",
      "args": ["-y", "imageyfx-mcp@latest"]
    }
  }
}
```

Start Chrome with remote debugging enabled and open <https://360.imagey.ai/app>.
The server attaches to that existing browser session. If you prefer a global
installation, run `npm install -g imageyfx-mcp@latest` and use `imageyfx-mcp` as
the client command. Restart the MCP client after updating.

`IMAGEYFX_PORT` changes the debugging port (default 9222) and `IMAGEYFX_MATCH`
the URL fragment used to find the tab (default `/app`), so a local copy on
`localhost:8010/app` and the deployed site both work without configuration.

## The tools

Twelve, shaped like the job rather than one per method. A model handed
fifty-eight flat tools picks by name-similarity instead of intent, which is the
failure the desk-first API was designed to avoid — so the same tiering applies
here.

| Tool | For |
|---|---|
| `imageyfx_status` | Orientation: is there music, what track, what account, what the rig can do |
| `imageyfx_analyse` | The shape of the track — loudness, onsets, peaks, sections, tempo |
| `imageyfx_schedule` | Hand over a set as cues against the track clock |
| `imageyfx_progress` | How far through the set it is |
| `imageyfx_transport` | Play, pause, seek, position |
| `imageyfx_desk` | Mode, intensity, the six macros |
| `imageyfx_layers` | Read the layers, or change one's state, pool or picked presets |
| `imageyfx_effects` | Discover effect ids, groups and sources before choosing |
| `imageyfx_content` | Words for the Text layer, artwork for the logo |
| `imageyfx_control` | Take the desk, or hand it back in a chosen mode |
| `imageyfx_say` | Put a line on screen over the visuals |
| `imageyfx_call` | Any page method by name, for what the rest do not cover |

The full API is documented for agents at
<https://360.imagey.ai/skill/imageyfx-360.md>.

## What it will not do

**Load music.** A browser only receives audio from the person at the keyboard,
and no amount of protocol changes that. `imageyfx_status` says so in its `next`
field when nothing is loaded.

**Sign in or buy anything.** Both spend somebody's money or open a login on
their behalf. `imageyfx_status` reports the account and carries the sentence to
pass on; the decision belongs to the human, in an interface they can see.

**Perform in real time.** Round trips are far too slow to hit a beat, and
anything driven by wall-clock is absent from a rendered video because the
renderer steps its own clock. Write a cue sheet; it plays identically live and
in a file.

## Dependencies

Two: the MCP SDK, and `ws` for the DevTools protocol. No browser driver —
Puppeteer and Playwright both bring a browser download and a process manager,
and neither is any use when the browser already exists and belongs to the user.

This package is deliberately separate from the app, which loads no npm
dependencies at all and still does not.

## API/MCP 1.1 update

- Status uses one page call and includes cue progress, silent-layer diagnostics
  and upload capacity. Refresh the app to use API 2.5.
- External logos count toward 16 upload slots (32 for subscribers). Only
  generations made inside Create use the uncapped generated collection.
  `imageyfx_content` with `listLogos: true` lists artwork and capacity.
- MCP text casting preserves styling by default; `keepLook: false` restores
  each word's saved look.
- Tool inputs are validated before page calls. Unknown macros, fractional text
  slots, seek without seconds and layer changes without a layer are rejected.
- Multiple matching Chrome tabs require a more specific `IMAGEYFX_MATCH` or
  closing duplicates. Connections are shared and recover on the next call.
  Disconnections/timeouts do not automatically retry writes: inspect state first.
- Run `npm test` for protocol and connection regression checks.

## MCP 1.3.0 / API 2.7

- Layer reads honour the layer filter; writes return actual power, permissions,
  pool and selected IDs instead of echoing the request alone. Use on for a
  required layer, auto for Chaos permission.
- Macro writes return current numeric values, including unchanged values.
- Controls expose enum options, operation and writability. Invalid enum values
  and numeric/toggle types are rejected. invoke(key) runs action controls;
  logoPick remains a shuffle action, not an artwork ID selector.
- Cue sheets support pick{name,ids} and invoke{key}; all IDs are validated before
  accepting the sheet. schedule reports behindPlayhead and current position.
  Cues preserve Auto ownership during live playback and rendering.
- Pool-aware random variations and next-frame pool reconciliation cover grid,
  lasers and other registered selectors. Logo artwork selection uses its pool.
- Diagnostics report unloaded artwork and zero opacity. Upload capacity separates
  generated items and explains preserved over-limit uploads after plan changes.
- Low-confidence tempo estimates include guidance. MCP initialization explains
  the product, the agent's role, and when Chaos or the user owns an action.

## 1.3.1 / app build 2026-09-06c

Transport preserves mode and ownership. User Set blocks the legacy Auto timer.
Agent controlled is an ownership badge; use User Set for precise cue scores
and Auto for Chaos variation alongside cues.
