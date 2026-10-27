import type { SvgDocument } from '../../domain/SvgDocument.js';
import { SnapshotCommand } from './SnapshotCommand.js';

export class DeleteCommand extends SnapshotCommand {
  constructor(private readonly id: string) { super(); }
  protected override mutate(document: SvgDocument): string { return `${document.delete(this.id).label} deleted`; }
}
