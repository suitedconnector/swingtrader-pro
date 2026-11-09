import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { storage } from './storage';
// Type definition for extended request
declare global {
  namespace Express {
    interface Request {
      userEmail?: string;
    }
  }
}
// 1. Safe domain normalization
const getValidatedDomain = (input: string | undefined): string => {
  if (!input) throw new Error("CLOUDFLARE_ACCESS_TEAM_DOMAIN is required");
  // Require HTTPS and reject malformed inputs
  if (!input.startsWith('https://')) {
    throw new Error("CLOUDFLARE_ACCESS_TEAM_DOMAIN must be an HTTPS URL");
  }
  const url = new URL(input);
  // Reject credentials, paths, queries, and fragments
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error("CLOUDFLARE_ACCESS_TEAM_DOMAIN must only contain protocol and domain");
  }
  return url.origin;
};
const TEAM_DOMAIN = getValidatedDomain(process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN);
const AUDIENCE = process.env.CLOUDFLARE_ACCESS_AUD;
if (!AUDIENCE) {
  throw new Error("CLOUDFLARE_ACCESS_AUD is required");
}
// 2. Consistent JWKS and issuer construction
const JWKS = createRemoteJWKSet(new URL(`${TEAM_DOMAIN}/cdn-cgi/access/certs`));
/**
 * Validates Cloudflare Access JWT.
 * Rejects requests failing signature, issuer, audience, or expiration checks.
 */
export async function authenticateWithCloudflare(
  req: Request, 
  res: Response, 
  next: NextFunction
) {
  const jwt = req.header('Cf-Access-Jwt-Assertion');
  if (!jwt) {
    return res.status(401).json({ message: "Authentication failure: Missing token" });
  }
  try {
    // 5. Signature, Issuer, Audience, Expiration, Not-Before verification
    const { payload } = await jwtVerify(jwt, JWKS, {
      issuer: TEAM_DOMAIN,
      audience: AUDIENCE,
    });
    // 3 & 4. Validate non-empty email and normalize for lookup
    const rawEmail = payload.email;
    if (typeof rawEmail !== 'string' || rawEmail.trim().length === 0) {
      return res.status(403).json({ message: "Authentication failure: Invalid identity claims" });
    }
    req.userEmail = rawEmail.trim().toLowerCase();

    // --- Phase 2: Shadow Mode Identity Lookup ---
    const appUser = await storage.getUserByEmail(req.userEmail);
    if (appUser) {
        console.log(`[Shadow Mode] Identity matched: Cloudflare user ${req.userEmail} exists in DB (ID: ${appUser.id})`);
    } else {
        console.log(`[Shadow Mode] Identity unmatched: Cloudflare user ${req.userEmail} not found in DB`);
    }
    // ---------------------------------------------

    next();
  } catch (err) {
    // 6. Security constraint: No logging of PII or sensitive claims
    console.error("JWT Verification failed.");
    return res.status(403).json({ message: "Authentication failure: Invalid or expired token" });
  }
}
