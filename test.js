import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { runInNewContext } from 'node:vm';
import { WebSocketServer } from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Rig } from './chrome.js';

let connections = 0, calls = [], duplicate = false, hang = false;
const api = {
  status: opts => ({ silent: ['text: empty'], scheduled: { count: 2 }, logoCapacity: { used: 16, max: 16, full: true }, full: !!opts.full }),
  castText: opts => opts,
  effects: (layer, opts) => ({ layer: layer || 'all', opts: opts || {}, effects: [{ id: 'holographic', group: 'Animation' }] }),
  setMode: value => value,
  setIntensity: value => false,
  intensity: () => 0.7,
  mode: () => 'user',
  setMacro: (name, value) => false,
  macros: () => ({ rotation: 0.5 }),
  layers: () => ({ grid: { on: false, auto: 'auto', pool: 'custom', picked: ['plasma'] }, lasers: { on: true } }),
  setLayer: (name, state) => state,
  pick: (name, ids) => ({ picked: ids.length }),
  schedule: cues => ({ cues: cues.length }),
  faults: () => { throw new Error('Invalid sheet\nCue 1: wrong layer\nCue 2: wrong action'); }
};
const http = createServer((req, res) => {
  const target = { type: 'page', url: 'http://localhost/app', webSocketDebuggerUrl: `ws://127.0.0.1:${http.address().port}` };
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(duplicate ? [target, target] : [target]));
});
const sockets = new WebSocketServer({ server: http });
sockets.on('connection', ws => {
  connections++;
  ws.on('message', async raw => {
    const msg = JSON.parse(raw); calls.push(msg);
    if (hang) return;
    let result;
    try { result = { result: { value: await runInNewContext(msg.params.expression, { window: { ImageyFX: api } }) } }; }
    catch (error) { result = { exceptionDetails: { exception: { description: error.stack } } }; }
    ws.send(JSON.stringify({ id: msg.id, result }));
  });
});
await new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
const port = http.address().port;
const rig = new Rig({ port, timeout: 150 });
let client, transport;
try {
  await Promise.all([rig.call('status', [{}]), rig.call('status', [{}])]);
  assert.equal(connections, 1, 'concurrent calls share one socket');
  assert.equal(rig.waiting.size, 0);
  await assert.rejects(rig.call('constructor'), /no such method/);
  await assert.rejects(rig.call('status', {}), /argument array/);
  await assert.rejects(rig.call('faults'), /Cue 1: wrong layer\nCue 2: wrong action/);
  hang = true;
  await assert.rejects(rig.call('status', [{}]), /timed out/);
  assert.equal(rig.waiting.size, 0);
  const pending = rig.call('status', [{}]);
  const rejected = assert.rejects(pending, /disconnected/);
  await new Promise(resolve => setTimeout(resolve, 10));
  for (const ws of sockets.clients) ws.terminate();
  await rejected;
  hang = false;
  await rig.call('status', [{}]);
  assert.equal(connections, 2, 'next read reconnects');
  rig.close();
  duplicate = true;
  await assert.rejects(rig.call('status', [{}]), /Multiple tabs/);
  duplicate = false;

  transport = new StdioClientTransport({ command: process.execPath, args: [new URL('./server.js', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], env: { ...process.env, IMAGEYFX_PORT: String(port) }, stderr: 'pipe' });
  client = new Client({ name: 'regression', version: '1' });
  await client.connect(transport);
  const { tools } = await client.listTools(); assert.equal(tools.length, 12);
  calls = [];
  const status = await client.callTool({ name: 'imageyfx_status', arguments: { full: true } });
  assert.equal(status.isError, undefined);
  assert.equal(JSON.parse(status.content[0].text).logoCapacity.full, true);
  assert.equal(calls.length, 1, 'status uses one complete API call');
  const effects = await client.callTool({ name: 'imageyfx_effects', arguments: { layer: 'logo', group: 'Animation' } });
  assert.equal(JSON.parse(effects.content[0].text).effects[0].id, 'holographic');
  const cast = await client.callTool({ name: 'imageyfx_content', arguments: { cast: true } });
  assert.equal(JSON.parse(cast.content[0].text).cast.keepLook, true);
  const layer = JSON.parse((await client.callTool({ name: 'imageyfx_layers', arguments: { layer: 'grid', state: 'off' } })).content[0].text);
  assert.equal(layer.on, false); assert.equal(layer.requestedState, 'off');
  assert.deepEqual(layer.picked, ['plasma']); assert.equal(layer.lasers, undefined);
  const desk = JSON.parse((await client.callTool({ name: 'imageyfx_desk', arguments: { macros: { rotation: 0.5 } } })).content[0].text);
  assert.equal(desk.macros.rotation, 0.5, 'unchanged macro reports its actual value');
  assert.equal((await client.callTool({ name: 'imageyfx_schedule', arguments: { cues: [{ at: 0, do: 'pick', name: 'grid', ids: ['plasma'] }] } })).isError, undefined);
  const before = calls.length;
  for (const [name, args] of [
    ['imageyfx_desk', {mode:'auto'}],
    ['imageyfx_desk', {intensity:0.7}],
    ['imageyfx_control', {action:'release',mode:'auto'}],
    ['imageyfx_layers', {layer:'grid',state:'auto'}],
    ['imageyfx_transport', { action: 'seek' }],
    ['imageyfx_transport', { action: 'constructor' }],
    ['imageyfx_desk', { mode: 'auto', macros: { typo: 0.8 } }],
    ['imageyfx_content', { addText: 'hello', slot: 1.5 }],
    ['imageyfx_layers', { state: 'off' }],
    ['imageyfx_call', { method: 'status', args: {} }],
    ['constructor', {}]
  ]) assert.equal((await client.callTool({ name, arguments: args })).isError, true, name);
  assert.equal(calls.length, before, 'invalid tools do not mutate the page');
  console.log('MCP regression passed: connection lifecycle, timeout, ambiguity, full errors, status, text styling and validation.');
} finally {
  await client?.close();
  rig.close();
  for (const ws of sockets.clients) ws.terminate();
  await new Promise(resolve => sockets.close(resolve));
  await new Promise(resolve => http.close(resolve));
}
