import { Shape } from './Shape.js';
import { RectShape } from './RectShape.js';
import { CircleShape } from './CircleShape.js';
import { EllipseShape } from './EllipseShape.js';
import { LineShape } from './LineShape.js';
import { TextShape } from './TextShape.js';
import { GroupShape } from './GroupShape.js';

interface ShapeDefinition {
  readonly min: number;
  readonly max: number;
  readonly create: (id: string, args: readonly string[]) => Shape;
  readonly fromSvg: (id: string, attrs: Readonly<Record<string, string>>, text?: string) => Shape;
}

/** The only shape-name dispatch point; replace registrations with providers in Phase 2. */
export class ShapeFactory {
  private readonly definitions: ReadonlyMap<string, ShapeDefinition> = new Map([
    ['rect', { min: 4, max: 5, create: RectShape.create, fromSvg: RectShape.fromSvg }],
    ['circle', { min: 3, max: 4, create: CircleShape.create, fromSvg: CircleShape.fromSvg }],
    ['ellipse', { min: 4, max: 5, create: EllipseShape.create, fromSvg: EllipseShape.fromSvg }],
    ['line', { min: 4, max: 5, create: LineShape.create, fromSvg: LineShape.fromSvg }],
    ['text', { min: 3, max: 3, create: TextShape.create, fromSvg: TextShape.fromSvg }],
    ['g', { min: 0, max: 0, create: GroupShape.create, fromSvg: GroupShape.fromSvg }],
  ]);

  private definition(type: string): ShapeDefinition {
    const definition = this.definitions.get(type);
    if (!definition) throw new Error(`unknown shape type: ${type} (is the plugin loaded?)`);
    return definition;
  }

  create(type: string, id: string, args: readonly string[]): Shape {
    const definition = this.definition(type);
    if (args.length < definition.min || args.length > definition.max) throw new Error(`invalid parameters for ${type}`);
    return definition.create(id, args);
  }

  fromSvg(type: string, id: string, attrs: Readonly<Record<string, string>>, text: string): Shape {
    const shape = this.definition(type).fromSvg(id, attrs, text);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'id' || key === 'transform') continue;
      if (shape.attribute(key) !== undefined || ['fill', 'stroke', 'stroke-width'].includes(key)) {
        shape.setAttribute(key, value);
      } else shape.importPresentation(key, value);
    }
    return shape;
  }
}
