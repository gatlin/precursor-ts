# precursor-ts

Precursor is a small, experimental programming language implemented as a pure
TypeScript (and hence, JavaScript) library.

You can read more details below in the *synopsis*, you can see a working example
(with I/O!) in `examples/iovm.ts`, and you can even
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
[the tests](index.test.ts).

## example

The following is an example usage of Precursor.
We will use the parser that comes with the library, and create an evaluator
that can compute with `number`, `boolean`, and `null` values.

First, we sub-class `CESKM` and specify the values our machine can work with.
Note that `CESKM` does not 

```typescript
import {
  CESKM,
  Value,
  scalar,
  parse_cbpv // use the pre-fab s-expression parser
} from "precursor-ts";
import { strict as assert } from "assert";

type Base = number | boolean | null ;
class ExampleMachine extends CESKM<Base> {
  public run(program: string): Value<Base> {
    let result = this.step(this.inject(parse_cbpv(program)));
    while (!result.done) {
      result = this.step(result.value);
    }
    return result.value;
  }
```

Now we must override the methods `literal` and `op`.

`literal` defines how "literal" values are to be converted into `Value`s.
A literal is something like a number (eg, `42`), `"doubly quoted string"`, or
boolean `#t`rue `#f`alse symbols.
You decide which of these to accept and how to evaluate them literally.

```typescript
  protected literal(v: Base): Value<Base> {
    if ("number" === typeof v
     || "boolean" === typeof v
     || null === v)
      { return scalar(v); }
    throw new Error(`${v} not a primitive value`);
  }
```

`op` defines the *primitive operations* ("ops") your machine can perform on
`Value`s.
The `CESKM` base class defines no ops: by default, the machine can only "do"
what you permit it to do.

*Aside*: The built-in parser, by convention, treats all symbols beginning with
`op:` as primitive operators, eg:

```
(op:mul 1 2)

    =>

{
  "tag": "cbpv_op",
  "op": "op:mul",
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
  protected op(op_sym: string, args: Value<Base>[]): Value<Base> {
    switch (op_sym) {
      case "op:mul": {
        if (! ("v" in args[0]) || ! ("v" in args[1]))
          { throw new Error(`arguments must be values`); }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v)
          { throw new Error(`arguments must be numbers`); }
        let result: unknown = args[0].v * args[1].v;
        return scalar(result as Base);
      }
      // ... other ops
      default: return super.op(op_sym, args);
    }
  }
}
```

Operators are not complete terms by themselves - they aren't variables you can
pass around as an argument.
Think of them as the "assembly" instructions of your evaluator.
You can write functions that call ops and pass *those* around all day.

---

Having supplied the universe of result types and filled in how they relate to
literal expressions and what primitive operators are defined for them, you can
`run` your machine down to a `Value<Base>`.

Note that we had to write our own `run` method.
You are free to use the one above, as it works and should give a good intuition
for how evaluation works in the machine, but there are
[certainly other evaluation strategies you might pursue](examples/iovm.ts#L313)
Precursor is here to enable you, not constrain you.

```typescript
const example_machine = new ExampleMachine();
const result = example_machine.run(`
(letrec (
  (square (λ (n)
    (let n (? n)      ; op arguments must be *fully* evaluated.
    (op:mul n n))))   ; higher level languages might not expose ops directly.
)

((? square) 3) ; a function defined in a `letrec` is automatically
               ; "suspended" and must be "resumed" with `?` before
               ; applying it to arguments (in this case, `3`).
)
`);

assert.deepEqual(result, { v: 9 });
```

## are there data structures? a type system?

Ultimately I would like to include a type checker for `Cbpv` which supports
*linear call-by-push-value with graded coeffects.*
I'll let you look up the parts of that which interest you.

As for data structures,

1. Nothing yet,
2. look at this:

```typescript
const result = new ExampleMachine().run(`
(letrec (
  (cons (λ (a b) (reset ((shift k k) a b))))
)
(let p1 ((? cons) 3 #f)
p1)
)
`);
console.log(result);
```

This prints the following:

```json
{
  "k": {
    "_args": [
      {
        "v": 3
      },
      {
        "v": false
      }
    ],
    "_k": {}
  }
}
```

This captured a set of arguments being passed to a "function" `(shift k k)` and
converted them into what looks suspiciously like a composite or product value
of some kind.

Stay tuned!

# questions / comments

You can submit bugs through the Issues feature at
https://github.com/gatlin/precursor-ts .

As well you may email me at `gatlin+precursor@niltag.net`.
I reserve the right to be terrible at replying; you should absolutely not take
it personally.
