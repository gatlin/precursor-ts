# precursor-ts

Precursor is a small, experimental programming language implemented as a pure
TypeScript (and hence, JavaScript) library.

You can read more details below in the *synopsis*, you can see a working example
(with I/O!) in `examples/iovm.ts`, and you can even
[try it out in a live demonstration in your browser][precursordemo].

[precursordemo]: https://niltag.net/code/precursor

Licensed under the `GPL-3` where it can be, and the `WTFPL` elsewhere.

# documentation

[API documentation & examples may be found here.][precursordocs]

[precursordocs]: //niltag.net/code/precursor/docs

# build and install from source

## install dependencies and run tests

```shell
nvm use # the author recommends nvm!
npm i   # install dependencies
npm t   # run tests
npm run coverage # run tests with coverage
```

## build the javascript distribution

```shell
npm run build
```

This produces two versions of the library, one each for CommonJS and ES
modules:

```shell
ls dist/cjs # or dist/esm, same file names
ceskm.d.ts  ceskm.js  grammar.d.ts  grammar.js  index.d.ts  index.js  parser.d.ts  parser.js
```

## build the documentation site

```shell
npm run docs
```

# synopsis

```typescript
import { strict as assert } from "assert";
import { CESKM, parse_cbpv, scalar } from "precursor-ts";
import type { Value } from "precursor-ts";

type Base = boolean | null | string | number;
class VM extends CESKM<Base> {
  public run(program: string): Value<Base> {
    let result = this.step(this.inject(parse_cbpv(program)));
    while (!result.done) {
      result = this.step(result.value);
    }
    return result.value;
  }
  protected literal(v: Base): Value<Base> {
    if ("number" === typeof v
     || "boolean" === typeof v
     || "string" === typeof v
     || null === v)
      { return scalar(v); }
    throw new Error(`${v} not a primitive value`);
  }
  protected op(op_sym: string, args: Value<Base>[]): Value<Base> {
    switch (op_sym) {
      case "op:add": {
        if (! ("v" in args[0]) || ! ("v" in args[1]))
          { throw new Error(`arguments must be values`); }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v)
          { throw new Error(`arguments must be numbers`); }
        const result: unknown = args[0].v + args[1].v;
        return scalar(result as Base);
      }
      // ...
      default: return super.op(op_sym,args);
    }
  }
}

const vm = new VM();
try {
  const three = vm.run(`
    (op:add 1 2)
  `);
  assert.deepEqual(three, {
    v: 3
  });
}
catch (e) { console.error(e); }
```

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

You can see examples of the syntax parsed by the default parser, and more
generally how to get started quickly with this library, please consult
[the tests](index.test.ts).

# questions / comments

You can submit bugs through the Issues feature at
https://github.com/gatlin/precursor-ts .

As well you may email me at `gatlin+precursor@niltag.net`.
I reserve the right to be terrible at replying; you should absolutely not take
it personally.
