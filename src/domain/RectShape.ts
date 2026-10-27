import { Shape } from './Shape.js';
import { NumberValue } from './NumberValue.js';

export class RectShape extends Shape {
  constructor(id: string, x: number, y: number, width: number, height: number) {
    super(id, { x, y, width, height }, ['width', 'height']);
  }
  override get type(): string { return 'rect'; }
  override move(dx: number, dy: number): void { this.translate(['x'], ['y'], dx, dy); }
  override clone(): RectShape {
    return this.copyAppearanceTo(new RectShape(this.id, this.number('x'), this.number('y'), this.number('width'), this.number('height')));
  }
  override summary(): string {
    return this.withAppearance(`x=${this.number('x')} y=${this.number('y')} w=${this.number('width')} h=${this.number('height')}`);
  }
  static create(id: string, args: readonly string[]): RectShape {
    const shape = new RectShape(id, ...args.slice(0, 4).map(value => NumberValue.parse(value)) as [number, number, number, number]);
    if (args[4] !== undefined) shape.setAttribute('fill', args[4]);
    return shape;
  }
  static fromSvg(id: string, attrs: Readonly<Record<string, string>>): RectShape {
    return new RectShape(id, NumberValue.parse(attrs.x ?? '0'), NumberValue.parse(attrs.y ?? '0'),
      NumberValue.parse(attrs.width ?? '0'), NumberValue.parse(attrs.height ?? '0'));
  }
}
