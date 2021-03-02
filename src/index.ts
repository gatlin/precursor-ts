export * from "./ceskm";
export * from "./grammar";
export * from "./parser";

import { CESKM, Value, numval, haltk, State } from "./ceskm";
import { parse_cbpv } from "./parser";

const clone = <A>(a: A): A => JSON.parse(JSON.stringify(a));

class Machine extends CESKM {

  public get_result() { return this.result; }

  public * run_generator() {
    let st = this.make_initial_state();
    yield st;
    while (!this.result) {
      let res = this.step(clone(st));
      if (!this.result) {
        st = <State>res;
        yield st; } }
    return; }

  protected primop(op_sym: string, args: Value[]): Value {
    switch (op_sym) {
      case "prim-mod": {
        if ("NumV" === args[0].tag && "NumV" === args[1].tag) {
          return numval(args[0].v % args[1].v); }
        break; }
      default: return super.primop(op_sym, args); };
    throw new Error("bah"); } }

let p1 = `
(letrec (
  (foldr (\\ (c e xs)
    (let xs (? xs)
    ( (? xs) c e ) )))

  (nil (\\ () (! (\\ (c e) e))))

  (cons (\\ (x xs) (! (\\ (c e)
    ( (? c)
      x
      (! ( (? foldr)
        c
        e
        xs )))))))
)
(let list-1
  (! ((? cons) 17
  (! ((? cons) 20
  (! ((? cons) 86
  (! ((? nil)))))))))
((? foldr)
   (! (\\ (a b)
         (let a (? a)
         (let b (? b)
         (prim-add a b)))))
   0
   list-1))
)`;
let p2 = '((λ (x) (let x (? x) (prim-mul x x))) 5)';
let p3 = `
(letrec (
  (yield (\\ (value) (shift k (! (\\ (p) ((? p) value k))))))
  (next (\\ (gen)
    (let k ( (? gen) (! (\\ (a b) b)))
    (k _))))
  (peek (\\ (gen)
    ( (? gen) (! (\\ (a b) a)))))
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
`;
let m = new Machine(parse_cbpv(p2));

let res;
for (let st of m.run_generator()) {
  console.log('st', JSON.stringify(st));
}

console.log(m.get_result());
