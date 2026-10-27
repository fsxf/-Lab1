import { Shape } from './Shape.js';
import { NumberValue } from './NumberValue.js';

export class CircleShape extends Shape {
  constructor(id: string, cx: number, cy: number, r: number) { super(id, { cx, cy, r }, ['r']); }
  override get type(): string { return 'circle'; }
  override move(dx: number, dy: number): void { this.translate(['cx'], ['cy'], dx, dy); }
  override clone(): CircleShape {
    return this.copyAppearanceTo(new CircleShape(this.id, this.number('cx'), this.number('cy'), this.number('r')));
  }
  override summary(): string { return this.withAppearance(`cx=${this.number('cx')} cy=${this.number('cy')} r=${this.number('r')}`); }
  static create(id: string, args: readonly string[]): CircleShape {
    const shape = new CircleShape(id, ...args.slice(0, 3).map(value => NumberValue.parse(value)) as [number, number, number]);
    if (args[3] !== undefined) shape.setAttribute('fill', args[3]);
    return shape;
  }
  static fromSvg(id: string, attrs: Readonly<Record<string, string>>): CircleShape {
    return new CircleShape(id, NumberValue.parse(attrs.cx ?? '0'), NumberValue.parse(attrs.cy ?? '0'), NumberValue.parse(attrs.r ?? '0'));
  }
}
