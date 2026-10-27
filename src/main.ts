import { EditorSession } from './application/EditorSession.js';
import { SvgFileStore } from './infrastructure/SvgFileStore.js';
import { CommandDispatcher } from './cli/CommandDispatcher.js';
import { Repl } from './cli/Repl.js';

const session = new EditorSession(new SvgFileStore());
const repl = new Repl(new CommandDispatcher(session));
const success = await repl.run(process.stdin, process.stdout, Boolean(process.stdin.isTTY && process.stdout.isTTY));
if (!success) process.exitCode = 1;
