import { Shape } from './Shape.js';
import { NumberValue } from './NumberValue.js';

export class EllipseShape extends Shape {
  constructor(id: string, cx: number, cy: number, rx: number, ry: number) { super(id, { cx, cy, rx, ry }, ['rx', 'ry']); }
  override get type(): string { return 'ellipse'; }
  override move(dx: number, dy: number): void { this.translate(['cx'], ['cy'], dx, dy); }
  override clone(): EllipseShape {
    return this.copyAppearanceTo(new EllipseShape(this.id, this.number('cx'), this.number('cy'), this.number('rx'), this.number('ry')));
  }
  override summary(): string { return this.withAppearance(`cx=${this.number('cx')} cy=${this.number('cy')} rx=${this.number('rx')} ry=${this.number('ry')}`); }
  static create(id: string, args: readonly string[]): EllipseShape {
    const shape = new EllipseShape(id, ...args.slice(0, 4).map(value => NumberValue.parse(value)) as [number, number, number, number]);
    if (args[4] !== undefined) shape.setAttribute('fill', args[4]);
    return shape;
  }
  static fromSvg(id: string, attrs: Readonly<Record<string, string>>): EllipseShape {
    return new EllipseShape(id, NumberValue.parse(attrs.cx ?? '0'), NumberValue.parse(attrs.cy ?? '0'),
      NumberValue.parse(attrs.rx ?? '0'), NumberValue.parse(attrs.ry ?? '0'));
  }
}
