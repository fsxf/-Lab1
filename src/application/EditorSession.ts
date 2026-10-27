import { SvgDocument } from '../domain/SvgDocument.js';
import type { DocumentStore } from './DocumentStore.js';
import type { Command } from './Command.js';
import { History } from './History.js';

export class EditorSession {
  private current: SvgDocument | undefined;
  private filePath: string | undefined;
  private readonly history = new History();
  constructor(private readonly store: DocumentStore) {}

  get document(): SvgDocument {
    if (!this.current) throw new Error("no document. use 'init' or 'read' first");
    return this.current;
  }
  /** Commit point for a complete, validated command snapshot. */
  install(document: SvgDocument): void { this.current = document; }

  init(width = 800, height = 600): string {
    const document = new SvgDocument(width, height);
    this.current = document; this.filePath = undefined;
    this.history.blockAfterIo();
    return `canvas ${document.width}x${document.height} created`;
  }
  read(path: string): string {
    const result = this.store.read(path);
    this.current = result.document; this.filePath = path;
    this.history.blockAfterIo();
    return [...result.warnings, `read ${path} (${result.document.count} elements)`].join('\n');
  }
  save(path?: string): string {
    const document = this.document;
    const destination = path ?? this.filePath;
    if (!destination) throw new Error('no file path. use save <file.svg>');
    this.store.write(destination, document);
    this.filePath = destination;
    this.history.blockAfterIo();
    return `saved to ${destination} (${document.count} elements)`;
  }
  canvas(width?: number, height?: number): string {
    const document = this.document;
    if (width !== undefined && height !== undefined) {
      const candidate = document.clone();
      candidate.resize(width, height);
      this.install(candidate); this.history.blockAfterIo();
      return `canvas resized to ${candidate.width}x${candidate.height}`;
    }
    return `canvas ${document.width}x${document.height}`;
  }
  edit(command: Command): string { this.document; return this.history.execute(command, this); }
  undo(): string { this.document; return this.history.undo(this); }
  redo(): string { this.document; return this.history.redo(this); }
}
