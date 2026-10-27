import { Shape } from './Shape.js';
import { NumberValue } from './NumberValue.js';

export class TextShape extends Shape {
  constructor(id: string, x: number, y: number, private content: string) { super(id, { x, y }); }
  override get type(): string { return 'text'; }
  override get textContent(): string { return this.content; }
  override move(dx: number, dy: number): void { this.translate(['x'], ['y'], dx, dy); }
  override setAttribute(name: string, value: string): void {
    if (name === 'text') { this.content = value; return; }
    super.setAttribute(name, value);
  }
  override clone(): TextShape { return this.copyAppearanceTo(new TextShape(this.id, this.number('x'), this.number('y'), this.content)); }
  override summary(): string { return this.withAppearance(`(${this.number('x')},${this.number('y')}) ${JSON.stringify(this.content)}`); }
  static create(id: string, args: readonly string[]): TextShape {
    return new TextShape(id, NumberValue.parse(args[0]!), NumberValue.parse(args[1]!), args[2]!);
  }
  static fromSvg(id: string, attrs: Readonly<Record<string, string>>, text = ''): TextShape {
    return new TextShape(id, NumberValue.parse(attrs.x ?? '0'), NumberValue.parse(attrs.y ?? '0'), text);
  }
}
