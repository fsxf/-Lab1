import type { SvgDocument } from '../../domain/SvgDocument.js';
import { SnapshotCommand } from './SnapshotCommand.js';

export class AddToCommand extends SnapshotCommand {
  constructor(private readonly containerId: string, private readonly id: string) { super(); }
  protected override mutate(document: SvgDocument): string {
    const label = document.require(this.id).label;
    document.addTo(this.containerId, this.id);
    return `${label} moved into g#${this.containerId}`;
  }
}
