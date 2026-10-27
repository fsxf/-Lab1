import type { SvgDocument } from '../domain/SvgDocument.js';
import type { Shape } from '../domain/Shape.js';

export class TreeFormatter {
  tree(document: SvgDocument, id?: string): string {
    if (id !== undefined) {
      const shape = document.require(id);
      return [shape.summary(), ...this.children(shape.children, '')].join('\n');
    }
    return [`svg (${document.width}x${document.height})`, ...this.children(document.children, '')].join('\n');
  }
  private children(shapes: readonly Shape[], prefix: string): string[] {
    return shapes.flatMap((shape, index) => {
      const last = index === shapes.length - 1;
      return [prefix + (last ? '└── ' : '├── ') + shape.summary(),
        ...this.children(shape.children, prefix + (last ? '    ' : '│   '))];
    });
  }
  show(document: SvgDocument, id: string): string {
    const shape = document.require(id);
    const rows = Object.entries(shape.attributes()).map(([key, value]) => `  ${key}=${value}`);
    if (shape.textContent !== null) rows.push(`  text=${JSON.stringify(shape.textContent)}`);
    return [`${shape.label}  parent=${document.parentLabel(shape)}`, ...rows].join('\n');
  }
}
