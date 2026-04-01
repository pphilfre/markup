class Worksheet {
  constructor(name) {
    this.name = name;
    this.columns = [];
    this._rows = [];
  }

  addRow(row) {
    this._rows.push(row);
    return row;
  }
}

class Workbook {
  constructor() {
    this._sheets = [];
    this.xlsx = {
      writeBuffer: async () => new ArrayBuffer(0),
    };
  }

  addWorksheet(name) {
    const sheet = new Worksheet(name);
    this._sheets.push(sheet);
    return sheet;
  }
}

module.exports = {
  Workbook,
};
