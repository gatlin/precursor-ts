/**
 * @module ceskm
 */

import { Cbpv, cbpv_lit , cbpv_is_positive } from './grammar';

const clone = <A>(a: A): A => JSON.parse(JSON.stringify(a));

/* Continuations and Values */
export type Kont<T>
  = { tag: "top" }
  | { tag: "arg", vs: Value<T>[], kont: Kont<T> }
  | { tag: "let", sym: string, exp: Cbpv, env: Env, kont: Kont<T> } ;
export const topk = <T>(): Kont<T> => ({ tag: 'top'});
export const argk = <T>(vs: Value<T>[], kont: Kont<T>): Kont<T> => ({
  tag: 'arg',
  vs, kont });
export const letk = <T>(sym: string, exp: Cbpv, env: Env, kont: Kont<T>): Kont<T> => ({
  tag: 'let',
  sym, exp, env, kont });

export type Value<T>
  = { _exp: Cbpv, _env: Env }
  | { _kont: Kont<T> }
  | { v : T } ;
export const closure = <T>(_exp: Cbpv, _env: Env): Value<T> => ({ _exp, _env });
export const continuation = <T>(_kont: Kont<T>): Value<T> => ({ _kont });
export const lit = <T>(v: T): Value<T> => ({ v });

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

export type Store<T> = Record<string,Value<T>>;

export type State<T> = {
  control: Cbpv;
  environment: Env;
  store: Store<T>;
  kontinuation: Kont<T>;
  meta: Kont<T>[];
};

/* The CESKM virtual machine */
export class CESKM<Result = never> {
  protected result: Value<Result> | null = null;
  protected gensym_count: number = 0;

  constructor (
    protected readonly control: Cbpv
  ) {}

  protected make_initial_state(): State<Result> {
    return {
      control: this.control,
      environment: [],
      store: {},
      kontinuation: topk(),
      meta: [] }; }

  /**
   * @method run
   * @returns { Value<Result> } The result value of the control expression.
   */
  public run(): Value<Result> {
    let st: State<Result> = this.make_initial_state();
    while (!this.result) {
      let res = this.step(clone(st));
      if (!this.result) {
        st = <State<Result>>res; }}
    return this.result; }

  /**
   * @method gensym
   * @returns { string } A freshly _gen_erated _sym_bol. Multi-purpose.
   */
  protected gensym(): string {
    return `#sym<${this.gensym_count++}>`; }

  /**
   * @method literal
   * @returns { Value<Result> } A value representation of the syntactic literal.
   * Sub-classes will need to override this method if they change the type T.
   */
  protected literal(v: any): Value<Result> {
    return closure(cbpv_lit(v), []);
  }

  /**
   * @method positive
   * @param { Cbpv } expr The positive expression we are evaluating.
   * @param { Env } env
   * @param { Store<Result> } store
   * @returns { Value<Result> } Resulthe resulting value from a positive term.
   * @throws if the expression isn't positive.
   * @remarks Runs in a loop so that arbitrarily-nested suspensions can be
   * evaluated in one call.
   */
  private positive(expr: Cbpv, env: Env, store: Store<Result>): Value<Result> {
    let finished: boolean = false;
    while (!finished) {
      switch (expr.tag) {
        case "cbpv_literal": return this.literal(expr.v);
        case "cbpv_symbol": {
          if ("_" === expr.v)
            { return continuation(topk()); }
          else {
            let addr_or_val: string | Cbpv =
              env_lookup(expr.v, env);
            return ("string" === typeof addr_or_val)
              ? store[addr_or_val as string]
              : closure(addr_or_val as Cbpv, env); }
          break; }
        case "cbpv_suspend": {
          let { exp: cexp } = expr;
          if (!cbpv_is_positive(cexp)) {
            return closure(cexp, env); }
          else {
            expr = cexp;
            break;}}
        case "cbpv_primop": {
          return this.primop(
            expr.op,
            expr.erands.map(
              (erand: Cbpv) => this.positive(erand, env, store))); }
        default: finished = true; }}
    throw new Error(`Invalid positive term: ${JSON.stringify(expr)}`); }

  /**
   * @method step
   * @param {State<Result>} state
   * @returns { Value<Result> | State<Result> } Returns a `State` in the event that there is
   * more work to be done, but otherwise it returns the final result `Value`.
   * @remarks Advances the machine forward one step. Some terms
   * (namely, `AppA`, `LetA`, and `LetrecA`) do not constitute a complete step
   * by themselves; conversely, they may be nested arbitrarily within a single
   * step so long as they wrap one of the complete steps. That's what the loop
   * is for; this function is still guaranteed™ to terminate for well-formed
   * inputs.
   */
  protected step(state: State<Result>): Value<Result> | State<Result> {
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
        case "cbpv_apply": {
          let vals = control.erands.map(
            (erand: Cbpv) => this.positive(erand, environment, store));
          control = control.op;
          kontinuation = argk(vals, kontinuation);
          break; }
        case "cbpv_let": {
          let { v, exp, body } = control;
          control = exp;
          kontinuation = letk(v, body, environment, kontinuation );
          break; }
        case "cbpv_letrec": {
          let frame: Frame = {};
          for (let binding of control.bindings)
            { frame[binding[0] as string] = binding[1] as Cbpv; }
          control = control.body;
          env_push_frame(frame, environment);
          break; }
        case "cbpv_shift": {
          let addr: string = this.gensym();
          let cc: Kont<Result> = kontinuation;
          let frame: Frame = {};
          frame[control.karg] = addr;
          env_push_frame(frame, environment);
          control = control.body;
          store[addr] = continuation(cc);
          kontinuation = topk();
          return {
            control,
            environment,
            store,
            kontinuation,
            meta }; }
        case "cbpv_reset": {
          let cc: Kont<Result> = kontinuation;
          control = control.exp;
          kontinuation = topk();
          meta.unshift(cc);
          return {
            control,
            environment,
            store,
            kontinuation,
            meta }; }
        case "cbpv_if": {
          let cv = this.positive(control.c, environment, store);
          if (! ("v" in cv))
            { throw new Error("`if` conditional must be a value"); }
          if ("boolean" !== typeof cv.v)
            { throw new Error("`if` conditional must be boolean"); }
          control = cv.v ? control.t : control.e;
          return {
            control,
            environment,
            store,
            kontinuation,
            meta }; }
        case "cbpv_resume": {
          let val = this.positive(control.v, environment, store);
          if ("_exp" in val) {
            control = val._exp;
            environment = val._env;
            return {
              control,
              environment,
              store,
              kontinuation,
              meta }; }
          else {
            return this.continue(val, kontinuation, store, meta); }}
        case "cbpv_abstract": {
          switch (kontinuation.tag) {
            case "arg": {
              let frame: Frame = {};
              for (let i = 0; i < control.args.length; i++) {
                let addr: string = this.gensym();
                store[addr] = kontinuation.vs[i];
                frame[control.args[i]] = addr; }
              control = control.body;
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
   * @param { Value<Result> } val
   * @param { Kont<Result> } kontinuation
   * @param { Store<Result> } store
   * @param { Kont<Result>[] } meta
   * @returns { Value<Result> | State<Result> } A result `Value` or another `State` if there is
   * more work to be done.
   * @remarks This method tries to apply the current continuation to a value.
   */
  private continue(
    val: Value<Result>,
    kontinuation: Kont<Result>,
    store: Store<Result>,
    meta: Kont<Result>[]
  ): Value<Result> | State<Result> {
    let finished: boolean = false;
    while (!finished) {
      switch (kontinuation.tag) {
        case "top": {
          if (meta.length === 0) {
            this.result = val; // mission accomplished
            return val; }
          else {
            let k: Kont<Result> = meta.shift()!;
            kontinuation = k; }
          break; }
        case "arg": {
          let actual_val: Value<Result> = kontinuation.vs[0];
          let next_k: Kont<Result> = kontinuation.kont;
          meta.unshift(next_k);
          if (! ("_kont" in val))
            { throw new Error(`boo: ${JSON.stringify(val)}`); }
          else
            { kontinuation = val._kont; }
          val = actual_val;
          break; }
        case "let": {
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
        default: finished = true; } }
    throw new Error("Invalid continuation."); }

  /**
   * @method primop
   * @param {string} op_sym the symbol for the primitive operator.
   * @param {Array<Value<Result>>} args the values passed to the operator.
   * @returns {Value<Result>}
   * @remarks This method is protected expressly so that sub-classes may define
   * custom primitive operators (indeed that is a primary motivation for
   * sub-classes). Those provided here are chosen because in all likelihood
   * sub-classes will still find them useful.
   */
  protected primop(op_sym: string, args: Value<Result>[]): Value<Result> {
    let s = "";
    for (let arg of args) { s += ` ${ "v" in arg ? typeof arg.v :  "unknown" }`; }
    throw new Error(`bad prim op or arguments: ${op_sym} - ${s}`); }}
