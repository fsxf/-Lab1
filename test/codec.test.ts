import test from 'node:test';
import assert from 'node:assert/strict';
import { SvgCodec } from '../src/infrastructure/SvgCodec.js';
import { EditorHarness } from './EditorHarness.js';

test('SVG round-trip preserves all shape types, hierarchy, appearance, text and default omission', () => {
  const h = new EditorHarness();
  h.run('init 400.5 300', 'create g g', 'set g fill red', 'create rect r -1 2 3 4 in g',
    'create circle c 1 2 3', 'create ellipse e 1 2 3 4', 'create line l 1 2 3 4 black',
    'create text t 1 2 "A & B < C > D \\"quoted\\"" in g');
  const codec = new SvgCodec(); const svg = h.snapshot();
  assert.match(svg, /A &amp; B &lt; C/u); assert.ok(!svg.includes('text="'));
  assert.deepEqual(codec.decode(svg).warnings, []);
  assert.equal(codec.encode(codec.decode(svg).document), svg);
});

test('missing IDs are assigned in preorder with reservations for later explicit IDs', () => {
  const result = new SvgCodec().decode('<svg width="400" height="300"><rect/><rect id="rect1"/><g><rect/><circle/><text>Hello</text></g></svg>');
  assert.deepEqual(result.document.all().map(s => s.id), ['rect2', 'rect1', 'g1', 'rect3', 'circle1', 'text1']);
  assert.deepEqual(result.warnings, [
    'warning: assigned id rect2 to unnamed <rect>', 'warning: assigned id g1 to unnamed <g>',
    'warning: assigned id rect3 to unnamed <rect>', 'warning: assigned id circle1 to unnamed <circle>',
    'warning: assigned id text1 to unnamed <text>',
  ]);
});

test('imports nested translate/scale in SVG order and retains text presentation', () => {
  const codec = new SvgCodec();
  const { document } = codec.decode('<svg width="400" height="200"><g id="diagram" transform="translate(60,40)"><g id="node" transform="translate(200,0) scale(0.8)"><rect id="r" width="120" height="60"/><text id="t" x="60" y="38" text-anchor="middle" font-size="16">End</text></g></g></svg>');
  assert.equal(document.require('r').number('x'), 260);
  assert.equal(document.require('r').number('y'), 40);
  assert.equal(document.require('r').number('width'), 96);
  assert.equal(document.require('t').number('x'), 308);
  assert.equal(document.require('t').attribute('font-size'), '12.8');
  assert.equal(document.require('t').attribute('text-anchor'), 'middle');
  assert.equal(codec.encode(codec.decode(codec.encode(document)).document), codec.encode(document));
});

test('root style and unknown plugin data-kind survive, imported group remains an ordinary group', () => {
  const codec = new SvgCodec(); const { document } = codec.decode('<svg viewBox="0 0 50 60" fill="blue"><g id="box" data-kind="box"><rect id="r" width="1" height="1"/></g></svg>');
  assert.equal(document.width, 50); assert.equal(document.height, 60);
  assert.equal(document.require('box').type, 'g');
  assert.match(codec.encode(document), /fill="blue"/u); assert.match(codec.encode(document), /data-kind="box"/u);
});

test('text preserves leading/trailing spaces, XML entities and CDATA', () => {
  const codec = new SvgCodec(); const { document } = codec.decode('<svg><text id="t">  &lt;&amp;&gt;<![CDATA[ "中文" ]]></text></svg>');
  assert.equal(document.require('t').textContent, '  <&> "中文" ');
  assert.equal(codec.decode(codec.encode(document)).document.require('t').textContent, '  <&> "中文" ');
});

for (const source of [
  '<svg><rect id="r"/><circle id="r"/></svg>',
  '<svg><rect></svg>', '<svg><rect width="1" width="2"/></svg>', '<svg><rect x="NaN"/></svg>',
  '<svg/><svg/>', '<html/>', '<svg><path id="p" d="M0 0"/></svg>',
  '<svg><script>alert(1)</script></svg>', '<svg onload="evil()"/>',
  '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg/>',
  '<svg><text><tspan>unsupported</tspan></text></svg>',
  '<svg viewBox="10 0 50 60"/>', '<svg width="100" height="100" viewBox="0 0 50 50"/>',
  '<svg><g transform="rotate(45)"/></svg>', '<svg><g transform="scale(2,3)"/></svg>',
  '<svg><rect height="-1"/></svg>', '<svg xmlns="http://example.org/not-svg"/>',
  '<svg>unexpected text</svg>', '<svg><rect>unexpected text</rect></svg>',
  '<svg><rect id="bad id"/></svg>',
]) {
  test(`unsupported or malformed SVG is rejected: ${source.slice(0, 65)}`, () => {
    assert.throws(() => new SvgCodec().decode(source));
  });
}
