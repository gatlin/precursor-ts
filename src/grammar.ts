/**
 * Defines a JSON-based *call-by-push-value* language.
 *
 * @remarks
 * The intended audience for this module is someone who wishes to transpile
 * some high-level language for use with the {@link CESKM} virtual machine.
 *
 * @see {@link https://en.wikipedia.org/wiki/Call-by-push-value}
 * @see {@link https://www.cs.bham.ac.uk/~pbl/papers/thesisqmwphd.pdf}
 *
 * @packageDocumentation
 */

/**
 * Call-By-Push-Value intermediate language.
 */
type Cbpv =
  | { tag: "cbpv_literal"; v: unknown }
  | { tag: "cbpv_symbol"; v: string }
  | { tag: "cbpv_op"; op: string; erands: Cbpv[] }
  | { tag: "cbpv_suspend"; exp: Cbpv }
  | { tag: "cbpv_resume"; v: Cbpv }
  | { tag: "cbpv_abstract"; args: string[]; body: Cbpv }
  | { tag: "cbpv_apply"; op: Cbpv; erands: Cbpv[] }
  | { tag: "cbpv_let"; v: string; exp: Cbpv; body: Cbpv }
  | { tag: "cbpv_letrec"; bindings: [string, Cbpv][]; body: Cbpv }
  | { tag: "cbpv_reset"; exp: Cbpv }
  | { tag: "cbpv_shift"; karg: string; body: Cbpv }
  | { tag: "cbpv_if"; c: Cbpv; t: Cbpv; e: Cbpv };

const cbpv_lit = (v: unknown): Cbpv => ({ tag: "cbpv_literal", v });
const cbpv_sym = (v: string): Cbpv => ({ tag: "cbpv_symbol", v });
const cbpv_op = (op: string, erands: Cbpv[]): Cbpv => ({
  tag: "cbpv_op",
  op,
  erands
});
const cbpv_suspend = (exp: Cbpv): Cbpv => ({ tag: "cbpv_suspend", exp });
const cbpv_resume = (v: Cbpv): Cbpv => ({ tag: "cbpv_resume", v });
const cbpv_lam = (args: string[], body: Cbpv): Cbpv => ({
  tag: "cbpv_abstract",
  args,
  body
});
const cbpv_app = (op: Cbpv, erands: Cbpv[]): Cbpv => ({
  tag: "cbpv_apply",
  op,
  erands
});
const cbpv_let = (v: string, exp: Cbpv, body: Cbpv): Cbpv => ({
  tag: "cbpv_let",
  v,
  exp,
  body
});
const cbpv_letrec = (bindings: [string, Cbpv][], body: Cbpv): Cbpv => ({
  tag: "cbpv_letrec",
  bindings,
  body
});
const cbpv_reset = (exp: Cbpv): Cbpv => ({ tag: "cbpv_reset", exp });
const cbpv_shift = (karg: string, body: Cbpv): Cbpv => ({
  tag: "cbpv_shift",
  karg,
  body
});
const cbpv_if = (c: Cbpv, t: Cbpv, e: Cbpv): Cbpv => ({
  tag: "cbpv_if",
  c,
  t,
  e
});

/**
 * A *positive* term is one which is fully evaluated - eg, applying
 * {@link CESKM.step} will not change it. This helper answers whether a given
 * term is positive or not.
 * @internal
 */
const cbpv_is_positive = (expr: Cbpv): boolean => {
  switch (expr.tag) {
    case "cbpv_literal":
    case "cbpv_symbol":
    case "cbpv_op":
    case "cbpv_suspend":
      return true;
    default:
      return false;
  }
};

export {
  cbpv_lit,
  cbpv_sym,
  cbpv_op,
  cbpv_if,
  cbpv_reset,
  cbpv_shift,
  cbpv_let,
  cbpv_letrec,
  cbpv_app,
  cbpv_suspend,
  cbpv_resume,
  cbpv_lam,
  cbpv_is_positive
};

export type { Cbpv };
