# imageyFX-360 over MCP

<p align="center">
  <a href="https://360.imagey.ai">
    <img src="https://360.imagey.ai/site/media/og.jpg"
         alt="imageyFX-360 — no two tracks look the same" width="820">
  </a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/imageyfx-mcp"><img alt="npm" src="https://img.shields.io/npm/v/imageyfx-mcp?color=6f42c1"></a>
  <img alt="licence" src="https://img.shields.io/badge/licence-MIT-blue">
  <img alt="node" src="https://img.shields.io/badge/node-%E2%89%A518-brightgreen">
  <a href="https://modelcontextprotocol.io"><img alt="mcp" src="https://img.shields.io/badge/MCP-server-black"></a>
</p>

Drive [imageyFX-360](https://360.imagey.ai) — a browser VJ rig — from an MCP
client, by attaching to a Chrome you already have open.

Nine layers of light move on the user's own track, automated on the beat, and
can be recorded frame by frame to MP4. This server lets an agent work the desk:
read the shape of a track, write a set as cues against the track clock, and hand
control back when it is done.

## Setup

Nothing to clone. Point your MCP client at the package — for Claude Desktop,
in `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "imageyfx": {
      "command": "npx",
      "args": ["-y", "imageyfx-mcp"]
    }
  }
}
```

Then start Chrome with the debugging port open and load the rig in it:

```
chrome --remote-debugging-port=9222
```

…and open <https://360.imagey.ai/app> in that window.

That is the whole setup, and it is the one part an agent cannot do for itself.

`IMAGEYFX_PORT` changes the debugging port (default `9222`) and `IMAGEYFX_MATCH`
the URL fragment used to find the tab (default `/app`), so a local copy on
`localhost:8010/app` and the deployed site both work without configuration.

## What a session looks like

```
you   → imageyfx_status
rig   ← { hasMusic: false, next: "No track loaded. Ask the person at the
          keyboard to load one..." }

  (the human drops a track on the window)

you   → imageyfx_status
rig   ← { hasMusic: true, track: { name: "nightdrive.mp3", duration: 214.6 } }

you   → imageyfx_analyse { summary: true }
rig   ← { bpm: 124, sections: [0, 31.2, 92.8, 168.0],
          peaks: [{ at: 92.8, level: 1.0 }], quiet: [{ from: 84.1, to: 92.6 }] }

you   → imageyfx_schedule   (a cue sheet hung on those numbers)
you   → imageyfx_transport { action: "play" }
you   → imageyfx_control  { action: "release", mode: "auto" }
```

The set keeps playing after you let go, and it plays the same way inside a
render, because the renderer steps the same clock.

## Why it attaches rather than launches

The rig is a visualiser. The point of it is that somebody is watching, so a
headless browser would render a light show to nobody — and the person whose desk
is being driven could not see what was done to it, which is exactly what the
on-screen takeover card exists to prevent.

So: your Chrome, your screen, your rig. This server just talks to it.

## The tools

Eleven, shaped like the job rather than one per method. A model handed
fifty-nine flat tools picks by name-similarity instead of intent, which is the
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
| `imageyfx_content` | Words for the Text layer, artwork for the logo |
| `imageyfx_control` | Take the desk, or hand it back in a chosen mode |
| `imageyfx_say` | Put a line on screen over the visuals |
| `imageyfx_call` | Any page method by name, for what the rest do not cover |

Call `imageyfx_status` first. It answers five questions in one round trip.

The full instruction set for agents, including a worked example that turns a
track analysis into a cue sheet, is at
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

## In-page alternatives

If your agent is already in a browser, you do not need this at all. The rig
exposes every control on `window.ImageyFX` in the page, with a `postMessage`
bridge for extension content scripts in an isolated world and a typed form in
Settings for agents that can only read the page and click. The skill file covers
all four doors.

There is no remote HTTP API, and `/api`, `/mcp` and `/health` are 404 on
purpose. Control happens in the user's own browser, on their own machine.

## Dependencies

Two: the MCP SDK, and `ws` for the DevTools protocol. No browser driver —
Puppeteer and Playwright both bring a browser download and a process manager,
and neither is any use when the browser already exists and belongs to the user.

## Privacy

Audio never leaves the user's machine. Analysis happens in their browser and
rendering happens on their own hardware; this server carries method calls and
their results between your client and a tab, and nothing else.

## Licence

MIT. imageyFX-360 itself is a product of imageyAI Inc. and is not included here
— this package drives the hosted app, it does not contain it.
