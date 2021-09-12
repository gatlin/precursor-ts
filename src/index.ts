/**
 * Precursor
 *
 *  Precursor is a small programming language which you may grow and build upon (a
 *  *precursor*, if you like).
 *
 *  The default distribution consists of 3 modules which work together "out of
 *  the box":
 *
 *  - a small [**call-by-push-value**][cbpvarticle] language,
 *    {@link Cbpv}, defined as a data type that you can manipulate in code;
 *  - a {@link CESKM | CESK-based evaluator} which operates on {@link Cbpv}
 *    objects;
 *  - a {@link Parser} for an [s-expression][sexprarticle] syntax, which parses
 *    source code `string`s into {@link Cbpv} values.
 *
 *  [cbpvarticle]: https://en.wikipedia.org/wiki/Call-by-push-value
 *  [sexprarticle]: https://en.wikipedia.org/wiki/S-expression
 *
 * @example
 * ```typescript
 * import { strict as assert } from "assert";
 * import { CESKM, parse_cbpv, scalar } from "precursor-ts";
 *
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
 *       case "op:add": {
 *         if (! ("v" in args[0]) || ! ("v" in args[1]))
 *           { throw new Error(`arguments must be values`); }
 *         if ("number" !== typeof args[0].v || "number" !== typeof args[1].v)
 *           { throw new Error(`arguments must be numbers`); }
 *         const result: unknown = args[0].v + args[1].v;
 *         return scalar(result as Base);
 *       }
 *       // ...
 *       default: return super.op(op_sym,args);
 *     }
 *   }
 * }
 *
 * const vm = new VM();
 * try {
 *   const three = vm.run(`
 *     (op:add 1 2)
 *   `);
 *   assert.deepEqual(three, {
 *     v: 3
 *   });
 * }
 * catch (e) { console.error(e); }
 * ```
 * @packageDocumentation
 */
export * from "./ceskm";
export * from "./grammar";
export * from "./parser";
