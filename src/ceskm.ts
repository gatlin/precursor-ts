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
 * - a {@link Continuation | **K**ontinuation}, intentionally misspelled to simplify
 *   the acronym; and
 * - the **M**eta-continuation stack, a feature we have added to the usual
 *   components listed above.
 *
 * The virtual machine works by iteratively applying a
 * {@link CESKM.step | transition step} to a {@link State | machine state},
 * returning a {@link Value} if finished, or else a subsequent state.
 *
 * @see {@link CESKM} for example usage and more detail.
 * @see {@link https://en.wikipedia.org/wiki/CEK_Machine}
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
  constructor(protected env: { [name: string]: string | Cbpv } = {}) {}

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
  public bind(name: string, addrOrExpr: string | Cbpv): this {
    this.env[name] = addrOrExpr;
    return this;
  }

  /**
   * Permits copying the actual data in the environment to any arbitrary
   * sub-class of Env.
   * @see {@link CESKM.emptyEnv}
   */
  public clone(): Record<string, string | Cbpv> {
    return { ...this.env };
  }
}

/**
 * ⊤, the "top-level" continuation which has no successor.
 * @remarks
 * While it is indeed the top-level continutation one notes that its place is
 * at the *bottom* of the continuation / call stack.
 * @see {@link Continuation | Continuations}
 * @see {@link topk}
 * @category Continuations & Values
 * @internal
 */
type Top = Record<string, never>;

/**
 * Constructs a {@link Top | ⊤} continuation.
 * @category Continuations & Values
 * @public
 */
const topk = (): Top => ({});

/**
 * Argument continuation
 *
 * An ordered n-tuple of 0-or-more arbitrary {@link Value | values} entangled
 * together in order to evaluate functions: application constructs and pushes
 * these onto the current {@link Continuation | continuation}, while abstraction pops
 * them off and binds them to names.
 * @example
 * ```
 * (reset ((shift k k) 1 #f))
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
 * @typeParam T - The underlying TypeScript types which we wrap in our
 * language.
 * @remarks
 * This is the constructor for the categorical tensor product.
 * @see {@link Continuation}
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
  constructor(
    public readonly _args: Value<T>[],
    public readonly _k: Continuation<T>
  ) {}
}

/**
 * Let-continuation
 *
 * A let-binding consists of *two* expressions to be evaluated: the result of
 * the first will be bound to some symbol, which will then be used to evaluate
 * the second.
 * @example
 * ```
 * (reset
 *   (let x (shift k k) ; <- first expression
 *   x                  ; <- second expression
 * ))
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
 * @typeParam T - The underlying TypeScript types which we wrap in our
 * language.
 * @see {@link Continuation}
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
    public readonly _k: Continuation<T>
  ) {}
}

/**
 * Continuations
 *
 * A continuation is a computer science way of formalizing the call stack.
 * They represent future work to be performed. The operators "shift" and
 * "reset" are used to manipulate continuations and the machine state to do
 * non-linear control flow, side effects, and other functions.
 *
 * There are three types of continuation:
 * - {@link Let | let-frames},
 * - {@link Args | argument frames}, or
 * - {@link topk | ⊤}.
 * @typeParam T - The underlying TypeScript types which we wrap in our
 * language.
 * @see {@link State}
 * @category Continuations & Values
 * @public
 */
type Continuation<T> = Top | Args<T> | Let<T>;

/**
 * A **value** is either a wrapped {@link Continuation | continuation} or a wrapped
 * term of some TypeScript type `T`.
 * @typeParam T - The underlying TypeScript types which we wrap in our
 * language.
 * @category Continuations & Values
 * @public
 */
type Value<T> = { v: T } | { k: Continuation<T> };

/**
 * {@link Value} constructor for wrapped {@link Continuation | continuations}.
 * @typeParam T - The underlying TypeScript types forming the basis of values
 * in the language. Passed along to nested values.
 * @category Continuations & Values
 * @public
 */
const continuation = <T>(k: Continuation<T>): Value<T> => ({ k });

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

/**
 * Maps string-typed addresses to physical values manipulated by the machine.
 * @typeParam T - The underlying TypeScript type forming the basis of values in
 * the language.
 * @category Environment & Store
 * @public
 */
class Store<T> {
  constructor(protected store: { [addr: string]: Value<T> } = {}) {}

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
  kontinuation: Continuation<T>;
  meta: Continuation<T>[];
};

/**
 * The CESKM virtual machine.
 *
 * The focal point is the {@link CESKM.step | transition step} implementation,
 * which a sub-class will use as a building-block in its evaluation algorithm.
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
class CESKM<Base> {
  /**
   * @param envCtor - Constructor for {@link Env} or a sub-class.
   * @param storeCtor - Constructor for {@link Store} or a sub-class.
   */
  constructor(
    protected readonly storeCtor: new () => Store<Base> = Store,
    protected readonly envCtor: new (
      e?: Record<string, string | Cbpv>
    ) => Env = Env
  ) {}

  /**
   * Define the baseline operations which your machine is able to perform on
   * data.
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
   *         return scalar(result as Base);
   *       }
   *       // ...
   *       default: return super.op(op_sym, args);
   *     }
   *   }
   * }
   * ```
   * @param op_sym - the symbol for the primitive operator.
   * @param args - the values passed to the operator.
   * @category Evaluation
   * @public
   * @virtual
   */
  protected op(opSym: string, args: Value<Base>[]): Value<Base> {
    let s = "";
    for (const arg of args) {
      s += ` ${"v" in arg ? typeof arg.v : "unknown"}`;
    }
    throw new Error(`bad op or arguments: ${opSym} - ${s}`);
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
    return closure(cbpv_lit(v), this.emptyEnv());
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
    let done = false;
    let { control, environment, store, kontinuation } = state;
    const { meta } = state;

    while (!done) {
      switch (control.tag) {
        case "cbpv_apply": {
          const { op, erands } = control;
          control = op;
          kontinuation = new Args(
            erands.map((erand: Cbpv) =>
              this.positive(erand, environment, store)
            ),
            kontinuation
          );
          break;
        }
        case "cbpv_let": {
          const { v, exp, body } = control;
          control = exp;
          kontinuation = new Let(
            v,
            body,
            this.emptyEnv(environment.clone()),
            kontinuation
          );
          break;
        }
        case "cbpv_letrec": {
          const { body, bindings } = control;
          control = body;
          for (const [name, definition] of bindings) {
            environment = environment.bind(name, definition);
          }
          break;
        }
        case "cbpv_shift": {
          const { karg, body } = control;
          const addr = this.gensym();
          control = body;
          environment = environment.bind(karg, addr);
          store = store.bind(addr, continuation(kontinuation));
          kontinuation = topk();
          return {
            done,
            value: { control, environment, store, kontinuation, meta }
          };
        }
        case "cbpv_reset": {
          control = control.exp;
          meta.unshift(kontinuation);
          kontinuation = topk();
          return {
            done,
            value: { control, environment, store, kontinuation, meta }
          };
        }
        case "cbpv_if": {
          const { c, t, e } = control;
          const cv = this.positive(c, environment, store);
          if (!("v" in cv)) {
            throw new Error("`if` conditional must be a value");
          }
          if ("boolean" !== typeof cv.v) {
            throw new Error("`if` conditional must be boolean");
          }
          control = cv.v ? t : e;
          return {
            done,
            value: { control, environment, store, kontinuation, meta }
          };
        }
        case "cbpv_resume": {
          const val = this.positive(control.v, environment, store);
          if ("k" in val && val.k instanceof Let) {
            control = val.k._exp;
            environment = val.k._env;
            return {
              done,
              value: { control, environment, store, kontinuation, meta }
            };
          } else {
            return this.continue(val, kontinuation, store, meta);
          }
        }
        case "cbpv_abstract": {
          if (kontinuation instanceof Args) {
            const { args, body } = control;
            const { _args: vals, _k: nextK } = kontinuation;
            for (let i = 0; i < args.length; i++) {
              const addr = this.gensym();
              environment = environment.bind(args[i], addr);
              store = store.bind(addr, vals[i]);
            }
            control = body;
            kontinuation = nextK;
            return {
              done,
              value: { control, environment, store, kontinuation, meta }
            };
          }
          throw new Error("invalid continuation for function");
        }
        default:
          done = true;
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
    let done = false;
    while (!done) {
      switch (expr.tag) {
        case "cbpv_literal":
          return this.literal(expr.v as Base);
        case "cbpv_symbol": {
          if ("_" === expr.v) {
            return continuation(topk());
          } else {
            const addrOrExpr = env.lookup(expr.v);
            return "string" === typeof addrOrExpr
              ? store.lookup(addrOrExpr as string)
              : closure(addrOrExpr as Cbpv, this.emptyEnv(env.clone()));
          }
        }
        case "cbpv_suspend": {
          const { exp } = expr;
          if (!cbpv_is_positive(exp)) {
            return closure(exp, this.emptyEnv(env.clone()));
          } else {
            expr = exp;
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
          done = true;
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
   * @param value - The {@link Value} which we are to annihilate with ...
   * @param kontinuation - ... the given continuation.
   * @param store - A backing {@link Value} storage object.
   * @param meta - A stack (LIFO) of {@link Continuation | continuations}.
   * @returns An `IteratorResult`: either `Value<Base>` if `done`, else
   * `State<Base>`.
   * @category Evaluation
   * @internal
   * @sealed
   */
  private continue(
    value: Value<Base>,
    kontinuation: Continuation<Base>,
    store: Store<Base>,
    meta: Continuation<Base>[]
  ): IteratorResult<State<Base>, Value<Base>> {
    let done = false;
    while (!done) {
      if (kontinuation instanceof Args) {
        const actualValue = continuation(kontinuation);
        meta.unshift(kontinuation._k);
        if (!("k" in value)) {
          throw new Error(`expected continuation: ${JSON.stringify(value)}`);
        }
        kontinuation = value.k;
        value = actualValue;
      } else if (kontinuation instanceof Let) {
        const { _let, _exp: control, _k: nextK } = kontinuation;
        let { _env: environment } = kontinuation;
        if ("k" in value && value.k instanceof Args) {
          const { _args } = value.k;
          for (let i = 0; i < _let.length; i++) {
            const addr: string = this.gensym();
            environment = environment.bind(_let[i], addr);
            store = store.bind(addr, _args[i]);
          }
        } else {
          const addr: string = this.gensym();
          environment = environment.bind(_let[0], addr);
          store = store.bind(addr, value);
        }
        return {
          done,
          value: {
            control,
            environment,
            store,
            kontinuation: nextK,
            meta
          }
        };
      } else {
        if (0 === meta.length) {
          done = true;
          return {
            done,
            value
          };
        } else {
          kontinuation = meta.shift() || topk();
        }
      }
    }
    throw new Error("");
  }

  /**
   * Constructs a fresh {@link State}.
   * @param control - The {@link Cbpv} expression we are to evaluate.
   * @returns An initial state suitable for evaluation.
   * @see {@link CESKM.step}
   * @category Evaluation
   * @public
   * @sealed
   */
  protected inject(control: Cbpv): State<Base> {
    return {
      control,
      environment: this.emptyEnv(),
      store: this.emptyStore(),
      kontinuation: topk(),
      meta: []
    };
  }

  /**
   * Monotonically increasing number used to generate unique identifiers.
   * @internal
   */
  protected gensymCount = 0;

  /**
   * @returns A freshly **gen**erated **sym**bol. Multi-purpose.
   * @internal
   */
  protected gensym(): string {
    return `#sym<${this.gensymCount++}>`;
  }

  /**
   * Provides a way to inject custom sub-classes of {@link Env}.
   * @virtual
   * @public
   */
  protected emptyEnv(env?: Record<string, string | Cbpv>): Env {
    return new this.envCtor(env);
  }

  /**
   * Provides a way to inject custom sub-classes of {@link Store}.
   * @virtual
   * @public
   */
  protected emptyStore(): Store<Base> {
    return new this.storeCtor();
  }
}

export { Args, CESKM, Env, Let, Store, topk, closure, continuation, scalar };
export type { Continuation, State, Top, Value };
