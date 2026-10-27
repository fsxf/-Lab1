import { NumberValue } from '../domain/NumberValue.js';
import { ShapeFactory } from '../domain/ShapeFactory.js';
import { EditorSession } from '../application/EditorSession.js';
import { TreeFormatter } from '../application/TreeFormatter.js';
import { CreateCommand } from '../application/commands/CreateCommand.js';
import { DeleteCommand } from '../application/commands/DeleteCommand.js';
import { MoveCommand } from '../application/commands/MoveCommand.js';
import { ScaleCommand } from '../application/commands/ScaleCommand.js';
import { SetCommand } from '../application/commands/SetCommand.js';
import { GroupCommand } from '../application/commands/GroupCommand.js';
import { UngroupCommand } from '../application/commands/UngroupCommand.js';
import { AddToCommand } from '../application/commands/AddToCommand.js';
import { FrontCommand } from '../application/commands/FrontCommand.js';
import { BackCommand } from '../application/commands/BackCommand.js';
import { CommandLexer, type Token } from './CommandLexer.js';

interface CommandDefinition {
  readonly syntax: string;
  readonly min: number;
  readonly max: number;
  readonly needsDocument?: boolean;
  readonly run: (args: readonly Token[]) => string;
}

/** The only command-name dispatch point. Parsing never changes editor state. */
export class CommandDispatcher {
  private readonly lexer = new CommandLexer();
  private readonly factory = new ShapeFactory();
  private readonly formatter = new TreeFormatter();
  private readonly commands: ReadonlyMap<string, CommandDefinition>;

  constructor(private readonly session: EditorSession) {
    this.commands = new Map<string, CommandDefinition>([
      ['init', { syntax: 'init [w] [h]', min: 0, max: 2, needsDocument: false,
        run: a => this.session.init(a[0] ? this.numeric(a, 0) : 800, a[1] ? this.numeric(a, 1) : 600) }],
      ['read', { syntax: 'read <file.svg>', min: 1, max: 1, needsDocument: false, run: a => this.session.read(a[0]!.value) }],
      ['save', { syntax: 'save [file.svg]', min: 0, max: 1, run: a => this.session.save(a[0]?.value) }],
      ['canvas', { syntax: 'canvas [w] [h]', min: 0, max: 2, run: a => {
        if (a.length === 1) throw new Error('usage: canvas [w] [h]');
        return a.length ? this.session.canvas(this.numeric(a, 0), this.numeric(a, 1)) : this.session.canvas();
      } }],
      ['create', { syntax: 'create <type> <id> [params…] [in <containerId>]', min: 2, max: Infinity, run: a => this.create(a) }],
      ['delete', { syntax: 'delete <id>', min: 1, max: 1, run: a => this.session.edit(new DeleteCommand(a[0]!.value)) }],
      ['move', { syntax: 'move <id> <dx> <dy>', min: 3, max: 3, run: a => this.session.edit(new MoveCommand(a[0]!.value, this.numeric(a, 1), this.numeric(a, 2))) }],
      ['scale', { syntax: 'scale <id> <factor>', min: 2, max: 2, run: a => this.session.edit(new ScaleCommand(a[0]!.value, this.numeric(a, 1))) }],
      ['set', { syntax: 'set <id> <attr> <value>', min: 3, max: 3, run: a => this.session.edit(new SetCommand(a[0]!.value, a[1]!.value, a[2]!.value)) }],
      ['group', { syntax: 'group <newGid> <id1> [id2…]', min: 2, max: Infinity, run: a => this.session.edit(new GroupCommand(a[0]!.value, a.slice(1).map(t => t.value))) }],
      ['ungroup', { syntax: 'ungroup <gid>', min: 1, max: 1, run: a => this.session.edit(new UngroupCommand(a[0]!.value)) }],
      ['addto', { syntax: 'addto <gid> <id>', min: 2, max: 2, run: a => this.session.edit(new AddToCommand(a[0]!.value, a[1]!.value)) }],
      ['front', { syntax: 'front <id>', min: 1, max: 1, run: a => this.session.edit(new FrontCommand(a[0]!.value)) }],
      ['back', { syntax: 'back <id>', min: 1, max: 1, run: a => this.session.edit(new BackCommand(a[0]!.value)) }],
      ['tree', { syntax: 'tree [id]', min: 0, max: 1, run: a => this.formatter.tree(this.session.document, a[0]?.value) }],
      ['show', { syntax: 'show <id>', min: 1, max: 1, run: a => this.formatter.show(this.session.document, a[0]!.value) }],
      ['help', { syntax: 'help', min: 0, max: 0, needsDocument: false, run: () => this.help() }],
      ['undo', { syntax: 'undo', min: 0, max: 0, run: () => this.session.undo() }],
      ['redo', { syntax: 'redo', min: 0, max: 0, run: () => this.session.redo() }],
    ]);
  }
  execute(line: string): string {
    const [name, ...args] = this.lexer.tokenize(line);
    if (!name) return '';
    const command = this.commands.get(name.value);
    if (!command) throw new Error(`unknown command: ${name.value}`);
    if (command.needsDocument !== false) this.session.document;
    if (args.length < command.min || args.length > command.max) throw new Error(`usage: ${command.syntax}`);
    return command.run(args);
  }
  private numeric(args: readonly Token[], index: number): number { return NumberValue.parse(args[index]!.value); }
  private create(args: readonly Token[]): string {
    const params = args.slice(2);
    let containerId: string | undefined;
    const marker = params.at(-2);
    if (marker?.value === 'in' && !marker.quoted) {
      containerId = params.at(-1)!.value; params.splice(-2);
    }
    return this.session.edit(new CreateCommand(this.factory, args[0]!.value, args[1]!.value, params.map(t => t.value), containerId));
  }
  private help(): string {
    return [...this.commands.values()].map(command => command.syntax).join('\n') +
      '\nTypes: rect x y w h [fill]; circle cx cy r [fill]; ellipse cx cy rx ry [fill];' +
      '\n       line x1 y1 x2 y2 [stroke]; text x y "content"; g' +
      '\nUse double quotes for spaces. Lines starting with # are comments. EOF / Ctrl-D exits.';
  }
}
