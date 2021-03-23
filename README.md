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

# overview

Precursor is a little self-contained programming language exported as a handful
of independent components which come ready to be used together:

- a *call-by-push-value* interpreter, implemented in pure ~~JavaScript~~
  TypeScript as a *CESKM* machine (in `ceskm.ts`);

- a simple data type representing the input language for the *CESKM* machine,
  `Cbpv` (exported along with smart constructors from `grammar.ts`); and

- an extremely plagiarized, extremely utilitarian parser for an
  **s-expression** (read: "lispy") surface syntax which produces `Cbpv` values,
  ready for evaluation by the *CESKM* machine.

Here is an example usage, followed by a more granular breakdown.

```javascript
import { CESKM, parse_cbpv, numval } from "precursor-ts";

class Machine extends CESKM {

  // just use the pre-fab s-expression parser
  constructor(program) { super(parse_cbpv(program)); }
  primop(op_sym, args) {
    switch (op_sym) {
      case "prim:mod": {
        if ("NumV" === args[0].tag && "NumV" === args[1].tag) {
          return numval(args[0].v % args[1].v);
        }
        break;
      }
      default: return super.primop(op_sym, args);
    }
  }
}

let machine = new Machine(`
(letrec (
  (is-even (λ (n)
    (let n (? n)
    (prim:eq 0 (prim:mod n 2)))))
)
((? is-even) 10))
`);

console.log(machine.run());
```

This will print the following to the console:

```json
{
  "tag": "BoolV",
  "v": true
}
```

## The language

Precursor is in some sense a "meta-language," the sort of thing that an
interpreter or compiler might define for internal usage.
It is intentionally minimal; part of why I created it is to explore what can be
done with one particular minimal-ish set of primitives I have encountered.

**Call-by-push-value** is a language foundation that generalizes both *lazy*
and *strict* evaluation strategies.
As the basis for Precursor it allows the programmer complete control over term
evaluation.
This turns out to be *very* useful.

### Comments

Any semicolon (`;`) not inside of a string signals a *comment*, meaning all the
text between it and the next end-of-line character will be ignored.

```
(let x 5 ; this annotation will be ignored
((? foo) x) ; ...
)
```

### Positive terms

TBD

#### Numbers, booleans, and strings

Because this is a language implemented in JavaScript, the basic literal values
are numbers, booleans, and strings, as defined by the JSON spec.

```
(let n 5
(let s "hello"
(let b #t
; etc ...
)))
```

#### Symbols ("variables")

As seen above, you can bind values to *symbols*.
These are immutable; precursor has no native concept of mutation.

(Don't worry, we thought about this! We like getting ~~sh~~stuff done too!)

#### "primops"

Ultimately, the *primitive operations* Precursor can perform on values are
defined as "primops," implemented via the `primop` method on the `CESKM` class.
A number of default primops are defined, in a namespace the author feels nobody
is likely to be clamoring for, and you are free to override the method however
you see fit.

A primop by itself is **not** a value: it cannot be passed as an argument or
anything.
However, it *can* be applied to its arguments; this **application** of a primop
to its arguments is a value term:

```
(let three (prim:add 1 2)
((? foo) three))
```

Above, `(prim:add 1 2)` is a self-contained value-term that can be (and is)
bound to a symbol.

*This may seem strange; there is a method to the madness but I have to write
one thing at a time!*

#### Suspensions

### Negative terms

TBD

## *CESKM* machine

A *CESKM* machine is an abstract machine with the following five components,
hence its name:

- a **c**ontrol-string, the current expression being evaluated;
- an **e**nvironment mapping symbols to either *addresses* or *definitions*
  (more control strings);
- a **s**tore mapping the above *addresses* to *values*;
- the current **k**ontinuation storing the remainder of the computation to be
  performed (trippy, huh?); and
- the **m**eta stack, used by the machine to juggle continuations for effect
  handling and flow control, among other things.

This implementation is optimized for *correctness*, *readability*, and
*simplicity*.
It certainly has room for improvement and optimization.
One attractive quality, however, is that the evaluation algorithm is rendered
as a pure value transformation on the CESKM state 5-tuple defined above.
The practical distinction between *positive* and *negative* terms is made
immediately clear, and the nuances surrounding *values* versus *terms* are
illuminated in the separate definitions of `Value` and `Cbpv` and `Kont`, et
al.

The `step` method represents a single irreversible transformation of the
machine state.
The default implementation evaluates a term by constructing an initial state
around the term and then calling `step` in a loop until it returns a `Value`
and not a subsequent `State` (see `CESKM#run` in `ceskm.ts`).

This is done purposefully to accommodate creative extension:

TBD precursor site example


