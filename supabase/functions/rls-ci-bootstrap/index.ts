// Returns RLS test admin credentials to GitHub Actions runs that present a
// valid GitHub OIDC token. No GitHub repo secrets required.
//
// Security model:
//  - Caller POSTs { token: <GitHub Actions OIDC JWT> }
//  - We verify the JWT against GitHub's JWKS (issuer token.actions.githubusercontent.com).
//  - If the optional Lovable Cloud secret RLS_CI_ALLOWED_REPO is set (e.g.
//    "owner/repo"), the JWT's `repository` claim must match exactly.
//  - On success we return RLS_TEST_ADMIN_EMAIL / RLS_TEST_ADMIN_PASSWORD.

import { jwtVerify, createRemoteJWKSet } from "https://esm.sh/jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";
const JWKS = createRemoteJWKSet(new URL(`${GITHUB_ISSUER}/.well-known/jwks`));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const token = body?.token as string | undefined;
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { payload } = await jwtVerify(token, JWKS, { issuer: GITHUB_ISSUER });

    const allowedRepo = Deno.env.get("RLS_CI_ALLOWED_REPO");
    if (allowedRepo && payload.repository !== allowedRepo) {
      return new Response(
        JSON.stringify({ error: `Forbidden repo: ${payload.repository}` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const email = Deno.env.get("RLS_TEST_ADMIN_EMAIL");
    const password = Deno.env.get("RLS_TEST_ADMIN_PASSWORD");
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Server not configured: missing RLS_TEST_ADMIN_* secrets" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        email,
        password,
        repo: payload.repository ?? null,
        workflow: payload.workflow ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `Invalid OIDC token: ${(e as Error).message}` }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
