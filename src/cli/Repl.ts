import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import type { CommandDispatcher } from './CommandDispatcher.js';

export class Repl {
  constructor(private readonly dispatcher: CommandDispatcher) {}
  async run(input: Readable, output: Writable, interactive: boolean): Promise<boolean> {
    output.write("svg-editor 0.1 — type 'help' for commands\n");
    const reader = createInterface({ input, output, terminal: interactive, prompt: 'svg> ' });
    let successful = true;
    if (interactive) reader.prompt();
    for await (const line of reader) {
      try {
        const result = this.dispatcher.execute(line);
        if (result) output.write(result + '\n');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        output.write('error: ' + message.replace(/[\r\n]+/gu, ' ') + '\n');
        successful = false;
      }
      if (interactive) reader.prompt();
    }
    return successful;
  }
}
