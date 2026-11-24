(function () {
  "use strict";

  const D = window.CONVERTER_DATA;
  const C = window.ConverterCore;
  const HEADERS = C.HEADERS;
  const FEE_HEADERS = C.FEE_HEADERS;
  const TYPES = C.TYPES;
  const $ = (id) => document.getElementById(id);

  const FEE_TYPE = "拦截费及拦截指令";
  const FEE_COLS = ["工作号", "渠道", "客户名称", "运单号", "件数"];
  const FEE_EXAMPLE = [
    ["WG001", "海外仓服务+卡车派送", "客户A", "FBA19XN9KC3F", "2"],
    ["WG001", "海外仓服务+卡车派送", "客户A", "FBA19XSG89L0", "3"],
    ["WG002", "海外仓服务+快递派送", "客户B", "FBA19Y2QNB7P", "1"]
  ];
  const FEE_RULES = [
    "（拦截费及拦截指令模板）D列，当工作号一致时合并，英文逗号隔开。例：FBA19XN9KC3F,FBA19XSG89L0",
    "工作号+客户名称一致视为同一柜：首票 100USD，同柜每多一票 +50USD，封顶 500USD/柜；末行输出拦截费用求和",
    "运单号，件数（同个运单号的数值求和），渠道（首行），此票需要目的港扣货\n目的港扣货原因：暂扣海外仓。\n申请扣货新建订单：每个运单号分别加 -HOLD\n拦截后的操作需求：暂扣海外仓。\n目的港扣货费用：费用金额，已确认。"
  ];

  const el = {
    tabs: $("typeTabs"), input: $("inputText"), file: $("fileInput"),
    parseStatus: $("parseStatus"), previewWrap: $("previewWrap"), previewTable: $("previewTable"),
    outputTable: $("outputTable"), outputFoot: $("outputFoot"), outputHint: $("outputHint"),
    inputHint: $("inputHint"), colsInfo: $("colsInfo"), rulesCard: $("rulesCard"),
    rulesTable: $("rulesTable"), toast: $("toast"), btnTpl: $("btnTpl"), feeNotice: $("feeNotice")
  };

  const TPL_FILES = {
    "拦截单转换": "templates/拦截单转换模板.xlsx",
    "拦截出货单转换": "templates/拦截出货单转换模板.xlsx",
    "暂扣海外仓出货单转换": "templates/暂扣海外仓出货单转换模板.xlsx",
    "退运单转换": "templates/退运单转换模板.xlsx",
    "退运单出货单转换": "templates/退运单出货单转换模板.xlsx",
    [FEE_TYPE]: "templates/拦截费及拦截指令模板.xlsx"
  };

  let currentType = "拦截单转换";
  let inputRows = [];
  let outputRows = [];

  const isFee = () => currentType === FEE_TYPE;
  const curHeaders = () => (isFee() ? FEE_HEADERS : HEADERS);
  const curCols = () => (isFee() ? FEE_COLS : TYPES[currentType].cols);
  const curExample = () => (isFee() ? FEE_EXAMPLE : TYPES[currentType].example);
  const curRules = () => (isFee() ? FEE_RULES : (D.rules[currentType] || []));

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[m]));
  }

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.toast.classList.remove("show"), 2400);
  }

  function renderPreview() {
    if (!inputRows.length) { el.previewWrap.hidden = true; return; }
    el.previewWrap.hidden = false;
    const cols = curCols();
    let html = "<thead><tr><th>#</th>" + cols.map((c) => "<th>" + esc(c) + "</th>").join("") + "</tr></thead><tbody>";
    inputRows.forEach((r, i) => {
      html += "<tr><td>" + (i + 1) + "</td>";
      cols.forEach((_, j) => { html += "<td>" + esc(r[j] || "") + "</td>"; });
      html += "</tr>";
    });
    el.previewTable.innerHTML = html + "</tbody>";
  }

  function renderOutput() {
    if (!outputRows.length) { el.outputTable.innerHTML = ""; return; }
    const headers = curHeaders();
    let html = "<thead><tr>" + headers.map((h) => "<th>" + esc(h) + "</th>").join("") + "</tr></thead><tbody>";
    outputRows.forEach((r) => {
      const totalStyle = r.isTotal ? ' style="font-weight:700;background:#eef4ff"' : "";
      html += "<tr" + totalStyle + ">";
      headers.forEach((h) => {
        const v = r[h] || "";
        let cls = "";
        if (h === "邮编" && !v && r["目的地"]) cls = ' class="missing" title="目的地未在邮编表中匹配到"';
        if (h === "尾程派送" && !v && r["渠道"]) cls = ' class="empty-time" title="渠道中未识别到快递/卡车派送关键词"';
        const text = h === "拦截指令" ? esc(v).replace(/\n/g, "<br>") : esc(v);
        const extra = h === "拦截指令" ? ' style="white-space:pre-wrap;min-width:420px"' : "";
        html += "<td" + cls + extra + ">" + text + "</td>";
      });
      html += "</tr>";
    });
    el.outputTable.innerHTML = html + "</tbody>";
  }

  function renderRules() {
    const rule = curRules();
    const headers = curHeaders();
    let html = "<thead><tr><th>输出列</th><th>转换规则</th></tr></thead><tbody>";
    headers.forEach((h, i) => {
      const r = String(rule[i] || "（空）").replace(/\n/g, "<br>");
      html += "<tr><td><b>" + esc(h) + "</b></td><td>" + r + "</td></tr>";
    });
    el.rulesTable.innerHTML = html + "</tbody>";
  }

  function updateMeta() {
    const cols = curCols();
    if (el.feeNotice) el.feeNotice.hidden = !isFee();
    el.inputHint.textContent = "共 " + cols.length + " 列";
    el.colsInfo.innerHTML = cols.map((c, i) => '<span class="col-chip"><b>' + String.fromCharCode(65 + i) + "</b>" + esc(c) + "</span>").join("");
    if (el.btnTpl) el.btnTpl.href = TPL_FILES[currentType];
  }

  function handleInput() {
    inputRows = C.parseInput(el.input.value);
    outputRows = [];
    renderPreview();
    renderOutput();
    el.outputFoot.textContent = "尚未转换";
    el.outputFoot.className = "output-foot";
    el.outputHint.textContent = "";
    if (!inputRows.length) {
      el.parseStatus.textContent = "等待输入数据";
      el.parseStatus.className = "parse-status";
    } else {
      const cols = curCols();
      const shortRows = inputRows.filter((r) => r.length < cols.length).length;
      el.parseStatus.textContent = "已识别 " + inputRows.length + " 行" + (shortRows ? "（" + shortRows + " 行列数不足，已按空值处理）" : "");
      el.parseStatus.className = "parse-status " + (shortRows ? "warn" : "ok");
    }
  }

  function convert() {
    if (!inputRows.length) { toast("请先输入或上传模板数据"); return; }
    if (isFee()) {
      outputRows = C.convertFeeAndInstruction(inputRows);
      const cabCount = outputRows.filter((r) => !r.isTotal).length;
      renderOutput();
      el.outputHint.textContent = "已生成 " + cabCount + " 柜";
      el.outputFoot.className = "output-foot ok";
      el.outputFoot.textContent = "✓ 生成完成，共 " + cabCount + " 个柜（按工作号+客户名称分组），末行已汇总拦截费用";
      toast("生成完成：" + cabCount + " 柜");
      return;
    }
    const fn = TYPES[currentType].convert;
    outputRows = inputRows.map((r) => fn(r));
    const before = outputRows.map((r) => r["运单号"]);
    C.dedupeWaybills(currentType, outputRows);
    const dupCount = outputRows.filter((r, i) => r["运单号"] !== before[i]).length;
    renderOutput();
    const unmatched = outputRows.filter((r) => r["目的地"] && !r["邮编"]).length;
    const noTime = outputRows.filter((r) => r["渠道"] && !r["尾程派送"]).length;
    el.outputHint.textContent = "已转换 " + outputRows.length + " 行";
    el.outputFoot.className = "output-foot " + (unmatched || noTime ? "warn" : "ok");
    let msg = "✓ 转换完成，共 " + outputRows.length + " 行";
    if (dupCount) msg += " · " + dupCount + " 行重复运单号已加区分后缀";
    if (unmatched) msg += " · ⚠ " + unmatched + " 行邮编未匹配";
    if (noTime) msg += " · ⚠ " + noTime + " 行尾程派送未识别";
    el.outputFoot.textContent = msg;
    toast("转换完成：" + outputRows.length + " 行");
  }

  function dataMatrix() {
    const headers = curHeaders();
    return outputRows.map((r) => headers.map((h) => String(r[h] || "")));
  }

  function matrix() {
    return [curHeaders().slice()].concat(dataMatrix());
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => toast("已复制到剪贴板")).catch(() => fallbackCopy(text));
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); toast("已复制到剪贴板"); }
    catch (e) { toast("复制失败，请手动选择表格内容"); }
    document.body.removeChild(ta);
  }

  function csvCell(v) {
    const s = String(v == null ? "" : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  el.tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".type-tab");
    if (!btn) return;
    document.querySelectorAll(".type-tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentType = btn.dataset.type;
    outputRows = [];
    updateMeta();
    renderRules();
    handleInput();
  });

  el.input.addEventListener("input", handleInput);

  $("btnClear").addEventListener("click", () => { el.input.value = ""; handleInput(); toast("已清空"); });

  $("btnSample").addEventListener("click", () => {
    el.input.value = curExample().map((r) => r.join("\t")).join("\n");
    handleInput();
    toast("已填入示例数据");
  });

  $("btnPaste").addEventListener("click", async () => {
    try {
      const t = await navigator.clipboard.readText();
      el.input.value = t;
      handleInput();
      toast("已从剪贴板粘贴");
    } catch (e) {
      toast("无法读取剪贴板，请直接按 Ctrl+V 粘贴到输入框");
    }
  });

  el.file.addEventListener("change", (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
        el.input.value = aoa.map((row) => row.map((c) => String(c).trim()).join("\t")).join("\n");
        handleInput();
        toast("已读取文件：" + f.name);
      } catch (err) {
        toast("文件读取失败，请确认是 Excel 或 CSV 文件");
      }
    };
    reader.readAsArrayBuffer(f);
    e.target.value = "";
  });

  $("btnConvert").addEventListener("click", convert);

  $("btnCopy").addEventListener("click", () => {
    if (!outputRows.length) { toast("请先转换数据"); return; }
    copyText(dataMatrix().map((r) => r.join("\t")).join("\n"));
  });

  $("btnDownload").addEventListener("click", () => {
    if (!outputRows.length) { toast("请先转换数据"); return; }
    const headers = curHeaders();
    const ws = XLSX.utils.aoa_to_sheet(matrix());
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(12, String(h).length * 2 + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isFee() ? "拦截费及指令" : "转换结果");
    XLSX.writeFile(wb, isFee() ? "拦截费及拦截指令.xlsx" : "转换结果.xlsx");
    toast("Excel 已下载");
  });

  $("btnDownloadCsv").addEventListener("click", () => {
    if (!outputRows.length) { toast("请先转换数据"); return; }
    const csv = "\ufeff" + matrix().map((r) => r.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = isFee() ? "拦截费及拦截指令.csv" : "转换结果.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("CSV 已下载");
  });

  $("btnRules").addEventListener("click", () => { el.rulesCard.hidden = !el.rulesCard.hidden; });
  $("btnCloseRules").addEventListener("click", () => { el.rulesCard.hidden = true; });

  updateMeta();
  renderRules();
  handleInput();
})();
