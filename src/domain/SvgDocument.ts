import { Shape } from './Shape.js';
import { GroupShape } from './GroupShape.js';
import { NumberValue } from './NumberValue.js';

export class SvgDocument {
  private readonly root: GroupShape;
  private canvasWidth: number;
  private canvasHeight: number;
  constructor(width = 800, height = 600, root?: GroupShape) {
    this.canvasWidth = NumberValue.positive(width, 'canvas width');
    this.canvasHeight = NumberValue.positive(height, 'canvas height');
    this.root = root ?? new GroupShape('__canvas__');
  }
  get width(): number { return this.canvasWidth; }
  get height(): number { return this.canvasHeight; }
  get children(): readonly Shape[] { return this.root.children; }
  get count(): number { return this.all().length; }
  rootAttributes(): Readonly<Record<string, string>> { return this.root.attributes(); }
  importRootAttribute(name: string, value: string): void {
    if (['fill', 'stroke', 'stroke-width'].includes(name)) this.root.setAttribute(name, value);
    else this.root.importPresentation(name, value);
  }
  clone(): SvgDocument { return new SvgDocument(this.width, this.height, this.root.clone()); }

  resize(width: number, height: number): void {
    const w = NumberValue.positive(width, 'canvas width');
    const h = NumberValue.positive(height, 'canvas height');
    this.canvasWidth = w; this.canvasHeight = h;
  }

  all(): readonly Shape[] {
    const result: Shape[] = [];
    const pending = [...this.children].reverse();
    while (pending.length) {
      const shape = pending.pop()!;
      result.push(shape);
      pending.push(...[...shape.children].reverse());
    }
    return result;
  }
  find(id: string): Shape | undefined { return this.all().find(shape => shape.id === id); }
  require(id: string): Shape {
    const shape = this.find(id);
    if (!shape) throw new Error(`no such shape: ${id}`);
    return shape;
  }
  requireContainer(id: string): GroupShape {
    const shape = this.find(id);
    if (!shape) throw new Error(`no such container: ${id}`);
    if (!(shape instanceof GroupShape)) throw new Error(`not a container: ${id}`);
    return shape;
  }
  assertUnused(id: string): void {
    if (this.find(id)) throw new Error(`id already exists: ${id}`);
  }
  parentLabel(shape: Shape): string {
    return shape.parent === this.root ? 'svg' : shape.parent!.label;
  }

  add(shape: Shape, containerId?: string): void {
    const parent = containerId === undefined ? this.root : this.requireContainer(containerId);
    const pending = [shape];
    const seen = new Set<string>();
    while (pending.length) {
      const item = pending.pop()!;
      this.assertUnused(item.id);
      if (seen.has(item.id)) throw new Error(`id already exists: ${item.id}`);
      seen.add(item.id); pending.push(...item.children);
    }
    parent.add(shape);
  }
  delete(id: string): Shape {
    const shape = this.require(id);
    shape.parent!.remove(shape);
    return shape;
  }

  group(id: string, ids: readonly string[]): GroupShape {
    this.assertUnused(id);
    if (!ids.length) throw new Error('group requires at least one shape');
    if (new Set(ids).size !== ids.length) throw new Error('duplicate group member');
    const selection = ids.map(member => this.require(member));
    for (const shape of selection) {
      if (shape instanceof GroupShape && selection.some(other => other !== shape && shape.contains(other))) {
        throw new Error(`cannot group a container into its own descendant: ${shape.id}`);
      }
    }
    const ordered = this.all().filter(shape => selection.includes(shape));
    let parent = ordered[0]!.parent!;
    while (!ordered.every(shape => parent.contains(shape))) parent = parent.parent!;
    const branches = ordered.map(shape => {
      let branch = shape;
      while (branch.parent !== parent) branch = branch.parent!;
      return parent.children.indexOf(branch);
    });
    const index = Math.min(...branches);
    const group = new GroupShape(id);
    for (const shape of ordered) { shape.parent!.remove(shape); group.add(shape); }
    parent.add(group, index);
    return group;
  }

  ungroup(id: string): number {
    const group = this.requireContainer(id);
    if (group.parent === this.root) throw new Error(`cannot ungroup top-level container: ${id}`);
    const parent = group.parent!;
    const index = parent.remove(group);
    const children = [...group.children];
    children.forEach((shape, offset) => { group.remove(shape); parent.add(shape, index + offset); });
    return children.length;
  }

  addTo(containerId: string, id: string): void {
    const group = this.requireContainer(containerId);
    const shape = this.require(id);
    if (shape === group || (shape instanceof GroupShape && shape.contains(group))) {
      throw new Error(`cannot move a container into its own descendant: ${id}`);
    }
    shape.parent!.remove(shape); group.add(shape);
  }

  reorder(id: string, front: boolean): void {
    const shape = this.require(id);
    const parent = shape.parent!;
    parent.remove(shape);
    parent.add(shape, front ? parent.children.length : 0);
  }
}
