import type initSqlJs from "sql.js";
import type {
  BindParams,
  Database,
  SqlJsStatic,
  Statement,
} from "sql.js";

type SqlJsInitializer = typeof initSqlJs;

let initializerPromise: Promise<SqlJsInitializer> | undefined;

const isWorkersRuntime = () =>
  "WorkerGlobalScope" in (globalThis as Record<string, unknown>);

const loadSqlJsInitializer = () => {
  initializerPromise ??= (async () => {
    if (isWorkersRuntime()) {
      const scope = globalThis as typeof globalThis & {
        location?: { href: string };
      };

      // sql.js' asm build expects the standard Web Worker `location` global,
      // which workerd intentionally does not expose. It only reads `href`
      // while initializing and does not use it to load external files.
      if (!scope.location) {
        Object.defineProperty(scope, "location", {
          configurable: true,
          value: { href: "https://hono-testkit.invalid/" },
        });
      }

      const module = await import("sql.js/dist/sql-asm.js");
      return module.default;
    }

    const module = await import("sql.js");
    return module.default;
  })();

  return initializerPromise;
};

export type D1Value = string | number | null | ArrayBuffer | ArrayBufferView;
type SqlValue = string | number | null | Uint8Array;

export interface MockD1Meta {
  changed_db: boolean;
  changes: number;
  duration: number;
  last_row_id: number;
  rows_read: number;
  rows_written: number;
  size_after: number;
}

export interface MockD1Result<Row = Record<string, unknown>> {
  success: boolean;
  results: Row[];
  meta: MockD1Meta;
  error?: string;
}

export interface MockD1ExecResult {
  count: number;
  duration: number;
}

export interface MockD1Options {
  schema?: string | string[];
  seed?: string | string[];
  data?: ArrayBuffer | Uint8Array;
  locateFile?: (file: string) => string;
}

const normalizeValue = (value: D1Value): SqlValue => {
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(
      value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength),
    );
  }
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  return value;
};

const normalizeRow = <Row>(columns: string[], values: SqlValue[]) =>
  Object.fromEntries(
    columns.map((column, index) => {
      const value = values[index];
      return [
        column,
        value instanceof Uint8Array
          ? value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
          : value,
      ];
    }),
  ) as Row;

const queryChangesData = (database: Database) => {
  const result = database.exec("SELECT changes() AS changes, last_insert_rowid() AS last_row_id");
  const values = result[0]?.values[0];
  return {
    changes: Number(values?.[0] ?? 0),
    lastRowId: Number(values?.[1] ?? 0),
  };
};

const statementKind = (sql: string) =>
  sql.trimStart().match(/^([a-z]+)/i)?.[1]?.toUpperCase() ?? "";

const isWriteStatement = (sql: string) =>
  ["INSERT", "UPDATE", "DELETE", "REPLACE", "CREATE", "ALTER", "DROP"].includes(
    statementKind(sql),
  );

export class MockD1PreparedStatement<Row = Record<string, unknown>> {
  readonly #database: Database;
  readonly #sql: string;
  readonly #bindings: SqlValue[];

  constructor(database: Database, sql: string, bindings: SqlValue[] = []) {
    this.#database = database;
    this.#sql = sql;
    this.#bindings = bindings;
  }

  bind(...values: D1Value[]) {
    return new MockD1PreparedStatement<Row>(
      this.#database,
      this.#sql,
      values.map(normalizeValue),
    );
  }

  async first<Column extends keyof Row & string>(column?: Column) {
    const rows = this.#selectRows<Row>();
    const first = rows[0] ?? null;
    return column && first ? first[column] ?? null : first;
  }

  async all<ResultRow = Row>(): Promise<MockD1Result<ResultRow>> {
    const started = performance.now();
    try {
      const results = this.#selectRows<ResultRow>();
      return this.#result(results, performance.now() - started, false, 0);
    } catch (error) {
      return this.#failure<ResultRow>(error, performance.now() - started);
    }
  }

  async raw<ResultRow extends unknown[] = unknown[]>(options?: {
    columnNames?: boolean;
  }): Promise<ResultRow[]> {
    const statement = this.#createStatement();
    try {
      const rows: unknown[][] = [];
      const columns = statement.getColumnNames();
      if (options?.columnNames) rows.push(columns);
      while (statement.step()) {
        rows.push(statement.get().map((value) =>
          value instanceof Uint8Array
            ? value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
            : value));
      }
      return rows as ResultRow[];
    } finally {
      statement.free();
    }
  }

  async run<ResultRow = Row>(): Promise<MockD1Result<ResultRow>> {
    const started = performance.now();
    try {
      const statement = this.#createStatement();
      const rows: ResultRow[] = [];
      try {
        const columns = statement.getColumnNames();
        while (statement.step()) rows.push(normalizeRow<ResultRow>(columns, statement.get()));
      } finally {
        statement.free();
      }
      const { changes, lastRowId } = queryChangesData(this.#database);
      return this.#result(
        rows,
        performance.now() - started,
        isWriteStatement(this.#sql),
        changes,
        lastRowId,
      );
    } catch (error) {
      return this.#failure<ResultRow>(error, performance.now() - started);
    }
  }

  #createStatement(): Statement {
    const statement = this.#database.prepare(this.#sql);
    if (this.#bindings.length > 0) statement.bind(this.#bindings as BindParams);
    return statement;
  }

  #selectRows<ResultRow>() {
    const statement = this.#createStatement();
    try {
      const rows: ResultRow[] = [];
      const columns = statement.getColumnNames();
      while (statement.step()) rows.push(normalizeRow<ResultRow>(columns, statement.get()));
      return rows;
    } finally {
      statement.free();
    }
  }

  #result<ResultRow>(
    results: ResultRow[],
    duration: number,
    changed: boolean,
    changes: number,
    lastRowId = 0,
  ): MockD1Result<ResultRow> {
    return {
      success: true,
      results,
      meta: {
        changed_db: changed && changes > 0,
        changes,
        duration,
        last_row_id: lastRowId,
        rows_read: results.length,
        rows_written: changed ? changes : 0,
        size_after: this.#database.export().byteLength,
      },
    };
  }

  #failure<ResultRow>(error: unknown, duration: number): MockD1Result<ResultRow> {
    return {
      success: false,
      results: [],
      error: error instanceof Error ? error.message : String(error),
      meta: {
        changed_db: false,
        changes: 0,
        duration,
        last_row_id: 0,
        rows_read: 0,
        rows_written: 0,
        size_after: this.#database.export().byteLength,
      },
    };
  }
}

export class MockD1Database {
  readonly #database: Database;

  constructor(sql: SqlJsStatic, data?: ArrayBuffer | Uint8Array) {
    this.#database = data
      ? new sql.Database(data instanceof Uint8Array ? data : new Uint8Array(data))
      : new sql.Database();
  }

  prepare<Row = Record<string, unknown>>(sql: string) {
    return new MockD1PreparedStatement<Row>(this.#database, sql);
  }

  async batch<Row = Record<string, unknown>>(
    statements: MockD1PreparedStatement<Row>[],
  ) {
    this.#database.run("BEGIN");
    try {
      const results: MockD1Result<Row>[] = [];
      for (const statement of statements) {
        const result = await statement.run<Row>();
        if (!result.success) throw new Error(result.error);
        results.push(result);
      }
      this.#database.run("COMMIT");
      return results;
    } catch (error) {
      this.#database.run("ROLLBACK");
      throw error;
    }
  }

  async exec(sql: string): Promise<MockD1ExecResult> {
    const started = performance.now();
    this.#database.run(sql);
    const count = sql.split(";").filter((statement) => statement.trim()).length;
    return { count, duration: performance.now() - started };
  }

  dump() {
    const bytes = this.#database.export();
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }

  close() {
    this.#database.close();
  }
}

const executeSql = (database: MockD1Database, sql?: string | string[]) => {
  if (!sql) return Promise.resolve();
  return database.exec(Array.isArray(sql) ? sql.join(";\n") : sql).then(() => undefined);
};

export const mockD1 = async (options: MockD1Options = {}) => {
  const initSqlJs = await loadSqlJsInitializer();
  const sql = await initSqlJs(
    options.locateFile ? { locateFile: options.locateFile } : undefined,
  );
  const database = new MockD1Database(sql, options.data);
  await executeSql(database, options.schema);
  await executeSql(database, options.seed);
  return database;
};
