/**
 * @module ceskm
 */

import { Cbpv, cbpv_is_positive } from './grammar';

const clone = <A>(a: A): A => JSON.parse(JSON.stringify(a));

/* Continuations and Values */
export type Kont
  = { tag: 'HaltK' }
  | { tag: 'ArgK', vs: Value[], kont: Kont }
  | { tag: 'LetK', sym: string, exp: Cbpv, env: Env, kont: Kont } ;
export const haltk = (): Kont => ({ tag: 'HaltK'});
export const argk = (vs: Value[], kont: Kont): Kont => ({
  tag: 'ArgK',
  vs, kont });
export const letk = (sym: string, exp: Cbpv, env: Env, kont: Kont): Kont => ({
  tag: 'LetK',
  sym, exp, env, kont });

export type Value
  = { tag: 'ClosureV', exp: Cbpv, env: Env }
  | { tag: 'ContinuationV', kont: Kont }
  | { tag: 'NumV', v: number }
  | { tag: 'BoolV', v: boolean } ;
export const closure = (exp: Cbpv, env: Env): Value => ({
  tag: 'ClosureV',
  exp,
  env });
export const continuation = (kont: Kont): Value => ({
  tag: 'ContinuationV',
  kont });
export const numval = (v: number): Value => ({ tag: 'NumV', v });
export const boolval = (v: boolean): Value => ({ tag: 'BoolV', v });

/* Environment and store */

export type Frame = Record<string, string | Cbpv>;
export type Env = Frame[];

export const env_lookup = (sym: string, env: Env): string | Cbpv => {
  for (let frame of env) {
    if (sym in frame) {
      return frame[sym]; } }
  throw new Error(`Unbound symbol: ${sym}`); };

export const env_push_frame = (frame: Frame, env: Env): Env => {
  env.unshift(frame);
  return env; };

export const env_pop_frame = (env: Env): Frame => {
  let frame: Frame = env.shift()!;
  return frame; };

export type Store = Record<string,Value>;

export type State = {
  control: Cbpv;
  environment: Env;
  store: Store;
  kontinuation: Kont;
  meta: Kont[];
};

/* The CESKM virtual machine */
export class CESKM {
  protected result: Value | null = null;
  protected gensym_count: number = 0;

  constructor (
    protected readonly control: Cbpv
  ) {}

  /**
   * @method run
   * @returns { Value } The result value of the control expression.
   */
  public run(): Value {
    let st: State = {
      control: this.control,
      environment: [],
      store: {},
      kontinuation: haltk(),
      meta: [] };
    while (!this.result) {
      let res = this.step(clone(st));
      if (!this.result) {
        st = <State>res; }}
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
   * @param { Env } env
   * @param { Store } store
   * @returns { Value } The resulting value from a positive term.
   * @throws if the expression isn't positive.
   * @remarks Runs in a loop so that arbitrarily-nested suspensions can be
   * evaluated in one call.
   */
  private positive(expr: Cbpv, env: Env, store: Store): Value {
    let finished: boolean = false;
    switch (expr.tag) {
      case 'NumA': return numval(expr.v);
      case 'BoolA': return boolval(expr.v);
      case 'SymA': {
        if ("_" === expr.v)
          { return continuation(haltk()); }
        else {
          let addr_or_val: string | Cbpv =
            env_lookup(expr.v, env);
          return ("string" === typeof addr_or_val)
            ? store[<string>addr_or_val]
            : closure(<Cbpv>addr_or_val, env); }
        break; }
      case 'SuspendA': {
        let { exp: cexp } = expr;
        if (!cbpv_is_positive(cexp)) {
          return closure(cexp, env); }
        else {
          return this.positive(cexp, env, store); }}
      case 'PrimA': {
        return this.primop(
          expr.op,
          expr.erands.map(
            (erand: Cbpv) => this.positive(erand, env, store))); }}
    throw new Error('Invalid positive term.'); }

  /**
   * @method step
   * @param {State} state
   * @returns { Value | State } Returns a `State` in the event that there is
   * more work to be done, but otherwise it returns the final result `Value`.
   * @remarks Advances the machine forward one step. Some terms
   * (namely, `AppA`, `LetA`, and `LetrecA`) do not constitute a complete step
   * by themselves; conversely, they may be nested arbitrarily within a single
   * step so long as they wrap one of the complete steps. That's what the loop
   * is for; this function is still guaranteed™ to terminate for well-formed
   * inputs.
   * Private so that sub-classes can't call it from primop.
   */
  private step(state: State): Value | State {
    let finished: boolean = false;
    let {
      control,
      environment,
      store,
      kontinuation,
      meta
    } = state;

    while (!finished) {
      switch (control.tag) {
        case 'AppA': {
          let vals = control.erands.map(
            (erand: Cbpv) => this.positive(erand, environment, store));
          control = control.op;
          kontinuation = argk(vals, kontinuation);
          break; }
        case 'LetA': {
          let { v, exp, body } = control;
          control = exp;
          kontinuation = letk(
            v,
            body,
            environment,
            kontinuation
          );
          break; }
        case 'LetrecA': {
          let frame: Frame = {};
          for (let binding of control.bindings)
            { frame[<string>binding[0]] = <Cbpv>binding[1]; }
          control = control.body;
          env_push_frame(frame, environment);
          break; }
        case 'ShiftA': {
          let addr: string = this.gensym();
          let cc: Kont = kontinuation;
          let frame: Frame = {};
          frame[control.karg] = addr;
          env_push_frame(frame, environment);
          control = control.body;
          store[addr] = continuation(cc);
          kontinuation = haltk();
          return {
            control,
            environment,
            store,
            kontinuation,
            meta }; }
        case 'ResetA': {
          let cc: Kont = kontinuation;
          control = control.exp!;
          kontinuation = haltk();
          meta.unshift(cc);
          return {
            control,
            environment,
            store,
            kontinuation,
            meta }; }
        case 'IfA': {
          let cv = this.positive(control.c, environment, store);
          if ('BoolV' !== cv.tag)
            { throw new Error('`if` conditional must be boolean'); }
          control = cv.v ? control.t : control.e;
          return {
            control,
            environment,
            store,
            kontinuation,
            meta, }; }
        case 'ResumeA': {
          let val = this.positive(control.v, environment, store);
          if ("ClosureV" === val.tag) {
            control = val.exp;
            environment = val.env;
            return {
              control,
              environment,
              store,
              kontinuation,
              meta }; }
          else {
            return this.continue(val, kontinuation, store, meta); }}
        case 'LamA': {
          switch (kontinuation.tag) {
            case 'ArgK': {
              let frame: Frame = {};
              for (let i = 0; i < control.args.length; i++) {
                let addr: string = this.gensym();
                store[addr] = kontinuation.vs[i];
                frame[control.args[i]] = addr; }
              control = control.body!;
              env_push_frame(frame, environment);
              kontinuation = kontinuation.kont;
              return {
                control,
                environment,
                store,
                kontinuation,
                meta }; }
            default: throw new Error('invalid continuation for function'); }
          finished = true;
          break; }
        default: finished = true; } }
    return this.continue(
      this.positive(control, environment, store),
      kontinuation,
      store,
      meta ); }

  /**
   * @method continue
   * @param { Value } val
   * @param { Kont } kontinuation
   * @param { Store } store
   * @param { Kont[] } meta
   * @returns { Value | State } A result `Value` or another `State` if there is
   * more work to be done.
   * @remarks This method tries to apply the current continuation to a value.
   */
  private continue(
    val: Value,
    kontinuation: Kont,
    store: Store,
    meta: Kont[]
  ): Value | State {
    let finished: boolean = false;
    while (!finished) {
      switch (kontinuation.tag) {
        case 'HaltK': {
          if (meta.length === 0) {
            this.result = val; // mission accomplished
            return val; }
          else {
            let k: Kont = meta.shift()!;
            kontinuation = k; }
          break; }
        case 'ArgK': {
          let actual_val: Value = kontinuation.vs[0]!;
          let next_k: Kont = kontinuation.kont;
          meta.unshift(next_k);
          if (val.tag !== 'ContinuationV') {
            throw new Error(`boo: ${JSON.stringify(val)}`); }
          else
            { kontinuation = val.kont; }
          val = actual_val;
          break; }
        case 'LetK': {
          let { sym, env, exp, kont } = kontinuation;
          let frame: Frame = {};
          let addr: string = this.gensym();
          frame[sym] = addr;
          env_push_frame(frame, env);
          store[addr] = val;
          return {
            control: kontinuation.exp,
            environment: env,
            store,
            kontinuation: kontinuation.kont,
            meta
          };  }
        default: throw new Error ('Invalid continuation'); } }
    throw new Error('tbh idk'); }

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
    throw new Error(`bad prim op or arguments: ${op_sym} - ${s}`); }}
