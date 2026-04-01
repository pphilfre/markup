export declare class Worksheet {
  name: string;
  columns: unknown[];
  addRow(row: unknown): unknown;
}

export declare class Workbook {
  xlsx: {
    writeBuffer(): Promise<ArrayBuffer>;
  };
  addWorksheet(name: string): Worksheet;
}
