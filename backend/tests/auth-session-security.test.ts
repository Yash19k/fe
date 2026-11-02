import { createHash } from "crypto";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";

import { config } from "../config/config";
import { AppDataSource } from "../config/data.source";
import { logout } from "../controllers/user.controller";
import { UserSession } from "../entities/user.session.entity";
import { setAuthCookies } from "../services/auth.session.service";

describe("authentication session cookie security", () => {
  test("sets refresh cookies HttpOnly, production-secure, expiring, host-only, and route-compatible", () => {
    const cookies = new Map<string, { value: string; options: Record<string, unknown> }>();
    const response = {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.set(name, { value, options });
        return response;
      },
    } as unknown as Response;

    setAuthCookies(response, {
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });

    const refreshCookie = cookies.get("refreshToken");
    assert.ok(refreshCookie);
    assert.equal(refreshCookie.options.httpOnly, true);
    assert.equal(refreshCookie.options.secure, process.env.NODE_ENV === "production");
    assert.equal(refreshCookie.options.sameSite, config.cookieSameSite);
    assert.equal(refreshCookie.options.path, "/");
    assert.equal(
      refreshCookie.options.maxAge,
      7 * 24 * 60 * 60 * 1000,
    );
    assert.equal("domain" in refreshCookie.options, false);
  });

  test("logout revokes the cookie-backed refresh session and clears both auth cookies", async (t) => {
    const refreshToken = "refresh-token-to-revoke";
    const session = { revokedAt: null } as UserSession;
    const repository = AppDataSource.getRepository(UserSession);
    let savedSession: UserSession | undefined;
    const clearedCookies: string[] = [];

    t.mock.method(repository, "findOne", (async (options: { where: { tokenHash: string } }) => {
      assert.equal(
        options.where.tokenHash,
        createHash("sha256").update(refreshToken).digest("hex"),
      );
      return session;
    }) as never);
    t.mock.method(repository, "save", (async (value: UserSession) => {
      savedSession = value;
      return value;
    }) as never);

    const response = {
      clearCookie: (name: string) => {
        clearedCookies.push(name);
        return response;
      },
      json: (body: unknown) => body,
    } as unknown as Response;

    const result = await logout(
      { cookies: { refreshToken } } as unknown as Request,
      response,
    );

    assert.equal(savedSession, session);
    assert.ok(session.revokedAt instanceof Date);
    assert.deepEqual(clearedCookies, ["token", "refreshToken"]);
    assert.deepEqual(result, { success: true });
  });
});
