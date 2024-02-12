import { importPKCS8 as s, SignJWT as p, CompactEncrypt as w, compactDecrypt as E, jwtVerify as d } from "jose";
import { v4 as y } from "uuid";
const i = process.env.ENCRYPTION_SECRET_JWT, a = process.env.ENCRYPTION_SECRET_JWE;
let t, n;
const T = async () => {
  if (!(t && n)) {
    if (!i)
      throw new Error("JWT encryption secret is not found in env.");
    if (!a)
      throw new Error("JWE encryption secret is not found in env.");
    t = await s(i, "ES256"), n = await s(a, "ECDH-ES+A128KW");
  }
};
T().then(() => console.log("@qnx/crypto initiated."));
const C = async (o) => {
  const e = y(), r = await new p({}).setProtectedHeader({ typ: "JWT", alg: "ES256" }).setIssuedAt().setExpirationTime("30d").setIssuer("https://mysite.com").setSubject(o).setJti(e).sign(t);
  return { token: await new w(new TextEncoder().encode(r)).setProtectedHeader({ alg: "ECDH-ES+A128KW", enc: "A256CBC-HS512" }).encrypt(n), dbToken: e };
}, S = async (o) => {
  try {
    const { plaintext: e } = await E(o, n), r = new TextDecoder().decode(e), { payload: c } = await d(r, t, {
      issuer: "https://mysite.com"
    });
    return c;
  } catch {
    throw new Error("Token decode error");
  }
};
export {
  S as decyptToken,
  C as generateToken
};
