#!/usr/bin/env node
/**
 * imageyFX-360 over MCP.
 *
 * The rig has had an API in the page for a while and three ways to reach it,
 * all of which assume the agent is already sitting in a browser. This is for
 * the ones that are not: an MCP client talks to this, this talks to a Chrome
 * that is already open, and the page does the work.
 *
 * Two things it deliberately does not do.
 *
 * It does not launch a browser. The rig is a visualiser and the point of it is
 * that somebody is watching - a headless render goes to nobody, and the person
 * whose desk is being driven could not see what was done to it.
 *
 * And it does not expose fifty-eight tools, one per method. A model handed a
 * flat list that long picks by name-similarity rather than by intent, which is
 * the failure the desk-first API was shaped to avoid in the first place. The
 * tools here are the shape of the job - look, read the track, write the set,
 * start it - with one escape hatch for the rest.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { Rig } from './chrome.js';
import { validate } from './validate.js';
import { readFileSync } from 'node:fs';

const rig = new Rig({
  port: Number(process.env.IMAGEYFX_PORT || 9222),
  match: process.env.IMAGEYFX_MATCH || '/app'
});

/* --- the tools ------------------------------------------------------------ */

const TOOLS = [
  {
    name: 'imageyfx_status',
    description:
      'Orientation. Returns whether music is loaded, what the track is, the ' +
      'account state, and what the rig can do. Call this first. Looks and pools ' +
      'can be prepared without music. Playback, analysis and rendering need a loaded track.',
    inputSchema: {
      type: 'object',
      properties: {
        full: {
          type: 'boolean',
          description:
            'Include the full current control list. Large; leave off ' +
            'unless you need to address a control by key.'
        }
      }
    }
  },
  {
    name: 'imageyfx_analyse',
    description:
      'Read the loaded track and return its shape: loudness over time, onsets, ' +
      'peaks, sections, quiet stretches, tempo. The audio never leaves the ' +
      'machine - this is a description, not a file. Plan the set from this. ' +
      'Prefer summary for long tracks or when reading results back as text.',
    inputSchema: {
      type: 'object',
      properties: {
        summary: {
          type: 'boolean',
          description: 'Leave out the loudness envelope. Much smaller; keeps the structure.'
        },
        hz: { type: 'number', description: 'Envelope samples per second. Defaults to fit the track.' },
        force: { type: 'boolean', description: 'Re-analyse rather than use the cached result.' }
      }
    }
  },
  {
    name: 'imageyfx_schedule',
    description:
      'Hand over a set as cues against the track clock. `at` is a position in ' +
      'the track in seconds, not a delay - the same sheet plays identically ' +
      'live and in a render. Do not try to perform in real time; you cannot ' +
      'hit a beat and wall-clock actions are absent from renders. Malformed ' +
      'sheets are refused whole, with every fault listed. Intensity cues affect Auto only; ' +
      'accepted sheets warn about this. Use macro cues in User Set.',
    inputSchema: {
      type: 'object',
      required: ['cues'],
      properties: {
        cues: {
          type: 'array',
          description: 'Each cue is { at, do, ... }.',
          items: {
            type: 'object',
            required: ['at', 'do'],
            properties: {
              at: { type: 'number', description: 'Seconds from the start of the track.' },
              do: {
                type: 'string',
                enum: ['set', 'macro', 'mode', 'press', 'release',
                       'tap', 'look', 'layer', 'pool', 'pick', 'invoke', 'cast'],
                description:
                  'set{key,value} macro{name,value} intensity{value} mode{value} ' +
                  'press/release/tap{id} look{id} layer{name,state} pool{name,value} pick{name,ids} invoke{key} cast{}'
              },
              ids: { type: 'array', items: { type: 'string' } },
              key: { type: 'string' }, name: { type: 'string' }, id: { type: 'string' },
              state: { type: 'string' },
              value: { description: 'Number or string, depending on the action.' }
            }
          }
        },
        trackId: {
          type: 'string',
          description: 'Plan ahead for a track not loaded yet. Defaults to the loaded one.'
        }
      }
    }
  },
  {
    name: 'imageyfx_transport',
    description:
      'Start, stop or move the track. Start it once the set is written and the ' +
      'desk is how you want it. Agent transport selects User Set without claiming ownership. A set assembled while the music is already ' +
      'running is assembled late.',
    inputSchema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: { type: 'string', enum: ['play', 'pause', 'seek', 'position'] },
        seconds: { type: 'number', minimum: 0, description: 'For seek.' }
      }
    }
  },
  {
    name: 'imageyfx_progress',
    description:
      'How far through the set the rig is, and what it is doing. Use the ' +
      'summary form to check progress - the whole sheet is an expensive way to ' +
      'ask a small question.',
    inputSchema: {
      type: 'object',
      properties: {
        cues: { type: 'boolean', description: 'Include the cue list. Off by default.' }
      }
    }
  },
  {
    name: 'imageyfx_desk',
    description:
      'The high-level controls: mode, how hard Auto drives, and the six macros. ' +
      'Use macros for broad changes; individual controls are also driven by Chaos ' +
      'when the human uses Auto. Agents must use User Set; intensity requests are rejected. ' +
      'Use macro cues for an authored score.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['user'] },
        intensity: { type: 'number', minimum: 0, maximum: 1, description: 'Auto only. No visual effect in User Set; use macros there.' },
        macros: {
          type: 'object',
          additionalProperties: false,
          properties: Object.fromEntries(['energy','motion','colour','density','scale','rotation'].map(k => [k, { type: 'number', minimum: 0, maximum: 1 }])),
          description: 'Any of energy, motion, colour, density, scale, rotation - each 0 to 1.'
        }
      }
    }
  },
  {
    name: 'imageyfx_layers',
    description:
      'Read every layer, or change one: whether it is on, what Auto may do to ' +
      'it, and which presets it may reach for. `pick` replaces the pool with ' +
      'exactly the ids given.',
    inputSchema: {
      type: 'object',
      properties: {
        layer: { type: 'string', description: 'Omit to read them all.' },
        state: { type: 'string', enum: ['on', 'off'] },
        pool: { type: 'string', enum: ['all', 'favourites', 'custom'] },
        pick: {
          type: 'array', items: { type: 'string' },
          description: 'Preset ids. Sets the pool to custom and uses only these.'
        },
        catalogue: { type: 'boolean', description: 'List everything the layer can play.' }
      }
    }
  },
  {
    name: 'imageyfx_effects',
    description:
      'Discover the visual effect and preset library before choosing a look. ' +
      'Returns stable ids, names, groups and sources. Omit layer for all drawable ' +
      'layers, or filter one layer by kind or group. Discovery only: use ' +
      'imageyfx_layers to choose a pool and imageyfx_desk or imageyfx_call to ' +
      'change controls.',
    inputSchema: {
      type: 'object',
      properties: {
        layer: { type: 'string', description: 'Layer id, such as circle, lasers, grid, spiro, shapes, logo, milk or text.' },
        kind: { type: 'string', description: 'Filter by catalogue kind.' },
        group: { type: 'string', description: 'Filter by catalogue group prefix.' }
      }
    }
  },
  {
    name: 'imageyfx_content',
    description:
      'Add words for the Text layer or artwork for the logo - the two things ' +
      'you can supply yourself. Music you cannot: a browser only takes audio ' +
      'from the person at the keyboard. Adding words does not show them; cast ' +
      'is what puts one on screen.',
    inputSchema: {
      type: 'object',
      properties: {
        addText: { type: 'string', description: 'A word or phrase. \\n is a line break.' },
        slot: { type: 'integer', minimum: 1, maximum: 5, description: 'Text slot 1-5. 1 is the main layer.' },
        cast: { type: 'boolean', description: 'Deal a word onto the screen.' },
        listText: { type: 'boolean' },
        listLogos: { type: 'boolean', description: 'List uploaded/generated artwork and upload capacity.' },
        keepLook: { type: 'boolean', description: 'When casting, preserve current text styling. Default true; false restores saved word looks.' },
        removeText: { type: 'integer', minimum: 0, description: 'Index to remove.' },
        addLogo: { type: 'string', description: 'base64 PNG or a data: URL.' },
        label: { type: 'string', description: 'A name for the artwork.' }
      }
    }
  },
  {
    name: 'imageyfx_control',
    description:
      'Take the desk or hand it back. Writing anything takes it automatically ' +
      'and puts the rig in User Set, because two things cannot drive one desk. ' +
      'Release when done - pass a mode to say what to leave it in, which is the ' +
      'only way to leave it running in Auto. `dismiss` clears the sign-in card ' +
      'a signed-out visitor gets on load; you cannot sign anybody in and should ' +
      'not try, since the login belongs to the person at the keyboard.',
    inputSchema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: {
          type: 'string',
          enum: ['take', 'release', 'status', 'dismiss'],
          description:
            'dismiss puts away the sign-in card a signed-out visitor gets on ' +
            'load. Taking the desk does that for you; this is for a clean ' +
            'screen without taking control.'
        },
        mode: { type: 'string', enum: ['user'], description: 'For release.' }
      }
    }
  },
  {
    name: 'imageyfx_say',
    description:
      'Put a line on the screen over the visuals. The person watching has only ' +
      'the picture to go on, and a picture that is not changing looks the same ' +
      'whether you are composing or have crashed. Say what you are doing.',
    inputSchema: {
      type: 'object',
      required: ['text'],
      properties: {
        text: { type: 'string' },
        busy: { type: 'boolean', description: 'Keep it up rather than fading.' }
      }
    }
  },
  {
    name: 'imageyfx_call',
    description:
      'Any method on the page API by name, for the things these tools do not ' +
      'cover. See https://360.imagey.ai/skill/imageyfx-360.md for the full list.',
    inputSchema: {
      type: 'object',
      required: ['method'],
      properties: {
        method: { type: 'string' },
        args: { type: 'array', description: 'Arguments, in order.' }
      }
    }
  }
];

/* --- doing them ----------------------------------------------------------- */

/** Several page calls, one tool call - the round trip is the expensive part. */
async function many(pairs) {
  const out = {};
  for (const [key, method, args] of pairs) {
    try { out[key] = await rig.call(method, args || []); }
    catch (e) { out[key] = { error: String(e.message || e) }; }
  }
  return out;
}

const RUN = {
  imageyfx_status: (a) => rig.call('status', [a]),

  imageyfx_analyse: (a) => rig.call('analyse', [a]),

  imageyfx_schedule: (a) => rig.call('schedule', [a.cues, a.trackId]),

  async imageyfx_transport(a) {
    if (a.action === 'position') return { position: await rig.call('position') };
    if (a.action === 'seek') return { position: await rig.call('seek', [a.seconds]) };
    return { playing: await rig.call(a.action) };
  },

  imageyfx_progress: (a) => rig.call('scheduled', [{ summary: !a.cues }]),

  async imageyfx_desk(a) {
    const did = {};
    if (a.mode) did.mode = await rig.call('setMode', [a.mode]);
    if (typeof a.intensity === 'number') {
      await rig.call('setIntensity', [a.intensity]);
      did.intensity = await rig.call('intensity');
      did.intensityEffect = { appliesIn: 'auto', effective: await rig.call('mode') === 'auto',
        guidance: 'In User Set use macro cues; intensity only changes a saved Auto setting.' };
    }
    if (a.macros) {
      did.macros = {};
      for (const [name, value] of Object.entries(a.macros)) {
        did.macros[name] = await rig.call('setMacro', [name, value]);
      }
    }
    if (!Object.keys(did).length) return rig.call('macros');
    if (a.macros) did.macros = await rig.call('macros');
    return did;
  },

  async imageyfx_layers(a) {
    if (a.catalogue && a.layer) return rig.call('catalogue', [a.layer]);
    if (!a.layer) return rig.call('layers');
    const did = {};
    if (a.state) did.state = await rig.call('setLayer', [a.layer, a.state]);
    if (a.pick) did.picked = await rig.call('pick', [a.layer, a.pick]);
    else if (a.pool) did.pool = await rig.call('setPool', [a.layer, a.pool]);
    const layers = await rig.call('layers');
    if (!Object.hasOwn(layers, a.layer)) throw new Error('Unknown layer: ' + a.layer);
    return { layer: a.layer, ...layers[a.layer], ...(a.state ? { requestedState: a.state } : {}) };
  },

  imageyfx_effects: (a) => rig.call('effects', [a.layer, {
    ...(a.kind ? { kind: a.kind } : {}), ...(a.group ? { group: a.group } : {})
  }]),

  async imageyfx_content(a) {
    const did = {};
    if (a.addText) did.text = await rig.call('addText', [a.addText, a.slot]);
    if (typeof a.removeText === 'number') did.removed = await rig.call('removeText', [a.removeText, a.slot]);
    if (a.addLogo) did.logo = await rig.call('addLogo', [a.addLogo, a.label]);
    if (a.cast) did.cast = await rig.call('castText', [{ keepLook: a.keepLook !== false }]);
    if (a.listLogos) { did.logos = await rig.call('catalogue', ['logo', { kind: 'mine' }]); did.capacity = await rig.call('logoCapacity'); }
    if (a.listText || !Object.keys(did).length) did.words = await rig.call('words', [a.slot]);
    return did;
  },

  imageyfx_control: (a) =>
    a.action === 'take' ? rig.call('takeControl')
    : a.action === 'release' ? rig.call('releaseControl', [a.mode ? { mode: a.mode } : undefined])
    : a.action === 'dismiss' ? rig.call('dismissSignIn')
    : many([['hasControl', 'hasControl'], ['mode', 'mode'], ['console', 'consoleShown']]),

  imageyfx_say: (a) => rig.call('say', [a.text, { busy: !!a.busy }]),

  imageyfx_call: (a) => rig.call(a.method, a.args || [])
};

/* --- wiring --------------------------------------------------------------- */

const server = new Server(
  { name: 'imageyfx-360', version: JSON.parse(readFileSync(new URL('./package.json', import.meta.url))).version },
  { capabilities: { tools: {} }, instructions: 'imageyFX-360 turns music into layered visuals and locally rendered video. Agents MUST use User Set. Auto belongs to the human operator. Call status first; use macros and selector cues to author the performance. Auto mode, Auto intensity and Auto handover requests are rejected. Agent transport selects User Set. Release control in User Set. Agent cues pause if the human selects Auto. Inspect controls for options and macro ownership; use invoke for actions. Music selection and sign-in belong to the user.' }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const run = Object.hasOwn(RUN, req.params.name) && RUN[req.params.name];
  if (!run) {
    return {
      isError: true,
      content: [{ type: 'text', text: `No tool called ${req.params.name}` }]
    };
  }
  try {
    const args = req.params.arguments || {};
    if (req.params.name === 'imageyfx_desk' && args.intensity != null) throw new Error('Intensity is Auto-only. Agents must use User Set macros.');
    validate(TOOLS.find(t => t.name === req.params.name).inputSchema, args);
    if (req.params.name === 'imageyfx_transport' && args.action === 'seek' && args.seconds == null) throw new Error('seek requires seconds');
    if (req.params.name === 'imageyfx_layers' && !args.layer && (args.state || args.pool || args.pick || args.catalogue)) throw new Error('layer is required for layer options');
    const value = await run(args);
    return { content: [{ type: 'text', text: JSON.stringify(value, null, 1) }] };
  } catch (e) {
    /*
     * The page's own words, not a wrapper's.
     *
     * The API refuses malformed cue sheets with every fault listed and the
     * valid names beside them, which is the most useful sentence anybody in
     * this chain will produce. Swallowing that and reporting "tool failed"
     * would throw away the only part worth reading.
     */
    return { isError: true, content: [{ type: 'text', text: String(e.message || e) }] };
  }
});

for (const tool of TOOLS) tool.inputSchema.additionalProperties = false;
server.onclose = () => rig.close();
const transport = new StdioServerTransport();
await server.connect(transport);
