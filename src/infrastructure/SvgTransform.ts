import { NumberValue } from '../domain/NumberValue.js';
import type { Shape } from '../domain/Shape.js';

/** Positive uniform SVG scale and translation; composition follows SVG's order. */
export class SvgTransform {
  constructor(private readonly factor = 1, private readonly dx = 0, private readonly dy = 0) {}
  compose(local: SvgTransform): SvgTransform {
    return new SvgTransform(NumberValue.positive(this.factor * local.factor, 'transform scale'),
      NumberValue.parse(this.dx + this.factor * local.dx), NumberValue.parse(this.dy + this.factor * local.dy));
  }
  static parse(source = ''): SvgTransform {
    let transform = new SvgTransform();
    let rest = source.trim();
    while (rest) {
      const match = /^(?:translate\s*\(([^)]*)\)|scale\s*\(([^)]*)\))\s*,?\s*/u.exec(rest);
      if (!match) throw new Error(`unsupported SVG transform: ${source}`);
      const values = (match[1] ?? match[2]!).trim().split(/[\s,]+/u).map(value => NumberValue.parse(value, 'transform'));
      if (values.length < 1 || values.length > 2) throw new Error(`invalid SVG transform: ${source}`);
      if (match[1] !== undefined) transform = transform.compose(new SvgTransform(1, values[0]!, values[1] ?? 0));
      else {
        if (values[1] !== undefined && values[1] !== values[0]) throw new Error('non-uniform SVG scale is not supported');
        transform = transform.compose(new SvgTransform(NumberValue.positive(values[0]!, 'transform scale')));
      }
      rest = rest.slice(match[0].length);
    }
    return transform;
  }
  apply(shape: Shape, inheritedStrokeWidth: string, inheritedFontSize: string): void {
    shape.scale(this.factor); shape.move(this.dx, this.dy);
    if (this.factor !== 1) {
      shape.setAttribute('stroke-width', String(NumberValue.nonnegative(inheritedStrokeWidth, 'stroke-width') * this.factor));
      if (shape.textContent !== null) {
        shape.importPresentation('font-size', String(NumberValue.nonnegative(inheritedFontSize, 'font-size') * this.factor));
      }
    }
  }
}
