# precursor-ts

Precursor is a small, experimental programming language implemented as a pure
TypeScript (or pure JavaScript) library.

You can read more details below in the *overview*, and you can even
[try it out in a live demonstration in your browser](https://niltag.net/code/precursor)

Licensed under the `GPL-3`.

# build and install from source

You can run tests and build the Javascript distribution from the typescript -
and, in fact, must - simply by running:

```shell
npm i
```

# Synopsis

Precursor is a small programming language which you may grow and build upon (a
"precursor," if you like).

The default distribution consists of 3 components which work together "out of
the box".

To be perfectly honest, I keep circling on how best to approach explaining what
this is, if only because *I'm* deficient in my didactic abilities.

The following shows an example of how to construct an evaluator for the default
surface language (if you're willing to write your own parser you can absolutely
substitute in your own surface syntax!) and a simple set of possible result
types.

First, we sub-classed `CESKM` and specified that, in addition to the built-in
value types of *closures* and *continuations*, we will be dealing in `number`s,
`boolean`s, and `null`.

```typescript
import {
  CESKM,
  Value,
  parse_cbpv // use the pre-fab s-expression parser
} from "precursor-ts";

import { strict as assert } from "assert";

type Val = number | boolean | null ;

class ExampleMachine<Val> extends CESKM<Val> {
  constructor (program: string) { super(parse_cbpv(program)); }
```

Accordingly we must override `literal` and `primop`: the first to define how
literal expressions are to be converted into `Value`s; and the second to define
the primitive operations on data your machine is able to perform.

```typescript
  protected literal(v: any): Value<Val> {
    if ("number" === typeof v
     || "boolean" === typeof v
     || null === v)
      { return { v }; }
    throw new Error(`${v} not a primitive value`);
  }
  protected primop(op_sym: string, args: Value<Val>[]): Value<Val> {
    switch (op_sym) {
      case "prim:mul": {
        if (! ("v" in args[0]) || ! ("v" in args[1]))
          { throw new Error(`arguments must be values`); }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v)
          { throw new Error(`arguments must be numbers`); }
        let result: unknown = args[0].v * args[1].v;
        return { v: result as Val };
      }
      // ... other prim ops
      default: return super.primop(op_sym, args);
    }
  }
}
```

Primitive operators are not complete terms by themselves - they aren't
variables you can pass around as an argument.
Think of them as the "assembly" instructions of your evaluator.
You will likely be defining functions which wrap them.

Having supplied the universe of result types and filled in how they relate to
literal expressions and what primitive operators are defined for them, you can
`run` your machine down to a `Value<Result>`.

```typescript
const example_machine = new ExampleMachine(`
(letrec (
  (square (λ (n)
    (let n (? n)      ; prim-op arguments must be *fully* evaluated
    (prim:mul n n))))
)
((? square) 3)
)
`);

assert.deepStrictEqual(example_machine.run(), { v: 9 });
```

