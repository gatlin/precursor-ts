import {
  CESKM,
  Value,
  Kont,
  Parser,
  build_cbpv,
  parse_cbpv
} from "../src/index";

class DebugMachine extends CESKM {
  constructor (program: string) { super(parse_cbpv(program)); }
  protected primop(op_sym: string, args: Value[]): Value {
    switch (op_sym) {
      case 'prim-mod': {
        if ('NumV' === args[0].tag && 'NumV' === args[1].tag) {
          return { tag: 'NumV', v: args[0].v % args[1].v };
        }
      }
      default: return super.primop(op_sym, args);
    }
  }
}

describe('index', () => {
  test('sanity check 1', () => {
    expect(new DebugMachine(`
(letrec (
  (sqr-int (λ (n) (prim-mul n n)))
)
((? sqr-int) 69))`).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 4761
    });
  });
  test('sanity check 2', () => {
    expect(new DebugMachine("( (\\ (x) (prim-mul x 2)) 210)").
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 420
      });
  });

  test('sanity check 3', () => {
    expect(new DebugMachine("(let n (prim-add 1 2) (prim-mul n 2))").
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 6
      });
  });

  test('sanity check 4', () => {
    expect(new DebugMachine(`
(letrec (
  (fact-tailrec (λ (n total)
    (if (prim-eq n 2)
      total
      ((? fact-tailrec) (prim-sub n 1) (prim-mul n total)))))
)
((? fact-tailrec) 10 1)
)
    `).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 1814400
      });
  });

  test('sanity check 5', () => {
    expect(new DebugMachine(`
(letrec (
  (times (λ (a b) (prim-mul a b)))
)
((? times) 2 4))
    `).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 8
      });
  });

  test('sanity check 6', () => {
    expect(new DebugMachine(`
(let f (reset (shift k k))
(let n (f (prim-add 10 55))
(prim-mul 3 n)))
    `).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 195
      });
  });
  test('sanity check 7', () => {
    expect(new DebugMachine(`
(letrec (
  (seventeen (λ ()
    (let sixteen (reset
      (let four-then-eight (shift times-2
        (let eight (times-2 4)
        (times-2 eight)))
      (prim-mul 2 four-then-eight)))
    (prim-add sixteen 1))))
  (fact (λ (n) (letrec (
    (help (λ (n total)
      (let n (? n)
      (if (prim-lt n 2)
        total
        ((? help) (prim-sub n 1) (prim-mul n total)))))))
    ((? help) n 1))))
)
((? fact) (! ((? seventeen))))
)
    `).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 355687428096000
      });
  });
  test('sanity check 8', () => {
    expect(new DebugMachine(`
(letrec (
  (make-reducer (λ (initial-value) (letrec (
    (loop (λ (total first-run) (reset
      (let n (shift k k)
      (if (prim-and
            (prim-eq n 0)
            (prim-not first-run))
        total
        ((? loop) (prim-add n total) #f  ))))))
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
        tag: 'NumV',
        v: 911666
      });
  });
  test('sanity check 9', () => {
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
(prim-add (prim-add n1 n2) n3)))))))
)
    `).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 6
      });
  });
  test('sanity check 10', () => {
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
      (if (prim-and
            (prim-eq n 0)
            (prim-not first-run))
        total
        ((? loop) (prim-add n total) #f  )))))))
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
(prim-add (prim-add n1 n2) (prim-add n3 n))))))))))))
)
    `).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 911672
      });
  });
  test('sanity check 11', () => {
    let machine = new DebugMachine(`
(letrec (
  (pair (\\ (a b)
    (! (\\ (p) ((? p) a b)))))
  (pair-fst (\\ (p)
    ((? p) (! (\\ (a b) a)))))
  (pair-snd (\\ (p)
    ((? p) (! (\\ (a b) b)))))
  (is-even (\\ (n)
    (let n (? n)
    (prim-eq 0 (prim-mod n 2)))))
)
(let p1 ((? pair) 3 is-even)
(let num ((? pair-fst) p1)
(let fn ((? pair-snd) p1)
((? fn) num) )))
)
`);
  try {
    let res = machine.run();
    expect(res).
      toStrictEqual({
        tag: "BoolV",
        v: false
    });
  }
  catch (e) {
    console.error(e);
  }
 });

  test('sanity check 12', () => {
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
      (prim-add a b)))))
    7
    list-1 ))
)
      `).
        run()).
        toStrictEqual({
          tag: 'NumV',
          v: 7
        });
  });

  test('sanity check 13', () => {
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
      (prim-add a b)))))
    7
    list-1 ))
)
      `).
        run()).
        toStrictEqual({
          tag: 'NumV',
          v: 17
        });
  });

  test('comment test', () => {
    expect(new DebugMachine(`
(letrec ( ; comment 1
  (fact-tailrec (λ (n total)
;comment 2
    (if (prim-eq n 2)
      total ; comment 3
      ((? fact-tailrec) (prim-sub n 1) (prim-mul n total)))))
)
((? fact-tailrec) 10 1) ;; comment 4
)
    `).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 1814400
      });
  });

  test('string functions: length', () => {
    expect(new DebugMachine(`
    (prim-string-length "bottom text")
    `).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 11
      });
  });

  test('string, object, array, and comment test', () => {
    expect(new DebugMachine(`
(letrec (
  ; comment test 1
  (load (λ () (shift k ;; comment test 2
    (! (λ (f) ((? (prim-object-get "load" f)) k))))))

  (save (λ (v) (shift k
    (! (λ (f) ((? (prim-object-get "save" f)) v k))))))

  (return (λ (x) (shift k
    (! (λ (_) (? x))))))

  (run-state (λ (st comp)
    (let handle (reset (? comp))
    ((? handle) (prim-object-new
      "load" (! (λ (continue)
               (let res (! (continue st))
               ((? run-state) st res))))
      "save" (! (λ (v continue)
               (let res (! (continue _))
               ((? run-state) v res)))))))))

  (increment-state (λ ()
    (let n ((? load))
    (let _ ((? save) (prim-add n 1))
    (let n-plus-1 ((? load))
    ((? return) n-plus-1))))))
)
((? run-state) 419 (! ((? increment-state))))
)`).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 420
    });
  });
});

