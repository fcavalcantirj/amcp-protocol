#!/usr/bin/env npx tsx

// scripts/amcp-cli.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { createCipheriv, createDecipheriv, randomBytes as randomBytes2, createHash, hkdfSync } from "crypto";

// node_modules/.pnpm/@noble+ed25519@2.3.0/node_modules/@noble/ed25519/index.js
var ed25519_CURVE = {
  p: 0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffedn,
  n: 0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3edn,
  h: 8n,
  a: 0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffecn,
  d: 0x52036cee2b6ffe738cc740797779e89800700a4d4141d8ab75eb4dca135978a3n,
  Gx: 0x216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51an,
  Gy: 0x6666666666666666666666666666666666666666666666666666666666666658n
};
var { p: P, n: N, Gx, Gy, a: _a, d: _d } = ed25519_CURVE;
var h = 8n;
var L = 32;
var L2 = 64;
var err = (m = "") => {
  throw new Error(m);
};
var isBig = (n) => typeof n === "bigint";
var isStr = (s) => typeof s === "string";
var isBytes = (a) => a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
var abytes = (a, l) => !isBytes(a) || typeof l === "number" && l > 0 && a.length !== l ? err("Uint8Array expected") : a;
var u8n = (len) => new Uint8Array(len);
var u8fr = (buf) => Uint8Array.from(buf);
var padh = (n, pad) => n.toString(16).padStart(pad, "0");
var bytesToHex = (b) => Array.from(abytes(b)).map((e) => padh(e, 2)).join("");
var C = { _0: 48, _9: 57, A: 65, F: 70, a: 97, f: 102 };
var _ch = (ch) => {
  if (ch >= C._0 && ch <= C._9)
    return ch - C._0;
  if (ch >= C.A && ch <= C.F)
    return ch - (C.A - 10);
  if (ch >= C.a && ch <= C.f)
    return ch - (C.a - 10);
  return;
};
var hexToBytes = (hex) => {
  const e = "hex invalid";
  if (!isStr(hex))
    return err(e);
  const hl = hex.length;
  const al = hl / 2;
  if (hl % 2)
    return err(e);
  const array = u8n(al);
  for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
    const n1 = _ch(hex.charCodeAt(hi));
    const n2 = _ch(hex.charCodeAt(hi + 1));
    if (n1 === void 0 || n2 === void 0)
      return err(e);
    array[ai] = n1 * 16 + n2;
  }
  return array;
};
var toU8 = (a, len) => abytes(isStr(a) ? hexToBytes(a) : u8fr(abytes(a)), len);
var cr = () => globalThis?.crypto;
var subtle = () => cr()?.subtle ?? err("crypto.subtle must be defined");
var concatBytes = (...arrs) => {
  const r = u8n(arrs.reduce((sum, a) => sum + abytes(a).length, 0));
  let pad = 0;
  arrs.forEach((a) => {
    r.set(a, pad);
    pad += a.length;
  });
  return r;
};
var randomBytes = (len = L) => {
  const c = cr();
  return c.getRandomValues(u8n(len));
};
var big = BigInt;
var arange = (n, min, max, msg = "bad number: out of range") => isBig(n) && min <= n && n < max ? n : err(msg);
var M = (a, b = P) => {
  const r = a % b;
  return r >= 0n ? r : b + r;
};
var modN = (a) => M(a, N);
var invert = (num, md) => {
  if (num === 0n || md <= 0n)
    err("no inverse n=" + num + " mod=" + md);
  let a = M(num, md), b = md, x = 0n, y = 1n, u = 1n, v = 0n;
  while (a !== 0n) {
    const q = b / a, r = b % a;
    const m = x - u * q, n = y - v * q;
    b = a, a = r, x = u, y = v, u = m, v = n;
  }
  return b === 1n ? M(x, md) : err("no inverse");
};
var callHash = (name) => {
  const fn = etc[name];
  if (typeof fn !== "function")
    err("hashes." + name + " not set");
  return fn;
};
var apoint = (p) => p instanceof Point ? p : err("Point expected");
var B256 = 2n ** 256n;
var Point = class _Point {
  static BASE;
  static ZERO;
  ex;
  ey;
  ez;
  et;
  constructor(ex, ey, ez, et) {
    const max = B256;
    this.ex = arange(ex, 0n, max);
    this.ey = arange(ey, 0n, max);
    this.ez = arange(ez, 1n, max);
    this.et = arange(et, 0n, max);
    Object.freeze(this);
  }
  static fromAffine(p) {
    return new _Point(p.x, p.y, 1n, M(p.x * p.y));
  }
  /** RFC8032 5.1.3: Uint8Array to Point. */
  static fromBytes(hex, zip215 = false) {
    const d = _d;
    const normed = u8fr(abytes(hex, L));
    const lastByte = hex[31];
    normed[31] = lastByte & ~128;
    const y = bytesToNumLE(normed);
    const max = zip215 ? B256 : P;
    arange(y, 0n, max);
    const y2 = M(y * y);
    const u = M(y2 - 1n);
    const v = M(d * y2 + 1n);
    let { isValid, value: x } = uvRatio(u, v);
    if (!isValid)
      err("bad point: y not sqrt");
    const isXOdd = (x & 1n) === 1n;
    const isLastByteOdd = (lastByte & 128) !== 0;
    if (!zip215 && x === 0n && isLastByteOdd)
      err("bad point: x==0, isLastByteOdd");
    if (isLastByteOdd !== isXOdd)
      x = M(-x);
    return new _Point(x, y, 1n, M(x * y));
  }
  /** Checks if the point is valid and on-curve. */
  assertValidity() {
    const a = _a;
    const d = _d;
    const p = this;
    if (p.is0())
      throw new Error("bad point: ZERO");
    const { ex: X, ey: Y, ez: Z, et: T } = p;
    const X2 = M(X * X);
    const Y2 = M(Y * Y);
    const Z2 = M(Z * Z);
    const Z4 = M(Z2 * Z2);
    const aX2 = M(X2 * a);
    const left = M(Z2 * M(aX2 + Y2));
    const right = M(Z4 + M(d * M(X2 * Y2)));
    if (left !== right)
      throw new Error("bad point: equation left != right (1)");
    const XY = M(X * Y);
    const ZT = M(Z * T);
    if (XY !== ZT)
      throw new Error("bad point: equation left != right (2)");
    return this;
  }
  /** Equality check: compare points P&Q. */
  equals(other) {
    const { ex: X1, ey: Y1, ez: Z1 } = this;
    const { ex: X2, ey: Y2, ez: Z2 } = apoint(other);
    const X1Z2 = M(X1 * Z2);
    const X2Z1 = M(X2 * Z1);
    const Y1Z2 = M(Y1 * Z2);
    const Y2Z1 = M(Y2 * Z1);
    return X1Z2 === X2Z1 && Y1Z2 === Y2Z1;
  }
  is0() {
    return this.equals(I);
  }
  /** Flip point over y coordinate. */
  negate() {
    return new _Point(M(-this.ex), this.ey, this.ez, M(-this.et));
  }
  /** Point doubling. Complete formula. Cost: `4M + 4S + 1*a + 6add + 1*2`. */
  double() {
    const { ex: X1, ey: Y1, ez: Z1 } = this;
    const a = _a;
    const A = M(X1 * X1);
    const B = M(Y1 * Y1);
    const C2 = M(2n * M(Z1 * Z1));
    const D = M(a * A);
    const x1y1 = X1 + Y1;
    const E = M(M(x1y1 * x1y1) - A - B);
    const G2 = D + B;
    const F = G2 - C2;
    const H = D - B;
    const X3 = M(E * F);
    const Y3 = M(G2 * H);
    const T3 = M(E * H);
    const Z3 = M(F * G2);
    return new _Point(X3, Y3, Z3, T3);
  }
  /** Point addition. Complete formula. Cost: `8M + 1*k + 8add + 1*2`. */
  add(other) {
    const { ex: X1, ey: Y1, ez: Z1, et: T1 } = this;
    const { ex: X2, ey: Y2, ez: Z2, et: T2 } = apoint(other);
    const a = _a;
    const d = _d;
    const A = M(X1 * X2);
    const B = M(Y1 * Y2);
    const C2 = M(T1 * d * T2);
    const D = M(Z1 * Z2);
    const E = M((X1 + Y1) * (X2 + Y2) - A - B);
    const F = M(D - C2);
    const G2 = M(D + C2);
    const H = M(B - a * A);
    const X3 = M(E * F);
    const Y3 = M(G2 * H);
    const T3 = M(E * H);
    const Z3 = M(F * G2);
    return new _Point(X3, Y3, Z3, T3);
  }
  /**
   * Point-by-scalar multiplication. Scalar must be in range 1 <= n < CURVE.n.
   * Uses {@link wNAF} for base point.
   * Uses fake point to mitigate side-channel leakage.
   * @param n scalar by which point is multiplied
   * @param safe safe mode guards against timing attacks; unsafe mode is faster
   */
  multiply(n, safe = true) {
    if (!safe && (n === 0n || this.is0()))
      return I;
    arange(n, 1n, N);
    if (n === 1n)
      return this;
    if (this.equals(G))
      return wNAF(n).p;
    let p = I;
    let f = G;
    for (let d = this; n > 0n; d = d.double(), n >>= 1n) {
      if (n & 1n)
        p = p.add(d);
      else if (safe)
        f = f.add(d);
    }
    return p;
  }
  /** Convert point to 2d xy affine point. (X, Y, Z) ∋ (x=X/Z, y=Y/Z) */
  toAffine() {
    const { ex: x, ey: y, ez: z } = this;
    if (this.equals(I))
      return { x: 0n, y: 1n };
    const iz = invert(z, P);
    if (M(z * iz) !== 1n)
      err("invalid inverse");
    return { x: M(x * iz), y: M(y * iz) };
  }
  toBytes() {
    const { x, y } = this.assertValidity().toAffine();
    const b = numTo32bLE(y);
    b[31] |= x & 1n ? 128 : 0;
    return b;
  }
  toHex() {
    return bytesToHex(this.toBytes());
  }
  // encode to hex string
  clearCofactor() {
    return this.multiply(big(h), false);
  }
  isSmallOrder() {
    return this.clearCofactor().is0();
  }
  isTorsionFree() {
    let p = this.multiply(N / 2n, false).double();
    if (N % 2n)
      p = p.add(this);
    return p.is0();
  }
  static fromHex(hex, zip215) {
    return _Point.fromBytes(toU8(hex), zip215);
  }
  get x() {
    return this.toAffine().x;
  }
  get y() {
    return this.toAffine().y;
  }
  toRawBytes() {
    return this.toBytes();
  }
};
var G = new Point(Gx, Gy, 1n, M(Gx * Gy));
var I = new Point(0n, 1n, 1n, 0n);
Point.BASE = G;
Point.ZERO = I;
var numTo32bLE = (num) => hexToBytes(padh(arange(num, 0n, B256), L2)).reverse();
var bytesToNumLE = (b) => big("0x" + bytesToHex(u8fr(abytes(b)).reverse()));
var pow2 = (x, power) => {
  let r = x;
  while (power-- > 0n) {
    r *= r;
    r %= P;
  }
  return r;
};
var pow_2_252_3 = (x) => {
  const x2 = x * x % P;
  const b2 = x2 * x % P;
  const b4 = pow2(b2, 2n) * b2 % P;
  const b5 = pow2(b4, 1n) * x % P;
  const b10 = pow2(b5, 5n) * b5 % P;
  const b20 = pow2(b10, 10n) * b10 % P;
  const b40 = pow2(b20, 20n) * b20 % P;
  const b80 = pow2(b40, 40n) * b40 % P;
  const b160 = pow2(b80, 80n) * b80 % P;
  const b240 = pow2(b160, 80n) * b80 % P;
  const b250 = pow2(b240, 10n) * b10 % P;
  const pow_p_5_8 = pow2(b250, 2n) * x % P;
  return { pow_p_5_8, b2 };
};
var RM1 = 0x2b8324804fc1df0b2b4d00993dfbd7a72f431806ad2fe478c4ee1b274a0ea0b0n;
var uvRatio = (u, v) => {
  const v3 = M(v * v * v);
  const v7 = M(v3 * v3 * v);
  const pow = pow_2_252_3(u * v7).pow_p_5_8;
  let x = M(u * v3 * pow);
  const vx2 = M(v * x * x);
  const root1 = x;
  const root2 = M(x * RM1);
  const useRoot1 = vx2 === u;
  const useRoot2 = vx2 === M(-u);
  const noRoot = vx2 === M(-u * RM1);
  if (useRoot1)
    x = root1;
  if (useRoot2 || noRoot)
    x = root2;
  if ((M(x) & 1n) === 1n)
    x = M(-x);
  return { isValid: useRoot1 || useRoot2, value: x };
};
var modL_LE = (hash) => modN(bytesToNumLE(hash));
var sha512a = (...m) => etc.sha512Async(...m);
var sha512s = (...m) => callHash("sha512Sync")(...m);
var hash2extK = (hashed) => {
  const head = hashed.slice(0, L);
  head[0] &= 248;
  head[31] &= 127;
  head[31] |= 64;
  const prefix = hashed.slice(L, L2);
  const scalar = modL_LE(head);
  const point = G.multiply(scalar);
  const pointBytes = point.toBytes();
  return { head, prefix, scalar, point, pointBytes };
};
var getExtendedPublicKeyAsync = (priv) => sha512a(toU8(priv, L)).then(hash2extK);
var getExtendedPublicKey = (priv) => hash2extK(sha512s(toU8(priv, L)));
var getPublicKeyAsync = (priv) => getExtendedPublicKeyAsync(priv).then((p) => p.pointBytes);
var hashFinishA = (res) => sha512a(res.hashable).then(res.finish);
var _sign = (e, rBytes, msg) => {
  const { pointBytes: P2, scalar: s } = e;
  const r = modL_LE(rBytes);
  const R = G.multiply(r).toBytes();
  const hashable = concatBytes(R, P2, msg);
  const finish = (hashed) => {
    const S = modN(r + modL_LE(hashed) * s);
    return abytes(concatBytes(R, numTo32bLE(S)), L2);
  };
  return { hashable, finish };
};
var signAsync = async (msg, privKey) => {
  const m = toU8(msg);
  const e = await getExtendedPublicKeyAsync(privKey);
  const rBytes = await sha512a(e.prefix, m);
  return hashFinishA(_sign(e, rBytes, m));
};
var veriOpts = { zip215: true };
var _verify = (sig, msg, pub, opts = veriOpts) => {
  sig = toU8(sig, L2);
  msg = toU8(msg);
  pub = toU8(pub, L);
  const { zip215 } = opts;
  let A;
  let R;
  let s;
  let SB;
  let hashable = Uint8Array.of();
  try {
    A = Point.fromHex(pub, zip215);
    R = Point.fromHex(sig.slice(0, L), zip215);
    s = bytesToNumLE(sig.slice(L, L2));
    SB = G.multiply(s, false);
    hashable = concatBytes(R.toBytes(), A.toBytes(), msg);
  } catch (error) {
  }
  const finish = (hashed) => {
    if (SB == null)
      return false;
    if (!zip215 && A.isSmallOrder())
      return false;
    const k = modL_LE(hashed);
    const RkA = R.add(A.multiply(k, false));
    return RkA.add(SB.negate()).clearCofactor().is0();
  };
  return { hashable, finish };
};
var verifyAsync = async (s, m, p, opts = veriOpts) => hashFinishA(_verify(s, m, p, opts));
var etc = {
  sha512Async: async (...messages) => {
    const s = subtle();
    const m = concatBytes(...messages);
    return u8n(await s.digest("SHA-512", m.buffer));
  },
  sha512Sync: void 0,
  bytesToHex,
  hexToBytes,
  concatBytes,
  mod: M,
  invert,
  randomBytes
};
var utils = {
  getExtendedPublicKeyAsync,
  getExtendedPublicKey,
  randomPrivateKey: () => randomBytes(L),
  precompute: (w = 8, p = G) => {
    p.multiply(3n);
    w;
    return p;
  }
  // no-op
};
var W = 8;
var scalarBits = 256;
var pwindows = Math.ceil(scalarBits / W) + 1;
var pwindowSize = 2 ** (W - 1);
var precompute = () => {
  const points = [];
  let p = G;
  let b = p;
  for (let w = 0; w < pwindows; w++) {
    b = p;
    points.push(b);
    for (let i = 1; i < pwindowSize; i++) {
      b = b.add(p);
      points.push(b);
    }
    p = b.double();
  }
  return points;
};
var Gpows = void 0;
var ctneg = (cnd, p) => {
  const n = p.negate();
  return cnd ? n : p;
};
var wNAF = (n) => {
  const comp = Gpows || (Gpows = precompute());
  let p = I;
  let f = G;
  const pow_2_w = 2 ** W;
  const maxNum = pow_2_w;
  const mask = big(pow_2_w - 1);
  const shiftBy = big(W);
  for (let w = 0; w < pwindows; w++) {
    let wbits = Number(n & mask);
    n >>= shiftBy;
    if (wbits > pwindowSize) {
      wbits -= maxNum;
      n += 1n;
    }
    const off = w * pwindowSize;
    const offF = off;
    const offP = off + Math.abs(wbits) - 1;
    const isEven = w % 2 !== 0;
    const isNeg = wbits < 0;
    if (wbits === 0) {
      f = f.add(ctneg(isEven, comp[offF]));
    } else {
      p = p.add(ctneg(isNeg, comp[offP]));
    }
  }
  return { p, f };
};

// scripts/amcp-cli.ts
etc.sha512Sync = (...m) => {
  const h2 = createHash("sha512");
  for (const d of m) h2.update(d);
  return new Uint8Array(h2.digest());
};
function toBase64url(bytes) {
  const base64 = Buffer.from(bytes).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64url(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  return new Uint8Array(Buffer.from(padded, "base64"));
}
var ED25519_PREFIX = "B";
function validateRequiredString(obj, field, errors) {
  if (typeof obj[field] !== "string") {
    errors.push(`Missing required field: ${field} (expected string)`);
  }
}
function validateKeriPrefix(aid, errors) {
  if (!aid.startsWith(ED25519_PREFIX)) {
    errors.push(
      `Invalid AID: expected KERI Ed25519 prefix '${ED25519_PREFIX}', got '${aid[0] ?? ""}'. AID must be a KERI self-certifying identifier (B + base64url public key)`
    );
  }
}
function validateOldFormat(agent) {
  const errors = [];
  validateRequiredString(agent, "aid", errors);
  validateRequiredString(agent, "currentPublicKey", errors);
  validateRequiredString(agent, "currentPrivateKey", errors);
  if (typeof agent.aid === "string") {
    validateKeriPrefix(agent.aid, errors);
  }
  return { valid: errors.length === 0, errors };
}
function validateIdentitySchema(parsed) {
  const errors = [];
  if (parsed.agent && typeof parsed.agent === "object") {
    return validateOldFormat(parsed.agent);
  }
  validateRequiredString(parsed, "aid", errors);
  validateRequiredString(parsed, "publicKey", errors);
  validateRequiredString(parsed, "privateKey", errors);
  if (typeof parsed.aid === "string") {
    validateKeriPrefix(parsed.aid, errors);
  }
  return { valid: errors.length === 0, errors };
}
function extractIdentityFields(parsed) {
  if (parsed.agent && typeof parsed.agent === "object") {
    const agent = parsed.agent;
    return {
      aid: typeof agent.aid === "string" ? agent.aid : void 0,
      publicKey: typeof agent.currentPublicKey === "string" ? agent.currentPublicKey : void 0
    };
  }
  return {
    aid: typeof parsed.aid === "string" ? parsed.aid : void 0,
    publicKey: typeof parsed.publicKey === "string" ? parsed.publicKey : void 0
  };
}
function isValidAid(aid) {
  try {
    if (!aid.startsWith(ED25519_PREFIX)) return false;
    const publicKey = fromBase64url(aid.slice(1));
    if (publicKey.length !== 32) return false;
    const point = Point.fromBytes(publicKey, false);
    if (point.clearCofactor().equals(Point.ZERO)) return false;
    return true;
  } catch {
    return false;
  }
}
function aidFromPublicKey(publicKey) {
  if (publicKey.length !== 32) {
    throw new Error(`Invalid public key length: expected 32, got ${publicKey.length}`);
  }
  return ED25519_PREFIX + toBase64url(publicKey);
}
async function validateIdentityFull(parsed) {
  const errors = [];
  const schemaResult = validateIdentitySchema(parsed);
  errors.push(...schemaResult.errors);
  const { aid, publicKey } = extractIdentityFields(parsed);
  if (aid && aid.startsWith(ED25519_PREFIX)) {
    if (!isValidAid(aid)) {
      errors.push("AID is not a valid Ed25519 public key (failed on-curve check)");
    }
  }
  if (aid && publicKey && aid.startsWith(ED25519_PREFIX)) {
    try {
      const pubKeyBytes = fromBase64url(publicKey);
      const derivedAid = aidFromPublicKey(pubKeyBytes);
      if (derivedAid !== aid) {
        errors.push(`AID does not match publicKey: expected ${derivedAid}, got ${aid}`);
      }
    } catch {
    }
  }
  const kel = parsed.kel;
  if (kel && typeof kel === "object" && Array.isArray(kel.events)) {
    if (kel.events.length === 0) {
      errors.push("KEL integrity check failed (empty events array)");
    } else if (aid && kel.events[0]?.aid !== aid) {
      errors.push(`KEL AID mismatch: identity AID is ${aid}, but KEL inception AID is ${kel.events[0]?.aid}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
async function createIdentity(parentAID) {
  const privateKey = utils.randomPrivateKey();
  const publicKey = await getPublicKeyAsync(privateKey);
  const aid = "B" + toBase64url(publicKey);
  return {
    aid,
    publicKey: toBase64url(publicKey),
    privateKey: toBase64url(privateKey),
    created: (/* @__PURE__ */ new Date()).toISOString(),
    parentAID
  };
}
async function loadIdentity(path) {
  const data = readFileSync(path, "utf-8");
  const parsed = JSON.parse(data);
  const validation = await validateIdentityFull(parsed);
  if (!validation.valid) {
    throw new Error(`Invalid identity: ${validation.errors.join("; ")}`);
  }
  if (parsed.aid && parsed.publicKey && parsed.privateKey) {
    return parsed;
  }
  if (parsed.agent) {
    return {
      aid: parsed.agent.aid,
      publicKey: parsed.agent.currentPublicKey,
      privateKey: parsed.agent.currentPrivateKey,
      created: parsed.agent.createdAt,
      parentAID: void 0
    };
  }
  throw new Error("Unknown identity format");
}
function saveIdentity(identity, path) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(identity, null, 2), { mode: 384 });
}
function deriveKey(privateKey) {
  return new Uint8Array(hkdfSync("sha256", privateKey, "amcp-checkpoint-v2", "aes-256-gcm", 32));
}
function encrypt(payload, privateKey) {
  const key = deriveKey(privateKey);
  const iv = randomBytes2(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString("base64");
}
function decrypt(encrypted, privateKey) {
  const key = deriveKey(privateKey);
  const combined = Buffer.from(encrypted, "base64");
  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(12, 28);
  const ciphertext = combined.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8"));
}
async function signData(data, privateKey) {
  const message = new TextEncoder().encode(data);
  const signature = await signAsync(message, privateKey);
  return toBase64url(signature);
}
async function verifySignature(data, signature, publicKey) {
  const message = new TextEncoder().encode(data);
  const sig = fromBase64url(signature);
  return verifyAsync(sig, message, publicKey);
}
async function createCheckpoint(identity, contentDir, secrets = [], previousCID, resurrectFromCID) {
  const privateKey = fromBase64url(identity.privateKey);
  const content = { files: {} };
  if (existsSync(contentDir)) {
    const readDir = (dir, prefix = "") => {
      for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        const relativePath = prefix ? `${prefix}/${entry}` : entry;
        const stats = statSync(fullPath, { throwIfNoEntry: false });
        if (!stats) continue;
        if (stats.isDirectory()) {
          readDir(fullPath, relativePath);
        } else if (entry.endsWith(".md") || entry.endsWith(".json")) {
          const fileContent = readFileSync(fullPath, "utf-8");
          if (entry === "SOUL.md") {
            content.soul = fileContent;
          } else if (entry === "MEMORY.md") {
            content.memory = fileContent;
          } else {
            content.files[relativePath] = fileContent;
          }
        }
      }
    };
    readDir(contentDir);
  }
  const payload = { content, secrets };
  const encryptedPayload = encrypt(payload, privateKey);
  const signature = await signData(encryptedPayload, privateKey);
  const header = {
    version: 2,
    aid: identity.aid,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    signature
  };
  if (identity.parentAID) header.parentAID = identity.parentAID;
  if (previousCID) header.previousCID = previousCID;
  if (resurrectFromCID) header.resurrectFromCID = resurrectFromCID;
  return JSON.stringify(header) + "\n---\n" + encryptedPayload;
}
function parseCheckpoint(checkpoint) {
  const [headerJson, encryptedPayload] = checkpoint.split("\n---\n");
  const header = JSON.parse(headerJson);
  return { header, encryptedPayload };
}
async function resuscitate(checkpointPath, identity) {
  const checkpoint = readFileSync(checkpointPath, "utf-8");
  const { header, encryptedPayload } = parseCheckpoint(checkpoint);
  if (header.version !== 2) {
    throw new Error(`Unsupported checkpoint version: ${header.version}`);
  }
  if (header.aid !== identity.aid) {
    throw new Error(`AID mismatch: checkpoint is for ${header.aid}, but identity is ${identity.aid}`);
  }
  const publicKey = fromBase64url(header.aid.slice(1));
  const valid = await verifySignature(encryptedPayload, header.signature, publicKey);
  if (!valid) {
    throw new Error("Signature verification failed: checkpoint is not authentic");
  }
  const privateKey = fromBase64url(identity.privateKey);
  const payload = decrypt(encryptedPayload, privateKey);
  return {
    header,
    content: payload.content,
    secrets: payload.secrets
  };
}
async function verifyCheckpoint(checkpointPath) {
  const checkpoint = readFileSync(checkpointPath, "utf-8");
  const { header, encryptedPayload } = parseCheckpoint(checkpoint);
  const publicKey = fromBase64url(header.aid.slice(1));
  const valid = await verifySignature(encryptedPayload, header.signature, publicKey);
  return {
    valid,
    aid: header.aid,
    parentAID: header.parentAID,
    timestamp: header.timestamp,
    previousCID: header.previousCID
  };
}
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const subcommand = args[1];
  function getArg(name) {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 ? args[idx + 1] : void 0;
  }
  const defaultIdentityPath = join(process.env.HOME || "~", ".amcp", "identity.json");
  try {
    if (command === "identity") {
      if (subcommand === "create") {
        const outPath = getArg("out") || defaultIdentityPath;
        const parentAID = getArg("parent-aid");
        console.log("Creating AMCP identity...");
        const identity = await createIdentity(parentAID);
        saveIdentity(identity, outPath);
        console.log(`\u2705 Identity created`);
        console.log(`   AID: ${identity.aid}`);
        console.log(`   Created: ${identity.created}`);
        if (parentAID) console.log(`   Parent AID: ${parentAID}`);
        console.log(`   Saved to: ${outPath}`);
      } else if (subcommand === "show") {
        const identityPath = getArg("identity") || defaultIdentityPath;
        const identity = await loadIdentity(identityPath);
        console.log(`AID: ${identity.aid}`);
        console.log(`Public Key: ${identity.publicKey}`);
        console.log(`Created: ${identity.created}`);
        if (identity.parentAID) console.log(`Parent AID: ${identity.parentAID}`);
      } else if (subcommand === "validate") {
        const identityPath = getArg("path") || defaultIdentityPath;
        let parsed;
        try {
          const data = readFileSync(identityPath, "utf-8");
          parsed = JSON.parse(data);
        } catch (err2) {
          const result2 = { valid: false, errors: [`Failed to read identity file: ${err2.message}`] };
          console.log(JSON.stringify(result2, null, 2));
          process.exit(1);
        }
        const result = await validateIdentityFull(parsed);
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.valid ? 0 : 1);
      } else {
        console.log("Usage: amcp identity <create|show|validate>");
        process.exit(1);
      }
    } else if (command === "checkpoint") {
      if (subcommand === "create") {
        const identityPath = getArg("identity") || defaultIdentityPath;
        const contentDir = getArg("content");
        const secretsPath = getArg("secrets");
        const previousCID = getArg("previous");
        const outPath = getArg("out") || "checkpoint.amcp";
        if (!contentDir) {
          console.error("Error: --content <dir> is required");
          process.exit(1);
        }
        const identity = await loadIdentity(identityPath);
        const secrets = secretsPath ? JSON.parse(readFileSync(secretsPath, "utf-8")) : [];
        console.log("Creating checkpoint...");
        const checkpoint = await createCheckpoint(identity, contentDir, secrets, previousCID);
        writeFileSync(outPath, checkpoint);
        console.log(`\u2705 Checkpoint created`);
        console.log(`   AID: ${identity.aid}`);
        console.log(`   Timestamp: ${(/* @__PURE__ */ new Date()).toISOString()}`);
        if (previousCID) console.log(`   Previous CID: ${previousCID}`);
        console.log(`   Saved to: ${outPath}`);
      } else {
        console.log("Usage: amcp checkpoint create --content <dir> [--secrets <json>] [--previous <cid>] [--out <path>]");
        process.exit(1);
      }
    } else if (command === "resuscitate") {
      const checkpointPath = getArg("checkpoint");
      const identityPath = getArg("identity") || defaultIdentityPath;
      const outContentDir = getArg("out-content");
      const outSecretsPath = getArg("out-secrets");
      if (!checkpointPath) {
        console.error("Error: --checkpoint <path> is required");
        process.exit(1);
      }
      const identity = await loadIdentity(identityPath);
      console.log("Resuscitating from checkpoint...");
      const { header, content, secrets } = await resuscitate(checkpointPath, identity);
      console.log(`\u2705 Checkpoint verified and decrypted`);
      console.log(`   AID: ${header.aid}`);
      console.log(`   Timestamp: ${header.timestamp}`);
      if (header.previousCID) console.log(`   Previous CID: ${header.previousCID}`);
      if (outContentDir) {
        mkdirSync(outContentDir, { recursive: true });
        if (content.soul) writeFileSync(join(outContentDir, "SOUL.md"), content.soul);
        if (content.memory) writeFileSync(join(outContentDir, "MEMORY.md"), content.memory);
        for (const [path, data] of Object.entries(content.files)) {
          const fullPath = join(outContentDir, path);
          mkdirSync(dirname(fullPath), { recursive: true });
          writeFileSync(fullPath, data);
        }
        console.log(`   Content written to: ${outContentDir}`);
      }
      if (outSecretsPath) {
        writeFileSync(outSecretsPath, JSON.stringify(secrets, null, 2));
        console.log(`   Secrets written to: ${outSecretsPath}`);
      }
    } else if (command === "verify") {
      const checkpointPath = getArg("checkpoint");
      if (!checkpointPath) {
        console.error("Error: --checkpoint <path> is required");
        process.exit(1);
      }
      console.log("Verifying checkpoint...");
      const result = await verifyCheckpoint(checkpointPath);
      if (result.valid) {
        console.log(`\u2705 Checkpoint is VALID`);
      } else {
        console.log(`\u274C Checkpoint is INVALID`);
      }
      console.log(`   AID: ${result.aid}`);
      console.log(`   Timestamp: ${result.timestamp}`);
      if (result.parentAID) console.log(`   Parent AID: ${result.parentAID}`);
      if (result.previousCID) console.log(`   Previous CID: ${result.previousCID}`);
      process.exit(result.valid ? 0 : 1);
    } else {
      console.log(`AMCP CLI - Agent Memory Continuity Protocol

Commands:
  amcp identity create [--out <path>] [--parent-aid <aid>]
  amcp identity show [--identity <path>]
  amcp identity validate [--path <path>]
  amcp checkpoint create --content <dir> [--secrets <json>] [--previous <cid>] [--out <path>]
  amcp resuscitate --checkpoint <path> [--identity <path>] [--out-content <dir>] [--out-secrets <json>]
  amcp verify --checkpoint <path>

Examples:
  amcp identity create
  amcp checkpoint create --content ~/clawd --out backup.amcp
  amcp verify --checkpoint backup.amcp
  amcp resuscitate --checkpoint backup.amcp --out-content ./restored`);
    }
  } catch (err2) {
    console.error("Error:", err2.message);
    process.exit(1);
  }
}
main();
/*! Bundled license information:

@noble/ed25519/index.js:
  (*! noble-ed25519 - MIT License (c) 2019 Paul Miller (paulmillr.com) *)
*/
