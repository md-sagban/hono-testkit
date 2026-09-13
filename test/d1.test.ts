import { describe, expect, it } from "vitest";
import { mockD1 } from "../src";

type User = { id: number; email: string; active: number };

describe("mockD1", () => {
  it("runs prepared statements with bindings", async () => {
    const database = await mockD1({
      schema: `
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          active INTEGER NOT NULL DEFAULT 1
        )
      `,
    });

    const insert = await database
      .prepare("INSERT INTO users (email) VALUES (?)")
      .bind("test@example.com")
      .run();

    expect(insert.success).toBe(true);
    expect(insert.meta.changes).toBe(1);
    expect(insert.meta.last_row_id).toBe(1);

    const user = await database
      .prepare<User>("SELECT id, email, active FROM users WHERE email = ?")
      .bind("test@example.com")
      .first();

    expect(user).toEqual({ id: 1, email: "test@example.com", active: 1 });
    database.close();
  });

  it("supports all, raw, seed data and database dumps", async () => {
    const database = await mockD1({
      schema: "CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)",
      seed: [
        "INSERT INTO items VALUES (1, 'one')",
        "INSERT INTO items VALUES (2, 'two')",
      ],
    });

    const all = await database.prepare<{ id: number; name: string }>(
      "SELECT * FROM items ORDER BY id",
    ).all();
    const raw = await database.prepare("SELECT id, name FROM items ORDER BY id").raw({
      columnNames: true,
    });

    expect(all.results).toEqual([
      { id: 1, name: "one" },
      { id: 2, name: "two" },
    ]);
    expect(raw).toEqual([
      ["id", "name"],
      [1, "one"],
      [2, "two"],
    ]);
    expect(database.dump().byteLength).toBeGreaterThan(0);
    database.close();
  });

  it("rolls back a failed batch", async () => {
    const database = await mockD1({
      schema: "CREATE TABLE counters (id INTEGER PRIMARY KEY, value INTEGER)",
      seed: "INSERT INTO counters VALUES (1, 0)",
    });

    await expect(
      database.batch([
        database.prepare("UPDATE counters SET value = 1 WHERE id = 1"),
        database.prepare("INSERT INTO missing_table VALUES (1)"),
      ]),
    ).rejects.toThrow();

    await expect(
      database.prepare<{ value: number }>("SELECT value FROM counters WHERE id = 1").first("value"),
    ).resolves.toBe(0);
    database.close();
  });

  it("returns D1-style failures for invalid all and run statements", async () => {
    const database = await mockD1({
      schema: "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE)",
      seed: "INSERT INTO users VALUES (1, 'used@example.com')",
    });

    const invalidQuery = await database.prepare("SELECT * FROM missing_table").all();
    expect(invalidQuery.success).toBe(false);
    expect(invalidQuery.results).toEqual([]);
    expect(invalidQuery.error).toContain("no such table");

    const duplicate = await database
      .prepare("INSERT INTO users (email) VALUES (?)")
      .bind("used@example.com")
      .run();
    expect(duplicate.success).toBe(false);
    expect(duplicate.error).toContain("UNIQUE constraint failed");
    expect(duplicate.meta.changes).toBe(0);
    database.close();
  });

  it("throws from direct helpers when SQL cannot be prepared or executed", async () => {
    const database = await mockD1();

    await expect(database.prepare("SELECT * FROM missing_table").first()).rejects.toThrow(
      "no such table",
    );
    await expect(database.prepare("SELECT * FROM missing_table").raw()).rejects.toThrow(
      "no such table",
    );
    await expect(database.exec("INVALID SQL")).rejects.toThrow();
    database.close();
  });
});
