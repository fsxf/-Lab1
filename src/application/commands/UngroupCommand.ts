import type { SvgDocument } from '../../domain/SvgDocument.js';
import { SnapshotCommand } from './SnapshotCommand.js';

export class UngroupCommand extends SnapshotCommand {
  constructor(private readonly id: string) { super(); }
  protected override mutate(document: SvgDocument): string {
    return `g#${this.id} ungrouped (${document.ungroup(this.id)} children promoted)`;
  }
}
