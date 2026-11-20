(function (root) {
  "use strict";
  const D = root.CONVERTER_DATA;
  const POSTAL = D.postal;
  const HEADERS = D.headers;

  const joinParts = (parts) => parts.filter((x) => x !== "" && x != null).join("-");

  function lastMile(channel) {
    const s = String(channel == null ? "" : channel);
    if (/快递|快派|express/i.test(s)) return "快递派";
    if (/卡车|卡派|truck/i.test(s)) return "卡车派送";
    return "";
  }

  function lookupPostal(dest) {
    if (!dest) return "";
    const d = String(dest).trim().toUpperCase().replace(/\s+/g, " ");
    if (POSTAL[d]) return POSTAL[d];
    const compact = d.replace(/\s/g, "");
    return POSTAL[compact] || "";
  }

  function parseInput(text) {
    const lines = String(text || "").split(/\r?\n/);
    const rows = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      let cells;
      if (line.indexOf("\t") >= 0) cells = line.split("\t");
      else if (line.indexOf(",") >= 0) cells = line.split(",");
      else cells = [line];
      cells = cells.map((c) => String(c).trim());
      if (cells.every((c) => c === "")) continue;
      if (cells.some((c) => c === "客户名称")) continue;
      rows.push(cells);
    }
    return rows;
  }

  const TYPES = {
    "拦截单转换": {
      cols: ["客户名称", "运单号", "目的地", "件数"],
      example: [
        ["客户名称", "运单号", "目的地", "件数"],
        ["深圳某某科技", "YT20260115001", "ONT8", "12"],
        ["广州某某贸易", "YT20260115002", "SJC7", "3"]
      ],
      convert: (a) => ({
        "客户名称": a[0] || "",
        "FBAID": a[1] || "",
        "运单号": a[1] ? a[1] + "-HOLD" : "",
        "渠道": "目的港扣货",
        "目的地": a[2] || "",
        "邮编": lookupPostal(a[2]),
        "件数": a[3] || "",
        "收货仓库": "总部办公室",
        "是否包税": "是",
        "是否退税报关": "否",
        "是否带电": "否",
        "运单备注": "",
        "尾程派送": "卡派"
      })
    },
    "拦截出货单转换": {
      cols: ["客户名称", "原运单号", "出货FBAID", "渠道", "新目的地", "新件数"],
      example: [
        ["客户名称", "原运单号", "出货FBAID", "渠道", "新目的地", "新件数"],
        ["深圳某某科技", "YT20260115001", "FBA15ABCDEF", "海外仓服务+卡车派送", "DFW7", "8"],
        ["广州某某贸易", "YT20260115002", "FBA15GHIJKL", "海外仓服务+快递派送", "ABE4", "2"]
      ],
      convert: (a) => ({
        "客户名称": a[0] || "",
        "FBAID": a[2] || "",
        "运单号": joinParts([a[1], "HOLD", a[5]]),
        "渠道": a[3] || "",
        "目的地": a[4] || "",
        "邮编": lookupPostal(a[4]),
        "件数": a[5] || "",
        "收货仓库": "总部办公室",
        "是否包税": "是",
        "是否退税报关": "否",
        "是否带电": "否",
        "运单备注": "",
        "尾程派送": lastMile(a[3])
      })
    },
    "暂扣海外仓出货单转换": {
      cols: ["客户名称", "原运单号", "出货FBAID", "渠道", "新目的地", "新件数"],
      example: [
        ["客户名称", "原运单号", "出货FBAID", "渠道", "新目的地", "新件数"],
        ["深圳某某科技", "YT20260115001", "FBA15ABCDEF", "海外仓服务+卡车派送", "LAS7", "6"],
        ["广州某某贸易", "YT20260115002", "FBA15GHIJKL", "海外仓服务+快递派送", "PDX9", "4"]
      ],
      convert: (a) => ({
        "客户名称": a[0] || "",
        "FBAID": a[2] || "",
        "运单号": joinParts([a[2], a[4], a[5]]),
        "渠道": a[3] || "",
        "目的地": a[4] || "",
        "邮编": lookupPostal(a[4]),
        "件数": a[5] || "",
        "收货仓库": "总部办公室",
        "是否包税": "是",
        "是否退税报关": "否",
        "是否带电": "否",
        "运单备注": "",
        "尾程派送": lastMile(a[3])
      })
    }
  };

  const Core = { POSTAL, HEADERS, TYPES, parseInput, lookupPostal, lastMile };
  root.ConverterCore = Core;
  if (typeof module !== "undefined" && module.exports) module.exports = Core;
})(typeof window !== "undefined" ? window : globalThis);
