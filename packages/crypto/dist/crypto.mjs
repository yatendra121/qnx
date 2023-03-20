import { importPKCS8 as y, SignJWT as v, CompactEncrypt as T, compactDecrypt as m, jwtVerify as f } from "jose";
import { v4 as h } from "uuid";
var l = (o, t, e) => new Promise((r, p) => {
  var E = (n) => {
    try {
      s(e.next(n));
    } catch (d) {
      p(d);
    }
  }, w = (n) => {
    try {
      s(e.throw(n));
    } catch (d) {
      p(d);
    }
  }, s = (n) => n.done ? r(n.value) : Promise.resolve(n.value).then(E, w);
  s((e = e.apply(o, t)).next());
});
const a = process.env.ENCRYPTION_SECRET_JWT, u = process.env.ENCRYPTION_SECRET_JWE;
let c, i;
const C = () => l(void 0, null, function* () {
  if (!(c && i)) {
    if (!a)
      throw new Error("JWT encryption secret is not found in env.");
    if (!u)
      throw new Error("JWE encryption secret is not found in env.");
    c = yield y(a, "ES256"), i = yield y(u, "ECDH-ES+A128KW");
  }
});
C();
const P = (o) => l(void 0, null, function* () {
  const t = h(), e = yield new v({}).setProtectedHeader({ typ: "JWT", alg: "ES256" }).setIssuedAt().setExpirationTime("30d").setIssuer("https://mysite.com").setSubject(o).setJti(t).sign(c);
  return { token: yield new T(new TextEncoder().encode(e)).setProtectedHeader({ alg: "ECDH-ES+A128KW", enc: "A256CBC-HS512" }).encrypt(i), dbToken: t };
}), W = (o) => l(void 0, null, function* () {
  try {
    const { plaintext: t } = yield m(o, i), e = new TextDecoder().decode(t), { payload: r } = yield f(e, c, {
      issuer: "https://mysite.com"
    });
    return r;
  } catch {
    throw new Error("Token decode error");
  }
});
export {
  W as decyptToken,
  P as generateToken
};
