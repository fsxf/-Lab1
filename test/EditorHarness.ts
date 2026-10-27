import { EditorSession } from '../src/application/EditorSession.js';
import { CommandDispatcher } from '../src/cli/CommandDispatcher.js';
import { SvgCodec } from '../src/infrastructure/SvgCodec.js';
import type { DocumentStore } from '../src/application/DocumentStore.js';
import { MemoryDocumentStore } from './MemoryDocumentStore.js';

export class EditorHarness {
  readonly session: EditorSession;
  readonly cli: CommandDispatcher;
  constructor(store: DocumentStore = new MemoryDocumentStore()) {
    this.session = new EditorSession(store); this.cli = new CommandDispatcher(this.session);
  }
  run(...lines: string[]): string { return lines.map(line => this.cli.execute(line)).join('\n'); }
  snapshot(): string { return new SvgCodec().encode(this.session.document); }
}
