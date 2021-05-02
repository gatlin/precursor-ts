import {
  CESKM,
  Value,
  State,
  parse_cbpv
} from "../src/index";

// eslint-disable-next-line
type Val = number | boolean | null ;

class DebugMachine<Val> extends CESKM<Val> {
  constructor (program: string) { super(parse_cbpv(program)); }

  /**
   * @method run
   * @returns { Value<Base> } The result value of the control expression.
   */
  public run(): Value<Val> {
    let st: State<Val> = this.make_initial_state();
    while (!this.result) {
      const res = this.step(JSON.parse(JSON.stringify((st))));
      if (!this.result) {
        st = <State<Val>>res; }}
    return this.result; }

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
        return { v: result as Val };
      }
      case "op:add": {
        if (! ("v" in args[0]) || ! ("v" in args[1]))
          { throw new Error(`arguments must be values`); }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v)
          { throw new Error(`arguments must be numbers`); }
        const result: unknown = args[0].v + args[1].v;
        return { v: result as Val };
      }
      case "op:sub": {
        if (! ("v" in args[0]) || ! ("v" in args[1]))
          { throw new Error(`arguments must be values`); }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v)
          { throw new Error(`arguments must be numbers`); }
        const result: unknown = args[0].v - args[1].v;
        return { v: result as Val };
      }
      case "op:div": {
        if (! ("v" in args[0]) || ! ("v" in args[1])) {
          throw new Error(`arguments must be values`);
        }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
          throw new Error(`arguments must be numbers`);
        }
        const result: unknown = args[0].v / args[1].v;
        return { v: result as Val };
      }
      case "op:mod": {
        if (! ("v" in args[0]) || ! ("v" in args[1])) {
          throw new Error(`arguments must be values`);
        }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
          throw new Error(`arguments must be numbers`);
        }
        const result: unknown = args[0].v % args[1].v;
        return { v: result as Val };
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
        return { v: result as Val };
      }
      case "op:lt": {
        if (! ("v" in args[0]) || ! ("v" in args[1])) {
          throw new Error(`arguments must be values`);
        }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
          throw new Error(`arguments must be numbers`);
        }
        const result: unknown = args[0].v < args[1].v;
        return { v: result as Val };
      }
      case "op:lte": {
        if (! ("v" in args[0]) || ! ("v" in args[1])) {
          throw new Error(`arguments must be values`);
        }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
          throw new Error(`arguments must be numbers`);
        }
        const result: unknown = args[0].v <= args[1].v;
        return { v: result as Val };
      }
      case "op:gt": {
        if (! ("v" in args[0]) || ! ("v" in args[1])) {
          throw new Error(`arguments must be values`);
        }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
          throw new Error(`arguments must be numbers`);
        }
        const result: unknown = args[0].v > args[1].v;
        return { v: result as Val };
      }
      case "op:gte": {
        if (! ("v" in args[0]) || ! ("v" in args[1])) {
          throw new Error(`arguments must be values`);
        }
        if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
          throw new Error(`arguments must be numbers`);
        }
        const result: unknown = args[0].v >= args[1].v;
        return { v: result as Val };
      }
      case "op:and": {
        if (! ("v" in args[0]) || ! ("v" in args[1])) {
          throw new Error(`arguments must be values`);
        }
        if ("boolean" !== typeof args[0].v || "boolean" !== typeof args[1].v) {
          throw new Error(`arguments must be booleans`);
        }
        const result: unknown = args[0].v && args[1].v;
        return { v: result as Val };
      }
      case "op:or": {
        if (! ("v" in args[0]) || ! ("v" in args[1])) {
          throw new Error(`arguments must be values`);
        }
        if ("boolean" !== typeof args[0].v || "boolean" !== typeof args[1].v) {
          throw new Error(`arguments must be booleans`);
        }
        const result: unknown = args[0].v || args[1].v;
        return { v: result as Val };
      }
      case "op:not": {
        if (! ("v" in args[0]) ) {
          throw new Error(`argument must be a value`);
        }
        if ("boolean" !== typeof args[0].v) {
          throw new Error(`argument must be a boolean`);
        }
        const result: unknown = !args[0].v;
        return { v: result as Val };
      }
      default: return super.op(op_sym, args);
    }
  }
}

describe("index", () => {
  test('scenario check 1', () => {
    expect(new DebugMachine(`
(letrec (
  (sqr-int (λ (n) (op:mul n n)))
)
((? sqr-int) 69))`).
      run()).
      toStrictEqual({
        v: 4761
    });
  });
  test("scenario check 2", () => {
    expect(new DebugMachine("( (\\ (x) (op:mul x 2)) 210)").
      run()).
      toStrictEqual({
        v: 420
      });
  });

  test("scenario check 3", () => {
    expect(new DebugMachine("(let n (op:add 1 2) (op:mul n 2))").
      run()).
      toStrictEqual({
        v: 6
      });
  });

  test("scenario check 4", () => {
    expect(new DebugMachine(`
(letrec (
  (fact-tailrec (λ (n total)
    (if (op:eq n 2)
      total
      ((? fact-tailrec) (op:sub n 1) (op:mul n total)))))
)
((? fact-tailrec) 10 1)
)
    `).
      run()).
      toStrictEqual({
        v: 1814400
      });
  });

  test("scenario check 5", () => {
    expect(new DebugMachine(`
(letrec (
  (times (λ (a b) (op:mul a b)))
)
((? times) 2 4))
    `).
      run()).
      toStrictEqual({
        v: 8
      });
  });

  test("scenario check 6", () => {
    expect(new DebugMachine(`
(let f (reset (shift k k))
(let n (f (op:add 10 55))
(op:mul 3 n)))
    `).
      run()).
      toStrictEqual({
        v: 195
      });
  });
  test("scenario check 7", () => {
    expect(new DebugMachine(`
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
    `).
      run()).
      toStrictEqual({
        v: 355687428096000
      });
  });
  test('scenario check 8', () => {
    expect(new DebugMachine(`
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
    `).
      run()).
      toStrictEqual({
        v: 911666
      });
  });
  test('scenario check 9', () => {
    expect(new DebugMachine(`
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
    `).
      run()).
      toStrictEqual({
        v: 6
      });
  });
  test('scenario check 10', () => {
    expect(new DebugMachine(`
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
    `).
      run()).
      toStrictEqual({
        v: 911672
      });
  });
  test('scenario check 11', () => {
    const machine = new DebugMachine(`
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
  try {
    const res = machine.run();
    expect(res).
      toStrictEqual({
        v: false
    });
  }
  catch (e) {
    console.error(e);
  }
 });

  test('scenario check 12', () => {
      expect(new DebugMachine(`
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
      `).
        run()).
        toStrictEqual({
          v: 7
        });
  });

  test('scenario check 13', () => {
      expect(new DebugMachine(`
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
      `).
        run()).
        toStrictEqual({
          v: 17
        });
  });

  test('comment test', () => {
    expect(new DebugMachine(`
(letrec ( ; comment 1
  (fact-tailrec (λ (n total)
;comment 2
    (if (op:eq n 2)
      total ; comment 3
      ((? fact-tailrec) (op:sub n 1) (op:mul n total)))))
)
((? fact-tailrec) 10 1) ;; comment 4
)
    `).
      run()).
      toStrictEqual({
        v: 1814400
      });
  });
});

