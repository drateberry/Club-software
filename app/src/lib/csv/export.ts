/**
 * Tiny CSV writer. Built for streaming a known set of column shapes,
 * not for arbitrary nested objects. Each entity exporter declares its
 * columns and a row mapper; this module handles the encoding rules.
 */

export type CsvColumn<Row> = {
  header: string;
  get: (row: Row) => string | number | boolean | Date | null | undefined;
};

function escapeCell(value: string | number | boolean | Date | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (value instanceof Date) {
    s = value.toISOString();
  } else if (typeof value === "boolean") {
    s = value ? "true" : "false";
  } else {
    s = String(value);
  }
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv<Row>(rows: Iterable<Row>, columns: CsvColumn<Row>[]): string {
  const lines: string[] = [];
  lines.push(columns.map((c) => escapeCell(c.header)).join(","));
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(c.get(row))).join(","));
  }
  return lines.join("\n") + "\n";
}

/**
 * Streaming variant for large exports. Returns a ReadableStream of UTF-8
 * encoded CSV bytes; consumer iterates the rows generator.
 */
export function rowsToCsvStream<Row>(
  rows: AsyncIterable<Row>,
  columns: CsvColumn<Row>[]
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(columns.map((c) => escapeCell(c.header)).join(",") + "\n")
        );
        for await (const row of rows) {
          const line = columns.map((c) => escapeCell(c.get(row))).join(",") + "\n";
          controller.enqueue(encoder.encode(line));
        }
      } catch (err) {
        controller.error(err);
        return;
      }
      controller.close();
    },
  });
}
