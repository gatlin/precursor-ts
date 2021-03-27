/**
 * @module ceskm
 */

import { Cbpv, cbpv_is_positive } from './grammar';

const clone = <A>(a: A): A => JSON.parse(JSON.stringify(a));

/* Continuations and Values */
export type Kont
  = { tag: "top" }
  | { tag: "arg", vs: Value[], kont: Kont }
  | { tag: "let", sym: string, exp: Cbpv, env: Env, kont: Kont } ;
export const topk = (): Kont => ({ tag: 'top'});
export const argk = (vs: Value[], kont: Kont): Kont => ({
  tag: 'arg',
  vs, kont });
export const letk = (sym: string, exp: Cbpv, env: Env, kont: Kont): Kont => ({
  tag: 'let',
  sym, exp, env, kont });

export type Value
  = { tag: "closure", exp: Cbpv, env: Env }
  | { tag: "continuation", kont: Kont }
  | { tag: "number", v: number }
  | { tag: "boolean", v: boolean }
  | { tag: "string" , v: string }
  | { tag: "record" , v: Record<string, Value> }
  | { tag: "array" , v: Value[] };
export const closure = (exp: Cbpv, env: Env): Value => ({
  tag: "closure",
  exp,
  env });
export const continuation = (kont: Kont): Value => ({
  tag: "continuation",
  kont });
export const numval = (v: number): Value => ({ tag: "number", v });
export const boolval = (v: boolean): Value => ({ tag: "boolean", v });
export const strval = (v: string): Value => ({ tag: "string", v });
export const recval = (v: Record<string,Value>): Value => ({ tag: "record", v });
export const arrval = (v: Value[]): Value => ({ tag: "array", v });

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

  protected make_initial_state(): State {
    return {
      control: this.control,
      environment: [],
      store: {},
      kontinuation: topk(),
      meta: [] }; }

  /**
   * @method run
   * @returns { Value } The result value of the control expression.
   */
  public run(): Value {
    let st: State = this.make_initial_state();
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
    while (!finished) {
      switch (expr.tag) {
        case "cbpv_number": return numval(expr.v);
        case "cbpv_boolean": return boolval(expr.v);
        case "cbpv_string": return strval(expr.v);
        case "cbpv_symbol": {
          if ("_" === expr.v)
            { return continuation(topk()); }
          else {
            let addr_or_val: string | Cbpv =
              env_lookup(expr.v, env);
            return ("string" === typeof addr_or_val)
              ? store[<string>addr_or_val]
              : closure(<Cbpv>addr_or_val, env); }
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
   * @param {State} state
   * @returns { Value | State } Returns a `State` in the event that there is
   * more work to be done, but otherwise it returns the final result `Value`.
   * @remarks Advances the machine forward one step. Some terms
   * (namely, `AppA`, `LetA`, and `LetrecA`) do not constitute a complete step
   * by themselves; conversely, they may be nested arbitrarily within a single
   * step so long as they wrap one of the complete steps. That's what the loop
   * is for; this function is still guaranteed™ to terminate for well-formed
   * inputs.
   */
  protected step(state: State): Value | State {
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
            { frame[<string>binding[0]] = <Cbpv>binding[1]; }
          control = control.body;
          env_push_frame(frame, environment);
          break; }
        case "cbpv_shift": {
          let addr: string = this.gensym();
          let cc: Kont = kontinuation;
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
          let cc: Kont = kontinuation;
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
          if ("boolean" !== cv.tag)
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
          if ("closure" === val.tag) {
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
        case "top": {
          if (meta.length === 0) {
            this.result = val; // mission accomplished
            return val; }
          else {
            let k: Kont = meta.shift()!;
            kontinuation = k; }
          break; }
        case "arg": {
          let actual_val: Value = kontinuation.vs[0];
          let next_k: Kont = kontinuation.kont;
          meta.unshift(next_k);
          if (val.tag !== "continuation") {
            throw new Error(`boo: ${JSON.stringify(val)}`); }
          else
            { kontinuation = val.kont; }
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
    throw new Error('Invalid continuation.'); }

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
      case 'prim:mul': {
        if ('number' === args[0].tag && 'number' === args[1].tag)
          { return numval(args[0].v * args[1].v); }}
      case 'prim:add': {
        if ('number' === args[0].tag && 'number' === args[1].tag)
          { return numval(args[0].v + args[1].v); }}
      case 'prim:sub': {
        if ('number' === args[0].tag && 'number' === args[1].tag)
          { return numval(args[0].v - args[1].v); }}
      case 'prim:div': {
        if ('number' === args[0].tag && 'number' === args[1].tag)
          { return numval(args[0].v / args[1].v); }}
      case 'prim:eq': {
        if ('number' === args[0].tag && 'number' === args[1].tag)
          { return boolval(args[0].v === args[1].v); }
        else if ('boolean' === args[0].tag && 'boolean' === args[1].tag)
          { return boolval(args[0].v === args[1].v); }}
      case 'prim:lt': {
        if ('number' === args[0].tag && 'number' === args[1].tag)
          { return boolval(args[0].v < args[1].v); }}
      case 'prim:gt': {
        if ('number' === args[0].tag && 'number' === args[1].tag)
          { return boolval(args[0].v > args[1].v); }}
      case 'prim:lte': {
        if ('number' === args[0].tag && 'number' === args[1].tag)
          { return boolval(args[0].v <= args[1].v); }}
      case 'prim:gte': {
        if ('number' === args[0].tag && 'number' === args[1].tag)
          { return boolval(args[0].v >= args[1].v); }}
      case 'prim:and': {
        if ('boolean' === args[0].tag && 'boolean' === args[1].tag)
          { return boolval(args[0].v && args[1].v); }}
      case 'prim:or': {
        if ('boolean' === args[0].tag && 'boolean' === args[1].tag)
          { return boolval(args[0].v || args[1].v); }}
      case 'prim:not': {
        if ('boolean' === args[0].tag)
          { return boolval(!args[0].v); }}
      case 'prim:string-length': {
        let str: Value = args[0];
        if ("string" !== str.tag)
          { throw new Error(`prim:string-length expects string argument, given ${JSON.stringify(args[0])}.`); }
        return numval(str.v.length); }
      case 'prim:string-concat': {
        let str_l: Value = args[0];
        let str_r: Value = args[1];
        if ("string" !== str_l.tag || "string" !== str_r.tag)
          { throw new Error(`prim:string-concat expects 2 string arguments.`); }
        return strval(str_l.v.concat(str_r.v)); }
      case 'prim:record-new': {
        if (0 !== args.length % 2 && 0 !== args.length) {
          throw new Error(
            `Record requires matching pairs of strings and values`); }
        const v: Record<string,Value> = {};
        for (let i = 0; i < args.length; i += 2) {
          let key: Value = args[i];
          let val: Value = args[i+1];
          if ("string" !== key.tag) {
            throw new Error(`Record key must be string, given: ${key}`); }
          v[key.v] = val; }
        return recval(v); }
      case "prim:record-get": {
        let key: Value = args[0];
        let rec: Value = args[1];
        if ("record" !== rec.tag)
          { throw new Error(`Cannot index non-record: ${rec}`); }
        if ("string" !== key.tag)
          { throw new Error(`Record key must be string, given: ${key}`); }
        let key_str: string = key.v;
        if (!(key_str in rec.v))
          { throw new Error(`No key ${key_str} in record.`); }
        return rec.v[key_str]; }
      case 'prim:record-set': {
        let key: Value = args[0];
        let val: Value = args[1];
        let rec: Value = args[2];
        if ("record" !== rec.tag) {
          throw new Error(`Cannot index non-record: ${rec}`); }
        if ("string" !== key.tag) {
          throw new Error(`Record key must be string, given: ${key}`); }
        rec.v[key.v] = val;
        return rec; }
      case "prim:record-exists": {
        let key: Value = args[0];
        let rec: Value = args[1];
        if ("record" !== rec.tag) {
          throw new Error(`Cannot index non-record: ${rec}`); }
        if ("string" !== key.tag) {
          throw new Error(`Record key must be string, given: ${key}`); }
        let key_str: string = key.v;
        return boolval(key_str in rec.v); }
      case "prim:record-del": {
        let key: Value = args[0];
        let rec: Value = args[1];
        if ("record" !== rec.tag) {
          throw new Error(`Cannot index non-record: ${rec}`); }
        if ("string" !== key.tag) {
          throw new Error(`Record key must be string, given: ${key}`); }
        delete rec.v[<string>key.v];
        return rec; }
      case "prim:array-new": { return arrval(clone(args)); }
      case "prim:array-get": {
        let idx: Value = args[0];
        let arr: Value = args[1];
        if ("array" !== arr.tag)
          { throw new Error(`You cannot array-index a non-array.`); }
        if ("number" !== idx.tag)
          { throw new Error(`Array index must be a number, given: ${idx}`); }
        let idx_num: number = idx.v;
        let arr_v: Value[] = arr.v;
        if (idx_num < 0)
          { throw new Error(`Array index must be >= 0.`); }
        if (idx_num >= arr_v.length)
          { throw new Error(`Array index out of bounds error`); }
        return arr_v[idx_num]; }
      case "prim:array-set": {
        let key: Value = args[0];
        let val: Value = args[1];
        let arr: Value = args[2];
        if ("array" !== arr.tag) {
          throw new Error(`Cannot index non-array: ${arr}`); }
        if ("number" !== key.tag) {
          throw new Error(`Array index must be number, given: ${key}`); }
        arr.v[key.v] = val;
        return arr; }
      case "prim:array-length": {
        if (1 !== args.length) {
          throw new Error(
            `prim:array-length has 1 argument (given ${args.length})`); }
        let arr: Value = args[0];
        if ("array" !== arr.tag)
          { throw new Error(`prim:array-length expects array argument.`); }
        return numval(arr.v.length); } 
      case "prim:array-concat": {
        if ("array" === args[0].tag && "array" === args[1].tag)
          { return arrval(args[0].v.concat(args[1].v)); } } }
    let s = '';
    for (let arg of args) { s += ` ${arg.tag}`; }
    throw new Error(`bad prim op or arguments: ${op_sym} - ${s}`); }}
