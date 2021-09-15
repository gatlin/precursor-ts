/**
 * The big payoff starts at line 246 and should be intelligible without first
 * poring over all the stuff in the middle.
 */

import { openSync, readSync, closeSync } from "fs";
import {
  CESKM,
  Value,
  parse_cbpv,
  scalar,
  State
} from "../src";

/**
 * Cross-platform means of opening stdin.
 */
function open_stdin(): number {
  let fd = -1;
  fd = process.stdin.fd;
  try {
    fd = openSync("/dev/stdin", "rs") as number;
  }
  catch (e) { console.error(e); }
  return fd;
}

/**
 * A (non-async) generator for a given file descriptor.
 * Yields each line from the given file.
 * ASSUMPTIONS:
 * - the file is already open;
 * - the file will be closed by someone else.
 */
function *file_lines_gen(fd: number): Generator<string,void,boolean> {
  const BUFSIZE = 256;
  const end_byte = "\n".charCodeAt(0);
  let stop = false;
  const buf = Buffer.alloc(BUFSIZE);
  while (true !== stop) {
    let total_buf = Buffer.alloc(BUFSIZE);
    let total_bytes_read = 0;
    let bytes_read = 0;
    let end_byte_read = false;
    if (fd < 0) { throw new Error("Could not open stdin"); }
    while (!end_byte_read) {
      try {
        bytes_read = readSync(fd, buf, 0, BUFSIZE, null);
        const tmp_buf = Buffer.alloc(total_bytes_read + bytes_read);
        total_buf.copy(tmp_buf, 0, 0, total_bytes_read);
        buf.copy(tmp_buf, total_bytes_read, 0, bytes_read);
        total_buf = tmp_buf;
        total_bytes_read += bytes_read;
        for (let i = 0; i < bytes_read; i++) {
          if (end_byte === buf[i]) {
            end_byte_read = true;
          }
        }
      }
      catch (e) {
        if ("EOF" === e.code) { stop = true; }
        else {
          throw e;
        }
      }
    }
    stop = yield total_buf.toString("utf-8").slice(0,-1);
    if (!stop) {
      stop = false;
    }
  }
}


/* In addition to closures, the universe of values our VM will compute with. */
type Base = string | number | boolean | null ;

class VM extends CESKM<Base> {
  private stdin: Generator<string,void,boolean> | undefined;

  public *run(program: string): Generator<State<Base>,Value<Base>,State<Base>> {
    let ceskm : State<Base> = this.inject(parse_cbpv(program));
    yield ceskm;
    const fd = open_stdin();
    this.stdin = file_lines_gen(fd);
    let iter : IteratorResult<State<Base>,Value<Base>> = this.step(ceskm);
    while (!iter.done) {
      ceskm = yield (iter.value as State<Base>);
      iter = this.step(ceskm);
      iter.done = iter.done ?? false;
    }
    closeSync(fd);
    if (!iter) { throw new Error(""); }
    return iter.value as Value<Base>;
  }

  // eslint-disable-next-line
  protected literal(v: any): Value<Base> {
    if ("number" === typeof v
     || "boolean" === typeof v
     || "string" === typeof v
     || null === v)
    { return scalar(v); }
    throw new Error(`${v} not a literal we can do anything with :(`);
  }

  protected op(op_sym: string, args: Value<Base>[]): Value<Base> {
    switch (op_sym) {
    case "op:mul": {
      if (! ("v" in args[0]) || ! ("v" in args[1]))
      { throw new Error("arguments must be values"); }
      if ("number" !== typeof args[0].v || "number" !== typeof args[1].v)
      { throw new Error("arguments must be numbers"); }
      const result: unknown = args[0].v * args[1].v;
      return scalar(result as Base);
    }
    case "op:add": {
      if (! ("v" in args[0]) || ! ("v" in args[1]))
      { throw new Error("arguments must be values"); }
      if ("number" !== typeof args[0].v || "number" !== typeof args[1].v)
      { throw new Error("arguments must be numbers"); }
      const result: unknown = args[0].v + args[1].v;
      return scalar(result as Base);
    }
    case "op:sub": {
      if (! ("v" in args[0]) || ! ("v" in args[1]))
      { throw new Error("arguments must be values"); }
      if ("number" !== typeof args[0].v || "number" !== typeof args[1].v)
      { throw new Error("arguments must be numbers"); }
      const result: unknown = args[0].v - args[1].v;
      return scalar(result as Base);
    }
    case "op:eq": {
      if (! ("v" in args[0]) || ! ("v" in args[1])) {
        throw new Error("arguments must be values");
      }
      if (("number" !== typeof args[0].v || "number" !== typeof args[1].v)
         && ("boolean" !== typeof args[0].v || "boolean" !== typeof args[1].v)
         && ("string" !== typeof args[0].v || "string" !== typeof args[1].v) ) {
        throw new Error("arguments must be numbers or booleans or strings");
      }
      const result: unknown = args[0].v === args[1].v;
      return scalar(result as Base);
    }
    case "op:lt": {
      if (! ("v" in args[0]) || ! ("v" in args[1])) {
        throw new Error("arguments must be values");
      }
      if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
        throw new Error("arguments must be numbers");
      }
      const result: unknown = args[0].v < args[1].v;
      return scalar(result as Base);
    }
    case "op:lte": {
      if (! ("v" in args[0]) || ! ("v" in args[1])) {
        throw new Error("arguments must be values");
      }
      if ("number" !== typeof args[0].v || "number" !== typeof args[1].v) {
        throw new Error("arguments must be numbers");
      }
      const result: unknown = args[0].v <= args[1].v;
      return scalar(result as Base);
    }
    case "op:concat": {
      if (! ("v" in args[0]) || ! ("v" in args[1])) {
        throw new Error("arguments must be values");
      }
      if ("string" !== typeof args[0].v || "string" !== typeof args[1].v) {
        throw new Error("arguments must be strings");
      }
      const result: unknown = args[0].v.concat(args[1].v);
      return scalar(result as Base);
    }
    case "op:strlen": {
      if (! ("v" in args[0])) {
        throw new Error("argument must be a value");
      }
      if ("string" !== typeof args[0].v) {
        throw new Error("argument must be a string");
      }
      const result: unknown = args[0].v.length;
      return scalar(result as Base);
    }
    case "op:substr": {
      if (! ("v" in args[0]) || ! ("v" in args[1]) || ! ("v" in args[2])) {
        throw new Error("arguments must be values");
      }
      if ("string" !== typeof args[0].v || "number" !== typeof args[1].v
           || "number" !== typeof args[2].v) {
        throw new Error("arguments must be strings");
      }
      const result: unknown = args[0].v.slice(args[1].v,args[2].v);
      return scalar(result as Base);
    }
    case "op:str->num": {
      if (! ("v" in args[0])) {
        throw new Error("argument must be a value");
      }
      if ("string" !== typeof args[0].v) {
        throw new Error(`argument must be a string: ${args[0].v}`);
      }
      return scalar(parseInt(args[0].v as string) as Base);
    }
    case "op:num->str": {
      if (! ("v" in args[0])) {
        throw new Error("argument must be a value");
      }
      if ("number" !== typeof args[0].v) {
        throw new Error(`argument must be a number: ${args[0].v}`);
      }
      return scalar((args[0].v as number).toString() as Base);
    }
    case "op:puts": {
      if (! ("v" in args[0])) {
        throw new Error("argument must be a value");
      }
      if ("string" !== typeof args[0].v) {
        throw new Error(`argument must be a string: ${args[0].v}`);
      }
      console.log(args[0].v);
      return scalar(null);
    }
    case "op:gets": {
      if (!this.stdin)
      { throw new Error("stdin is out of order!"); }
      const iter = this.stdin.next();
      if (!iter.done) {
        return scalar(iter.value as Base);
      }
      throw new Error("stdin is closed for good.");
    }
    // You are encouraged (and expected!) to add more ops here.
    default: return super.op(op_sym, args);
    }
  }
}

const vm = new VM();

const execution = vm.run(`
(letrec (
  ; The trivial effect.
  (return (λ (value) (shift k
    (! (λ (f)
      (let effect (! ((? f) ""))
      ((? effect) value)))))))

  ; Write a string to stdout and terminate with newline.
  (writeln (λ (line) (shift k
    (! (λ (f)
      (let effect (! ((? f) "io:writeln" ))
      ((? effect) line k)))))))

  ; Read in a line from stdin as a string. BLOCKS.
  (readln (λ () (shift k
    (! (λ (f)
      (let effect (! ((? f) "io:readln"))
      ((? effect) k)))))))

  ; Implementation of side-effects.
  (run-fx (λ (comp)
    (let handle (reset (? comp))
    ((? handle) (! (λ (effect-tag)
      (if (op:eq "" effect-tag) (λ (value) value)
      (if (op:eq "io:writeln" effect-tag) (λ (output continue)
        (let output (? output)
        (let _ (op:puts output)
        (let res (! (continue _))
        ((? run-fx) res)))))
      (if (op:eq "io:readln" effect-tag) (λ (continue)
        (let input (op:gets)
        (let res (! (continue input))
        ((? run-fx) res))))
      _ ; undefined behavior
  )))))))))

  ; Composes writeln and readln.
  (prompt (λ (message)
    (let _ ((? writeln) message)
    ((? readln)))))

  ; Helper: constructs a friendly salutation for a given name.
  (welcome (λ (name)
    (let name (? name)
    (op:concat "Welcome, "
    (op:concat name "!")))))

  ; Helper: computes an Interesting Fact™ about a given human age.
  (dog-years (λ (age)
    (let age (? age)
    (let age-times-7 (op:num->str (op:mul (op:str->num age) 7))
    (op:concat "Whoa! That is "
    (op:concat age-times-7 " in dog years!"))))))

  (pair (λ (a b) (reset ((shift k k) a b))))
)
((? run-fx) (!
  (let name ((? prompt) "What is your name?")
  (let _ ((? writeln) (! ((? welcome) name)))
  (let age ((? prompt) "How old are you?")
  (let _ ((? writeln) (! ((? dog-years) age)))
  (let p ((? pair) name age)
  ((? return) p))))))))
)
`);
let iter: IteratorResult<State<Base>,Value<Base>> = execution.next();
while (!iter.done) {
  try {
    iter = execution.next({ ...iter.value  });
  }
  catch (err) {
    console.error("ERROR",err);
    break;
  }
}
if (!iter.done) {
  throw new Error("");
}
const filtered: Partial<Value<Base>> = { ...iter.value };
console.log("result", JSON.stringify(filtered, null, 2));
