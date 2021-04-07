# precursor-ts

Precursor is a small, experimental programming language implemented as a pure
TypeScript (or pure JavaScript) library.

You can read more details below in the *overview*, and you can even
[try it out in a live demonstration in your browser][precursordemo].

[precursordemo]: https://niltag.net/code/precursor

Licensed under the `GPL-3` where it can be, and the `WTFPL` elsewhere.

# build and install from source

You can run tests and build the Javascript distribution from the typescript -
and, in fact, must - simply by running:

```shell
npm i
```

# synopsis

## an attempt with words

Precursor is a small programming language which you may grow and build upon (a
*precursor*, if you like).

The default distribution consists of 3 components which work together "out of
the box":

- a small [**call-by-push-value**][cbpvarticle] language, `Cbpv`, defined as a
  data type that you can manipulate in code (`grammar.ts`);
- a [CESK][cekarticle]-based evaluator which operates on `Cbpv` objects
  (`ceskm.ts`) ;
- a parser for an [s-expression][sexprarticle] syntax, which parses source code
  `string`s into `Cbpv` values(`parser.ts`).

[cekarticle]: https://en.wikipedia.org/wiki/CEK_Machine
[cbpvarticle]: https://en.wikipedia.org/wiki/Call-by-push-value
[sexprarticle]: https://en.wikipedia.org/wiki/S-expression

You can see examples of the syntax parsed by the default parser in
`__tests__/index.test.ts`.

## example

The following is an example usage of Precursor.
We will use the parser that comes with the library, and create an evaluator
that can compute with `number`, `boolean`, and `null` values.

First, we sub-class `CESKM` and specify the values our machine can work with.

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

Now we must override the methods `literal` and `primop`.

`literal` defines how "literal" values are to be converted into `Value`s.
A literal is something like a number (eg, `42`), `"doubly quoted string"`, or
boolean `#t`rue `#f`alse symbols.
You decide which of these to accept and how to evaluate them literally.

```typescript
  protected literal(v: any): Value<Val> {
    if ("number" === typeof v
     || "boolean" === typeof v
     || null === v)
      { return { v }; }
    throw new Error(`${v} not a primitive value`);
  }
```

`primop` defines the *primitive operations* ("primops") your machine can
perform on `Value`s.
The `CESKM` base class defines no primops: by default, the machine can only
"do" what you permit it to do.

*Aside*: The built-in parser, by convention, treats all symbols beginning with
`prim:` as primitive operators, eg:

```
(prim:mul 1 2)

    =>

{
  "tag": "cbpv_primop",
  "op": "prim:mul",
  "erands": [
    {
      "tag": "cbpv_literal",
      "v": 1
    },
    {
      "tag": "cbpv_literal",
      "v": 2
    }
  ]
}
```

There is no brilliant reason for this, it just keeps the interaction between
the parser and the evaluator simple in lieu of a more principled mechanism.

```typescript
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
You can write functions that call primops and pass *those* around all day.

---

Having supplied the universe of result types and filled in how they relate to
literal expressions and what primitive operators are defined for them, you can
`run` your machine down to a `Value<Result>`.

```typescript
const example_machine = new ExampleMachine(`
(letrec (
  (square (λ (n)
    (let n (? n)      ; prim-op arguments must be *fully* evaluated.
    (prim:mul n n)))) ; higher level languages might not expose primops
)                     ; directly.

((? square) 3) ; a function defined in a `letrec` is automatically
               ; "suspended" and must be "resumed" with `?` before
               ; applying it to arguments (in this case, `3`).
)
`);

assert.deepStrictEqual(example_machine.run(), { v: 9 });
```

# questions / comments

You can submit bugs through the Issues feature at
https://github.com/gatlin/precursor-ts .

As well you may email me at `gatlin+precursor@niltag.net`.
I reserve the right to be terrible at replying; you should absolutely not take
it personally.
