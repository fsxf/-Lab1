import { Shape } from './Shape.js';
import { NumberValue } from './NumberValue.js';

export class LineShape extends Shape {
  constructor(id: string, x1: number, y1: number, x2: number, y2: number) { super(id, { x1, y1, x2, y2 }); }
  override get type(): string { return 'line'; }
  override move(dx: number, dy: number): void { this.translate(['x1', 'x2'], ['y1', 'y2'], dx, dy); }
  override clone(): LineShape {
    return this.copyAppearanceTo(new LineShape(this.id, this.number('x1'), this.number('y1'), this.number('x2'), this.number('y2')));
  }
  override summary(): string { return this.withAppearance(`(${this.number('x1')},${this.number('y1')}) -> (${this.number('x2')},${this.number('y2')})`); }
  static create(id: string, args: readonly string[]): LineShape {
    const shape = new LineShape(id, ...args.slice(0, 4).map(value => NumberValue.parse(value)) as [number, number, number, number]);
    if (args[4] !== undefined) shape.setAttribute('stroke', args[4]);
    return shape;
  }
  static fromSvg(id: string, attrs: Readonly<Record<string, string>>): LineShape {
    return new LineShape(id, NumberValue.parse(attrs.x1 ?? '0'), NumberValue.parse(attrs.y1 ?? '0'),
      NumberValue.parse(attrs.x2 ?? '0'), NumberValue.parse(attrs.y2 ?? '0'));
  }
}
