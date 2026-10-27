export interface Token { readonly value: string; readonly quoted: boolean; }

export class CommandLexer {
  tokenize(line: string): readonly Token[] {
    if (!line.trim() || line.trimStart().startsWith('#')) return [];
    const tokens: Token[] = [];
    let index = 0;
    while (index < line.length) {
      while (/\s/u.test(line[index] ?? '') && index < line.length) index++;
      if (index === line.length) break;
      const quoted = line[index] === '"';
      let value = '';
      if (quoted) {
        index++;
        let closed = false;
        while (index < line.length) {
          const char = line[index++]!;
          if (char === '"') { closed = true; break; }
          if (char === '\\' && ['"', '\\'].includes(line[index] ?? '')) value += line[index++]!;
          else value += char;
        }
        if (!closed) throw new Error('unterminated double quote');
        if (index < line.length && !/\s/u.test(line[index]!)) throw new Error('expected whitespace after quoted argument');
      } else {
        while (index < line.length && !/\s/u.test(line[index]!)) {
          if (line[index] === '"') throw new Error('double quote must start an argument');
          value += line[index++]!;
        }
      }
      tokens.push({ value, quoted });
    }
    return tokens;
  }
}
