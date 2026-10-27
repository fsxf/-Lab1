import type { SvgDocument } from '../../domain/SvgDocument.js';
import { SnapshotCommand } from './SnapshotCommand.js';

export class SetCommand extends SnapshotCommand {
  constructor(private readonly id: string, private readonly attribute: string, private readonly value: string) { super(); }
  protected override mutate(document: SvgDocument): string {
    const shape = document.require(this.id); shape.setAttribute(this.attribute, this.value);
    return `${shape.label} updated: ${this.attribute}=${JSON.stringify(this.value)}`;
  }
}
