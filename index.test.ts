import {
  CESKM,
  Value,
  parse_cbpv,
  scalar
} from "./src/index";
import { test } from "tap";

// eslint-disable-next-line
type Val = number | boolean | null ;

class DebugMachine<Val> extends CESKM<Val> {

  public run(program: string): Value<Val> {
    let result = this.step(this.inject(parse_cbpv(program)));
    while (!result.done) {
      result = this.step(result.value);
    }
    return result.value;
  }

  protected literal(v: Val): Value<Val> {
    if ("number" === typeof v
     || "boolean" === typeof v
     || null === v)
      { return { v }; }
    throw new Error(`${v} not a primitive value`);
  }

  protected op(op_sym: string, args: Value<Val>[]): Value<Val> {
    switch (op_sym) {
      case "op:mul": {
        if (! ("v" in args[0]) || ! ("v" in args[1]))
          { throw new Error(`arguments must be values`); }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v)
          { throw new Error(`arguments must be numbers`); }
        const result: unknown = args[0].v * args[1].v;
        return scalar(result as Val);
      }
      case "op:add": {
        if (! ("v" in args[0]) || ! ("v" in args[1]))
          { throw new Error(`arguments must be values`); }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v)
          { throw new Error(`arguments must be numbers`); }
        const result: unknown = args[0].v + args[1].v;
        return scalar(result as Val);
      }
      case "op:sub": {
        if (! ("v" in args[0]) || ! ("v" in args[1]))
          { throw new Error(`arguments must be values`); }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v)
          { throw new Error(`arguments must be numbers`); }
        const result: unknown = args[0].v - args[1].v;
        return scalar(result as Val);
      }
      case "op:div": {
        if (! ("v" in args[0]) || ! ("v" in args[1])) {
          throw new Error(`arguments must be values`);
        }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
          throw new Error(`arguments must be numbers`);
        }
        const result: unknown = args[0].v / args[1].v;
        return scalar(result as Val);
      }
      case "op:mod": {
        if (! ("v" in args[0]) || ! ("v" in args[1])) {
          throw new Error(`arguments must be values`);
        }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
          throw new Error(`arguments must be numbers`);
        }
        const result: unknown = args[0].v % args[1].v;
        return scalar(result as Val);
      }
      case "op:eq": {
        if (! ("v" in args[0]) || ! ("v" in args[1])) {
          throw new Error(`arguments must be values`);
        }
        if (("number" !== typeof args[0].v || "number" !== typeof args[1].v)
         && ("boolean" !== typeof args[0].v || "boolean" !== typeof args[1].v) ) {
          throw new Error(`arguments must be numbers or booleans`);
        }
        const result: unknown = args[0].v === args[1].v;
        return scalar(result as Val);
      }
      case "op:lt": {
        if (! ("v" in args[0]) || ! ("v" in args[1])) {
          throw new Error(`arguments must be values`);
        }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
          throw new Error(`arguments must be numbers`);
        }
        const result: unknown = args[0].v < args[1].v;
        return scalar(result as Val);
      }
      case "op:lte": {
        if (! ("v" in args[0]) || ! ("v" in args[1])) {
          throw new Error(`arguments must be values`);
        }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
          throw new Error(`arguments must be numbers`);
        }
        const result: unknown = args[0].v <= args[1].v;
        return scalar(result as Val);
      }
      case "op:gt": {
        if (! ("v" in args[0]) || ! ("v" in args[1])) {
          throw new Error(`arguments must be values`);
        }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
          throw new Error(`arguments must be numbers`);
        }
        const result: unknown = args[0].v > args[1].v;
        return scalar(result as Val);
      }
      case "op:gte": {
        if (! ("v" in args[0]) || ! ("v" in args[1])) {
          throw new Error(`arguments must be values`);
        }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
          throw new Error(`arguments must be numbers`);
        }
        const result: unknown = args[0].v >= args[1].v;
        return scalar(result as Val);
      }
      case "op:and": {
        if (! ("v" in args[0]) || ! ("v" in args[1])) {
          throw new Error(`arguments must be values`);
        }
        if ("boolean" !== typeof args[0].v || "boolean" !== typeof args[1].v) {
          throw new Error(`arguments must be booleans`);
        }
        const result: unknown = args[0].v && args[1].v;
        return scalar(result as Val);
      }
      case "op:or": {
        if (! ("v" in args[0]) || ! ("v" in args[1])) {
          throw new Error(`arguments must be values`);
        }
        if ("boolean" !== typeof args[0].v || "boolean" !== typeof args[1].v) {
          throw new Error(`arguments must be booleans`);
        }
        const result: unknown = args[0].v || args[1].v;
        return scalar(result as Val);
      }
      case "op:not": {
        if (! ("v" in args[0]) ) {
          throw new Error(`argument must be a value`);
        }
        if ("boolean" !== typeof args[0].v) {
          throw new Error(`argument must be a boolean`);
        }
        const result: unknown = !args[0].v;
        return scalar(result as Val);
      }
      default: return super.op(op_sym, args);
    }
  }
}

test('scenario check 1', (t) => {
  const result = new DebugMachine().run(`
(letrec (
  (sqr-int (λ (n) (op:mul n n)))
)
((? sqr-int) 69))
`);
  t.same(result, {
    v: 4761
  });
  t.end();
});

test("scenario check 2", (t) => {
    const result = new DebugMachine().run("( (\\ (x) (op:mul x 2)) 210)");
    t.same(result, {
      v: 420
    });
    t.end();
});

test("scenario check 3", (t) => {
  const result = new DebugMachine().run("(let n (op:add 1 2) (op:mul n 2))");
  t.same(result, {
    v: 6
  });
  t.end();
});

test("scenario check 4", (t) => {
  const result = new DebugMachine().run(`
(letrec (
  (fact-tailrec (λ (n total)
    (if (op:eq n 2)
      total
      ((? fact-tailrec) (op:sub n 1) (op:mul n total)))))
)
((? fact-tailrec) 10 1)
)
`);
  t.same(result,{
    v: 1814400
  });
  t.end();
});

test("scenario check 5", (t) => {
  const result = new DebugMachine().run(`
(letrec (
  (times (λ (a b) (op:mul a b)))
)
((? times) 2 4))
`);
  t.same(result,{
    v: 8
  });
  t.end();
});

test("scenario check 6", (t) => {
  const result = new DebugMachine().run(`
(let f (reset (shift k k))
(let n (f (op:add 10 55))
(op:mul 3 n)))
`);
  t.same(result, {
    v: 195
  });
  t.end();
});

test("scenario check 7", (t) => {
  const result = new DebugMachine().run(`
(letrec (
  (seventeen (λ ()
    (let sixteen (reset
      (let four-then-eight (shift times-2
        (let eight (times-2 4)
        (times-2 eight)))
      (op:mul 2 four-then-eight)))
    (op:add sixteen 1))))
  (fact (λ (n) (letrec (
    (help (λ (n total)
      (let n (? n)
      (if (op:lt n 2)
        total
        ((? help) (op:sub n 1) (op:mul n total)))))))
    ((? help) n 1))))
)
((? fact) (! ((? seventeen))))
)
`);
  t.same(result, {
    v: 355687428096000
  });
  t.end();
});

test('scenario check 8', (t) => {
  const result = new DebugMachine().run(`
(letrec (
  (make-reducer (λ (initial-value) (letrec (
    (loop (λ (total first-run) (reset
      (let n (shift k k)
      (if (op:and
            (op:eq n 0)
            (op:not first-run))
        total
        ((? loop) (op:add n total) #f  ))))))
    )
    ((? loop) initial-value #t)
  )))
)
(let the-reducer ((? make-reducer) 911177)
(let the-reducer (the-reducer 69)
(let the-reducer (the-reducer 420)
(the-reducer 0))))
)
`);
  t.same(result,{
    v: 911666
  });
  t.end();
});

test('scenario check 9', (t) => {
  const result = new DebugMachine().run(`
(letrec (
  (yield (λ (value) (shift k (! (λ (p) ((? p) value k))))))
  (next (λ (gen)
    (let k ( (? gen) (! (λ (a b) b)))
    (k _))))
  (peek (λ (gen)
    ( (? gen) (! (λ (a b) a)))))
  )
(let gen (reset
  (let _ ((? yield) 1)
  (let _ ((? yield) 2)
         ((? yield) 3))))
(let n1 ((? peek) gen)
(let gen ((? next) gen)
(let n2 ((? peek) gen)
(let gen ((? next) gen)
(let n3 ((? peek) gen)
(op:add (op:add n1 n2) n3)))))))
)
`);
  t.same(result,{
    v: 6
  });
  t.end();
});

test('scenario check 10', (t) => {
  const result = new DebugMachine().run(`
(letrec (

  (yield (λ (value) (shift k (! (λ (p) ((? p) value k))))))
  (next (λ (gen)
    (let k ( (? gen) (! (λ (a b) b)))
    (k _))))
  (peek (λ (gen)
    ( (? gen) (! (λ (a b) a)))))

  (make-reducer (λ (initial-value) (letrec (
    (loop (λ (total first-run) (reset
      (let n (shift k k)
      (let n (? n)
      (if (op:and
            (op:eq n 0)
            (op:not first-run))
        total
        ((? loop) (op:add n total) #f  )))))))
    )
    ((? loop) initial-value #t)
  )))
  )
(let the-reducer ((? make-reducer) 911177)
(let the-reducer (the-reducer 69)
(let the-reducer (the-reducer 420)
(let n (the-reducer 0)

(let gen (reset
  (let _ ((? yield) 1)
  (let _ ((? yield) 2)
         ((? yield) 3))))
(let n1 ((? peek) gen)
(let gen ((? next) gen)
(let n2 ((? peek) gen)
(let gen ((? next) gen)
(let n3 ((? peek) gen)
(op:add (op:add n1 n2) (op:add n3 n))))))))))))
)
`);
  t.same(result, {
    v: 911672
  });
  t.end();
});

test('scenario check 11', (t) => {
  const machine = new DebugMachine();
  try {
    const res = machine.run(`
(letrec (
  (pair (\\ (a b)
    (! (\\ (p) ((? p) a b)))))
  (pair-fst (\\ (p)
    ((? p) (! (\\ (a b) a)))))
  (pair-snd (\\ (p)
    ((? p) (! (\\ (a b) b)))))
  (is-even (\\ (n)
    (let n (? n)
    (op:eq 0 (op:mod n 2)))))
)
(let p1 ((? pair) 3 is-even)
(let num ((? pair-fst) p1)
(let fn ((? pair-snd) p1)
((? fn) num) )))
)
`);
    t.same(res, {
      v: false
    });
  }
  catch (e) {
    console.error(e);
  }
  finally {
    t.end();
  }
});

test('scenario check 12', (t) => {
  const result = new DebugMachine().run(`
(letrec (
  (foldr (λ (c e xs)
    (let xs (? xs)
    ( (? xs) c e ) )))

  (nil (λ () (! (λ (c e) e))))

  (cons (λ (x xs) (! (λ (c e)
    ( (? c)
        x
        (! ( (? foldr)
               c
               e
               xs )))))))

)
(let list-1
  (! ((? nil)))
( (? foldr)
    (! (λ (a b)
      (let a (? a)
      (let b (? b)
      (op:add a b)))))
    7
    list-1 ))
)
`);
  t.same(result,{
    v: 7
  });
  t.end();
});

test('scenario check 13', (t) => {
  const result = new DebugMachine().run(`
(letrec (
  (foldr (λ (c e xs)
    (let xs (? xs)
    ( (? xs) c e ) )))

  (nil (λ () (! (λ (c e) e))))

  (cons (λ (x xs) (! (λ (c e)
    ( (? c)
        x
        (! ( (? foldr)
               c
               e
               xs )))))))

)
(let list-1
  (! ((? cons) 10
  (! ((? nil)))))
( (? foldr)
    (! (λ (a b)
      (let a (? a)
      (let b (? b)
      (op:add a b)))))
    7
    list-1 ))
)
      `);
  t.same(result, {
    v: 17
  });
  t.end();
});

test('comment test', (t) => {
  const result = new DebugMachine().run(`
(letrec ( ; comment 1
  (fact-tailrec (λ (n total)
;comment 2
    (if (op:eq n 2)
      total ; comment 3
      ((? fact-tailrec) (op:sub n 1) (op:mul n total)))))
)
((? fact-tailrec) 10 1) ;; comment 4
)
    `);
  t.same(result, {
    v: 1814400
  });
  t.end();
});

