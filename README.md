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

Here is a sample program which uses this library to parse a small program and
evaluate it to a result.

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
  (factorial (\ (n) (letrec (
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

To help clarify what is going on, here we are evaluating a (silly) Precursor
program in a VM *inside* a JavaScript program.

To help parse what you're looking at, the silly Precursor program consists of
two named parts:

- `thirteen`, which computes the number `13` in an extremely cirumspect and
  ridiculous way; and
- `factorial`, which computes the factorial of its argument.

It then applies `factorial` to the result of `thirteen`.

# real fast - why is this implemented in TS / JS?

1. I want to experiment more with call-by-push-value; the browser provides a
   number of fun capabilities, which makes for a fun setting to explore the
   separation of effect handlers from their operators, etc;

2. JS is everywhere, and since time is a flat circle it's only a matter of time
   until we want to embed constrained, instrumentable interpreters in JS. Let's
   just accept the reality we live in and do it *right* this time, by working
   with a language foundation that doesn't prescribe any particular evaluation
   semantics.

3. CBPV has a natural interpretation in a linear type system, making it
   (potentially, theoretically) exciting for all the reasons Rust is exciting;

   3.1 Also quantum computing is a linearly typed (symmetric monoidal closed
   category) affair so I mean hey I'm just asking questions.

# what's inside

Precursor consists of (and exports) several parts:

- an abstract, call-by-push-value expression language `Cbpv` (from
  `grammar.ts`);

- a pure TypeScript `CESKM` virtual machine; `CESKM` is an acronym for its five
  components:
  - the **c**ontrol expression currently under evaluation;
  - the **e**nvironment mapping symbols to either *addresses* or expression
    *definitions* (analogous to a "stack" memory);
  - the **s**tore which maps *addresses* to `Value`s (analogous to a "heap"
    memory);
  - the current **k**ontinuation representing the state of the program and the
    remainder of the work to be done; and finally
  - the **m**eta-kontinuation, a LIFO stack of continuations; articulating its
    use better is a personal goal of the author's.

- an **extremely plagiarized** parser for an s-expression ("lispy") source
  language so that at least one exists. Precursor is carefully designed to
  work in terms of `Cbpv` values, not any given source language. Compile it
  down from Java for all I care.

- a simple type for `Value`s, which represent the results of program evaluation
  (by definition).

- a mechanism for extending the builtin *primitive operators* ("primops")
  provided by the machine; one can think of a Precursor program as a telling a
  `CESKM` how to orchestrate its primops.

## Built-in primops

By default the following primops are supported by the language.
The `prim-` prefix is purely a convention: the goal was to provide a useful,
non-controversial, simple set of operators which are deliberately namespaced in
a clunky manner client code is not likely to want for itself.

The built-in primops are as follows:

```
prim-mul : number x number -> number
prim-add : number x number -> number
prim-sub : number x number -> number
prim-div : number x number -> number
prim-eq  : ∀ t. t x t -> boolean
prim-lt  : number x number -> boolean
prim-gt  : number x number -> boolean
prim-lte : number x number -> boolean
prim-gte : number x number -> boolean
prim-and : boolean x boolean -> boolean
prim-or  : boolean x boolean -> boolean
prim-not : boolean -> boolean
```

The live demo site [itself extends `CESKM`][demoextendexample] provides an
example of how simple it is, in practice, to add your own primops.
Paraphrased here:

```javascript
class DemoMachine extends CESKM {
  primop(op_sim, args) {
    switch (op_sym) {
      case 'prim-mod': {
        if ("NumV" === args[0].tag && "NumV" === args[1].tag) {
          return { tag: "NumV", v: args[0].v % args[1].v }; }
        break; }
      case 'prim-xor': {
        if ("BoolV" === args[0].tag && "BoolV" === args[1].tag) {
          return { tag: "BoolV", v: args[0].v ^ args[1].v }; }
        break; }
      default: return super.primop(op_sym, args); }
    throw new Error(`invalid primop: ${op_sym}`); } }
```

[demoextendexample]: https://github.com/gatlin/precursor-site/blob/main/src/main.js 

## The grammar

The virtual machine is defined in terms of, but separately from, the
*call-by-push-value* `Cbpv` grammar type, in the `grammar.ts` module.

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

For example, here is an implementation of a state effect handler and two
operators (`load` and `save`, because "get" and "put" are *so* passé):

```
(letrec (
  (load (λ () (shift k
    (! (λ (l _) ((? l) k))))))

  (save (λ (new-state) (shift k
    (! (λ (_ s) ((? s) new-state k))))))

  (return (λ (x) (shift k
    (! (λ (_ _) (? x))))))

  (run-state (λ (state comp)
    (let handle (reset (? comp))
    ((? handle)
       (! (λ (k)
         (let result (! (k state))
         ((? run-state) state result))))
       (! (λ (new-state k)
         (let result (! (k _))
         ((? run-state) new-state result))))))))

  (increment-state (λ ()
    (let n ((? load))
    (let _ ((? save) (prim-add n 1))
    (let n-plus-1 ((? load))
    ((? return) n-plus-1))))))
)
((? run-state) 255 (! ((? increment-state))))
)
```

This would evaluate to the following `Value`:

```JSON
{ "tag": "NumV", v: 256 }
```

Thanks to CBPV, algebraic effect handling has a really simple implementation.

### Linear types!

CBPV *also* has a natural interpretation with linear types, so all the exciting
benefits of Rust are **theoretically** available to Precursor.

[You can read more about linear call-by-push-value from smarter people.][lcbpv]

[lcbpv]: https://www.irif.fr/~saurin/Enseignement/LMFI/2018-19/presentation-articles/llcbpv.pdf 

Speaking of that ...

# Is it typed?

*Yes*, in the sense that there is a coherent type discipline that, if you
follow it, Should™ steer you away from runtime exceptions.
Specifically, the target type system is *liner call-by-push-value with
delimited control and graded coeffects.*

Forgive me, but this may be the first language attempting to combine all these
features, so I am going to have give the type checker a little thought. `:-)`

One reason CBPV is interesting is *because* term evaluation has consequences in
the types. This is **cool** and **good**.

# Questions / Comments / Etc

Email me at `gatlin+precursor@niltag.net`.
You may also officially report issues or other feedback using the Github Issues
feature.
And PRs are always welcome, though I reserve the right to reject submissions
that hurt my pride.
