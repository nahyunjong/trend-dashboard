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
  } catch (error) {
    content.innerHTML = `<h2>문서를 불러오지 못했습니다</h2><p>${error.message}</p><p>정적 파일 서버로 열었는지 확인하세요.</p>`;
  }
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
