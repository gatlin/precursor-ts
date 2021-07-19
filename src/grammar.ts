/* eslint-disable */
/**
 * @module grammar
 */

// Call-By-Push-Value intermediate language.
export type Cbpv =
  | { tag: "cbpv_literal"; v: any }
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

// smart constructors
export const cbpv_lit = (v: any): Cbpv => ({ tag: "cbpv_literal", v });
export const cbpv_sym = (v: string): Cbpv => ({ tag: "cbpv_symbol", v });
export const cbpv_op = (op: string, erands: Cbpv[]): Cbpv => ({
  tag: "cbpv_op",
  op,
  erands
});
export const cbpv_suspend = (exp: Cbpv): Cbpv => ({ tag: "cbpv_suspend", exp });
export const cbpv_resume = (v: Cbpv): Cbpv => ({ tag: "cbpv_resume", v });
export const cbpv_lam = (args: string[], body: Cbpv): Cbpv => ({
  tag: "cbpv_abstract",
  args,
  body
});
export const cbpv_app = (op: Cbpv, erands: Cbpv[]): Cbpv => ({
  tag: "cbpv_apply",
  op,
  erands
});
export const cbpv_let = (v: string, exp: Cbpv, body: Cbpv): Cbpv => ({
  tag: "cbpv_let",
  v,
  exp,
  body
});
export const cbpv_letrec = (bindings: [string, Cbpv][], body: Cbpv): Cbpv => ({
  tag: "cbpv_letrec",
  bindings,
  body
});
export const cbpv_reset = (exp: Cbpv): Cbpv => ({ tag: "cbpv_reset", exp });
export const cbpv_shift = (karg: string, body: Cbpv): Cbpv => ({
  tag: "cbpv_shift",
  karg,
  body
});
export const cbpv_if = (c: Cbpv, t: Cbpv, e: Cbpv): Cbpv => ({
  tag: "cbpv_if",
  c,
  t,
  e
});

export const cbpv_is_positive = (expr: Cbpv): boolean => {
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
