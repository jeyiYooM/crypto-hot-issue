const el = (id) => document.getElementById(id);

const UPBIT_MARKETS = { BTC: "KRW-BTC", ETH: "KRW-ETH", SOL: "KRW-SOL", XRP: "KRW-XRP" };

const DEFAULT_SETTINGS = {
  coins: ["BTC", "ETH", "SOL", "XRP"],
  price: { enabled: true, thresholdPct: 3, windowMinutes: 60 },
  trend: { enabled: true, topN: 5 },
  whale: { enabled: true, btcThreshold: 50, blocksToScan: 3 },
};

const SETTINGS_KEY = "hotissue_settings_v1";
const SEEN_TREND_KEY = "hotissue_seen_trend_v1";
const SEEN_WHALE_KEY = "hotissue_seen_whale_v1";

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      coins: parsed.coins || DEFAULT_SETTINGS.coins,
      price: { ...DEFAULT_SETTINGS.price, ...(parsed.price || {}) },
      trend: { ...DEFAULT_SETTINGS.trend, ...(parsed.trend || {}) },
      whale: { ...DEFAULT_SETTINGS.whale, ...(parsed.whale || {}) },
    };
  } catch (e) {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function loadSeenSet(key) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch (e) {
    return new Set();
  }
}

function saveSeenSet(key, set, cap) {
  localStorage.setItem(key, JSON.stringify(Array.from(set).slice(-cap)));
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s == null ? "" : String(s);
  return div.innerHTML;
}

function fmtTime(date) {
  return date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ---------- Price ----------

async function fetchPriceData(settings) {
  const results = [];
  for (const coin of settings.coins) {
    const market = UPBIT_MARKETS[coin];
    if (!market) continue;
    try {
      const res = await fetch(`https://api.upbit.com/v1/candles/minutes/5?market=${market}&count=12`);
      const candles = await res.json();
      if (!Array.isArray(candles) || candles.length === 0) throw new Error("empty");
      const latest = candles[0].trade_price;
      const oldest = candles[candles.length - 1].trade_price;
      const pct = oldest ? ((latest - oldest) / oldest) * 100 : 0;
      results.push({ coin, price: latest, pct, ok: true });
    } catch (e) {
      results.push({ coin, ok: false });
    }
  }
  return results;
}

function renderPrice(priceData, settings) {
  const strip = el("price-strip");
  strip.innerHTML = "";
  priceData.forEach((p) => {
    const card = document.createElement("div");
    card.className = "price-card";
    if (!p.ok) {
      card.innerHTML = `<div class="price-coin">${p.coin}</div><div class="price-error">조회 실패</div>`;
    } else {
      const pctClass = p.pct > 0 ? "pct-up" : p.pct < 0 ? "pct-down" : "";
      const sign = p.pct > 0 ? "+" : "";
      card.innerHTML = `
        <div class="price-coin">${p.coin}</div>
        <div class="price-value">₩${Math.round(p.price).toLocaleString("ko-KR")}</div>
        <div class="price-pct ${pctClass}">${sign}${p.pct.toFixed(2)}%</div>
      `;
    }
    strip.appendChild(card);
  });

  const surges = priceData.filter((p) => p.ok && Math.abs(p.pct) >= settings.price.thresholdPct);
  const surgeList = el("price-surge-list");
  if (surges.length === 0) {
    surgeList.innerHTML = `<div class="empty-state">최근 ${settings.price.windowMinutes}분 내 ${settings.price.thresholdPct}% 이상 변동은 없어요.</div>`;
  } else {
    surgeList.innerHTML = "";
    surges.forEach((p) => {
      const direction = p.pct > 0 ? "급등" : "급락";
      const item = document.createElement("div");
      item.className = "alert-item source-price";
      item.innerHTML = `
        <div class="alert-top">
          <span class="tag source-tag">가격</span>
          <span class="tag coin-tag">${p.coin}</span>
        </div>
        <div class="alert-title">${p.coin} ${direction} ${p.pct > 0 ? "+" : ""}${p.pct.toFixed(2)}% (${settings.price.windowMinutes}분)</div>
        <div class="alert-detail">현재가 ₩${Math.round(p.price).toLocaleString("ko-KR")}</div>
      `;
      surgeList.appendChild(item);
    });
  }
}

// ---------- Trend ----------

async function fetchTrendData(settings) {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/search/trending");
    const data = await res.json();
    const items = (data.coins || []).slice(0, settings.trend.topN).map((c) => c.item);
    const seen = loadSeenSet(SEEN_TREND_KEY);
    const result = items.map((item) => ({
      id: item.id,
      name: item.name,
      symbol: (item.symbol || "").toUpperCase(),
      rank: (item.score || 0) + 1,
      isNew: !seen.has(item.id),
      url: `https://www.coingecko.com/en/coins/${item.id}`,
    }));
    saveSeenSet(SEEN_TREND_KEY, new Set(items.map((i) => i.id)), 50);
    return result;
  } catch (e) {
    return [];
  }
}

function renderTrend(trendData) {
  const list = el("trend-list");
  if (trendData.length === 0) {
    list.innerHTML = '<div class="empty-state">트렌드 정보를 불러오지 못했어요.</div>';
    return;
  }
  list.innerHTML = "";
  trendData.forEach((t) => {
    const item = document.createElement("div");
    item.className = "alert-item source-trend clickable";
    item.addEventListener("click", () => window.open(t.url, "_blank"));
    item.innerHTML = `
      <div class="alert-top">
        <span class="tag source-tag">트렌드</span>
        <span class="tag coin-tag">${escapeHtml(t.symbol)}</span>
        ${t.isNew ? '<span class="tag new-tag">NEW</span>' : ""}
      </div>
      <div class="alert-title">${escapeHtml(t.name)}</div>
      <div class="alert-detail">CoinGecko 검색 트렌딩 ${t.rank}위</div>
    `;
    list.appendChild(item);
  });
}

// ---------- Whale ----------

async function fetchWhaleData(settings) {
  const threshold = settings.whale.btcThreshold;
  const blocksToScan = settings.whale.blocksToScan || 3;
  const results = [];
  const seen = loadSeenSet(SEEN_WHALE_KEY);
  const merged = new Set(seen);
  try {
    const tipRes = await fetch("https://blockstream.info/api/blocks/tip/height");
    const tipHeight = parseInt((await tipRes.text()).trim(), 10);
    for (let h = tipHeight; h > tipHeight - blocksToScan; h--) {
      const hashRes = await fetch(`https://blockstream.info/api/block-height/${h}`);
      const blockHash = (await hashRes.text()).trim();
      for (let page = 0; page < 2; page++) {
        const txRes = await fetch(`https://blockstream.info/api/block/${blockHash}/txs/${page * 25}`);
        if (!txRes.ok) break;
        const txs = await txRes.json();
        if (!Array.isArray(txs) || txs.length === 0) break;
        txs.forEach((tx) => {
          const totalBtc = (tx.vout || []).reduce((sum, o) => sum + (o.value || 0), 0) / 1e8;
          if (totalBtc >= threshold) {
            results.push({
              txid: tx.txid,
              totalBtc,
              height: h,
              isNew: !seen.has(tx.txid),
              url: `https://blockstream.info/tx/${tx.txid}`,
            });
            merged.add(tx.txid);
          }
        });
        if (txs.length < 25) break;
      }
    }
  } catch (e) {
    // partial or empty results on network error
  }
  saveSeenSet(SEEN_WHALE_KEY, merged, 1000);
  return results.sort((a, b) => b.totalBtc - a.totalBtc).slice(0, 20);
}

function renderWhale(whaleData, settings) {
  const list = el("whale-list");
  if (whaleData.length === 0) {
    list.innerHTML = `<div class="empty-state">최근 블록에 BTC ${settings.whale.btcThreshold}개 이상 거래는 없었어요.</div>`;
    return;
  }
  list.innerHTML = "";
  whaleData.forEach((w) => {
    const item = document.createElement("div");
    item.className = "alert-item source-whale clickable";
    item.addEventListener("click", () => window.open(w.url, "_blank"));
    item.innerHTML = `
      <div class="alert-top">
        <span class="tag source-tag">고래</span>
        <span class="tag coin-tag">BTC</span>
        ${w.isNew ? '<span class="tag new-tag">NEW</span>' : ""}
      </div>
      <div class="alert-title">BTC 대형 거래: ${w.totalBtc.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} BTC</div>
      <div class="alert-detail">블록 #${w.height}</div>
    `;
    list.appendChild(item);
  });
}

// ---------- Orchestration ----------

async function refresh() {
  const settings = loadSettings();
  const btn = el("refresh-btn");
  btn.classList.add("loading");

  const tasks = [];
  tasks.push(settings.price.enabled ? fetchPriceData(settings) : Promise.resolve(null));
  tasks.push(settings.trend.enabled ? fetchTrendData(settings) : Promise.resolve(null));
  tasks.push(settings.whale.enabled ? fetchWhaleData(settings) : Promise.resolve(null));

  const [priceData, trendData, whaleData] = await Promise.all(tasks);

  toggleSection("price-section", settings.price.enabled);
  toggleSection("trend-section", settings.trend.enabled);
  toggleSection("whale-section", settings.whale.enabled);

  if (priceData) renderPrice(priceData, settings);
  if (trendData) renderTrend(trendData);
  if (whaleData) renderWhale(whaleData, settings);

  el("updated-at").textContent = "마지막 업데이트: " + fmtTime(new Date());
  btn.classList.remove("loading");
}

function toggleSection(id, enabled) {
  el(id).style.display = enabled ? "" : "none";
}

// ---------- Settings modal ----------

function openSettings() {
  const settings = loadSettings();
  el("src-price").checked = settings.price.enabled;
  el("price-threshold").value = settings.price.thresholdPct;
  el("src-trend").checked = settings.trend.enabled;
  el("trend-topn").value = settings.trend.topN;
  el("src-whale").checked = settings.whale.enabled;
  el("whale-threshold").value = settings.whale.btcThreshold;
  el("settings-overlay").classList.add("open");
}

function closeSettings() {
  el("settings-overlay").classList.remove("open");
}

function saveSettingsFromForm() {
  const settings = loadSettings();
  settings.price.enabled = el("src-price").checked;
  settings.price.thresholdPct = parseFloat(el("price-threshold").value) || 3;
  settings.trend.enabled = el("src-trend").checked;
  settings.trend.topN = parseInt(el("trend-topn").value, 10) || 5;
  settings.whale.enabled = el("src-whale").checked;
  settings.whale.btcThreshold = parseFloat(el("whale-threshold").value) || 50;
  saveSettings(settings);
  closeSettings();
  refresh();
}

window.addEventListener("DOMContentLoaded", () => {
  refresh();

  el("refresh-btn").addEventListener("click", refresh);
  el("settings-btn").addEventListener("click", openSettings);
  el("settings-cancel").addEventListener("click", closeSettings);
  el("settings-save").addEventListener("click", saveSettingsFromForm);
  el("settings-overlay").addEventListener("click", (e) => {
    if (e.target === el("settings-overlay")) closeSettings();
  });

  // Live updates only while this tab stays open - nothing runs once it's closed.
  setInterval(() => {
    const settings = loadSettings();
    if (settings.price.enabled) fetchPriceData(settings).then((d) => renderPrice(d, settings));
  }, 30000);
  setInterval(refresh, 3 * 60 * 1000);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js", { scope: "./" }).catch(() => {});
  }
});
