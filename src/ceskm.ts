/**
 * @module ceskm
 */

import { Cbpv, cbpv_lit , cbpv_is_positive } from './grammar';

/* Environment */
export type Env = { [name:string]: string | Cbpv };

/* Continuations and Values */
export type Kont<T>
  = Record<string,never>
  | { _let: string []
    ; _exp: Cbpv
    ; _env: Env
    ; _k: Kont<T> }
  | { _args: Value<T>[] ; _k: Kont<T> }
  ;

export const topk = <T>(_v?: T): Kont<T> => ({ });
export const argk = <T>(_args: Value<T>[], _k: Kont<T>): Kont<T> => ({
  _args, _k });
export const letk = <T>(
  _let: string[],
  _exp: Cbpv,
  _env: Env,
  _k: Kont<T>
): Kont<T> => ({ _let, _exp, _env, _k });

export type Value<T> = { v: T } | { _k: Kont<T> };

export const closure = <T>(_exp: Cbpv, _env: Env): Value<T> => ({
  _k: { _exp, _env, _let: [], _k: topk() }
});
export const continuation = <T>(_k: Kont<T>): Value<T> => ({ _k });
export const lit = <T>(v: T): Value<T> => ({ v });

/* Finally, the store */

export type Store<T> = { [addr: string]: Value<T> };

export type State<T> = {
  control: Cbpv;
  environment: Env;
  store: Store<T>;
  kontinuation: Kont<T>;
  meta: Kont<T>[]; };

/* The CESKM virtual machine */
export class CESKM<Base = null | boolean> {
  protected result: Value<Base> | null = null;
  protected gensym_count = 0;

  constructor (
    protected readonly control: Cbpv
  ) {}

  protected make_initial_state(): State<Base> {
    return {
      control: this.control,
      environment: this.env_empty(),
      store: {},
      kontinuation: topk(),
      meta: [] }; }

  /**
   * @method gensym
   * @returns { string } A freshly _gen_erated _sym_bol. Multi-purpose.
   */
  protected gensym(): string {
    return `#sym<${this.gensym_count++}>`; }

  /**
   * @method literal
   * @returns { Value<Base> } A value representation of the syntactic literal.
   * Sub-classes will need to override this method if they change the type T.
   */
  protected literal(v: Base): Value<Base> {
    return closure(cbpv_lit(v), this.env_empty()); }

  protected env_lookup (sym: string, env: Env): string | Cbpv {
    if (sym in env) {
      return env[sym]; }
    throw new Error(`Unbound symbol: ${sym}`); }

  protected env_push (frame: Env, env: Env): Env {
    return { ...env, ...frame }; }

  protected env_empty (): Env {
    return {}; }

  protected store_bind (sto: Store<Base>, addr: string, value: Value<Base>): Store<Base> {
    sto[addr] = value;
    return sto; }

  protected store_lookup (sto: Store<Base>, addr: string): Value<Base> {
    const result: Value<Base> = sto[addr];
    return result; }

  protected store_empty (): Store<Base> {
    return {}; }

  /**
   * @method positive
   * @param { Cbpv } expr The positive expression we are evaluating.
   * @param { Env } env
   * @param { Store<Base> } store
   * @returns { Value<Base> } The resulting value from a positive term.
   * @throws if the expression isn't positive.
   * @remarks Runs in a loop so that arbitrarily-nested suspensions can be
   * evaluated in one call.
   */
  private positive(expr: Cbpv, env: Env, store: Store<Base>): Value<Base> {
    let finished = false;
    while (!finished) {
      switch (expr.tag) {
        case "cbpv_literal": return this.literal(expr.v);
        case "cbpv_symbol": {
          if ("_" === expr.v)
            { return continuation(topk()); }
          else {
            const addr_or_val: string | Cbpv =
              this.env_lookup(expr.v, env);
            return ("string" === typeof addr_or_val)
              ? this.store_lookup(store, addr_or_val as string)
              : closure(addr_or_val as Cbpv, env); }
          break; }
        case "cbpv_suspend": {
          const { exp: cexp } = expr;
          if (!cbpv_is_positive(cexp)) {
            return closure(cexp, env); }
          else {
            expr = cexp;
            break;}}
        case "cbpv_op": {
          return this.op(
            expr.op,
            expr.erands.map(
              (erand: Cbpv) => this.positive(erand, env, store))); }
        default: finished = true; }}
    throw new Error(`Invalid positive term: ${JSON.stringify(expr)}`); }

  /**
   * @method step
   * @param {State<Base>} state
   * @returns { Value<Base> | State<Base> } Returns a `State` in the event that there is
   * more work to be done, but otherwise it returns the final result `Value`.
   * @remarks Advances the machine forward one step. Some terms
   * (namely, `AppA`, `LetA`, and `LetrecA`) do not constitute a complete step
   * by themselves; conversely, they may be nested arbitrarily within a single
   * step so long as they wrap one of the complete steps. That's what the loop
   * is for; this function is still guaranteed™ to terminate for well-formed
   * inputs.
   */
  protected step(state: State<Base>): Value<Base> | State<Base> {
    let finished = false;
    let { control, environment, store, kontinuation } = state;
    const { meta } = state;

    while (!finished) {
      switch (control.tag) {
        case "cbpv_apply": {
          const vals = control.erands.map(
            (erand: Cbpv) => this.positive(erand, environment, store));
          control = control.op;
          kontinuation = argk(vals, kontinuation);
          break; }
        case "cbpv_let": {
          const { v, exp, body } = control;
          control = exp;
          kontinuation = letk([v], body, environment, kontinuation );
          break; }
        case "cbpv_letrec": {
          const frame: Env = this.env_empty();
          for (const binding of control.bindings)
            { frame[binding[0] as string] = binding[1] as Cbpv; }
          control = control.body;
          environment = this.env_push(frame, environment);
          break; }
        case "cbpv_shift": {
          const addr: string = this.gensym();
          const cc: Kont<Base> = kontinuation;
          const frame: Env = this.env_empty();
          frame[control.karg] = addr;
          environment = this.env_push(frame, environment);
          control = control.body;
          store = this.store_bind(store, addr, continuation(cc));
          kontinuation = topk();
          return { control, environment, store, kontinuation, meta }; }
        case "cbpv_reset": {
          const cc: Kont<Base> = kontinuation;
          control = control.exp;
          kontinuation = topk();
          meta.unshift(cc);
          return { control, environment, store, kontinuation, meta }; }
        case "cbpv_if": {
          const cv = this.positive(control.c, environment, store);
          if (! ("v" in cv))
            { throw new Error("`if` conditional must be a value"); }
          if ("boolean" !== typeof cv.v)
            { throw new Error("`if` conditional must be boolean"); }
          control = cv.v ? control.t : control.e;
          return { control, environment, store, kontinuation, meta }; }
        case "cbpv_resume": {
          const val = this.positive(control.v, environment, store);
          if ("_k" in val && "_exp" in val._k) {
            control = val._k._exp;
            environment = val._k._env;
            return { control, environment, store, kontinuation, meta };
          }
          else {
            return this.continue(val, kontinuation, store, meta); }}
        case "cbpv_abstract": {
          if ("_args" in kontinuation) {
            const frame: Env = this.env_empty();
            for (let i = 0; i < control.args.length; i++) {
              const addr: string = this.gensym();
              store = this.store_bind(store, addr, kontinuation._args[i]);
              frame[control.args[i]] = addr; }
            control = control.body;
            environment = this.env_push(frame, environment);
            kontinuation = kontinuation._k;
            return { control, environment, store, kontinuation, meta }; }
          throw new Error('invalid continuation for function'); }
        default: finished = true; } }
    return this.continue(
      this.positive(control, environment, store),
      kontinuation,
      store,
      meta ); }

  /**
   * @method continue
   * @param { Value<Base> } val
   * @param { Kont<Base> } kontinuation
   * @param { Store<Base> } store
   * @param { Kont<Base>[] } meta
   * @returns { Value<Base> | State<Base> } A result `Value` or another `State` if there is
   * more work to be done.
   * @remarks This method tries to apply the current continuation to a value.
   */
  private continue(
    val: Value<Base>,
    kontinuation: Kont<Base>,
    store: Store<Base>,
    meta: Kont<Base>[]
  ): Value<Base> | State<Base> {
    const finished = false;
    while (!finished) {
      if ("_args" in kontinuation) {
        const { _args, _k } = kontinuation;
        const actual_val: Value<Base> = _args[0];
        const next_k: Kont<Base> = _k;
        meta.unshift(next_k);
        if (! ("_k" in val))
          { throw new Error(`expected continuation: ${JSON.stringify(val)}`); }
        else
          { kontinuation = val._k; }
        val = actual_val; }
      else if ("_let" in kontinuation) {
        const { _let, _exp, _k} = kontinuation;
        if (1 !== _let.length)
          { throw new Error(`invalid # of args for letk: ${_let.length}`); }
        let { _env } = kontinuation;
        const frame: Env = this.env_empty();
        const addr: string = this.gensym();
        frame[_let[0]] = addr;
        _env = this.env_push(frame, _env);
        store[addr] = val;
        return {
          control: _exp,
          environment: _env,
          store,
          kontinuation: _k,
          meta }; }
      else {
        if (0 === meta.length) {
          this.result = val;
          return val; }
        else {
          const k: Kont<Base> = meta.shift() || topk();
          kontinuation = k; } } }
    throw new Error("Invalid continuation."); }

  /**
   * @method op
   * @param {string} op_sym the symbol for the primitive operator.
   * @param {Array<Value<Base>>} args the values passed to the operator.
   * @returns {Value<Base>}
   * @remarks This method is protected expressly so that sub-classes may define
   * custom operators (indeed that is a primary motivation for
   * sub-classes). Those provided here are chosen because in all likelihood
   * sub-classes will still find them useful.
   */
  protected op(op_sym: string, args: Value<Base>[]): Value<Base> {
    let s = "";
    for (const arg of args) { s += ` ${ "v" in arg ? typeof arg.v :  "unknown" }`; }
    throw new Error(`bad op or arguments: ${op_sym} - ${s}`); }}
