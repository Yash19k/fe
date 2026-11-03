import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import ts from "typescript";
import { app } from "../app";

const backendRoot = join(__dirname, "..");
const validUuid = "047fe1e7-7f4b-44ce-8e1f-d24a7f5d8f31";
let server: Server;
let baseUrl: string;

before(async () => {
  server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (!server?.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function getJson(
  path: string,
  method = "GET",
): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  const response = await fetch(`${baseUrl}${path}`, { method });
  const contentType = response.headers.get("content-type") ?? "";
  assert.match(contentType, /application\/json/, path);
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

describe("route registrations and aliases", () => {
  test("contains no duplicate method and path in an active route table", () => {
    const routeDirectory = join(backendRoot, "routes");
    const duplicates: string[] = [];

    for (const file of readdirSync(routeDirectory).filter((name) =>
      name.endsWith(".ts"),
    )) {
      const source = ts.createSourceFile(
        file,
        readFileSync(join(routeDirectory, file), "utf8"),
        ts.ScriptTarget.Latest,
        true,
      );
      const routes = new Set<string>();

      const visit = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.expression.getText(source) === "router" &&
          ["get", "post", "put", "patch", "delete"].includes(
            node.expression.name.text,
          ) &&
          ts.isStringLiteral(node.arguments[0])
        ) {
          const route = `${node.expression.name.text.toUpperCase()} ${node.arguments[0].text}`;
          if (routes.has(route)) duplicates.push(`${file}: ${route}`);
          routes.add(route);
        }
        ts.forEachChild(node, visit);
      };

      visit(source);
    }

    assert.deepEqual(duplicates, []);
  });

  test("keeps backward-compatible mounts pointed at their shared routers", () => {
    const source = ts.createSourceFile(
      "app.ts",
      readFileSync(join(backendRoot, "app.ts"), "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const mounts = new Map<string, string>();

    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText(source) === "app" &&
        node.expression.name.text === "use" &&
        ts.isStringLiteral(node.arguments[0]) &&
        ts.isIdentifier(node.arguments[1])
      ) {
        mounts.set(node.arguments[0].text, node.arguments[1].text);
      }
      ts.forEachChild(node, visit);
    };

    visit(source);
    assert.equal(mounts.get("/api/organizations"), "organizationRoutes");
    assert.equal(mounts.get("/api/organization"), "organizationRoutes");
    assert.equal(mounts.get("/api/sla"), "slaRoutes");
    assert.equal(mounts.get("/api/organization/sla"), "slaRoutes");
  });

  test("rejects malformed UUID parameters before protected handlers", async () => {
    const invalidPaths = [
      { path: "/api/projects/not-a-uuid" },
      { path: "/api/work-items/not-a-uuid" },
      { path: "/api/work-items/project/not-a-uuid" },
      { path: "/api/organization/members/not-a-uuid", method: "DELETE" },
      { path: "/api/projects/not-a-uuid/sprints" },
      { path: "/api/whiteboards/not-a-uuid" },
      { path: "/api/projects/not-a-uuid/dashboard" },
    ];

    for (const { path, method } of invalidPaths) {
      const invalid = await getJson(path, method);
      assert.equal(invalid.status, 400, path);
      assert.equal(invalid.body.code, "VALIDATION_ERROR", path);
    }

    const valid = await getJson(`/api/projects/${validUuid}`);
    assert.equal(valid.status, 401);
    assert.equal(valid.body.code, "UNAUTHORIZED");
  });

  test("organization route aliases return the same authorization response", async () => {
    const [singular, plural] = await Promise.all([
      getJson("/api/organization/members"),
      getJson("/api/organizations/members"),
    ]);

    assert.equal(singular.status, 401);
    assert.deepEqual(singular, plural);
  });

  test("SLA aliases remain mounted on the same protected routes", async () => {
    const [primary, alias] = await Promise.all([
      getJson("/api/sla"),
      getJson("/api/organization/sla"),
    ]);

    assert.equal(primary.status, 401);
    assert.deepEqual(primary, alias);
  });
});
