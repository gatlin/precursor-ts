/**
 * @module ceskm
 */

import { Cbpv, cbpv_is_positive } from './grammar';

/* Continuations and Values */
type Kont
  = { tag: 'HaltK' }
  | { tag: 'ArgK', vs: Value[], kont: Kont }
  | { tag: 'LetK', sym: string, exp: Cbpv, env: Env, kont: Kont } ;
const haltk = (): Kont => ({ tag: 'HaltK'});
const argk = (vs: Value[], kont: Kont): Kont => ({
  tag: 'ArgK',
  vs, kont });
const letk = (sym: string, exp: Cbpv, env: Env, kont: Kont): Kont => ({
  tag: 'LetK',
  sym, exp, env, kont });

export type Value
  = { tag: 'ClosureV', exp: Cbpv, env: Env }
  | { tag: 'ContinuationV', kont: Kont }
  | { tag: 'NumV', v: number }
  | { tag: 'BoolV', v: boolean } ;
const closure = (exp: Cbpv, env: Env): Value => ({
  tag: 'ClosureV',
  exp,
  env });
const continuation = (kont: Kont): Value => ({
  tag: 'ContinuationV',
  kont });
const numval = (v: number): Value => ({ tag: 'NumV', v });
const boolval = (v: boolean): Value => ({ tag: 'BoolV', v });

/* Environment and store */

type Frame = Record<string, string | Cbpv>;
type Env = Frame[];

const env_lookup = (sym: string, env: Env): string | Cbpv => {
  for (let frame of env) {
    if (sym in frame) {
      return frame[sym]; } }
  throw new Error(`Unbound symbol: ${sym}`); };

const env_push_frame = (frame: Frame, env: Env): Env => {
  env.unshift(frame);
  return env; };

const env_pop_frame = (env: Env): Frame => {
  let frame: Frame = env.shift()!;
  return frame; };

type Store = Record<string,Value>;

/* The CESKM virtual machine */
export class CESKM {
  constructor( protected control: Cbpv ) {} // "C"
  protected environment: Env = [{}];        // "E"
  protected store: Store = {};              // "S"
  protected kontinuation: Kont = haltk();   // "K"
  protected meta: Kont[] = [];              // "M"

  protected gensym_count: number = 0;
  protected result: Value | null = null;

  /**
   * @method run
   * @returns { Value } The result value of the control expression.
   */
  public run(): Value {
    while (null === this.result) { this.step(); }
    return this.result; }

  /**
   * @method gensym
   * @returns { string } A freshly _gen_erated _sym_bol. Multi-purpose.
   */
  protected gensym(): string {
    return `#sym<${this.gensym_count++}>`; }

  /**
   * @method positive
   * @param { Cbpv } expr The positive expression we are evaluating.
   * @returns { Value } The resulting value from a positive term.
   * @throws if the expression isn't positive.
   * @remarks Runs in a loop so that arbitrarily-nested suspensions can be
   * evaluated in one call.
   */
  private positive(expr: Cbpv): Value {
    let finished: boolean = false;
    while (!finished) {
      switch (expr.tag) {
        case 'NumA': return numval(expr.v);
        case 'BoolA': return boolval(expr.v);
        case 'SymA': {
          if ("_" === expr.v)
            { return continuation(haltk()); }
          else {
            let addr_or_val: string | Cbpv =
              env_lookup(expr.v, this.environment);
            return ("string" === typeof addr_or_val)
              ? this.store[<string>addr_or_val]
              : closure(<Cbpv>addr_or_val,this.environment); }
          break; }
        case 'SuspendA': {
          if (!cbpv_is_positive(expr.exp))
            { return closure(expr.exp, this.environment); }
          else { expr = expr.exp; }
          break; }
        case 'PrimA': {
          return this.primop(
            expr.op,
            expr.erands.map(this.positive.bind(this))); }
        default: finished = true; } } // only suspend should loop
    throw new Error('Invalid positive term.'); }

  /**
   * @method step
   * @returns {this}
   * @remarks Advances the machine forward one step. Some terms
   * (namely, `AppA`, `LetA`, and `LetrecA`) do not constitute a complete step
   * by themselves; conversely, they may be nested arbitrarily within a single
   * step so long as they wrap one of the complete steps. That's what the loop
   * is for; this function is still guaranteed™ to terminate for well-formed
   * inputs.
   * Private so that sub-classes can't call it from primop.
   */
  private step(): this {
    let finished: boolean = false;
    while (!finished) {
      switch (this.control.tag) {
        case 'AppA': {
          let vals = this.control.erands.map((erand: Cbpv) => this.positive(erand));
          this.control = this.control.op;
          this.kontinuation = argk(vals, this.kontinuation);
          break; }
        case 'LetA': {
          let { v, exp, body } = this.control;
          this.control = exp;
          this.kontinuation = letk(
            v,
            body,
            this.environment,
            this.kontinuation
          );
          break; }
        case 'LetrecA': {
          let frame: Frame = {};
          for (let binding of this.control.bindings)
            { frame[<string>binding[0]] = <Cbpv>binding[1]; }
          this.control = this.control.body;
          env_push_frame(frame, this.environment);
          break; }
        case 'ShiftA': {
          let addr: string = this.gensym();
          let cc: Kont = this.kontinuation;
          let frame: Frame = {};
          frame[this.control.karg] = addr;
          env_push_frame(frame, this.environment);
          this.control = this.control.body;
          this.store[addr] = continuation(cc);
          this.kontinuation = haltk();
          return this; }
        case 'ResetA': {
          let cc: Kont = this.kontinuation;
          this.control = this.control.exp!;
          this.kontinuation = haltk();
          this.meta.unshift(cc);
          return this; }
        case 'IfA': {
          let cv = this.positive(this.control.c);
          if ('BoolV' !== cv.tag)
            { throw new Error('`if` conditional must be boolean'); }
          this.control = cv.v ? this.control.t : this.control.e;
          return this; }
        case 'ResumeA': {
          this.control = this.control.v;
          if (cbpv_is_positive(this.control)) {
            let val: Value = this.positive(this.control);
            if ('ClosureV' === val.tag) {
              this.control = val.exp;
              this.environment = val.env;
              return this; }
            finished = true; }
          break; }
        case 'LamA': {
          switch (this.kontinuation.tag) {
            case 'ArgK': {
              let frame: Frame = {};
              for (let i = 0; i < this.control.args.length; i++) {
                let addr: string = this.gensym();
                this.store[addr] = this.kontinuation.vs[i];
                frame[this.control.args[i]] = addr; }
              this.control = this.control.body!;
              env_push_frame(frame, this.environment);
              this.kontinuation = this.kontinuation.kont;
              return this; }
            default: throw new Error('invalid continuation for function'); }
          finished = true;
          break; }
        default: finished = true; } }
    return this.continue(this.positive(this.control)); }

  /**
   * @method continue
   * @param { Value } val
   * @returns { this } This very same CESKM machine.
   * @remarks This method tries to apply the current continuation to a value.
   */
  private continue(val: Value): this {
    let finished: boolean = false;
    while (!finished) {
      switch (this.kontinuation.tag) {
        case 'HaltK': {
          if (this.meta.length === 0) {
            this.result = val; // mission accomplished
            finished = true; }
          else {
            let k: Kont = this.meta.shift()!;
            this.kontinuation = k; }
          break; }
        case 'ArgK': {
          let actual_val: Value = this.kontinuation.vs[0]!;
          let next_k: Kont = this.kontinuation.kont;
          this.meta.unshift(next_k);
          if (val.tag !== 'ContinuationV') {
            throw new Error(
              'this should never ever happen for any reason ever'); }
          else
            { this.kontinuation = val.kont; }
          val = actual_val;
          break; }
        case 'LetK': {
          let addr: string = this.gensym();
          this.control = this.kontinuation.exp;
          let frame: Frame = {};
          frame[this.kontinuation.sym!] = addr;
          env_push_frame(frame, this.environment);
          this.store[addr] = val;
          this.kontinuation = this.kontinuation.kont;
          finished = true;
          break; }
        default: throw new Error ('Invalid continuation'); } }
    return this; }

  /**
   * @method primop
   * @param {string} op_sym the symbol for the primitive operator.
   * @param {Array<Value>} args the values passed to the operator.
   * @returns {Value}
   * @remarks This method is protected expressly so that sub-classes may define
   * custom primitive operators (indeed that is a primary motivation for
   * sub-classes). Those provided here are chosen because in all likelihood
   * sub-classes will still find them useful.
   */
  protected primop(op_sym: string, args: Value[]): Value {
    switch (op_sym) {
      case 'prim-mul': {
        if ('NumV' === args[0].tag && 'NumV' === args[1].tag)
          { return numval(args[0].v * args[1].v); }}
      case 'prim-add': {
        if ('NumV' === args[0].tag && 'NumV' === args[1].tag)
          { return numval(args[0].v + args[1].v); }}
      case 'prim-sub': {
        if ('NumV' === args[0].tag && 'NumV' === args[1].tag)
          { return numval(args[0].v - args[1].v); }}
      case 'prim-div': {
        if ('NumV' === args[0].tag && 'NumV' === args[1].tag)
          { return numval(args[0].v / args[1].v); }}
      case 'prim-eq': {
        if ('NumV' === args[0].tag && 'NumV' === args[1].tag)
          { return boolval(args[0].v === args[1].v); }
        else if ('BoolV' === args[0].tag && 'BoolV' === args[1].tag)
          { return boolval(args[0].v === args[1].v); }}
      case 'prim-lt': {
        if ('NumV' === args[0].tag && 'NumV' === args[1].tag)
          { return boolval(args[0].v < args[1].v); }}
      case 'prim-gt': {
        if ('NumV' === args[0].tag && 'NumV' === args[1].tag)
          { return boolval(args[0].v > args[1].v); }}
      case 'prim-lte': {
        if ('NumV' === args[0].tag && 'NumV' === args[1].tag)
          { return boolval(args[0].v <= args[1].v); }}
      case 'prim-gte': {
        if ('NumV' === args[0].tag && 'NumV' === args[1].tag)
          { return boolval(args[0].v >= args[1].v); }}
      case 'prim-and': {
        if ('BoolV' === args[0].tag && 'BoolV' === args[1].tag)
          { return boolval(args[0].v && args[1].v); }}
      case 'prim-or': {
        if ('BoolV' === args[0].tag && 'BoolV' === args[1].tag)
          { return boolval(args[0].v || args[1].v); }}
      case 'prim-not': {
        if ('BoolV' === args[0].tag)
          { return boolval(!args[0].v); }} }
    let s = '';
    for (let arg of args) { s += ` ${arg.tag}`; }
    throw new Error(`bad prim op or arguments: ${op_sym} - ${s}`); } }
