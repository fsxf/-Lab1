import type { SvgDocument } from '../../domain/SvgDocument.js';
import { SnapshotCommand } from './SnapshotCommand.js';

export class FrontCommand extends SnapshotCommand {
  constructor(private readonly id: string) { super(); }
  protected override mutate(document: SvgDocument): string {
    document.reorder(this.id, true); return `${document.require(this.id).label} moved to front`;
  }
}
