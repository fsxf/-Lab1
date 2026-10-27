import ts from 'typescript';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative, dirname, basename } from 'node:path';
import assert from 'node:assert/strict';

class ArchitectureCheck {
  rules = {
    domain: new Set(['domain']),
    application: new Set(['application', 'domain']),
    infrastructure: new Set(['infrastructure', 'application', 'domain']),
    cli: new Set(['cli', 'application', 'domain']),
  };
  files(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? this.files(path) : path.endsWith('.ts') ? [path] : [];
    });
  }
  run() {
    const root = resolve('src');
    const files = this.files(root);
    let imports = 0;
    for (const path of files) {
      const local = relative(root, path);
      const layer = local.split('/')[0];
      const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
      const classes = source.statements.filter(ts.isClassDeclaration);
      assert.ok(classes.length <= 1, `one class per file: ${local}`);
      for (const declaration of classes) assert.equal(declaration.name?.text, basename(path, '.ts'));
      this.visit(source, local);
      for (const statement of source.statements.filter(ts.isImportDeclaration)) {
        const target = statement.moduleSpecifier.text;
        imports++;
        if (layer === 'main.ts') continue;
        if (target.startsWith('.')) {
          const dependency = relative(root, resolve(dirname(path), target)).split('/')[0];
          assert.ok(this.rules[layer]?.has(dependency), `forbidden dependency: ${local} -> ${target}`);
        } else {
          assert.ok(layer === 'infrastructure' || (layer === 'cli' && target.startsWith('node:')), `external dependency: ${local} -> ${target}`);
        }
      }
    }
    console.log(`Architecture check passed: ${files.length} source files, ${imports} imports; dependency rules, class filenames, no switch dispatch.`);
  }
  visit(node, local) {
    assert.ok(!ts.isSwitchStatement(node), `switch dispatch found in ${local}`);
    assert.ok(!ts.isFunctionDeclaration(node), `procedural free function found in ${local}`);
    ts.forEachChild(node, child => this.visit(child, local));
  }
}

new ArchitectureCheck().run();
