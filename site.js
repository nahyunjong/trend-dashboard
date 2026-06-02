let docs = [];

const nav = document.getElementById("nav");
const content = document.getElementById("content");
const docTitle = document.getElementById("docTitle");
const docMeta = document.getElementById("docMeta");
const openRaw = document.getElementById("openRaw");
let currentPath = "";

function renderNav() {
  const groups = new Map();
  docs.forEach(doc => {
    if (!groups.has(doc.section)) groups.set(doc.section, []);
    groups.get(doc.section).push(doc);
  });
  nav.innerHTML = "";
  for (const [section, items] of groups) {
    const wrap = document.createElement("section");
    wrap.className = "nav-section";
    const h = document.createElement("h3");
    h.textContent = section;
    wrap.appendChild(h);
    items.forEach(doc => {
      const btn = document.createElement("button");
      btn.className = "nav-link";
      btn.textContent = doc.title;
      btn.addEventListener("click", () => loadDoc(doc));
      btn.dataset.path = doc.path;
      wrap.appendChild(btn);
    });
    nav.appendChild(wrap);
  }
}

async function loadDoc(doc) {
  currentPath = doc.path;
  document.querySelectorAll(".nav-link").forEach(el => el.classList.toggle("active", el.dataset.path === doc.path));
  docTitle.textContent = doc.section + " / " + doc.title;
  docMeta.textContent = doc.path;
  content.innerHTML = "<p>불러오는 중...</p>";
  try {
    const res = await fetch(doc.path, { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const md = await res.text();
    content.innerHTML = marked.parse(md);
    renderStockChartIfNeeded(doc);
  } catch (error) {
    content.innerHTML = `<h2>문서를 불러오지 못했습니다</h2><p>${error.message}</p><p>정적 파일 서버로 열었는지 확인하세요.</p>`;
  }
}

function parseNumber(value) {
  const n = Number(String(value || "").replace(/,/g, "").replace("%", "").trim());
  return Number.isFinite(n) ? n : null;
}

function renderStockChartIfNeeded(doc) {
  if (!doc.path.endsWith("주가_동향/주가_동향.md")) return;

  const tables = [...content.querySelectorAll("table")];
  const stockTable = tables.find(table => {
    const headers = [...table.querySelectorAll("thead th")].map(th => th.textContent.trim());
    return headers.includes("업데이트일") && headers.includes("티커") && headers.includes("종가");
  });
  if (!stockTable) return;

  const rows = [...stockTable.querySelectorAll("tbody tr")].map(row => {
    const cells = [...row.querySelectorAll("td")].map(td => td.textContent.trim());
    return {
      updateDate: cells[0],
      category: cells[1],
      company: cells[2],
      ticker: cells[3],
      close: parseNumber(cells[5]),
      status: cells[8],
    };
  }).filter(row => row.updateDate && row.ticker && row.close !== null && row.status === "수집 완료");

  const byTicker = new Map();
  rows.forEach(row => {
    if (!byTicker.has(row.ticker)) byTicker.set(row.ticker, new Map());
    byTicker.get(row.ticker).set(row.updateDate, row);
  });
  if (byTicker.size === 0) return;

  const chart = document.createElement("section");
  chart.className = "stock-chart";
  chart.innerHTML = `
    <div class="stock-chart-toolbar">
      <label for="stockTickerSelect">종목</label>
      <select id="stockTickerSelect"></select>
      <span id="stockChartMeta"></span>
    </div>
    <canvas id="stockChartCanvas" width="960" height="360"></canvas>
  `;

  const heading = [...content.querySelectorAll("h2")].find(h => h.textContent.trim() === "종목별 그래프");
  if (heading) heading.insertAdjacentElement("afterend", chart);
  else content.insertBefore(chart, content.firstChild);

  const select = chart.querySelector("#stockTickerSelect");
  const meta = chart.querySelector("#stockChartMeta");
  const canvas = chart.querySelector("#stockChartCanvas");
  const tickers = [...byTicker.keys()].sort();
  tickers.forEach(ticker => {
    const option = document.createElement("option");
    option.value = ticker;
    option.textContent = ticker;
    select.appendChild(option);
  });

  function draw(ticker) {
    const points = [...byTicker.get(ticker).values()]
      .sort((a, b) => a.updateDate.localeCompare(b.updateDate));
    meta.textContent = `${points.length}개 일자`;
    drawLineChart(canvas, points.map(p => ({ label: p.updateDate, value: p.close })), ticker);
  }

  select.addEventListener("change", () => draw(select.value));
  draw(select.value);
}

function drawLineChart(canvas, points, title) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const pad = { left: 64, right: 24, top: 34, bottom: 54 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const values = points.map(p => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min = min * 0.98;
    max = max * 1.02;
  }

  ctx.font = "13px Segoe UI, Malgun Gothic, Arial";
  ctx.fillStyle = "#1f2937";
  ctx.fillText(`${title} 종가`, pad.left, 20);

  ctx.strokeStyle = "#d8dee8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, height - pad.bottom);
  ctx.lineTo(width - pad.right, height - pad.bottom);
  ctx.stroke();

  for (let i = 0; i <= 4; i += 1) {
    const y = pad.top + (plotHeight * i / 4);
    const value = max - ((max - min) * i / 4);
    ctx.strokeStyle = "#eef2f7";
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = "#6b7280";
    ctx.fillText(value.toFixed(2), 8, y + 4);
  }

  const xFor = index => pad.left + (points.length === 1 ? plotWidth / 2 : plotWidth * index / (points.length - 1));
  const yFor = value => pad.top + (max - value) / (max - min) * plotHeight;

  ctx.strokeStyle = "#0f766e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = xFor(index);
    const y = yFor(point.value);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  points.forEach((point, index) => {
    const x = xFor(index);
    const y = yFor(point.value);
    ctx.fillStyle = "#0f766e";
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  const labelStep = Math.max(1, Math.ceil(points.length / 6));
  ctx.fillStyle = "#6b7280";
  points.forEach((point, index) => {
    if (index % labelStep !== 0 && index !== points.length - 1) return;
    const x = xFor(index);
    ctx.save();
    ctx.translate(x, height - pad.bottom + 18);
    ctx.rotate(-Math.PI / 8);
    ctx.fillText(point.label.slice(5), -16, 0);
    ctx.restore();
  });
}

async function init() {
  try {
    const res = await fetch("docs.json", { cache: "no-store" });
    docs = await res.json();
  } catch (error) {
    docs = [{ section: "오류", title: "docs.json 로드 실패", path: "content/README.md" }];
  }
  renderNav();
  if (docs.length > 0) loadDoc(docs[0]);
}

openRaw.addEventListener("click", () => {
  if (currentPath) window.open(currentPath, "_blank");
});

init();
