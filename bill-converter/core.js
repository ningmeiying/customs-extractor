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

  // 字母序号：0->A, 1->B, ... 25->Z, 26->AA
  function letterSeq(n) {
    let s = "";
    let x = n + 1;
    while (x > 0) {
      const rem = (x - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      x = Math.floor((x - 1) / 26);
    }
    return s;
  }
  const twoDigit = (n) => String(n + 1).padStart(2, "0");

  // 对转换结果中的重复运单号加区分后缀
  // 拦截出货单转换: 完整运单号后加 -A/-B
  // 退运单出货单转换: 在模板B列（即 -00BR 之前）后加 01/02
  function dedupeWaybills(type, rows) {
    if (type !== "拦截出货单转换" && type !== "退运单出货单转换") return rows;
    const groups = new Map();
    rows.forEach((r) => {
      const k = r["运单号"];
      if (!k) return;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    });
    groups.forEach((members) => {
      if (members.length < 2) return;
      members.forEach((r, i) => {
        const base = r["运单号"];
        if (type === "拦截出货单转换") {
          r["运单号"] = base + "-" + letterSeq(i);
        } else {
          // base 形如 "FBA19F4VFHJ4-00BR"，在 -00BR 前插入序号
          const m = base.match(/^(.*)-00BR$/);
          if (m) r["运单号"] = m[1] + twoDigit(i) + "-00BR";
          else r["运单号"] = base + twoDigit(i);
        }
      });
    });
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
        ["深圳某某科技", "FBA19F4VFHJ4", "FBA19F4VFHJ4", "海外仓服务+卡车派送", "DFW7", "4"],
        ["广州某某贸易", "FBA19F4VFHJ4", "FBA19F4VFHJ4", "海外仓服务+快递派送", "ABE4", "4"]
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
    },
    "退运单转换": {
      cols: ["客户名称", "运单号", "目的地", "件数"],
      example: [
        ["客户名称", "运单号", "目的地", "件数"],
        ["深圳某某科技", "FBA19F4VFHJ4", "ONT8", "12"],
        ["广州某某贸易", "FBA19Y2QNB7P", "SJC7", "3"]
      ],
      convert: (a) => ({
        "客户名称": a[0] || "",
        "FBAID": a[1] || "",
        "运单号": a[1] ? a[1] + "-00R" : "",
        "渠道": "IR01",
        "目的地": a[2] || "",
        "邮编": "88888",
        "件数": a[3] || "",
        "收货仓库": "总部办公室",
        "是否包税": "是",
        "是否退税报关": "否",
        "是否带电": "否",
        "运单备注": "",
        "尾程派送": "卡派"
      })
    },
    "退运单出货单转换": {
      cols: ["客户名称", "原运单号", "出货FBAID", "新目的地", "新件数", "是否包税", "是否退税报关", "是否带电", "尾程派送"],
      example: [
        ["客户名称", "原运单号", "出货FBAID", "新目的地", "新件数", "是否包税", "是否退税报关", "是否带电", "尾程派送"],
        ["深圳某某科技", "FBA19F4VFHJ4", "FBA19F4VFHJ4", "DFW7", "4", "是", "否", "否", "快递派"],
        ["广州某某贸易", "FBA19F4VFHJ4", "FBA19F4VFHJ4", "ABE4", "4", "是", "否", "否", "卡车派送"]
      ],
      convert: (a) => ({
        "客户名称": a[0] || "",
        "FBAID": a[2] || "",
        "运单号": a[1] ? a[1] + "-00BR" : "",
        "渠道": "BR01",
        "目的地": a[3] || "",
        "邮编": lookupPostal(a[3]),
        "件数": a[4] || "",
        "收货仓库": "总部办公室",
        "是否包税": a[5] || "",
        "是否退税报关": a[6] || "",
        "是否带电": a[7] || "",
        "运单备注": "",
        "尾程派送": a[8] || ""
      })
    }
  };

  const Core = { POSTAL, HEADERS, TYPES, parseInput, lookupPostal, lastMile, dedupeWaybills };
  root.ConverterCore = Core;
  if (typeof module !== "undefined" && module.exports) module.exports = Core;
})(typeof window !== "undefined" ? window : globalThis);
