import { readFileSync, writeFileSync, renameSync, unlinkSync, accessSync, statSync, existsSync, constants } from 'node:fs';
import { dirname, basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DocumentStore, ReadResult } from '../application/DocumentStore.js';
import type { SvgDocument } from '../domain/SvgDocument.js';
import { SvgCodec } from './SvgCodec.js';

export class SvgFileStore implements DocumentStore {
  constructor(private readonly codec = new SvgCodec()) {}
  read(path: string): ReadResult {
    let source: string;
    try { source = readFileSync(path, 'utf8'); }
    catch { throw new Error(`cannot read file: ${path}`); }
    return this.codec.decode(source);
  }
  write(path: string, document: SvgDocument): void {
    const source = this.codec.encode(document);
    const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
    try {
      let mode: number | undefined;
      if (existsSync(path)) {
        accessSync(path, constants.W_OK);
        mode = statSync(path).mode & 0o777;
      }
      writeFileSync(temporary, source, { encoding: 'utf8', flag: 'wx', mode });
      renameSync(temporary, path);
    } catch {
      try { unlinkSync(temporary); } catch { /* Nothing to clean up. */ }
      throw new Error(`cannot write file: ${path}`);
    }
  }
}
