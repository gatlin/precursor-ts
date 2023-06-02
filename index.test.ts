import {
  CESKM,
  Env,
  Store,
  scalar,
  parseCbpv,
  cbpv_lit,
  cbpv_op,
  cbpv_is_positive
} from "./src/index";
import type { State, Value, Cbpv } from "./src/index";
import { test } from "tap";

// eslint-disable-next-line
type Val = number | boolean | null;

class DebugMachine<Val> extends CESKM<Val> {
  constructor() {
    super(
      class extends Store<Val> {
        constructor(protected store: { [addr: string]: Value<Val> } = {}) {
          super(store);
          this.bind("test-addr-1", scalar(1 as unknown as Val));
          this.bind("test-addr-2", scalar(true as unknown as Val));
        }
      },
      class extends Env {
        constructor(protected env: { [name: string]: string | Cbpv } = {}) {
          super(env);
          this.bind("x", "test-addr-1");
          this.bind("y", "test-addr-2");
        }
      }
    );
  }

  public inject(control: Cbpv): State<Val> {
    return {
      ...super.inject(control)
    };
  }

  public run(program: string): Value<Val> {
    return this.runCbpv(parseCbpv(program));
  }

  public runCbpv(expr: Cbpv): Value<Val> {
    let result = this.step(this.inject(expr));
    while (!result.done) {
      result = this.step(result.value as State<Val>);
    }
    return result.value;
  }

  protected literal(v: Val): Value<Val> {
    if ("number" === typeof v || "boolean" === typeof v || null === v) {
      return scalar(v);
    }
    throw new Error(`${v} not a primitive value`);
  }

  protected op(op_sym: string, args: Value<Val>[]): Value<Val> {
    switch (op_sym) {
      case "op:mul": {
        if (!("v" in args[0]) || !("v" in args[1])) {
          throw new Error("arguments must be values");
        }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
          throw new Error("arguments must be numbers");
        }
        const result: unknown = args[0].v * args[1].v;
        return scalar(result as Val);
      }
      case "op:add": {
        if (!("v" in args[0]) || !("v" in args[1])) {
          throw new Error("arguments must be values");
        }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
          throw new Error("arguments must be numbers");
        }
        const result: unknown = args[0].v + args[1].v;
        return scalar(result as Val);
      }
      case "op:sub": {
        if (!("v" in args[0]) || !("v" in args[1])) {
          throw new Error("arguments must be values");
        }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
          throw new Error("arguments must be numbers");
        }
        const result: unknown = args[0].v - args[1].v;
        return scalar(result as Val);
      }
      case "op:div": {
        if (!("v" in args[0]) || !("v" in args[1])) {
          throw new Error("arguments must be values");
        }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
          throw new Error("arguments must be numbers");
        }
        const result: unknown = args[0].v / args[1].v;
        return scalar(result as Val);
      }
      case "op:mod": {
        if (!("v" in args[0]) || !("v" in args[1])) {
          throw new Error("arguments must be values");
        }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
          throw new Error("arguments must be numbers");
        }
        const result: unknown = args[0].v % args[1].v;
        return scalar(result as Val);
      }
      case "op:eq": {
        if (!("v" in args[0]) || !("v" in args[1])) {
          throw new Error("arguments must be values");
        }
        if (
          ("number" !== typeof args[0].v || "number" !== typeof args[1].v) &&
          ("boolean" !== typeof args[0].v || "boolean" !== typeof args[1].v)
        ) {
          throw new Error("arguments must be numbers or booleans");
        }
        const result: unknown = args[0].v === args[1].v;
        return scalar(result as Val);
      }
      case "op:lt": {
        if (!("v" in args[0]) || !("v" in args[1])) {
          throw new Error("arguments must be values");
        }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
          throw new Error("arguments must be numbers");
        }
        const result: unknown = args[0].v < args[1].v;
        return scalar(result as Val);
      }
      case "op:and": {
        if (!("v" in args[0]) || !("v" in args[1])) {
          throw new Error("arguments must be values");
        }
        if ("boolean" !== typeof args[0].v || "boolean" !== typeof args[1].v) {
          throw new Error("arguments must be booleans");
        }
        const result: unknown = args[0].v && args[1].v;
        return scalar(result as Val);
      }
      case "op:or": {
        if (!("v" in args[0]) || !("v" in args[1])) {
          throw new Error("arguments must be values");
        }
        if ("boolean" !== typeof args[0].v || "boolean" !== typeof args[1].v) {
          throw new Error("arguments must be booleans");
        }
        const result: unknown = args[0].v || args[1].v;
        return scalar(result as Val);
      }
      case "op:not": {
        if (!("v" in args[0])) {
          throw new Error("argument must be a value");
        }
        if ("boolean" !== typeof args[0].v) {
          throw new Error("argument must be a boolean");
        }
        const result: unknown = !args[0].v;
        return scalar(result as Val);
      }
      default:
        return super.op(op_sym, args);
    }
  }
}

test("grammar: cbpv_is_positive", (t) => {
  t.ok(cbpv_is_positive(cbpv_lit(1)));
  t.ok(cbpv_is_positive(cbpv_op("op:test", [])));
  t.end();
});

test("ceskm: evaluates literals correctly", (t) => {
  const vm = new DebugMachine();
  t.same(vm.run("#t"), {
    v: true
  });
  t.same(vm.run("1"), {
    v: 1
  });
  t.end();
});

test("ceskm: correctly transforms state on each step", (t) => {
  const vm = new DebugMachine();
  t.same(vm.run("1"), { v: 1 });
  t.same(vm.run("y"), { v: true });
  t.same(vm.run("(if #t 1 2)"), { v: 1 });
  t.same(vm.run("(if #f 1 2)"), { v: 2 });
  t.same(vm.run("(shift k k)"), { k: {} });
  t.same(vm.run("(let z #t z)"), { v: true });
  t.same(vm.run("(letrec ((a 4)) (? a))"), { v: 4 });
  t.same(vm.run("(? 1)"), { v: 1 });
  t.same(vm.run("( (λ (n) n) #f )"), { v: false });
  t.same(vm.run("(reset #t)"), { v: true });
  t.same(vm.run("(! #t)"), { v: true });
  t.same(vm.run("_"), { k: {} });
  t.throws(() => {
    vm.run("(op:not-implemented 1)");
  });
  t.throws(() => {
    vm.run("(if (! (λ (n) n)) 1 2)");
  });
  t.throws(() => {
    vm.run("(if 5 1 2)");
  });
  t.throws(() => {
    vm.run("(λ (n) n)");
  });
  t.throws(() => {
    vm.run("((λ (n) n) (? 1))");
  });
  t.same(vm.run("(! (λ (n) n))"), {
    k: {
      _let: [],
      _exp: {
        tag: "cbpv_abstract",
        args: ["n"],
        body: {
          tag: "cbpv_symbol",
          v: "n"
        }
      },
      _env: {
        env: {
          x: "test-addr-1",
          y: "test-addr-2"
        }
      },
      _k: {}
    }
  });
  t.end();
});
