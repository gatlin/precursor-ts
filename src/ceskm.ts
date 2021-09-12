/**
 * **CESKM** stack-based virtual machine implementation.
 *
 * A {@link CESKM |*CESKM* virtual machine} is a model of a computer with the
 * following components:
 *
 * - a **C**ontrol-string in some {@link Cbpv | language}, to be evaluated;
 * - an {@link Env | **E**nvironment} mapping symbols to term definitions or
 *   addresses in the ...
 * - {@link Store | **S**tore}, which is a mapping from addresses to actual
 *   {@link Value | values};
 * - a {@link Kont | **K**ontinuation}, intentionally misspelled to simplify
 *   the acronym; and
 * - the **M**eta-continuation stack, a feature we have added to the usual
 *   components listed above.
 *
 * The virtual machine works by iteratively applying a
 * {@link CESKM.step | transition step} to a {@link State | machine state},
 * returning a {@link Value} if finished, or else a subsequent state.
 *
 * @see {@link CESKM} for example usage and more detail.
 *
 * @packageDocumentation
 */
import { cbpv_lit, cbpv_is_positive } from "./grammar";
import type { Cbpv } from "./grammar";

/**
 * Binds *names* in the program source to either
 * - an **address** to be looked up in the {@link Store}; or
 * - a {@link Cbpv | term definition}.
 *
 * @public
 * @category Environment & Store
 */
class Env {
  constructor(private env: { [name: string]: string | Cbpv } = {}) {}

  /**
   * Lookup a name to retrieve either a `string` address or {@link Cbpv}
   * expression.
   * @param name - The name we are looking up.
   * @returns Either an address string for use with {@link Store} or a
   * definition.
   * @throws Error
   * If the name is unbound in this environment.
   */
  public lookup(name: string): string | Cbpv {
    if (!(name in this.env)) {
      throw new Error(`${name} not bound in this environment`);
    }
    return this.env[name];
  }

  /**
   * Binds an address string or {@link Cbpv} definition to the given name.
   * @param name - The name to which we are binding the second argument.
   * @param addr_or_expr - Either an address or a definition to bind.
   * @returns This updated environment.
   */
  public bind(name: string, addr_or_expr: string | Cbpv): this {
    this.env[name] = addr_or_expr;
    return this;
  }

  /**
   * Provides read-only access to the environment map.
   * @see {@link Env.merge}
   * @internal
   */
  protected toRecord(): { [name: string]: string | Cbpv } {
    return this.env;
  }

  /**
   * Merge the entire contents of the other environment into ours, replacing
   * any entries we might have.
   * @param other - The other {@link Env | environment}.
   * @returns This environment updated with the contents of the other one.
   * @public
   */
  public merge(other: Env): Env {
    return new Env({
      ...this.env,
      ...other.toRecord()
    });
  }
}

/**
 * The "top-level" continuation which has no successor.
 * @remarks
 * While it is indeed the top-level continutation one notes that its place is
 * at the *bottom* of the continuation / call stack.
 * @see {@link Kont | Continuation data structures.}
 * @see {@link topk}
 * @category Continuations & Values
 * @internal
 */
type Top = Record<string, never>;

/**
 * Constructs a {@link Top | ⊤} continuation.
 * @category Continuation
 * @public
 */
const topk = (): Top => ({});

/**
 * Argument continuation: pushed by applications, popped by abstractions.
 * @example
 * ```
 * (reset ( (shift k k)  1 #f ))
 * ```
 * @example
 * ```json
 * {
 *   "k": {
 *     "_args": [
 *       {
 *         "v": 1
 *       },
 *       {
 *         "v": false
 *       }
 *     ],
 *     "_k": {}
 *   }
 * }
 * ```
 * @remarks
 * This is the constructor for the categorical tensor product.
 * @see {@link Kont}
 * @see {@link Value}
 * @category Continuations & Values
 * @internal
 */
class Args<T> {
  /**
   * @param _args - Array of {@link Value | values} to push on the stack
   * simultaneously.
   * @param _k - The next continuation.
   */
  constructor(public readonly _args: Value<T>[], public readonly _k: Kont<T>) {}
}

/**
 * Let-continuation: pushed onto the stack by a `let` expression.
 * @example
 * ```
 * (reset (let x (shift k k) x) )
 * ```
 * @example
 * ```json
 * {
 *   "k": {
 *     "_let": [
 *       "x"
 *     ],
 *     "_exp": {
 *       "tag": "cbpv_symbol",
 *       "v": "x"
 *     },
 *     "_env": {},
 *     "_k": {}
 *   }
 * }
 * ```
 * @remarks
 * A let-binding consists of *two* expressions to be evaluated: the result of
 * the first will be bound to some symbol, which will then be used to evaluate
 * the second.
 * The let-continuation records the remaining work to be done while evaluating
 * the first expression.
 * @see {@link Kont}
 * @see {@link Value}
 * @see {@link closure}
 * @category Continuations & Values
 * @internal
 */
class Let<T> {
  /**
   * @param _let - An array of string identifiers unbound in the expression.
   * @param _exp - The {@link Cbpv} expression we are enclosing.
   * @param _env - An {@link Env | environment} binding free symbols in the
   * expression.
   * @param _k - The continuation following this one.
   */
  constructor(
    public readonly _let: string[],
    public readonly _exp: Cbpv,
    public readonly _env: Env,
    public readonly _k: Kont<T>
  ) {}
}

/**
 * Continuations: {@link Let | let-frames}, {@link Args | argument frames},
 * or {@link topk | ⊤}.
 * @category Continuations & Values
 * @public
 */
type Kont<T> = Top | Args<T> | Let<T>;

/**
 * @remarks
 * This allows us to extend the context data we can couple with values.
 * @category Continuations & Values
 * @internal
 */
interface Valuable<T> {
  v: T;
}

/**
 * A **value** is either a wrapped {@link Kont | continuation} or a wrapped
 * term of some TypeScript type `T`.
 * @typeParam T - The underlying TypeScript types which we wrap in our
 * language.
 * @category Continuations & Values
 * @public
 */
type Value<T> = Valuable<T> | { k: Kont<T> };

/**
 * {@link Value} constructor for wrapped {@link Kont | continuations}.
 * @typeParam T - The underlying TypeScript types forming the basis of values
 * in the language. Passed along to nested values.
 * @category Continuations & Values
 * @public
 */
const continuation = <T>(k: Kont<T>): Value<T> => ({ k });

/**
 * @typeParam T - The underlying TypeScript types forming the basis of values
 * in the language. Passed along to nested values.
 * @category Continuations & Values
 * @public
 */
const scalar = <T>(v: T): Value<T> => ({ v });

/**
 * Constructs what would commonly be called a "closure".
 * @remarks
 * In call-by-push-value any so-called "negative" term (ie, one which may
 * perform side-effects or modify control flow) may be suspended into a
 * continuation.
 * @typeParam T - The underlying TypeScript type forming the basis of values in
 * the language.
 * @category Continuations & Values
 * @public
 */
const closure = <T>(_exp: Cbpv, _env: Env): Value<T> =>
  continuation(new Let<T>([], _exp, _env, topk()));

/* Finally, the store */

/**
 * Maps string-typed addresses to physical values manipulated by the machine.
 * @typeParam T - The underlying TypeScript type forming the basis of values in
 * the language.
 * @category Environment & Store
 * @public
 */
class Store<T> {
  constructor(private store: { [addr: string]: Value<T> } = {}) {}

  /**
   * Bind a value to an address.
   * @param addr - The address to bind to.
   * @param value - The {@link Value} we are binding.
   * @returns This store with the new binding.
   * @public
   */
  public bind(addr: string, value: Value<T>): this {
    this.store[addr] = value;
    return this;
  }

  /**
   * Lookup the {@link Value} bound to a given address.
   * @param addr - The string-typed address.
   * @returns The value located at the address.
   * @throws Error
   * If the given address does not contain a value.
   * @public
   */
  public lookup(addr: string): Value<T> {
    if (!(addr in this.store)) {
      throw new Error(`Address ${addr} not populated in memory.`);
    }
    return this.store[addr];
  }
}

/**
 * The state of the {@link CESKM | virtual machine} mutated over the course of
 * execution.
 * @typeParam T - The underlying TypeScript type forming the basis of values in
 * the language.
 * @category VM
 * @public
 */
type State<T> = {
  control: Cbpv;
  environment: Env;
  store: Store<T>;
  kontinuation: Kont<T>;
  meta: Kont<T>[];
};

/**
 * The CESKM virtual machine.
 *
 * The chief export is the {@link CESKM.step | transition step} implementation,
 * which a sub-class will use as a building-block in its evaluation strategy.
 *
 * @remarks
 * The machine can only perform the operations it defines, so sub-classes will
 * almost certainly override {@link CESKM.op}.
 * If your machine is to manipulate values of types other than `boolean` or
 * `null`, you will also need to override {@link CESKM.literal} to map term
 * literals to primitive machine values.
 * @example
 * ```typescript
 * type Base = boolean | null | string | number;
 * class VM extends CESKM<Base> {
 *   public run(program: string): Value<Base> {
 *     let result = this.step(this.inject(parse_cbpv(program)));
 *     while (!result.done) {
 *       result = this.step(result.value);
 *     }
 *     return result.value;
 *   }
 *   protected literal(v: Base): Value<Base> {
 *     if ("number" === typeof v
 *      || "boolean" === typeof v
 *      || "string" === typeof v
 *      || null === v)
 *       { return scalar(v); }
 *     throw new Error(`${v} not a primitive value`);
 *   }
 *   protected op(op_sym: string, args: Value<Base>[]): Value<Base> {
 *     switch (op_sym) {
 *       // ...
 *       default: return super.op(op_sym,args);
 *     }
 *   }
 * }
 * ```
 * @typeParam Base - The types which may be {@link Store | stored} and
 * {@link CESKM.op | operated} on by your programs.
 * @category VM
 * @public
 */
class CESKM<Base = null | boolean> {
  /**
   * @example
   * ```typescript
   * type Base = number | boolean | string | null;
   * class VM extends CESKM<Base> {
   *   // ...
   *   protected op(op_sym: string, args: Value<Base>[]): Value<Base> {
   *     switch (op_sym) {
   *       case "op:add": {
   *         if (! ("v" in args[0]) || ! ("v" in args[1]))
   *           { throw new Error(`arguments must be values`); }
   *         if ("number" !== typeof args[0].v || "number" !== typeof args[1].v)
   *           { throw new Error(`arguments must be numbers`); }
   *         const result: unknown = args[0].v + args[1].v;
   *         return scalar(result as Val);
   *       }
   *       // ...
   *       default: return super.op(op_sym, args);
   *     }
   *   }
   * }
   * ```
   * @remarks
   * This method is protected expressly so that sub-classes may define
   * custom operators (indeed that is a primary motivation for
   * sub-classes).
   * @param op_sym - the symbol for the primitive operator.
   * @param args - the values passed to the operator.
   * @category Evaluation
   * @public
   * @virtual
   */
  protected op(op_sym: string, args: Value<Base>[]): Value<Base> {
    let s = "";
    for (const arg of args) {
      s += ` ${"v" in arg ? typeof arg.v : "unknown"}`;
    }
    throw new Error(`bad op or arguments: ${op_sym} - ${s}`);
  }

  /**
   * @remarks
   * Sub-classes will need to override this method if they change the Base type.
   * @example
   * ```typescript
   * class VM extends CESKM {
   *   // ...
   *   protected literal(v: null | boolean) {
   *     if ("number" === typeof v || "boolean" === typeof v) {
   *       return scalar(v);
   *     }
   *     throw new Error(`invalid literal: ${JSON.stringify(v)}`);
   *   }
   * }
   * ```
   * @param v - A term intended to represent a literal value.
   * @returns A value representation of the syntactic literal.
   * @category Evaluation
   * @public
   * @virtual
   */
  protected literal(v: Base): Value<Base> {
    return closure(cbpv_lit(v), this.env_empty());
  }

  /**
   * Performs one transition "step" on a {@link State}, yielding either
   * a terminal {@link Value} or another {@link State} from which to step
   * again.
   *
   * @remarks
   * This method always terminates for well-formed input.
   *
   * The `while`-loop exists because 3 expression types (application,
   * let-bindings, and letrec-bindings) do not by themselves constitute a
   * complete *step*.
   * Rather, each points to a successor term which must be evaluated.
   *
   * Seeing as how all input expected to terminate will be finite, it is
   * reasonable to assume that the number of nested applications and bindings
   * will be finite, and thus that the loop will eventually terminate.
   * @param state - The {@link State} from which we are starting.
   * @returns An `IteratorResult` of either `State<Base>` (not done), or
   * `Value<Base>` (done).
   * @category Evaluation
   * @public
   * @sealed
   */
  protected step(state: State<Base>): IteratorResult<State<Base>, Value<Base>> {
    let finished = false;
    let { control, environment, store, kontinuation } = state;
    const { meta } = state;

    while (!finished) {
      switch (control.tag) {
        case "cbpv_apply": {
          const vals = control.erands.map((erand: Cbpv) =>
            this.positive(erand, environment, store)
          );
          control = control.op;
          kontinuation = new Args(vals, kontinuation);
          break;
        }
        case "cbpv_let": {
          const { v, exp, body } = control;
          control = exp;
          kontinuation = new Let([v], body, environment, kontinuation);
          break;
        }
        case "cbpv_letrec": {
          let frame: Env = this.env_empty();
          for (const binding of control.bindings) {
            frame = frame.bind(binding[0] as string, binding[1] as Cbpv);
          }
          control = control.body;
          environment = this.env_push(frame, environment);
          break;
        }
        case "cbpv_shift": {
          const addr: string = this.gensym();
          const cc: Kont<Base> = kontinuation;
          let frame: Env = this.env_empty();
          frame = frame.bind(control.karg, addr);
          environment = this.env_push(frame, environment);
          control = control.body;
          store = this.store_bind(store, addr, continuation(cc));
          kontinuation = topk();
          return {
            done: false,
            value: { control, environment, store, kontinuation, meta }
          };
        }
        case "cbpv_reset": {
          const cc: Kont<Base> = kontinuation;
          control = control.exp;
          kontinuation = topk();
          meta.unshift(cc);
          return {
            done: false,
            value: { control, environment, store, kontinuation, meta }
          };
        }
        case "cbpv_if": {
          const cv = this.positive(control.c, environment, store);
          if (!("v" in cv)) {
            throw new Error("`if` conditional must be a value");
          }
          if ("boolean" !== typeof cv.v) {
            throw new Error("`if` conditional must be boolean");
          }
          control = cv.v ? control.t : control.e;
          return {
            done: false,
            value: { control, environment, store, kontinuation, meta }
          };
        }
        case "cbpv_resume": {
          const val = this.positive(control.v, environment, store);
          if ("k" in val && "_exp" in val.k) {
            control = val.k._exp;
            environment = val.k._env;
            return {
              done: false,
              value: { control, environment, store, kontinuation, meta }
            };
          }
          else {
            return this.continue(val, kontinuation, store, meta);
          }
        }
        case "cbpv_abstract": {
          if ("_args" in kontinuation) {
            let frame: Env = this.env_empty();
            for (let i = 0; i < control.args.length; i++) {
              const addr: string = this.gensym();
              store = this.store_bind(store, addr, kontinuation._args[i]);
              frame = frame.bind(control.args[i], addr);
            }
            control = control.body;
            environment = this.env_push(frame, environment);
            kontinuation = kontinuation._k;
            return {
              done: false,
              value: { control, environment, store, kontinuation, meta }
            };
          }
          throw new Error("invalid continuation for function");
        }
        default:
          finished = true;
      }
    }
    return this.continue(
      this.positive(control, environment, store),
      kontinuation,
      store,
      meta
    );
  }

  /**
   * Evaluates a positive {@link Cbpv | expression} to an irreducible
   * {@link Value}.
   * @remarks
   * @param expr - The positive expression we are evaluating.
   * @param env - A static environment to bind any free variables.
   * @param store - A backing {@link Value} storage.
   * @returns The term as a positive {@link Value}, suspended if necessary.
   * @throws Error
   * If the expression isn't positive.
   * @category Evaluation
   * @internal
   * @sealed
   */
  private positive(expr: Cbpv, env: Env, store: Store<Base>): Value<Base> {
    let finished = false;
    while (!finished) {
      switch (expr.tag) {
        case "cbpv_literal":
          return this.literal(expr.v);
        case "cbpv_symbol": {
          if ("_" === expr.v) {
            return continuation(topk());
          }
          else {
            const addr_or_val: string | Cbpv = this.env_lookup(expr.v, env);
            return "string" === typeof addr_or_val
              ? this.store_lookup(store, addr_or_val as string)
              : closure(addr_or_val as Cbpv, env);
          }
          break;
        }
        case "cbpv_suspend": {
          const { exp: cexp } = expr;
          if (!cbpv_is_positive(cexp)) {
            return closure(cexp, env);
          }
          else {
            expr = cexp;
            break;
          }
        }
        case "cbpv_op": {
          return this.op(
            expr.op,
            expr.erands.map((erand: Cbpv) => this.positive(erand, env, store))
          );
        }
        default:
          finished = true;
      }
    }
    throw new Error(`Invalid positive term: ${JSON.stringify(expr)}`);
  }

  /**
   * This method tries to apply the current continuation to a value, which we
   * know is positive.
   * @remarks
   * This is where the meta-stack plays its role: the machine only halts if the
   * current continuation (argument 2) is {@link Top | ⊤ } *and* the
   * meta-stack is empty.
   * It becomes non-empty when the reset operator pushes to it.
   * @param val - The {@link Value} which we are to annihilate with ...
   * @param kontinuation - ... the given continuation.
   * @param store - A backing {@link Value} storage object.
   * @param meta - A stack (LIFO) of {@link Kont | continuations}.
   * @returns An `IteratorResult`: either `Value<Base>` if `done`, else
   * `State<Base>`.
   * @category Evaluation
   * @internal
   * @sealed
   */
  private continue(
    val: Value<Base>,
    kontinuation: Kont<Base>,
    store: Store<Base>,
    meta: Kont<Base>[]
  ): IteratorResult<State<Base>, Value<Base>> {
    let finished = false;
    let final: IteratorResult<State<Base>, Value<Base>> | undefined;
    while (!finished) {
      // update each "val" with corresp. "actual_val" and then loop
      if ("_args" in kontinuation) {
        const { _args, _k } = kontinuation;
        const actual_val: Value<Base> = _args[0];
        const next_k: Kont<Base> = _k;
        meta.unshift(next_k);
        if (!("k" in val)) {
          throw new Error(`expected continuation: ${JSON.stringify(val)}`);
        }
        else {
          kontinuation = val.k;
        }
        val = actual_val;
      }
      else if ("_let" in kontinuation) {
        const { _let, _exp, _k } = kontinuation;
        let { _env } = kontinuation;
        let frame: Env = this.env_empty();
        for (let i = 0; i < _let.length; i++) {
          const addr: string = this.gensym();
          frame = frame.bind(_let[i], addr);
          store = this.store_bind(store, addr, val);
        }
        _env = this.env_push(frame, _env);
        final = {
          done: false,
          value: {
            control: _exp,
            environment: _env,
            store,
            kontinuation: _k,
            meta
          }
        };
        finished = true;
      }
      else {
        if (0 === meta.length) {
          final = {
            done: true,
            value: val
          };
          finished = true;
        }
        else {
          const k: Kont<Base> = meta.shift() || topk();
          kontinuation = k;
        }
      }
    }
    if ("undefined" === typeof final) {
      throw new Error("");
    }
    return final;
  }

  /**
   * Constructs a fresh {@link State}.
   * @param control - The {@link Cbpv} expression we are to evaluate.
   * @returns An initial state suitable for evaluation.
   * @see {@link CESKM.step}
   * @category Evaluation
   * @public
   */
  protected inject(control: Cbpv): State<Base> {
    return {
      control,
      environment: this.env_empty(),
      store: this.store_empty(),
      kontinuation: topk(),
      meta: []
    };
  }

  /**
   * Monotonically increasing number used to generate unique identifiers.
   * @internal
   */
  protected gensym_count = 0;

  /**
   * @returns A freshly **gen**erated **sym**bol. Multi-purpose.
   * @internal
   */
  protected gensym(): string {
    return `#sym<${this.gensym_count++}>`;
  }

  /**
   * @remarks
   * Uses the {@link Env} interface so sub-classes may extend that type to
   * change environment behavior.
   * @category Environment & Store
   * @internal
   */
  protected env_lookup(sym: string, env: Env): string | Cbpv {
    const addr_or_expr = env.lookup(sym);
    if (null === addr_or_expr) {
      throw new Error(`Unbound symbol: ${sym}`);
    }
    return addr_or_expr;
  }

  /**
   * @remarks
   * Uses the {@link Env} interface so sub-classes may extend that type to
   * change environment behavior.
   * @category Environment & Store
   * @internal
   */
  protected env_push(frame: Env, env: Env): Env {
    return env.merge(frame);
  }

  /**
   * @remarks
   * Uses the {@link Env} interface so sub-classes may extend that type to
   * change environment behavior.
   * @category Environment & Store
   * @internal
   */
  protected env_empty(): Env {
    return new Env();
  }

  /**
   * @remarks
   * Uses the {@link Store} interface so sub-classes may extend that type to
   * change storage behavior.
   * {@link Store}.
   * @category Environment & Store
   * @internal
   */
  protected store_bind(
    sto: Store<Base>,
    addr: string,
    value: Value<Base>
  ): Store<Base> {
    return sto.bind(addr, value);
  }

  /**
   * @remarks
   * Uses the {@link Store} interface so sub-classes may extend that type to
   * change storage behavior.
   * {@link Store}.
   * @category Environment & Store
   * @internal
   */
  protected store_lookup(sto: Store<Base>, addr: string): Value<Base> {
    const result: Value<Base> = sto.lookup(addr);
    return result;
  }

  /**
   * @remarks
   * Uses the {@link Store} interface so sub-classes may extend that type to
   * change storage behavior.
   * @category Environment & Store
   * @internal
   */
  protected store_empty(): Store<Base> {
    return new Store();
  }
}

export { Args, CESKM, Let, topk, closure, continuation, scalar };
export type { Env, Kont, State, Store, Top, Value, Valuable };
