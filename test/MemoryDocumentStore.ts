import type { DocumentStore, ReadResult } from '../src/application/DocumentStore.js';
import type { SvgDocument } from '../src/domain/SvgDocument.js';
import { SvgCodec } from '../src/infrastructure/SvgCodec.js';

export class MemoryDocumentStore implements DocumentStore {
  private readonly files = new Map<string, string>();
  private readonly codec = new SvgCodec();
  read(path: string): ReadResult {
    const source = this.files.get(path);
    if (source === undefined) throw new Error(`cannot read file: ${path}`);
    return this.codec.decode(source);
  }
  write(path: string, document: SvgDocument): void { this.files.set(path, this.codec.encode(document)); }
}
