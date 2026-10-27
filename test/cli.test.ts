import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync, chmodSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { SvgFileStore } from '../src/infrastructure/SvgFileStore.js';
import { SvgCodec } from '../src/infrastructure/SvgCodec.js';
import { CommandLexer } from '../src/cli/CommandLexer.js';
import { EditorHarness } from './EditorHarness.js';

test('lexer handles quoted in, escaped quotes, empty text, Windows paths and full-line comments', () => {
  const lexer = new CommandLexer();
  assert.deepEqual(lexer.tokenize('  # comment "'), []);
  assert.deepEqual(lexer.tokenize('set t text ""').map(t => t.value), ['set', 't', 'text', '']);
  assert.equal(lexer.tokenize('read "C:\\Users\\student\\my file.svg"')[1]!.value, 'C:\\Users\\student\\my file.svg');
  const h = new EditorHarness();
  h.run('init', 'create g group', 'create text t 1 2 "in" in group', 'set t text "say \\"hi\\""');
  assert.equal(h.session.document.require('t').textContent, 'say "hi"');
  assert.throws(() => h.run('set t text "x"trailing'), /expected whitespace/u);
});

test('real SVG files support spaces in paths, remembered save path and transactional failed read/write', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lab1-files-'));
  try {
    const file = join(directory, 'my drawing.svg');
    const h = new EditorHarness(new SvgFileStore());
    h.run('init', 'create text t 1 2 "中文 & < >"', `save "${file}"`, 'move t 5 6', 'save');
    const reader = new EditorHarness(new SvgFileStore());
    reader.run(`read "${file}"`);
    assert.equal(reader.session.document.require('t').number('x'), 6);
    reader.run('set t text "read then save"', 'save');
    assert.match(readFileSync(file, 'utf8'), /read then save/u);
    h.run('move t 1 0'); const before = h.snapshot();
    const corrupt = join(directory, 'corrupt.svg'); writeFileSync(corrupt, '<svg><rect></svg>');
    assert.throws(() => h.run(`read "${corrupt}"`), /invalid SVG XML/u);
    assert.equal(h.snapshot(), before);
    assert.throws(() => h.run(`save "${directory}/missing/output.svg"`), { message: `cannot write file: ${directory}/missing/output.svg` });
    assert.equal(h.snapshot(), before);
    const directoryTarget = join(directory, 'directory.svg'); mkdirSync(directoryTarget);
    assert.throws(() => h.run(`save "${directoryTarget}"`), /cannot write file/u);
    assert.ok(!readdirSync(directory).some(name => name.endsWith('.tmp')));
    h.run('undo'); assert.equal(h.session.document.require('t').number('x'), 6);
    h.run('save'); assert.ok(readFileSync(file, 'utf8').includes('x="6"'));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('failed external SVG import emits no partial warnings and does not replace current document', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lab1-import-'));
  try {
    const file = join(directory, 'invalid.svg'); writeFileSync(file, '<svg><rect/><circle id="c" r="-1"/></svg>');
    const h = new EditorHarness(new SvgFileStore()); h.run('init', 'create g retained'); const before = h.snapshot();
    assert.throws(() => h.run(`read "${file}"`), /r must be non-negative/u);
    assert.equal(h.snapshot(), before); h.run('undo'); assert.equal(h.session.document.count, 0);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('atomic save respects existing file permissions and retains original bytes on failure', { skip: process.platform === 'win32' || process.getuid?.() === 0 }, () => {
  const directory = mkdtempSync(join(tmpdir(), 'lab1-permissions-'));
  const file = join(directory, 'read-only.svg');
  try {
    const h = new EditorHarness(new SvgFileStore()); h.run('init', 'create circle c 1 2 3');
    writeFileSync(file, 'original', { mode: 0o444 });
    assert.throws(() => h.run(`save "${file}"`), { message: `cannot write file: ${file}` });
    assert.equal(readFileSync(file, 'utf8'), 'original');
    h.run('undo'); assert.equal(h.session.document.count, 0);
    chmodSync(file, 0o600); h.run(`save "${file}"`);
    assert.equal(statSync(file).mode & 0o777, 0o600);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('piped REPL recovers after errors, prints each on one line and exits with failure status', () => {
  const result = spawnSync(process.execPath, [resolve('dist/src/main.js')], {
    input: 'tree\ninit\ncreate rect r 1 2 3 4\nset r width -1\nshow r\n', encoding: 'utf8',
  });
  assert.equal(result.error, undefined); assert.equal(result.status, 1);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /^svg-editor 0.1/u);
  assert.match(result.stdout, /^error: no document\. use 'init' or 'read' first$/mu);
  assert.match(result.stdout, /^error: width must be non-negative$/mu);
  assert.match(result.stdout, /rect#r  parent=svg\n  x=1\n  y=2\n  width=3/u);
  assert.ok(!result.stdout.includes('svg> '));
});

test('piped flowchart demo saves an eight-element SVG and a successful CLI returns zero', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lab1-demo-'));
  try {
    const script = readFileSync('examples/flowchart.commands', 'utf8').replace('save examples/flowchart.svg', 'save flowchart.svg');
    const result = spawnSync(process.execPath, [resolve('dist/src/main.js')], { input: script, encoding: 'utf8', cwd: directory });
    assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stdout + result.stderr);
    const { document } = new SvgCodec().decode(readFileSync(join(directory, 'flowchart.svg'), 'utf8'));
    assert.equal(document.count, 8);
    assert.equal(document.require('process').number('y'), 100);
    assert.equal(document.require('process-label').textContent, '处理数据 v2');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
