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

export const topk = <T>(): Kont<T> => ({ });
export const argk = <T>(_args: Value<T>[], _k: Kont<T>): Kont<T> => ({
  _args, _k });
export const letk = <T>(
  _let: string[],
  _exp: Cbpv,
  _env: Env,
  _k: Kont<T>
): Kont<T> => ({ _let, _exp, _env, _k });

export type Value<T> = { v: T } | { k: Kont<T> };

export const continuation = <T>(k: Kont<T>): Value<T> => ({ k });
export const scalar = <T>(v: T): Value<T> => ({ v });
export const closure = <T>(_exp: Cbpv, _env: Env): Value<T> => ({
  k: { _exp, _env, _let: [], _k: topk() }
});

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
  protected gensym_count = 0;

  protected make_initial_state(control: Cbpv): State<Base> {
    return {
      control,
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
   * Sub-classes will need to override this method if they change the Base type.
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
   * @returns { Value<Base> }
   * @throws if the expression isn't positive.
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
   * @returns {IteratorResult<Value<Base>,State<Base>>}
   */
  protected step(state: State<Base>): IteratorResult<State<Base>,Value<Base>> {
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
          return {
            done: false,
            value: { control, environment, store, kontinuation, meta }}};
        case "cbpv_reset": {
          const cc: Kont<Base> = kontinuation;
          control = control.exp;
          kontinuation = topk();
          meta.unshift(cc);
          return {
            done: false,
            value: { control, environment, store, kontinuation, meta } }};
        case "cbpv_if": {
          const cv = this.positive(control.c, environment, store);
          if (! ("v" in cv))
            { throw new Error("`if` conditional must be a value"); }
          if ("boolean" !== typeof cv.v)
            { throw new Error("`if` conditional must be boolean"); }
          control = cv.v ? control.t : control.e;
          return {
            done: false,
            value: { control, environment, store, kontinuation, meta } }};
        case "cbpv_resume": {
          const val = this.positive(control.v, environment, store);
          if ("k" in val && "_exp" in val.k) {
            control = val.k._exp;
            environment = val.k._env;
            return {
              done: false,
              value: { control, environment, store, kontinuation, meta }};
          }
          else {
            return this.continue(val, kontinuation, store, meta)!; }}
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
            return {
              done: false,
              value: { control, environment, store, kontinuation, meta } }};
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
   * @returns { IteratorResult<Value<Base>,State<Base>> }
   * @remarks This method tries to apply the current continuation to a value.
   */
  private continue(
    val: Value<Base>,
    kontinuation: Kont<Base>,
    store: Store<Base>,
    meta: Kont<Base>[]
  ): IteratorResult<State<Base>,Value<Base>> {
    let finished = false;
    let final: IteratorResult<State<Base>,Value<Base>> | undefined;
    while (!finished) {
      // update each "val" with corresp. "actual_val" and then loop
      if ("_args" in kontinuation) {
        const { _args, _k } = kontinuation;
        const actual_val: Value<Base> = _args[0];
        const next_k: Kont<Base> = _k;
        meta.unshift(next_k);
        if (! ("k" in val))
          { throw new Error(`expected continuation: ${JSON.stringify(val)}`); }
        else
          { kontinuation = val.k; }
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
        store = this.store_bind(store, addr, val);
        final = {
          done: false,
          value: {
            control: _exp,
            environment: _env,
            store,
            kontinuation: _k,
            meta } };
        finished = true; }
      else {
        if (0 === meta.length) {
          final = {
            done: true,
            value: val
          };
          finished = true; }
        else {
          const k: Kont<Base> = meta.shift() || topk();
          kontinuation = k; } } }
    if ("undefined" === typeof final) { throw new Error(""); }
    return final; }

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
