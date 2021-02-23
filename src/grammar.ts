/**
 * @module grammar
 */

// Call-By-Push-Value intermediate language.
export type Cbpv
  = { tag: 'NumA' ; v: number }
  | { tag: 'BoolA' ; v: boolean }
  | { tag: 'SymA' ; v: string }
  | { tag: 'PrimA' ; op: string; erands: Cbpv[] }
  | { tag: 'SuspendA'; exp: Cbpv }
  | { tag: 'ResumeA'; v: Cbpv }
  | { tag: 'LamA'; args: string[]; body: Cbpv }
  | { tag: 'AppA'; op: Cbpv; erands: Cbpv[] }
  | { tag: 'LetA'; v: string; exp: Cbpv; body: Cbpv }
  | { tag: 'LetrecA'; bindings: [string,Cbpv][]; body: Cbpv }
  | { tag: 'ResetA'; exp: Cbpv }
  | { tag: 'ShiftA'; karg: string; body: Cbpv }
  | { tag: 'IfA'; c: Cbpv; t: Cbpv; e : Cbpv }
  ;

// smart constructors
export const cbpv_num = (v: number): Cbpv => ({ tag: 'NumA', v });
export const cbpv_bool = (v: boolean): Cbpv => ({ tag: 'BoolA', v });
export const cbpv_sym = (v: string): Cbpv => ({ tag: 'SymA', v });
export const cbpv_prim = (op: string, erands: Cbpv[]): Cbpv => ({
  tag: 'PrimA',
  op, erands });
export const cbpv_suspend = (exp: Cbpv): Cbpv => ({ tag: 'SuspendA', exp });
export const cbpv_resume = (v: Cbpv): Cbpv => ({ tag: 'ResumeA', v });
export const cbpv_lam = (args: string[], body: Cbpv): Cbpv => ({
  tag: 'LamA',
  args, body });
export const cbpv_app = (op: Cbpv, erands: Cbpv[]): Cbpv => ({
  tag: 'AppA',
  op, erands });
export const cbpv_let = (v: string, exp: Cbpv, body: Cbpv): Cbpv => ({
  tag: 'LetA',
  v, exp, body });
export const cbpv_letrec = (bindings: [string,Cbpv][], body: Cbpv): Cbpv => ({
  tag: 'LetrecA',
  bindings, body });
export const cbpv_reset = (exp: Cbpv): Cbpv => ({ tag: 'ResetA', exp});
export const cbpv_shift = (karg: string, body: Cbpv): Cbpv => ({
  tag: 'ShiftA',
  karg, body });
export const cbpv_if = (c: Cbpv, t: Cbpv, e: Cbpv): Cbpv => ({
  tag: 'IfA',
  c, t, e });

export const cbpv_is_positive = (expr: Cbpv): boolean => { switch (expr.tag) {
    case 'NumA':
    case 'BoolA':
    case 'SymA':
    case 'PrimA':
    case 'SuspendA':
    return true;
    default: return false;
}};

