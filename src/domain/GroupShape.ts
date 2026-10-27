import { Shape } from './Shape.js';
import { NumberValue } from './NumberValue.js';

export class GroupShape extends Shape {
  private readonly members: Shape[] = [];
  constructor(id: string) { super(id, {}); }
  override get type(): string { return 'g'; }
  override get children(): readonly Shape[] { return this.members.slice(); }

  contains(shape: Shape): boolean {
    for (let current: Shape | null = shape; current; current = current.parent) {
      if (current === this) return true;
    }
    return false;
  }

  add(shape: Shape, index = this.members.length): void {
    if (shape === this || (shape instanceof GroupShape && shape.contains(this))) {
      throw new Error(`cannot move a container into its own descendant: ${shape.id}`);
    }
    if (shape.parent) throw new Error(`shape already has a parent: ${shape.id}`);
    if (!Number.isInteger(index) || index < 0 || index > this.members.length) throw new Error('invalid child index');
    this.members.splice(index, 0, shape);
    shape.attachTo(this);
  }

  remove(shape: Shape): number {
    const index = this.members.indexOf(shape);
    if (index < 0) throw new Error(`no such child: ${shape.id}`);
    this.members.splice(index, 1);
    shape.attachTo(null);
    return index;
  }

  override move(dx: number, dy: number): void {
    NumberValue.parse(dx, 'dx'); NumberValue.parse(dy, 'dy');
    for (const child of this.members) child.move(dx, dy);
  }
  override scale(factor: number): void {
    NumberValue.positive(factor, 'scale factor');
    for (const child of this.members) child.scale(factor);
  }
  override clone(): GroupShape {
    const group = this.copyAppearanceTo(new GroupShape(this.id));
    for (const child of this.members) group.add(child.clone());
    return group;
  }
  override summary(): string { return this.withAppearance(''); }
  static create(id: string, _args: readonly string[]): GroupShape { return new GroupShape(id); }
  static fromSvg(id: string, _attrs: Readonly<Record<string, string>>): GroupShape { return new GroupShape(id); }
}
