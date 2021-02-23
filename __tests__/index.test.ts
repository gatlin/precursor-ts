import { CESKM, parse_cbpv } from "../src/index";

describe('index', () => {
  it('sanity check 1', () => {
    expect(new CESKM(parse_cbpv(`
(letrec (
  (sqr-int (λ (n) (prim-mul n n)))
)
((? sqr-int) 69))`)).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 4761
    });
  });

  it('sanity check 2', () => {
    expect(new CESKM(parse_cbpv("( (\\ (x) (prim-mul x 2)) 210)")).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 420
      });
  });

  it('sanity check 3', () => {
    expect(new CESKM(parse_cbpv("(let n (prim-add 1 2) (prim-mul n 2))")).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 6
      });
  });

  it('sanity check 4', () => {
    expect(new CESKM(parse_cbpv(`
(letrec (
  (fact-tailrec (λ (n total)
    (if (prim-eq n 2)
      total
      ((? fact-tailrec) (prim-sub n 1) (prim-mul n total)))))
)
((? fact-tailrec) 10 1)
)
    `)).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 1814400
      });
  });

  it('sanity check 5', () => {
    expect(new CESKM(parse_cbpv(`
(letrec (
  (times (λ (a b) (prim-mul a b)))
)
((? times) 2 4))
    `)).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 8
      });
  });

  it('sanity check 6', () => {
    expect(new CESKM(parse_cbpv(`
(let f (reset (shift k k))
(let n (f (prim-add 10 55))
(prim-mul 3 n)))
    `)).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 195
      });
  });

  it('sanity check 7', () => {
    expect(new CESKM(parse_cbpv(`
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
    `)).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 355687428096000
      });
  });

  it('sanity check 8', () => {
    expect(new CESKM(parse_cbpv(`
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
    `)).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 911666
      });
  });

  it('sanity check 9', () => {
    expect(new CESKM(parse_cbpv(`
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
    `)).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 6
      });
  });

  it('sanity check 10', () => {
    expect(new CESKM(parse_cbpv(`
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
    `)).
      run()).
      toStrictEqual({
        tag: 'NumV',
        v: 911672
      });
  });
});
