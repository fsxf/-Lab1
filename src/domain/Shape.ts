import { NumberValue } from './NumberValue.js';
import type { GroupShape } from './GroupShape.js';

export abstract class Shape {
  private readonly geometry: Map<string, number>;
  private readonly styles = new Map<string, string>();
  private readonly extras = new Map<string, string>();
  private owner: GroupShape | null = null;

  protected constructor(
    private readonly identifier: string,
    geometry: Record<string, number>,
    private readonly nonnegative: readonly string[] = [],
  ) {
    if (!identifier || /[\s\u0000-\u001f\u007f]/u.test(identifier)) {
      throw new Error(`invalid id: ${identifier}`);
    }
    this.geometry = new Map(Object.entries(geometry));
    for (const [key, value] of this.geometry) this.setAttribute(key, String(value));
  }

  abstract get type(): string;
  get id(): string { return this.identifier; }
  get label(): string { return `${this.type}#${this.id}`; }
  get parent(): GroupShape | null { return this.owner; }
  get children(): readonly Shape[] { return []; }
  get textContent(): string | null { return null; }

  /** Ownership is changed only by GroupShape's checked structural operations. */
  attachTo(parent: GroupShape | null): void { this.owner = parent; }

  number(name: string): number {
    const value = this.geometry.get(name);
    if (value === undefined) throw new Error(`unknown geometry: ${name}`);
    return value;
  }

  attribute(name: string): string | undefined {
    if (this.geometry.has(name)) return NumberValue.format(this.number(name));
    return this.styles.get(name) ?? this.extras.get(name);
  }

  attributes(): Readonly<Record<string, string>> {
    return Object.fromEntries([
      ...Array.from(this.geometry, ([key, value]) => [key, NumberValue.format(value)]),
      ...this.styles, ...this.extras,
    ]);
  }

  setAttribute(name: string, value: string): void {
    if (this.geometry.has(name)) {
      const number = this.nonnegative.includes(name)
        ? NumberValue.nonnegative(value, name) : NumberValue.parse(value, name);
      this.geometry.set(name, number);
      return;
    }
    if (['fill', 'stroke', 'stroke-width'].includes(name)) {
      if (name === 'stroke-width') value = String(NumberValue.nonnegative(value, name));
      this.styles.set(name, value);
      return;
    }
    throw new Error(`unknown attribute: ${name}`);
  }

  /** Import-only presentation attributes, never an alternative CLI set path. */
  importPresentation(name: string, value: string): void {
    const allowed = ['font-size', 'font-family', 'font-weight', 'text-anchor',
      'dominant-baseline', 'opacity', 'fill-opacity', 'stroke-opacity',
      'stroke-linecap', 'stroke-linejoin', 'data-kind'];
    if (!allowed.includes(name)) throw new Error(`unsupported SVG attribute: ${name}`);
    if (name === 'font-size') NumberValue.nonnegative(value, name);
    this.extras.set(name, value);
  }

  protected translate(xNames: readonly string[], yNames: readonly string[], dx: number, dy: number): void {
    NumberValue.parse(dx, 'dx');
    NumberValue.parse(dy, 'dy');
    for (const key of xNames) this.setAttribute(key, String(this.number(key) + dx));
    for (const key of yNames) this.setAttribute(key, String(this.number(key) + dy));
  }

  abstract move(dx: number, dy: number): void;

  scale(factor: number): void {
    NumberValue.positive(factor, 'scale factor');
    for (const [key, value] of this.geometry) this.setAttribute(key, String(value * factor));
  }

  protected copyAppearanceTo<T extends Shape>(target: T): T {
    for (const [key, value] of this.styles) target.setAttribute(key, value);
    for (const [key, value] of this.extras) target.importPresentation(key, value);
    return target;
  }

  abstract clone(): Shape;
  abstract summary(): string;

  protected appearanceSummary(): string {
    return [...this.styles].map(([key, value]) => `${key}=${value}`).join(' ');
  }

  protected withAppearance(description: string): string {
    return [this.label, description, this.appearanceSummary()].filter(Boolean).join('  ');
  }
}
