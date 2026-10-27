import type { Command } from './Command.js';
import type { EditorSession } from './EditorSession.js';

export class History {
  private readonly undoStack: Command[] = [];
  private readonly redoStack: Command[] = [];
  private ioLocked = true;

  execute(command: Command, session: EditorSession): string {
    const result = command.execute(session);
    this.undoStack.push(command);
    this.redoStack.length = 0;
    this.ioLocked = false;
    return result;
  }
  blockAfterIo(): void {
    this.undoStack.length = 0; this.redoStack.length = 0; this.ioLocked = true;
  }
  undo(session: EditorSession): string {
    if (this.ioLocked) throw new Error('undo not allowed after io command');
    const command = this.undoStack.at(-1);
    if (!command) throw new Error('nothing to undo');
    const result = command.undo(session);
    this.undoStack.pop(); this.redoStack.push(command);
    return result;
  }
  redo(session: EditorSession): string {
    if (this.ioLocked) throw new Error('undo not allowed after io command');
    const command = this.redoStack.at(-1);
    if (!command) throw new Error('nothing to redo');
    const result = command.redo(session);
    this.redoStack.pop(); this.undoStack.push(command);
    return result;
  }
}
