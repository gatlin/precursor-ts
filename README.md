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

What follows is my best attempt at a summary for anyone who wanders into this
repository and wants to know how to find out more.
I think the best way to get a feel for its usage is to take a look at the unit
tests in the `__tests__` directory.

---

Precursor is a small programming language which you may grow and build upon (a
"precursor," if you like).

The default distribution consists of 3 components which work together "out of
the box".

## *CESKM* Evaluator

`ceskm.ts` defines a CESKM [machine][cekarticle] to evaluate Precursor.
It is called a *CESKM* machine because it consists of five components:

- **c**ontrol-string, the program expression being evaluated;
- **e**nvironment, a mapping from variable names to *addresses* or
  *definitions*;
- **s**tore, a subsequent mapping from *addresses* to ***values***;
- **k**ontinuation, the current [continuation][contarticle]; and
- **m**eta stack, a control stack used in tandem with the continuation.

[cekarticle]: https://en.wikipedia.org/wiki/CEK_Machine
[contarticle]: https://en.wikipedia.org/wiki/Continuation

The language grammar (below) can ultimately be thought of as the operating
instructions for this machine.

The objective of a CESKM machine is to evaluate the **c**ontrol string down to
a value.
Precursor (currently) defines the following language of values, meant to
resemble JSON primitives (modified slightly for presentation):

```typescript
type Value
  = { tag: 'closure', exp: Cbpv, env: Env }
  | { tag: 'continuation', kont: Kont }
  | { tag: 'number', v: number }
  | { tag: 'boolean', v: boolean }
  | { tag: 'string' , v: string }
  | { tag: 'record' , v: Record<string, Value> }
  | { tag: 'array' , v: Value[] };
```

In addition to numbers, booleans, strings, records, and arrays, we have

- *closures*: ongoing computations with a closed environment which have more
  work to be done before they can produce a result `Value`, created with the
  `!` operator (see `Grammar`); and
- *continuations*: continuations can be bound to variables using `shift`, and
  this is what is inside that variable. If you don't know what a continuation
  is, I refer you to the [article on the subject above][contarticle].

### Step by step

The base class implements a protected method `step` which "purely" acts on a
*state* value consisting of the five components listed above.
The output of each `step` is used as the input to the next `step`; evaluation
terminates when `step` returns a `Value` type instead.

The public method `run` implements this algorithm, but you are free to override
it or supplement it with your own (for instance, you might want a "debug mode"
where the machine yields each state to a logging system for review).

## Grammar

`grammar.ts` defines the Precursor grammar, `Cbpv`, as a plain-old-JSON type.
Here is that definition, modified slightly for presentation.

```typescript
type Cbpv
  /* Positive */
  = { tag: 'cbpv_number' ; v: number }    // eg, 5
  | { tag: 'cbpv_boolean' ; v: boolean }  // #t, #f
  | { tag: 'cbpv_string' ; v: string }    // "double-quotes only"
  | { tag: 'cbpv_symbol' ; v: string }    // immutable
  | { tag: 'cbpv_primop' ; op: string; erands: Cbpv[] } // see below
  | { tag: 'cbpv_suspend'; exp: Cbpv }
  /* Negative */
  | { tag: 'cbpv_apply'; op: Cbpv; erands: Cbpv[] } // eg, (op arg1 arg2)
  | { tag: 'cbpv_abstract'; args: string[]; body: Cbpv } // eg, (λ (x) (...))
  | { tag: 'cbpv_let'; v: string; exp: Cbpv; body: Cbpv } // (let x 5 (...))
  | { tag: 'cbpv_letrec'; bindings: [string,Cbpv][]; body: Cbpv } // see below
  | { tag: 'cbpv_if'; c: Cbpv; t: Cbpv; e : Cbpv } //the author is iffy on this one
  | { tag: 'cbpv_resume'; v: Cbpv } // weird
  | { tag: 'cbpv_reset'; exp: Cbpv } // weird
  | { tag: 'cbpv_shift'; karg: string; body: Cbpv } // weird
  ;
```

`Cbpv` stands for [*call-by-push-value*][cbpvarticle], a language foundation
which is neither lazy **nor** strict.
Instead, term evaluation is handled explicitly by two operators: `!`
("suspend") and `?` ("resume").

[cbpvarticle]: https://en.wikipedia.org/wiki/Call-by-push-value

### A polarizing subject

In call-by-push-value terms are sorted into two (for lack of a better word, oy)
kinds:

*Positive* terms are data: terms which require no further evaluation or work by
the machine in order to render as result values.
Literals (numbers, strings, booleans, etc), variables, and *primops* are all
positive.

*Primitive operators* ("primops") are basic operations that the Precursor
machine can perform on data.
You might think of them as the basic instruction set for a CPU.
By default the `CESKM` class defines a handful of primops to manipulate the
basic data types but it is easy (and expected and encouraged) for you to add
your own; see the unit tests for a concrete example!

*Negative* terms are those which express some **irreversible** work to be done.
For example, function abstraction (`cbpv_abstract` above) pops the top frame
from the argument stack; function application pushes a frame on it and
evaluates its (negative) operator; an `if` expression essentially chooses
between two continuations and throws one away; etc.

`!` *suspends* a negative ("active," "ongoing") computation into a closure
value; `?` *resumes* suspended computations in order to evaluate them.

### To be continued

`shift` and `reset` are [delimited continuation][delimccarticle] operators.
A *continuation* is an abstract representation of the control state of the
program (according to Wikipedia).
It represents a point in the computation with a specified amount of remaining
work.

[delimccarticle]: https://en.wikipedia.org/wiki/Delimited_continuation

When handled with care, these four operators are very powerful:

```
(letrec (
  (load (λ () (shift k
    (! (λ (f) ((? (prim:record-get "load" f)) k))))))

  (save (λ (v) (shift k
    (! (λ (f) ((? (prim:record-get "save" f)) v k))))))

  (return (λ (x) (shift k
    (! (λ (_) (? x))))))

  (run-state (λ (st comp)
    (let handle (reset (? comp))
    ((? handle) (prim:record-new
      "load" (! (λ (continue)
               (let res (! (continue st))
               ((? run-state) st res))))
      "save" (! (λ (v continue)
               (let res (! (continue _))
               ((? run-state) v res)))))))))

  (increment-state (λ ()
    (let n ((? load))
    (let _ ((? save) (prim:add n 1))
    (let n-plus-1 ((? load))
    ((? return) n-plus-1))))))
)
((? run-state) 255 (! ((? increment-state))))
)
; result: 256
```

`!`, `?`, `shift`, and `reset` are here used to implement a small [effect
system][effectsysarticle], in this case modeling a mutable state effect.

[effectsysarticle]: https://en.wikipedia.org/wiki/Effect_system

There's a lot more to say but not a lot of time!
Hopefully though if you are the sort of person whom this could potentially
excite, you'll be excited by now.

## Parser

Precursor comes with a parser for a small *s-expression* (think lisp) surface
language which builds the `Cbpv` expressions evaluated by `CESKM`.
The `parse_cbpv` function in `parser.ts` can be used without any fuss for
exactly this.

This language is meant to closely mirror the structure of the grammar itself;
it's not supposed to win any awards for usability or ergonomics.
This is why it exists in a separate module and why `CESKM` consumes a custom
data type and not source code directly.

# Questions / Comments / Issues

Feel free to email the author at `gatlin+precursor@niltag.net`.
You may also use the "Issues" feature on GitHub to report any feedback.

