import type { SvgDocument } from '../../domain/SvgDocument.js';
import type { Command } from '../Command.js';
import type { EditorSession } from '../EditorSession.js';

export abstract class SnapshotCommand implements Command {
  private before: SvgDocument | undefined;
  private after: SvgDocument | undefined;
  private result = '';

  execute(session: EditorSession): string {
    const before = session.document.clone();
    const candidate = before.clone();
    const result = this.mutate(candidate);
    this.before = before; this.after = candidate.clone(); this.result = result;
    session.install(candidate);
    return result;
  }
  undo(session: EditorSession): string {
    if (!this.before) throw new Error('command has not executed');
    session.install(this.before.clone());
    return `${this.result} (undone)`;
  }
  redo(session: EditorSession): string {
    if (!this.after) throw new Error('command has not executed');
    session.install(this.after.clone());
    return `${this.result} (redone)`;
  }
  protected abstract mutate(document: SvgDocument): string;
}
