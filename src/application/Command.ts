import type { EditorSession } from './EditorSession.js';

export interface Command {
  execute(session: EditorSession): string;
  undo(session: EditorSession): string;
  redo(session: EditorSession): string;
}
