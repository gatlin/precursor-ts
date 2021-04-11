/**
 * @module parser
 */

import {
  Cbpv,
  cbpv_is_positive,
  cbpv_lit,
  cbpv_sym,
  cbpv_op,
  cbpv_app,
  cbpv_let,
  cbpv_letrec,
  cbpv_lam,
  cbpv_suspend,
  cbpv_resume,
  cbpv_shift,
  cbpv_reset,
  cbpv_if
} from "./grammar";

/**
 * @class Parser
 * @remarks An S-expression parser. Returns arrays of arrays or atoms.
 * Egregiously plagiarized from [1], and then vivisected immorally into a
 * Typescript class.
 *
 * [1]: https://gist.github.com/DmitrySoshnikov/2a434dda67019a4a7c37
 */
export class Parser {
  protected cursor: number = 0;
  protected ast: any[] = [];
  constructor(
    protected expression: string
  ) {}

  public parse(): any {
    let ast = this.parse_expression();
    return ast;
  }

  protected parse_expression(): any {
    this.whitespace();
    if (';' === this.expression[this.cursor]) {
      this.parse_comment(); }
    else if ('(' === this.expression[this.cursor]) {
      return this.parse_list(); }
    return this.parse_atom(); }

  protected parse_comment(): any {
    // this is called before parse_atom and thus before parse_string.
    // => we may assume we are not in a string.
    while ('\n' !== this.expression[this.cursor]) {
      this.cursor++; } }

  protected parse_list(): any {
    this.ast.push([]);
    this.expect('(');
    this.parse_list_entries();
    this.expect(')');
    return this.ast[0]; }

  protected parse_list_entries(): void {
    let finished = false;
    while (!finished) {
      this.whitespace();
      if (this.expression[this.cursor] === ')') {
        finished = true;
        break;
      }
      let entry = this.parse_expression();
      if ('' !== entry) {
        if (Array.isArray(entry)) {
          entry = this.ast.pop();
        }
        this.ast[this.ast.length-1].push(entry);
      }
    }
  }

  protected parse_string(): string {
    let start = this.cursor;
    let finished = false;
    while (!finished) {
      if ('"' === this.expression[this.cursor]) {
        finished = true;
      }
      this.cursor++;
    }
    let str_body = this.expression.slice(start, this.cursor-1);
    return `"${str_body}"`; };

  protected parse_atom(): any {
    const terminator = /\s+|\)/;
    if ('"' === this.expression[this.cursor]) {
      this.cursor++;
      return this.parse_string(); }
    let atom: any = '';
    while (this.expression[this.cursor] &&
           !terminator.test(this.expression[this.cursor])) {
      atom += this.expression[this.cursor];
      this.cursor++;
    }

    if ('' !== atom && !isNaN(atom)) {
      atom = Number(<number>atom);
    }
    else if ('' !== atom && '#' === atom.charAt(0)) {
      let b: string = atom.charAt(1);
      if ('t' === b) { atom = true; }
      else if ('f' === b) { atom = false; }
      else { throw new Error('boolean is either #t or #f'); }
    }
    else {
      atom = <string>atom;
    }
    return atom;
  }

  protected whitespace(): void {
    const ws = /^\s+/;
    while (this.expression[this.cursor] &&
           ws.test(this.expression[this.cursor])) {
      this.cursor++;
    }
  }

  protected expect(c: string): void {
    if (this.expression[this.cursor] !== c) {
      throw new Error(
        `Unexpected token: ${this.expression[this.cursor]}, expected ${c}`
      );
    }
    this.cursor++;
  }
}

/**
 * @function build_cbpv
 * @param {any} ast A loosely-typed object representing an s-expression.
 * @returns {Cbpv} A proper CBPV syntax object fit for execution.
 * @remarks I plagiarized the s-expression parser above and so convert its
 * result into the correct form afterward.
 */
export const build_cbpv = (ast: any): Cbpv => {
  if (Array.isArray(ast)) {
    switch (ast[0]) {
      case 'λ':
      case '\\': {
        if (!Array.isArray(ast[1])) {
          throw new Error('arguments must be in a list');
        }
        for (let arg of ast[1]) {
          if ('string' !== typeof arg) {
            throw new Error('function argument must be a symbol');
          }
        }
        return cbpv_lam(ast[1], build_cbpv(ast[2]));
      }
      case 'let': {
        if ('string' !== typeof ast[1]) {
          throw new Error('lhs of let-binding must be symbol');
        }
        return cbpv_let(
          <string>ast[1],
          build_cbpv(ast[2]),
          build_cbpv(ast[3])
        );
      }
      case 'letrec': {
        if (!Array.isArray(ast[1])) {
          throw new Error('letrec bindings must be a list');
        }
        let bindings: Array<[any,any]> = ast[1].map((binding: [string,any]) => {
          return [binding[0], build_cbpv(binding[1])];
        });
        return cbpv_letrec(bindings, build_cbpv(ast[2]));
      }
      case 'shift': {
        if ('string' !== typeof ast[1]) {
          throw new Error('continuation variable must be a symbol');
        }
        return cbpv_shift(ast[1], build_cbpv(ast[2]));
      }
      case 'reset': return cbpv_reset(build_cbpv(ast[1]));
      case '?': return cbpv_resume(build_cbpv(ast[1]));
      case '!': return cbpv_suspend(build_cbpv(ast[1]));
      case 'if': {
        return cbpv_if(
          build_cbpv(ast[1]),
          build_cbpv(ast[2]),
          build_cbpv(ast[3])
        );
      }
      default: {
        if ('string' === typeof ast[0] && ast[0].startsWith('op:')) {
          return cbpv_op(
            ast[0],
            ast.slice(1).map(build_cbpv)
          );
        }
        else {
          return cbpv_app(
            build_cbpv(ast[0]),
            ast.slice(1).map(build_cbpv)
          );
        }
      }
    }
  }
  else {
    switch (typeof ast) {
      case 'number': return cbpv_lit(<number>ast);
      case 'boolean': return cbpv_lit(<boolean>ast);
      case 'string': {
        if ('"' === ast.charAt(0)) {
          return cbpv_lit(<string>ast.substr(1,ast.length-2)); }
        return cbpv_sym(<string>ast);
      }
    }
  }

  throw new Error(`invalid term`);
};

/**
 * @function parse_cbpv
 * @param {string} source the source code to parse
 * @returns {Cbpv} a CBPV syntax object ready to be executed.
 * @remarks The source code is stripped of comments before parsing.
 */
export const parse_cbpv = (source: string): Cbpv => {
  const parser = new Parser(source);
  const cbpv = build_cbpv(parser.parse());
  return cbpv;
};
