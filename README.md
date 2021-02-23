# precursor-ts

A call-by-push-value language and interpreter that you can embed in Typescript
programs.

# use it right now

[A live demonstration of Precursor in your browser.](https://niltag.net/code/precursor)

You can run tests and build the Javascript distribution from the typescript -
and, in fact, must - simply by running:

```
npm i
```

# overview

Precursor is a small programming language implemented in pure Typescript which
you can embed in other applications.

## what?

Just look, this is what you can do with it:

```javascript
import { CESKM, parse_cbpv } from "precursor-ts";
import { strict as assert } from "assert";

let thirteen_factorial = new CESKM(parse_cbpv(`
(letrec (
  (thirteen (λ ()
    (let twelve (reset
      (let three-then-six (shift times-2
        (let six (times-2 3)
        (times-2 six)))
      (prim-mul 2 three-then-six)))
    (prim-add twelve 1))))
  (factorial (λ (n) (letrec (
    (help (λ (n total)
      (let n (? n)
      (if (prim-lt n 2)
        total
        ((? help) (prim-sub n 1) (prim-mul n total)))))))
    ((? help) n 1))))
)
((? factorial) (! ((? thirteen))))
)
`)).run().v;

assert(thirteen_factorial===6227020800);
```

## what's included

- a *CESKM* stack-based virtual machine;
- an expression language implemented as Plain Old JSON™ data, which is executed
  by the VM and is a good target for transpiling; and
- an extremely plagiarized parser for a rudimentary lisp-y language syntax.

The idea is that this VM is useful as a transpiler target for applications
which want to include some scripting ability; if you're cool with the default
language, then this package contains everything you need.

Otherwise, have a look at `src/grammar.ts` to see the `Cbpv` expression data
type that the VM executions as well as its smart constructors.

# What language is this?

It's one I'm working on.
I call this version *precursor* because

- it's kind of a testbed for language experimenting and
- you can supply your own surface language that transpiles to this, that's fine
  too and expected in the design.

**Call-by-push-value** is, intuitively, a foundation for programming languages
where *evaluation of terms* and *creation of closures* are primitive operations
up to the programmer: *suspend* (written `!`) and *resume* (written `?`).

CBPV has several theoretical advantages in helping programmers safely define,
compose, and reason about side effects an intuitive way, because of
those suspension/resumption and delimited control operators.

CBPV *also* has a natural interpretation with linear types, so all the exciting
benefits of Rust are **theoretically** available to Precursor.

You know, eventually.

# Is it typed?

*Yes*, in the sense that there is a coherent type discipline that, if you
follow it, Should™ steer you away from runtime exceptions.
Specifically, the target type system is *liner call-by-push-value with
delimited control and graded coeffects.*

Forgive me, but this may be the first language attempting to combine all these
features.

*Call-by-push-value* is perhaps interesting because term evaluation is
explicitly noted in the type system; I hope to take advantage of this.
