import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Request, Response } from "express";
import { AppError } from "../errors/app.error";
import { validateViewProjectWorkItems } from "../validations/work.item.validations";
import {
  createPaginationQuerySchema,
  validatePaginationQuery,
  validateRequestBody,
} from "../validations/request.validation";
import Joi from "joi";

describe("request validation", () => {
  test("accepts valid pagination and rejects malformed, repeated, and out-of-range values", () => {
    const schema = createPaginationQuerySchema(20, 100);
    assert.equal(
      schema.validate({ page: "3", limit: "25" }).error,
      undefined,
    );

    for (const query of [
      { page: "1abc" },
      { page: "0" },
      { limit: "101" },
      { page: ["1", "2"] },
      { unexpected: "true" },
    ]) {
      assert.ok(schema.validate(query).error);
    }
  });

  test("returns standard validation errors for malformed pagination requests", () => {
    const middleware = validatePaginationQuery(20, 100);
    const request = Object.create(null) as Request;
    request.query = { page: "not-a-number" };
    let validationError: unknown;

    middleware(request, {} as Response, (error?: unknown) => {
      validationError = error;
    });

    assert.ok(validationError instanceof AppError);
    assert.equal(validationError.statusCode, 400);
    assert.equal(validationError.code, "VALIDATION_ERROR");
  });

  test("rejects invalid work-item query enums and pagination", () => {
    const request = Object.create(null) as Request;
    request.params = {
      projectId: "047fe1e7-7f4b-44ce-8e1f-d24a7f5d8f31",
    };
    request.query = { status: "NOT_A_STATUS" };

    assert.throws(
      () => validateViewProjectWorkItems(request, { locals: {} } as Response, () => {}),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 400 &&
        error.code === "VALIDATION_ERROR",
    );
  });

  test("rejects missing required body fields and non-object payloads", () => {
    const middleware = validateRequestBody(
      Joi.object({ name: Joi.string().trim().min(1).required() })
        .required()
        .unknown(false),
    );
    const invalidBodies: unknown[] = [undefined, null, {}, { name: "" }];

    for (const body of invalidBodies) {
      const request = Object.create(null) as Request;
      request.body = body;
      let validationError: unknown;
      middleware(request, {} as Response, (error?: unknown) => {
        validationError = error;
      });

      assert.ok(validationError instanceof AppError);
      assert.equal(validationError.statusCode, 400);
      assert.equal(validationError.code, "VALIDATION_ERROR");
    }
  });
});
