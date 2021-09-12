/**
 * @example
 * ```typescript
 * import { CESKM, parse_cbpv } from "precursor-ts";
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
 *       case "op:mul": {
 *         if (! ("v" in args[0]) || ! ("v" in args[1]))
 *           { throw new Error(`arguments must be values`); }
 *         if ("number" !== typeof args[0].v || "number" !== typeof args[1].v)
 *           { throw new Error(`arguments must be numbers`); }
 *         const result: unknown = args[0].v * args[1].v;
 *         return scalar(result as Base);
 *       }
 *       case "op:eq": {
 *         if (! ("v" in args[0]) || ! ("v" in args[1]))
 *           { throw new Error(`arguments must be values`); }
 *         if (typeof args[0].v !== typeof args[1].v)
 *           { throw new Error(`arguments must be the same type`); }
 *         const result: unknown = args[0].v === args[1].v;
 *         return scalar(result as Base);
 *       }
 *       case "op:not": {
 *         if (! ("v" in args[0]) || ! ("v" in args[1]))
 *           { throw new Error(`arguments must be values`); }
 *         if ("number" !== typeof args[0].v || "number" !== typeof args[1].v)
 *           { throw new Error(`arguments must be numbers`); }
 *         const result: unknown = !(args[0].v);
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
 *   const { v } = vm.run(`
 *     (op:add 1 2)
 *   `);
 *
 * }
 *
 * ```
 * @packageDocumentation
 */
export * from "./ceskm";
export * from "./grammar";
export * from "./parser";
