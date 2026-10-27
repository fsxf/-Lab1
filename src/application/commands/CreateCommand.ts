import { ShapeFactory } from '../../domain/ShapeFactory.js';
import type { SvgDocument } from '../../domain/SvgDocument.js';
import { SnapshotCommand } from './SnapshotCommand.js';

export class CreateCommand extends SnapshotCommand {
  constructor(private readonly factory: ShapeFactory, private readonly type: string,
    private readonly id: string, private readonly args: readonly string[], private readonly containerId?: string) { super(); }
  protected override mutate(document: SvgDocument): string {
    document.assertUnused(this.id);
    const shape = this.factory.create(this.type, this.id, this.args);
    document.add(shape, this.containerId);
    return `${shape.label} created` + (this.containerId === undefined ? '' : ` in g#${this.containerId}`);
  }
}
