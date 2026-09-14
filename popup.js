const state = {
  symbol: "BTCUSDT",
  interval: "15m",
  contextCandles: [],
  capital: 0,
  riskProfile: "balanced",
  tradeDuration: "intraday",
  notifyEnable: false,
  notifyThreshold: 80,
  lastNotificationTime: 0,
  candles: [],
  ticker: null,
  depth: null,
  socket: null,
  poller: null,
  lastBias: "TRUNG LẬP",
};

const els = {
  connectionStatus: document.querySelector("#connectionStatus"),
  symbolSelect: document.querySelector("#symbolSelect"),
  intervalSelect: document.querySelector("#intervalSelect"),
  capitalInput: document.querySelector("#capitalInput"),
  riskProfileSelect: document.querySelector("#riskProfileSelect"),
  tradeDurationSelect: document.querySelector("#tradeDurationSelect"),
  notifyEnable: document.querySelector("#notifyEnable"),
  notifyThreshold: document.querySelector("#notifyThreshold"),
  refreshButton: document.querySelector("#refreshButton"),
  lastPrice: document.querySelector("#lastPrice"),
  priceChange: document.querySelector("#priceChange"),
  signalText: document.querySelector("#signalText"),
  confidenceText: document.querySelector("#confidenceText"),
  forecastText: document.querySelector("#forecastText"),
  horizonText: document.querySelector("#horizonText"),
  leverageText: document.querySelector("#leverageText"),
  leverageReason: document.querySelector("#leverageReason"),
  updatedAt: document.querySelector("#updatedAt"),
  indicatorList: document.querySelector("#indicatorList"),
  strategyList: document.querySelector("#strategyList"),
  fillLongButton: document.querySelector("#fillLongButton"),
  fillShortButton: document.querySelector("#fillShortButton"),
  fillStatus: document.querySelector("#fillStatus"),
  chart: document.querySelector("#priceChart"),
  btnHomeTab: document.querySelector("#btnHomeTab"),
  btnNoteTab: document.querySelector("#btnNoteTab"),
  homeView: document.querySelector("#homeView"),
  noteView: document.querySelector("#noteView"),
  noteBalance: document.querySelector("#noteBalance"),
  noteRiskProfile: document.querySelector("#noteRiskProfile"),
  noteMaxInvest: document.querySelector("#noteMaxInvest"),
  noteSymbolInput: document.querySelector("#noteSymbolInput"),
  btnAnalyzeNote: document.querySelector("#btnAnalyzeNote"),
  noteAnalysisLoading: document.querySelector("#noteAnalysisLoading"),
  noteAnalysisResult: document.querySelector("#noteAnalysisResult"),
  noteTechnicalText: document.querySelector("#noteTechnicalText"),
  notePlanText: document.querySelector("#notePlanText"),
};

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });
const pct = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, signDisplay: "always" });

function setStatus(text, mode = "") {
  els.connectionStatus.textContent = text;
  els.connectionStatus.className = `status ${mode}`.trim();
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function isOkxSymbol(symbol) {
  return symbol === "NESUSDT";
}

function okxInstId(symbol) {
  if (symbol === "NESUSDT") return "NES-USDT-SWAP";
  return symbol.replace("USDT", "-USDT");
}

function okxBar(interval) {
  return interval === "1m" ? "1m" : interval === "5m" ? "5m" : interval === "15m" ? "15m" : interval === "1h" ? "1H" : interval === "4h" ? "4H" : "1D";
}

function getIntervals() {
  if (state.tradeDuration === "scalping") return { trigger: "5m", context: "15m", horizon: "15 - 45 phút" };
  if (state.tradeDuration === "swing") return { trigger: "4h", context: "1d", horizon: "2 - 7 ngày" };
  return { trigger: "15m", context: "1h", horizon: "4 - 12 giờ" };
}

async function loadInitialMarket() {
  setStatus("Đang tải dữ liệu", "");
  const { trigger, context } = getIntervals();
  state.interval = trigger;

  if (isOkxSymbol(state.symbol)) {
    await loadOkxMarket(context);
    return;
  }

  const [klines, contextKlines, ticker, depth] = await Promise.all([
    fetchJson(`https://api.binance.com/api/v3/klines?symbol=${state.symbol}&interval=${trigger}&limit=160`),
    fetchJson(`https://api.binance.com/api/v3/klines?symbol=${state.symbol}&interval=${context}&limit=100`),
    fetchJson(`https://api.binance.com/api/v3/ticker/24hr?symbol=${state.symbol}`),
    fetchJson(`https://api.binance.com/api/v3/depth?symbol=${state.symbol}&limit=20`),
  ]);

  state.candles = klines.map(toCandle);
  state.contextCandles = contextKlines.map(toCandle);
  state.ticker = ticker;
  state.depth = depth;
  render();
  connectRealtime();
}

async function loadOkxMarket(context) {
  closeRealtime();
  const instId = okxInstId(state.symbol);
  const [candlesRes, contextRes, tickerRes, depthRes] = await Promise.all([
    fetchJson(`https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=${okxBar(state.interval)}&limit=160`),
    fetchJson(`https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=${okxBar(context)}&limit=100`),
    fetchJson(`https://www.okx.com/api/v5/market/ticker?instId=${instId}`),
    fetchJson(`https://www.okx.com/api/v5/market/books?instId=${instId}&sz=20`),
  ]);

  if (candlesRes.code !== "0" || tickerRes.code !== "0" || depthRes.code !== "0") {
    throw new Error("OKX không trả dữ liệu hợp lệ cho NESUSDT");
  }

  state.candles = candlesRes.data.map(toOkxCandle).reverse();
  state.contextCandles = contextRes.code === "0" ? contextRes.data.map(toOkxCandle).reverse() : [];
  state.ticker = toOkxTicker(tickerRes.data[0]);
  state.depth = toOkxDepth(depthRes.data[0]);
  render();
  setStatus("OKX realtime", "live");

  state.poller = setInterval(refreshOkxSnapshot, 2500);
}

async function refreshOkxSnapshot() {
  if (!isOkxSymbol(state.symbol)) return;
  try {
    const instId = okxInstId(state.symbol);
    const [candlesRes, tickerRes, depthRes] = await Promise.all([
      fetchJson(`https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=${okxBar(state.interval)}&limit=160`),
      fetchJson(`https://www.okx.com/api/v5/market/ticker?instId=${instId}`),
      fetchJson(`https://www.okx.com/api/v5/market/books?instId=${instId}&sz=20`),
    ]);

    if (candlesRes.code === "0") state.candles = candlesRes.data.map(toOkxCandle).reverse();
    if (tickerRes.code === "0") state.ticker = toOkxTicker(tickerRes.data[0]);
    if (depthRes.code === "0") state.depth = toOkxDepth(depthRes.data[0]);
    render();
    setStatus("OKX realtime", "live");
  } catch (error) {
    console.error(error);
    setStatus("Lỗi OKX", "error");
  }
}

function toCandle(kline) {
  return {
    time: kline[0],
    open: Number(kline[1]),
    high: Number(kline[2]),
    low: Number(kline[3]),
    close: Number(kline[4]),
    volume: Number(kline[5]),
  };
}

function toOkxCandle(candle) {
  return {
    time: Number(candle[0]),
    open: Number(candle[1]),
    high: Number(candle[2]),
    low: Number(candle[3]),
    close: Number(candle[4]),
    volume: Number(candle[5]),
  };
}

function toOkxTicker(ticker) {
  const open24h = Number(ticker.open24h);
  const last = Number(ticker.last);
  const changePercent = open24h ? ((last - open24h) / open24h) * 100 : 0;
  return { lastPrice: ticker.last, priceChangePercent: String(changePercent) };
}

function toOkxDepth(depth) {
  return {
    bids: depth.bids.map(([price, qty]) => [price, qty]),
    asks: depth.asks.map(([price, qty]) => [price, qty]),
  };
}

function closeRealtime() {
  if (state.socket) {
    state.socket.close();
    state.socket = null;
  }
  if (state.poller) {
    clearInterval(state.poller);
    state.poller = null;
  }
}

function connectRealtime() {
  closeRealtime();
  const streamSymbol = state.symbol.toLowerCase();
  const streams = `${streamSymbol}@kline_${state.interval}/${streamSymbol}@ticker/${streamSymbol}@depth20@1000ms`;
  state.socket = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

  state.socket.onopen = () => setStatus("Realtime", "live");
  state.socket.onerror = () => setStatus("Lỗi kết nối", "error");
  state.socket.onclose = () => setStatus("Ngắt kết nối", "error");
  state.socket.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    const data = payload.data;
    if (data.e === "kline") updateKline(data.k);
    if (data.e === "24hrTicker") state.ticker = data;
    if (data.lastUpdateId && data.bids) state.depth = data;
    render();
  };
}

function updateKline(kline) {
  const candle = {
    time: kline.t,
    open: Number(kline.o),
    high: Number(kline.h),
    low: Number(kline.l),
    close: Number(kline.c),
    volume: Number(kline.v),
  };
  const last = state.candles[state.candles.length - 1];
  if (last && last.time === candle.time) state.candles[state.candles.length - 1] = candle;
  else state.candles = [...state.candles.slice(-159), candle];
}

function sma(values, period) {
  if (values.length < period) return null;
  return values.slice(-period).reduce((sum, item) => sum + item, 0) / period;
}

function ema(values, period) {
  if (values.length < period) return null;
  const multiplier = 2 / (period + 1);
  let average = sma(values.slice(0, period), period);
  for (let i = period; i < values.length; i++) average = values[i] * multiplier + average * (1 - multiplier);
  return average;
}

function rsi(values, period = 14) {
  if (values.length <= period) return null;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gains += delta;
    else losses -= delta;
  }
  if (losses === 0) return 100;
  const relativeStrength = gains / losses;
  return 100 - 100 / (1 + relativeStrength);
}

function macd(values) {
  const fast = ema(values, 12);
  const slow = ema(values, 26);
  if (fast === null || slow === null) return null;
  return fast - slow;
}

function bollinger(values, period = 20) {
  const middle = sma(values, period);
  if (middle === null) return null;
  const slice = values.slice(-period);
  const variance = slice.reduce((sum, value) => sum + (value - middle) ** 2, 0) / period;
  const deviation = Math.sqrt(variance);
  return { upper: middle + deviation * 2, middle, lower: middle - deviation * 2 };
}

function atr(candles, period = 14) {
  if (candles.length <= period) return null;
  const ranges = [];
  for (let i = candles.length - period; i < candles.length; i++) {
    const current = candles[i];
    const previous = candles[i - 1];
    ranges.push(Math.max(current.high - current.low, Math.abs(current.high - previous.close), Math.abs(current.low - previous.close)));
  }
  return ranges.reduce((sum, range) => sum + range, 0) / period;
}

function orderBookImbalance(depth) {
  if (!depth?.bids || !depth?.asks) return 0;
  const bidVolume = depth.bids.reduce((sum, [, qty]) => sum + Number(qty), 0);
  const askVolume = depth.asks.reduce((sum, [, qty]) => sum + Number(qty), 0);
  return (bidVolume - askVolume) / Math.max(bidVolume + askVolume, 1);
}

function riskProfileConfig() {
  const profiles = {
    safe: { label: "An toàn", leverageBoost: -2, riskMultiplier: 0.65, maxMargin: 0.08, minConfidence: 68, maxLeverage: 5 },
    balanced: { label: "Cân bằng", leverageBoost: 0, riskMultiplier: 1, maxMargin: 0.14, minConfidence: 60, maxLeverage: 10 },
    aggressive: { label: "Mạo hiểm", leverageBoost: 3, riskMultiplier: 1.55, maxMargin: 0.24, minConfidence: 55, maxLeverage: 20 },
  };
  return profiles[state.riskProfile] || profiles.balanced;
}

function recommendLeverage({ bias, confidence, atr14, last, volumeRatio, rsi14 }) {
  const profile = riskProfileConfig();
  if (bias === "TRUNG LẬP") {
    return { value: "Không vào", reason: "Tín hiệu chưa rõ, tránh dùng đòn bẩy" };
  }
  if (confidence < profile.minConfidence) {
    return { value: "Không vào", reason: `${profile.label}: chờ tín hiệu tối thiểu ${profile.minConfidence}%` };
  }

  const volatilityPercent = atr14 && last ? (atr14 / last) * 100 : 0.8;
  let leverage = confidence >= 82 ? 8 : confidence >= 72 ? 5 : confidence >= 62 ? 3 : 2;
  leverage += profile.leverageBoost;

  if (volatilityPercent > 2.5) leverage -= 3;
  else if (volatilityPercent > 1.4) leverage -= 2;
  else if (volatilityPercent > 0.8) leverage -= 1;

  if (volumeRatio > 2.2) leverage -= 1;
  if ((bias === "LONG" && rsi14 > 74) || (bias === "SHORT" && rsi14 < 26)) leverage -= 1;

  leverage = Math.max(1, Math.min(profile.maxLeverage, leverage));
  return {
    value: `${leverage}x`,
    reason: `${profile.label} | ATR ${fmt.format(volatilityPercent)}% | tin cậy ${confidence}%`,
  };
}

function parseLeverageValue(leverage) {
  const value = Number.parseFloat(String(leverage.value).replace("x", ""));
  return Number.isFinite(value) ? value : 0;
}

function riskPercentFor(result) {
  if (result.bias === "TRUNG LẬP") return 0;
  const profile = riskProfileConfig();
  let baseRisk = 0.25;
  if (result.confidence >= 82 && Math.abs(result.score) >= 48) baseRisk = 1.2;
  else if (result.confidence >= 72 && Math.abs(result.score) >= 36) baseRisk = 0.8;
  else if (result.confidence >= 62) baseRisk = 0.5;
  return Math.min(2, baseRisk * profile.riskMultiplier);
}

function estimateLiquidation(entry, leverageNumber, direction) {
  if (!entry || !leverageNumber || !direction) return null;
  const maintenanceBuffer = 0.006;
  return direction > 0
    ? entry * (1 - 1 / leverageNumber + maintenanceBuffer)
    : entry * (1 + 1 / leverageNumber - maintenanceBuffer);
}

function tradePlan(result, forcedSide = null) {
  const profile = riskProfileConfig();
  const planBias = forcedSide || result.bias;
  const direction = planBias === "SHORT" ? -1 : planBias === "LONG" ? 1 : 0;

  let atrMultiplierSL = 1.2;
  let atrMultiplierTP = 1.8;
  if (state.tradeDuration === "scalping") {
    atrMultiplierSL = 0.6;
    atrMultiplierTP = 1.0;
  } else if (state.tradeDuration === "swing") {
    atrMultiplierSL = 2.4;
    atrMultiplierTP = 4.0;
  }

  const entryOffset = result.atr14 ? result.atr14 * 0.12 * direction : result.last * 0.001 * direction;
  const entry = direction === 0 ? result.last : result.last + entryOffset;
  const stop = direction === 0
    ? result.last
    : entry - direction * (result.atr14 ? result.atr14 * atrMultiplierSL : result.last * 0.01);
  const takeProfit = direction === 0
    ? result.last
    : entry + direction * (result.atr14 ? result.atr14 * atrMultiplierTP : result.last * 0.015);
  const leverageNumber = parseLeverageValue(result.leverage);
  const walletBalance = state.capital;
  const riskPercent = riskPercentFor(result);
  const maxRisk = walletBalance > 0 ? walletBalance * (riskPercent / 100) : 0;
  const stopDistance = Math.abs(entry - stop);
  const riskBasedNotional = stopDistance > 0 ? (maxRisk * entry) / stopDistance : 0;
  const confidenceMargin = result.confidence >= 82 ? profile.maxMargin : result.confidence >= 72 ? profile.maxMargin * 0.72 : profile.maxMargin * 0.5;
  const maxMarginPercent = Math.max(0.02, confidenceMargin);
  const maxMargin = walletBalance * maxMarginPercent;
  const marginFromRisk = leverageNumber > 0 ? riskBasedNotional / leverageNumber : 0;
  const margin = direction !== 0 && walletBalance > 0 && leverageNumber > 0 ? Math.min(marginFromRisk, maxMargin) : 0;
  const notional = margin * leverageNumber;
  const quantity = entry > 0 ? notional / entry : 0;
  const riskAmount = direction === 0 ? 0 : Math.abs(entry - stop) * quantity;
  const rewardAmount = direction === 0 ? 0 : Math.abs(takeProfit - entry) * quantity;
  const rewardRiskRatio = riskAmount > 0 ? rewardAmount / riskAmount : 0;
  const liquidation = estimateLiquidation(entry, leverageNumber, direction);
  const losingTradesToStop = riskAmount > 0 ? Math.max(1, Math.floor((walletBalance * 0.08) / riskAmount)) : 0;

  return { side: planBias, entry, stop, takeProfit, margin, notional, quantity, riskAmount, rewardAmount, rewardRiskRatio, walletBalance, riskPercent, maxRisk, maxMarginPercent, liquidation, losingTradesToStop, profile, leverageNumber };
}

function setFillStatus(text, mode = "") {
  els.fillStatus.textContent = text;
  els.fillStatus.className = `fill-status ${mode}`.trim();
}

function buildAutofillPayload(side) {
  if (!state.candles.length) throw new Error("Chưa có dữ liệu thị trường để tính lệnh.");
  const result = analyze();
  if (result.bias === "TRUNG LẬP") throw new Error("Tín hiệu đang trung lập, không nên tự điền lệnh.");
  if (result.bias !== side) throw new Error(`Tín hiệu hiện tại là ${result.bias}, không khớp với nút ${side}.`);

  const plan = tradePlan(result, side);
  if (!state.capital) throw new Error("Hãy nhập vốn ví hiện tại trước.");
  if (!plan.margin || !plan.quantity || !plan.leverageNumber) throw new Error("Kế hoạch vốn chưa hợp lệ để điền lệnh.");

  return {
    side,
    symbol: state.symbol,
    entry: Number(plan.entry.toFixed(8)),
    takeProfit: Number(plan.takeProfit.toFixed(8)),
    stopLoss: Number(plan.stop.toFixed(8)),
    leverage: plan.leverageNumber,
    margin: Number(plan.margin.toFixed(4)),
    notional: Number(plan.notional.toFixed(4)),
    quantity: Number(plan.quantity.toFixed(6)),
    riskAmount: Number(plan.riskAmount.toFixed(4)),
    confidence: result.confidence,
    generatedAt: new Date().toISOString(),
  };
}

async function fillOkxOrder(side) {
  try {
    setFillStatus(`Đang chuẩn bị điền ${side}...`, "warn");
    const payload = buildAutofillPayload(side);
    const tabs = await chrome.tabs.query({ url: "*://*.okx.com/*" });
    const tab = tabs.find((t) => t.active) || tabs[0];
    if (!tab?.id) throw new Error("Hãy mở tab OKX rồi bấm lại.");

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { type: "FILL_OKX_ORDER", payload });
    } catch (error) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["okx-autofill.js"] });
      response = await chrome.tabs.sendMessage(tab.id, { type: "FILL_OKX_ORDER", payload });
    }
    if (!response?.ok) throw new Error(response?.error || "Không điền được form OKX.");
    setFillStatus(`Đã chuẩn bị ${side}: entry ${payload.entry}, số lượng ${payload.quantity} ${payload.symbol.replace("USDT", "")}, ký quỹ ~${payload.margin} USDT, ${payload.leverage}x. Kiểm tra lại rồi tự bấm đặt lệnh.`, "ok");
  } catch (error) {
    console.warn("Lỗi khi điền lệnh:", error.message);
    setFillStatus(error.message, "error");
  }
}

function analyze() {
  const closes = state.candles.map((item) => item.close);
  const volumes = state.candles.map((item) => item.volume);
  const highs = state.candles.map((item) => item.high);
  const lows = state.candles.map((item) => item.low);
  const last = closes.at(-1) ?? Number(state.ticker?.lastPrice ?? state.ticker?.c ?? 0);
  
  const contextCloses = state.contextCandles.map((item) => item.close);
  const contextHighs = state.contextCandles.map((item) => item.high);
  const contextLows = state.contextCandles.map((item) => item.low);

  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const rsi14 = rsi(closes);
  const macdValue = macd(closes);
  const bands = bollinger(closes);
  const atr14 = atr(state.candles);
  const volumeRatio = volumes.length >= 21 ? volumes.at(-1) / Math.max(sma(volumes.slice(0, -1), 20), 1) : 1;
  const imbalance = orderBookImbalance(state.depth);

  const contextEma50 = ema(contextCloses, 50);
  const contextEma200 = ema(contextCloses, 200);
  const macroResist = contextHighs.length ? Math.max(...contextHighs.slice(-30)) : last;
  const macroSupport = contextLows.length ? Math.min(...contextLows.slice(-30)) : last;

  // --- Thu thập mốc nến (Market Structure) ---
  const sessionLength = Math.min(40, highs.length);
  const sessionHigh = sessionLength > 0 ? Math.max(...highs.slice(-sessionLength)) : last;
  const sessionLow = sessionLength > 0 ? Math.min(...lows.slice(-sessionLength)) : last;
  const sessionRange = sessionHigh - sessionLow;
  
  // Xác định thị trường giằng co (Choppy Market)
  const isInsideRange = last > sessionLow + sessionRange * 0.15 && last < sessionHigh - sessionRange * 0.15;
  const isNarrowRange = atr14 && sessionRange > 0 ? (sessionRange / last) < (atr14 * 2.5 / last) : false;
  const isChoppy = isInsideRange && isNarrowRange;

  let score = 0;

  if (state.tradeDuration === "scalping") {
    if (rsi14 !== null) score += rsi14 < 30 ? 30 : rsi14 > 70 ? -30 : rsi14 > 55 ? 12 : rsi14 < 45 ? -12 : 0;
    score += Math.max(-30, Math.min(30, imbalance * 60)); // Double weight for orderbook
    if (bands) score += last <= bands.lower * 1.001 ? 25 : last >= bands.upper * 0.999 ? -25 : 0;
    // MTFA Filter: Follow 15m trend
    if (contextEma50 && last < contextEma50) score -= 15;
    if (contextEma50 && last > contextEma50) score += 15;
    score += volumeRatio > 1.4 ? Math.sign(score || 1) * 10 : 0;
  } else if (state.tradeDuration === "swing") {
    if (contextEma50 && contextEma200) {
      if (last > contextEma50 && contextEma50 > contextEma200) score += 40;
      if (last < contextEma50 && contextEma50 < contextEma200) score -= 40;
    }
    if (ema12 && ema26) score += ema12 > ema26 ? 30 : -30;
    if (last <= macroSupport * 1.02) score += 20; // Near macro support
    if (last >= macroResist * 0.98) score -= 20; // Near macro resist
    if (rsi14 !== null && rsi14 < 30) score += 15;
    if (rsi14 !== null && rsi14 > 70) score -= 15;
    // Ignore orderbook completely
  } else {
    // Intraday (Mặc định)
    if (ema12 && ema26) score += ema12 > ema26 ? 22 : -22;
    if (rsi14 !== null) score += rsi14 < 30 ? 18 : rsi14 > 70 ? -18 : rsi14 > 52 ? 8 : rsi14 < 48 ? -8 : 0;
    if (macdValue !== null) score += macdValue > 0 ? 16 : -16;
    if (bands) score += last < bands.lower ? 12 : last > bands.upper ? -12 : last > bands.middle ? 6 : -6;
    score += Math.max(-16, Math.min(16, imbalance * 40));
    score += volumeRatio > 1.4 ? Math.sign(score || 1) * 8 : 0;
    if (contextEma50 && last > contextEma50) score += 12;
    if (contextEma50 && last < contextEma50) score -= 12;
    // Breakout mốc nến
    if (sessionRange > 0 && last >= sessionHigh * 0.999 && volumeRatio > 1.2) score += 18;
    if (sessionRange > 0 && last <= sessionLow * 1.001 && volumeRatio > 1.2) score -= 18;
  }

  let longThreshold = 24;
  let shortThreshold = -24;

  // Lọc nhiễu: Ép điểm về gần 0 và tăng ngưỡng kích hoạt nếu thị trường đi ngang
  if (isChoppy) {
    longThreshold = 34;
    shortThreshold = -34;
    score = score * 0.55; 
  }

  const confidence = Math.min(94, Math.max(35, Math.round(50 + Math.abs(score) * 0.55 + Math.min(volumeRatio, 2) * 5)));
  
  let bias = "TRUNG LẬP";
  if (score > longThreshold) bias = "LONG";
  else if (score < shortThreshold) bias = "SHORT";

  // Cơ chế chống nhiễu (Hysteresis): Giữ tín hiệu cũ nếu điểm chỉ bị rớt nhẹ xuống vùng Trung lập
  if (state.lastBias === "LONG" && bias === "TRUNG LẬP" && score > 12) bias = "LONG";
  if (state.lastBias === "SHORT" && bias === "TRUNG LẬP" && score < -12) bias = "SHORT";
  state.lastBias = bias;

  const direction = bias === "LONG" ? 1 : bias === "SHORT" ? -1 : 0;
  const expectedMove = atr14 ? atr14 * (0.6 + confidence / 180) : last * 0.006;
  const forecast = direction === 0 ? last : last + direction * expectedMove;
  const leverage = recommendLeverage({ bias, confidence, atr14, last, volumeRatio, rsi14 });

  return { last, ema12, ema26, rsi14, macdValue, bands, atr14, volumeRatio, imbalance, score, confidence, bias, forecast, leverage, sessionHigh, sessionLow };
}

function render() {
  if (!state.candles.length) return;
  const result = analyze();
  const plan = tradePlan(result);
  const change = Number(state.ticker?.priceChangePercent ?? state.ticker?.P ?? 0);
  const signalClass = result.bias === "LONG" ? "up" : result.bias === "SHORT" ? "down" : "neutral";

  if (state.notifyEnable && result.confidence >= state.notifyThreshold && result.bias !== "TRUNG LẬP") {
    const now = Date.now();
    if (now - state.lastNotificationTime > 60000) {
      state.lastNotificationTime = now;
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/logo.png",
        title: `🔥 CƠ HỘI ${result.bias} ${state.symbol} 🔥`,
        message: `Độ tin cậy đạt ${result.confidence}%. Tín hiệu rất đẹp, bạn NÊN VÀO LỆNH ngay! (Đòn bẩy: ${result.leverage.value})`
      });
    }
  }

  els.lastPrice.textContent = `$${fmt.format(result.last)}`;
  els.priceChange.textContent = `${pct.format(change)}% trong 24h`;
  els.priceChange.className = change >= 0 ? "up" : "down";
  els.signalText.textContent = result.bias;
  els.signalText.className = signalClass;
  els.confidenceText.textContent = `Độ tin cậy ${result.confidence}% | Điểm ${Math.round(result.score)}`;
  els.forecastText.textContent = `$${fmt.format(result.forecast)}`;
  els.forecastText.className = signalClass;
  const { horizon } = getIntervals();
  els.horizonText.textContent = `Dự báo cho ${horizon}`;
  els.leverageText.textContent = result.leverage.value;
  els.leverageText.className = signalClass;
  els.leverageReason.textContent = result.leverage.reason;
  els.updatedAt.textContent = new Date().toLocaleTimeString("vi-VN");

  renderIndicators(result);
  renderStrategy(result, plan);
  drawChart(result);
}

function renderIndicators(result) {
  const items = [
    ["Cấu trúc 40 nến", result.sessionHigh ? `${fmt.format(result.sessionLow)} – ${fmt.format(result.sessionHigh)}` : "Đang tính"],
    ["EMA 12/26", result.ema12 && result.ema26 ? `${fmt.format(result.ema12)} / ${fmt.format(result.ema26)}` : "Đang tính"],
    ["RSI 14", result.rsi14 !== null ? fmt.format(result.rsi14) : "Đang tính"],
    ["MACD", result.macdValue !== null ? fmt.format(result.macdValue) : "Đang tính"],
    ["Bollinger", result.bands ? `${fmt.format(result.bands.lower)} – ${fmt.format(result.bands.upper)}` : "Đang tính"],
    ["Volume", `${fmt.format(result.volumeRatio)}x so với trung bình`],
  ];
  els.indicatorList.innerHTML = items.map(([label, value]) => `<div class="indicator"><b>${label}</b><span>${value}</span></div>`).join("");
}

function renderStrategy(result, plan) {
  const riskNote = result.confidence < 60 ? "Tín hiệu yếu: nên giảm khối lượng hoặc chờ xác nhận." : "Tín hiệu đủ mạnh: vẫn cần giới hạn rủi ro mỗi lệnh.";
  const capitalNote = state.capital > 0
    ? `Ví hiện tại: <strong>${fmt.format(plan.walletBalance)} USDT</strong>; ký quỹ nên dùng: <strong>${fmt.format(plan.margin)} USDT</strong> (${fmt.format(plan.maxMarginPercent * 100)}% ví tối đa).`
    : "Nhập vốn ví hiện tại để app tự tính số vốn nên vào mỗi lệnh.";
  const sizingNote = state.capital > 0 && plan.notional > 0
    ? `OKX sẽ điền ô Số lượng: <strong>${fmt.format(plan.quantity)}</strong> ${state.symbol.replace("USDT", "")}; quy mô vị thế khoảng <strong>${fmt.format(plan.notional)} USDT</strong>.`
    : "Không nên dùng toàn bộ ví cho một lệnh; chờ tín hiệu rõ hơn nếu app báo không vào.";
  const riskLimitNote = state.capital > 0 && plan.riskAmount > 0
    ? `Rủi ro lệnh này khoảng <strong>${fmt.format(plan.riskAmount)} USDT</strong> / giới hạn <strong>${fmt.format(plan.maxRisk)} USDT</strong> (${fmt.format(plan.riskPercent)}% ví).`
    : "Nguyên tắc chống cháy ví: mỗi lệnh chỉ rủi ro khoảng 0.25%–1.2% tổng ví.";
  const liquidationNote = plan.liquidation
    ? `Thanh lý ước tính rất thô: <strong>$${fmt.format(plan.liquidation)}</strong>; hãy đặt stop-loss trước vùng này.`
    : "Không có điểm thanh lý vì app đang khuyến nghị không vào lệnh.";
  const streakNote = state.capital > 0 && plan.losingTradesToStop > 0
    ? `Kỷ luật vốn: nếu thua <strong>${plan.losingTradesToStop}</strong> lệnh tương tự liên tiếp, nên dừng và đánh giá lại.`
    : "Kỷ luật vốn: nếu mất khoảng 8% ví trong ngày/chuỗi lệnh, nên dừng giao dịch.";
  els.strategyList.innerHTML = [
    `Ưu tiên: <strong class="${result.bias === "LONG" ? "up" : result.bias === "SHORT" ? "down" : "neutral"}">${result.bias}</strong>.`,
    `Mức rủi ro: <strong>${plan.profile.label}</strong>.`,
    `Đòn bẩy đề xuất: <strong>${result.leverage.value}</strong> — ${result.leverage.reason}.`,
    `Entry tham khảo: <strong>$${fmt.format(plan.entry)}</strong>.`,
    `Vùng chốt lời tham khảo: <strong>$${fmt.format(plan.takeProfit)}</strong>.`,
    `Dừng lỗ tham khảo: <strong>$${fmt.format(plan.stop)}</strong>.`,
    plan.rewardRiskRatio > 0 ? `Tỷ lệ lời/lỗ mục tiêu: <strong>1:${fmt.format(plan.rewardRiskRatio)}</strong>.` : "",
    capitalNote,
    sizingNote,
    riskLimitNote,
    liquidationNote,
    streakNote,
    state.capital > 0 && plan.rewardAmount > 0 ? `Lợi nhuận mục tiêu ước tính: <strong>${fmt.format(plan.rewardAmount)} USDT</strong>.` : "",
    riskNote,
  ].filter(Boolean).map((item) => `<li>${item}</li>`).join("");
}

function drawChart(result) {
  const canvas = els.chart;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const candles = state.candles.slice(-80);
  const highs = candles.map((item) => item.high);
  const lows = candles.map((item) => item.low);
  const max = Math.max(...highs, result.forecast);
  const min = Math.min(...lows, result.forecast);
  const pad = (max - min) * 0.08 || 1;
  const scaleY = (price) => height - 24 - ((price - min + pad) / (max - min + pad * 2)) * (height - 48);
  const candleWidth = Math.max(4, (width - 36) / candles.length - 3);

  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = 18 + i * ((height - 36) / 4);
    ctx.beginPath(); ctx.moveTo(12, y); ctx.lineTo(width - 12, y); ctx.stroke();
  }

  candles.forEach((candle, index) => {
    const x = 18 + index * ((width - 36) / candles.length);
    const color = candle.close >= candle.open ? "#25d07d" : "#ff5573";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + candleWidth / 2, scaleY(candle.high));
    ctx.lineTo(x + candleWidth / 2, scaleY(candle.low));
    ctx.stroke();
    const y = Math.min(scaleY(candle.open), scaleY(candle.close));
    const bodyHeight = Math.max(2, Math.abs(scaleY(candle.open) - scaleY(candle.close)));
    ctx.fillRect(x, y, candleWidth, bodyHeight);
  });

  ctx.strokeStyle = result.bias === "SHORT" ? "#ff5573" : result.bias === "LONG" ? "#25d07d" : "#ffd166";
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(14, scaleY(result.forecast));
  ctx.lineTo(width - 14, scaleY(result.forecast));
  ctx.stroke();
  ctx.setLineDash([]);
}

async function refresh() {
  state.symbol = els.symbolSelect.value;
  // Interval is now auto-mapped from tradeDuration
  state.capital = Math.max(0, Number(els.capitalInput.value) || 0);
  state.riskProfile = els.riskProfileSelect.value;
  state.tradeDuration = els.tradeDurationSelect.value;
  
  const { trigger } = getIntervals();
  state.interval = trigger;
  
  await chrome.storage.local.set({ symbol: state.symbol, interval: state.interval, capital: state.capital, riskProfile: state.riskProfile, tradeDuration: state.tradeDuration });
  updateNoteBalance();
  try {
    await loadInitialMarket();
  } catch (error) {
    console.error(error);
    setStatus("Không tải được dữ liệu", "error");
  }
}

function updateNoteBalance() {
  if (!els.noteBalance) return;
  els.noteBalance.textContent = `${fmt.format(state.capital)} USDT`;
  const maxRiskPercent = state.riskProfile === "safe" ? 0.01 : state.riskProfile === "balanced" ? 0.02 : 0.03;
  const maxRisk = state.capital * maxRiskPercent;

  let atrMultiplier = 1.5;
  if (state.tradeDuration === "scalping") atrMultiplier = 0.8;
  else if (state.tradeDuration === "swing") atrMultiplier = 2.5;

  els.noteRiskProfile.textContent = state.riskProfile === "safe" ? "An toàn (1%)" : state.riskProfile === "balanced" ? "Cân bằng (2%)" : "Mạo hiểm (3%)";
  els.noteMaxInvest.textContent = `${fmt.format(maxRisk)} USDT / lệnh (Cắt lỗ tối đa)`;
}

async function analyzeNoteTab() {
  const symbol = els.noteSymbolInput.value.trim().toUpperCase() || "BTCUSDT";
  els.noteSymbolInput.value = symbol;
  els.noteAnalysisResult.style.display = "none";
  els.noteAnalysisLoading.style.display = "block";

  try {
    let closes1d, closes4h, data1d, data4h, lastPrice;
    
    if (isOkxSymbol(symbol)) {
      const instId = okxInstId(symbol);
      const [res1d, res4h] = await Promise.all([
        fetch(`https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=1D&limit=100`),
        fetch(`https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=4H&limit=100`)
      ]);
      const json1d = await res1d.json();
      const json4h = await res4h.json();
      if (json1d.code !== "0" || json4h.code !== "0") throw new Error("Không tìm thấy dữ liệu Coin trên sàn OKX");
      
      data1d = json1d.data.map(toOkxCandle).reverse();
      data4h = json4h.data.map(toOkxCandle).reverse();
    } else {
      const [res1d, res4h] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=100`),
        fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=4h&limit=100`)
      ]);
      if (!res1d.ok || !res4h.ok) throw new Error("Không tìm thấy dữ liệu Coin trên sàn Binance");
      const json1d = await res1d.json();
      const json4h = await res4h.json();
      
      data1d = json1d.map(toCandle);
      data4h = json4h.map(toCandle);
    }

    closes1d = data1d.map(c => c.close);
    closes4h = data4h.map(c => c.close);
    lastPrice = closes1d[closes1d.length - 1];

    const ema50_1d = ema(closes1d, 50);
    const rsi_4h = rsi(closes4h, 14);
    const macd_1d = macd(closes1d);
    
    const highs1d = data1d.map(c => c.high).slice(-30);
    const lows1d = data1d.map(c => c.low).slice(-30);
    const resist = Math.max(...highs1d);
    const support = Math.min(...lows1d);

    let trendD1 = "Sideways (Đi ngang)";
    if (ema50_1d && lastPrice > ema50_1d && macd_1d > 0) trendD1 = "TĂNG (Bullish)";
    else if (ema50_1d && lastPrice < ema50_1d && macd_1d < 0) trendD1 = "GIẢM (Bearish)";

    els.noteTechnicalText.innerHTML = `
      - <b>Xu hướng dài hạn (D1):</b> <span style="color: ${trendD1.includes("TĂNG") ? "var(--green)" : trendD1.includes("GIẢM") ? "var(--red)" : "var(--yellow)"}">${trendD1}</span> <br/>
      - <b>Hỗ trợ vĩ mô:</b> $${fmt.format(support)} <br/>
      - <b>Kháng cự vĩ mô:</b> $${fmt.format(resist)} <br/>
      - <b>Động lượng trung hạn (4H RSI):</b> ${rsi_4h.toFixed(1)} ${rsi_4h > 70 ? "(Quá mua)" : rsi_4h < 30 ? "(Quá bán)" : "(Bình thường)"}
    `;

    let plan = "";
    if (trendD1.includes("TĂNG")) {
      if (rsi_4h > 70) plan = `Thị trường đang trong xu hướng TĂNG mạnh nhưng khung 4H đã <b>QUÁ MUA</b>. Không nên FOMO lúc này.<br/><br/><b>Kế hoạch tỉ mỉ:</b> Kiên nhẫn chờ giá điều chỉnh (pullback) về gần vùng hỗ trợ $${fmt.format(support)} hoặc khi RSI 4H hạ nhiệt xuống dưới 50 để tìm lệnh LONG.`;
      else plan = `Xu hướng chính là TĂNG. Khung 4H đang ủng hộ nhịp tăng tiếp diễn.<br/><br/><b>Kế hoạch tỉ mỉ:</b> Tìm điểm vào lệnh LONG quanh mức giá hiện tại ($${fmt.format(lastPrice)}), đặt Stop-loss tuyệt đối ở $${fmt.format(support * 0.99)} (dưới mốc hỗ trợ vĩ mô). Chia vốn theo tỷ lệ Rủi ro ở trên.`;
    } else if (trendD1.includes("GIẢM")) {
      if (rsi_4h < 30) plan = `Thị trường đang trong xu hướng GIẢM nhưng khung 4H đã <b>QUÁ BÁN</b>. Dễ có nhịp hồi kỹ thuật.<br/><br/><b>Kế hoạch tỉ mỉ:</b> Không nên đuổi lệnh SHORT ở đây. Chờ giá hồi lên kiểm tra lại vùng kháng cự $${fmt.format(resist)} để tìm lệnh SHORT xuống.`;
      else plan = `Xu hướng chính là GIẢM. Động lượng phe bán vẫn kiểm soát.<br/><br/><b>Kế hoạch tỉ mỉ:</b> Canh các nhịp hồi nhẹ để rải lệnh SHORT, đặt Stop-loss tuyệt đối ở $${fmt.format(resist * 1.01)} (trên mốc kháng cự vĩ mô). Đánh đúng khối lượng khuyến nghị.`;
    } else {
      plan = `Thị trường đang bị kẹp trong hộp <b>Darvas vĩ mô</b> (Hỗ trợ $${fmt.format(support)} - Kháng cự $${fmt.format(resist)}).<br/><br/><b>Kế hoạch tỉ mỉ:</b> Đánh Ping-Pong (Mua ở Hỗ trợ, Bán ở Kháng cự). Canh giá về $${fmt.format(support)} để LONG hoặc lên $${fmt.format(resist)} để SHORT. Khuyến nghị giảm nửa khối lượng lệnh so với bình thường.`;
    }

    els.notePlanText.innerHTML = plan;
    els.noteAnalysisLoading.style.display = "none";
    els.noteAnalysisResult.style.display = "block";
  } catch (err) {
    els.noteAnalysisLoading.style.display = "none";
    els.noteAnalysisResult.style.display = "block";
    els.noteTechnicalText.innerHTML = "";
    els.notePlanText.innerHTML = `<span style="color:var(--red);">Lỗi: ${err.message}. Đảm bảo mã coin đúng (ví dụ BTCUSDT) hoặc thử lại sau.</span>`;
  }
}

async function boot() {
  const saved = await chrome.storage.local.get(["symbol", "interval", "capital", "riskProfile", "tradeDuration", "notifyEnable", "notifyThreshold"]);
  state.symbol = saved.symbol || state.symbol;
  state.interval = saved.interval || state.interval;
  state.capital = Number(saved.capital) || state.capital;
  state.riskProfile = saved.riskProfile || state.riskProfile;
  state.tradeDuration = saved.tradeDuration || state.tradeDuration;
  state.notifyEnable = saved.notifyEnable ?? state.notifyEnable;
  state.notifyThreshold = saved.notifyThreshold ?? state.notifyThreshold;
  els.symbolSelect.value = state.symbol;
  els.intervalSelect.value = state.interval;
  els.capitalInput.value = state.capital || "";
  els.riskProfileSelect.value = state.riskProfile;
  if (els.tradeDurationSelect) els.tradeDurationSelect.value = state.tradeDuration;
  els.notifyEnable.checked = state.notifyEnable;
  els.notifyThreshold.value = state.notifyThreshold;
  els.refreshButton.addEventListener("click", refresh);
  els.symbolSelect.addEventListener("change", refresh);
  els.intervalSelect.addEventListener("change", refresh);
  els.fillLongButton.addEventListener("click", () => fillOkxOrder("LONG"));
  els.fillShortButton.addEventListener("click", () => fillOkxOrder("SHORT"));
  els.notifyEnable.addEventListener("change", () => {
    state.notifyEnable = els.notifyEnable.checked;
    chrome.storage.local.set({ notifyEnable: state.notifyEnable });
    if (state.notifyEnable) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/logo.png",
        title: `Bật báo động`,
        message: `Hệ thống sẽ báo khi độ tin cậy từ ${state.notifyThreshold}% trở lên.`
      });
    }
  });
  els.notifyThreshold.addEventListener("change", () => {
    state.notifyThreshold = Number(els.notifyThreshold.value) || 80;
    chrome.storage.local.set({ notifyThreshold: state.notifyThreshold });
    if (state.notifyEnable) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/logo.png",
        title: `Cập nhật mức báo động`,
        message: `Đã lưu! Sẽ thông báo khi độ tin cậy đạt ${state.notifyThreshold}%`
      });
    }
  });
  els.riskProfileSelect.addEventListener("change", () => {
    state.riskProfile = els.riskProfileSelect.value;
    chrome.storage.local.set({ riskProfile: state.riskProfile });
    updateNoteBalance();
    render();
  });
  if (els.tradeDurationSelect) {
    els.tradeDurationSelect.addEventListener("change", () => {
      state.tradeDuration = els.tradeDurationSelect.value;
      chrome.storage.local.set({ tradeDuration: state.tradeDuration });
      render();
    });
  }
  els.capitalInput.addEventListener("input", () => {
    state.capital = Math.max(0, Number(els.capitalInput.value) || 0);
    chrome.storage.local.set({ capital: state.capital });
    updateNoteBalance();
    render();
  });
  
  if (els.btnHomeTab) {
    els.btnHomeTab.addEventListener("click", () => {
      els.btnHomeTab.classList.add("active");
      els.btnNoteTab.classList.remove("active");
      els.homeView.style.display = "block";
      els.noteView.style.display = "none";
    });
    els.btnNoteTab.addEventListener("click", () => {
      els.btnNoteTab.classList.add("active");
      els.btnHomeTab.classList.remove("active");
      els.homeView.style.display = "none";
      els.noteView.style.display = "block";
      updateNoteBalance();
    });
    els.btnAnalyzeNote.addEventListener("click", analyzeNoteTab);
  }

  refresh();
}

boot();
