import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorHarness } from './EditorHarness.js';

test('help is available initially, all document commands need a document', () => {
  const h = new EditorHarness();
  assert.match(h.run('help'), /create <type>/u);
  for (const line of ['tree', 'show a', 'save a.svg', 'canvas', 'create g a', 'delete a', 'move a 1 2', 'scale a 2', 'set a fill red', 'group a b', 'ungroup a', 'addto a b', 'front a', 'back a', 'undo', 'redo']) {
    assert.throws(() => h.run(line), { message: "no document. use 'init' or 'read' first" });
  }
  assert.equal(h.run('  # comment', ''), '\n');
});

test('all six types, geometry, optional appearance, IDs and explicit parent', () => {
  const h = new EditorHarness();
  h.run('init', 'create g scene', 'create rect r 1.5 -2 30 40 red in scene',
    'create circle c 10 20 5', 'create ellipse e 5 6 7 8 blue',
    'create line l 1 2 3 4 black', 'create text t 2 3 "你好 world" in scene', 'create rect R 0 0 1 1');
  assert.equal(h.session.document.count, 7);
  assert.match(h.run('show r'), /parent=g#scene\n  x=1.5\n  y=-2/u);
  assert.equal(h.session.document.require('c').attribute('fill'), undefined);
  assert.equal(h.session.document.require('c').attribute('stroke'), undefined);
  assert.equal(h.session.document.require('t').textContent, '你好 world');
  assert.match(h.run('tree'), /├── g#scene\n│   ├── rect#r/u);
  assert.ok(!h.run('tree scene').includes('circle#c'));
});

test('move and scale polymorphically recurse through nested groups', () => {
  const h = new EditorHarness();
  h.run('init', 'create g a', 'create g b in a', 'create rect r 1 2 3 4 in b',
    'create circle c 5 6 7 in a', 'create ellipse e 8 9 10 11 in b',
    'create line l 1 2 3 4 in a', 'create text t 2 3 "label" in b');
  const initial = h.snapshot();
  h.run('move a 10 -1', 'scale a 2');
  assert.equal(h.session.document.require('r').number('x'), 22);
  assert.equal(h.session.document.require('r').number('height'), 8);
  assert.equal(h.session.document.require('c').number('r'), 14);
  assert.equal(h.session.document.require('e').number('ry'), 22);
  assert.equal(h.session.document.require('l').number('x2'), 26);
  assert.equal(h.session.document.require('t').number('y'), 4);
  h.run('undo', 'undo'); assert.equal(h.snapshot(), initial);
  h.run('redo', 'redo'); assert.equal(h.session.document.require('r').number('x'), 22);
});

test('set supports geometry, common style and text while preserving group inheritance', () => {
  const h = new EditorHarness();
  h.run('init', 'create g g', 'create rect r 0 0 1 1 in g', 'create text t 0 0 "" in g',
    'set r width 2.5', 'set g fill green', 'set r stroke black', 'set r stroke-width 1.5', 'set t text "A & B < C"');
  assert.equal(h.session.document.require('r').number('width'), 2.5);
  assert.equal(h.session.document.require('g').attribute('fill'), 'green');
  assert.equal(h.session.document.require('r').attribute('fill'), undefined);
  assert.equal(h.session.document.require('r').attribute('stroke-width'), '1.5');
  assert.equal(h.session.document.require('t').textContent, 'A & B < C');
  h.run('undo'); assert.equal(h.session.document.require('t').textContent, '');
});

test('group keeps original sibling order despite reversed arguments; undo restores all parents and positions', () => {
  const h = new EditorHarness();
  h.run('init', 'create g outer', 'create rect a 0 0 1 1 in outer',
    'create circle b 0 0 1 in outer', 'create text c 0 0 "C" in outer');
  const before = h.snapshot();
  h.run('group inner c a');
  assert.deepEqual(h.session.document.require('outer').children.map(s => s.id), ['inner', 'b']);
  assert.deepEqual(h.session.document.require('inner').children.map(s => s.id), ['a', 'c']);
  h.run('undo'); assert.equal(h.snapshot(), before);
  h.run('redo', 'ungroup inner'); assert.equal(h.session.document.find('inner'), undefined);
  assert.deepEqual(h.session.document.require('outer').children.map(s => s.id), ['a', 'c', 'b']);
  h.run('undo'); assert.deepEqual(h.session.document.require('inner').children.map(s => s.id), ['a', 'c']);
});

test('cross-parent group uses lowest common ancestor, document order and first affected branch', () => {
  const h = new EditorHarness();
  h.run('init', 'create g left', 'create g right', 'create circle a 0 0 1 in left', 'create circle b 0 0 1 in right');
  const before = h.snapshot(); h.run('group combined b a');
  assert.deepEqual(h.session.document.children.map(s => s.id), ['combined', 'left', 'right']);
  assert.deepEqual(h.session.document.require('combined').children.map(s => s.id), ['a', 'b']);
  h.run('undo'); assert.equal(h.snapshot(), before);
});

test('delete subtree is one undo unit; redo removes descendant IDs', () => {
  const h = new EditorHarness();
  h.run('init', 'create g outer', 'create g inner in outer', 'create rect r 0 0 1 1 in inner');
  const before = h.snapshot(); h.run('delete outer'); assert.equal(h.session.document.count, 0);
  h.run('undo'); assert.equal(h.snapshot(), before);
  h.run('redo'); assert.equal(h.session.document.find('r'), undefined);
  h.run('create circle r 0 0 1'); assert.equal(h.session.document.require('r').type, 'circle');
});

test('addto appends, sibling z-order matches SVG painting order and every operation is undoable', () => {
  const h = new EditorHarness();
  h.run('init', 'create g g', 'create circle a 0 0 1 in g', 'create circle b 0 0 1 in g', 'create circle c 0 0 1');
  const before = h.snapshot();
  h.run('addto g c', 'front a');
  assert.deepEqual(h.session.document.require('g').children.map(s => s.id), ['b', 'c', 'a']);
  h.run('back a'); assert.deepEqual(h.session.document.require('g').children.map(s => s.id), ['a', 'b', 'c']);
  h.run('undo', 'undo', 'undo'); assert.equal(h.snapshot(), before);
});

test('new successful edit invalidates redo, failed edits and display do not', () => {
  const h = new EditorHarness(); h.run('init', 'create circle c 1 2 3', 'move c 1 1', 'undo');
  assert.throws(() => h.run('set c r -1'));
  h.run('tree', 'show c', 'help', 'canvas', 'redo', 'undo', 'move c 3 4');
  assert.throws(() => h.run('redo'), { message: 'nothing to redo' });
  assert.equal(h.session.document.require('c').number('cx'), 4);
});

for (const io of ['init 300 200', 'save file.svg', 'canvas 300 200', 'read file.svg']) {
  test(`successful document operation locks both histories: ${io}`, () => {
    const h = new EditorHarness(); h.run('init', 'create circle c 0 0 1', 'save file.svg', 'move c 1 1', 'undo', io);
    for (const command of ['undo', 'redo']) assert.throws(() => h.run(command), { message: 'undo not allowed after io command' });
    h.run('create g next', 'undo'); assert.equal(h.session.document.find('next'), undefined);
  });
}

test('failed IO, failed canvas change and missing save path retain document and history', () => {
  const h = new EditorHarness(); h.run('init', 'create circle c 0 0 1'); const before = h.snapshot();
  for (const line of ['read missing.svg', 'canvas -1 2', 'canvas 100', 'save']) assert.throws(() => h.run(line));
  assert.equal(h.snapshot(), before); h.run('undo'); assert.equal(h.session.document.count, 0);
});

const failures: readonly [string, string][] = [
  ['create rect r 0 0 1 1', 'id already exists: r'],
  ['delete absent', 'no such shape: absent'],
  ['create circle c 0 0 1 in absent', 'no such container: absent'],
  ['create circle c 0 0 1 in r', 'not a container: r'],
  ['create box x 0 0 1 1 "box"', 'unknown shape type: box (is the plugin loaded?)'],
  ['create hexagon h', 'unknown shape type: hexagon (is the plugin loaded?)'],
  ['group bad r g', 'cannot group a container into its own descendant: g'],
  ['group bad r r', 'duplicate group member'],
  ['group bad r absent', 'no such shape: absent'],
  ['addto nested g', 'cannot move a container into its own descendant: g'],
  ['addto g g', 'cannot move a container into its own descendant: g'],
  ['ungroup g', 'cannot ungroup top-level container: g'],
  ['ungroup r', 'not a container: r'],
  ['scale g 0', 'scale factor must be positive'],
  ['scale g -1', 'scale factor must be positive'],
  ['scale g NaN', 'invalid number: NaN'],
  ['move r Infinity 1', 'invalid number: Infinity'],
  ['set r width -1', 'width must be non-negative'],
  ['set r stroke-width -1', 'stroke-width must be non-negative'],
  ['set r id x', 'unknown attribute: id'],
  ['set g x 10', 'unknown attribute: x'],
  ['create text t 0 0 "unfinished', 'unterminated double quote'],
  ['move r 1', 'usage: move <id> <dx> <dy>'],
  ['unknown', 'unknown command: unknown'],
];
for (const [line, message] of failures) {
  test(`failed command preserves state and redo: ${line}`, () => {
    const h = new EditorHarness();
    h.run('init', 'create g g', 'create g nested in g', 'create rect r 0 0 1 1 in g', 'move r 1 1', 'undo');
    const before = h.snapshot(); assert.throws(() => h.run(line), { message });
    assert.equal(h.snapshot(), before); h.run('redo'); assert.equal(h.session.document.require('r').number('x'), 1);
  });
}

test('numeric overflow halfway through recursive move rolls back every descendant', () => {
  const h = new EditorHarness();
  h.run('init', 'create g g', 'create circle small 1 2 3 in g', 'create circle huge 1e308 2 3 in g');
  const before = h.snapshot(); assert.throws(() => h.run('move g 1e308 0'), /invalid cx/u);
  assert.equal(h.snapshot(), before); h.run('undo'); assert.equal(h.session.document.find('huge'), undefined);
});

test('snapshot undo restores exact floating values instead of inverse arithmetic', () => {
  const h = new EditorHarness(); h.run('init', 'create rect r 0.1 0.2 0.3 0.4');
  const before = h.snapshot(); h.run('scale r 3', 'undo'); assert.equal(h.snapshot(), before);
});
