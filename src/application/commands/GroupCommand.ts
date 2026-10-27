import type { SvgDocument } from '../../domain/SvgDocument.js';
import { SnapshotCommand } from './SnapshotCommand.js';

export class GroupCommand extends SnapshotCommand {
  constructor(private readonly id: string, private readonly members: readonly string[]) { super(); }
  protected override mutate(document: SvgDocument): string {
    const group = document.group(this.id, this.members);
    return `${group.label} created with ${group.children.length} children`;
  }
}
