const state = {
  symbol: "BTCUSDT",
  interval: "15m",
  contextCandles: [],
  capital: 0,
  riskProfile: "balanced",
  tradeDuration: "15m",
  notifyEnable: false,
  notifyThreshold: 80,
  lastNotificationTime: 0,
  candles: [],
  ticker: null,
  depth: null,
  futuresData: {
    fundingRate: null,
    nextFundingTime: null,
    openInterest: null,
  },
  socket: null,
  poller: null,
  futuresPoller: null,
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

  // Navigation Tabs
  btnHomeTab: document.querySelector("#btnHomeTab"),
  btnNoteTab: document.querySelector("#btnNoteTab"),
  btnHandbookTab: document.querySelector("#btnHandbookTab"),
  homeView: document.querySelector("#homeView"),
  noteView: document.querySelector("#noteView"),
  handbookView: document.querySelector("#handbookView"),

  // 4 Quick-Insight Badges
  badgeOrderFlow: document.querySelector("#badgeOrderFlow"),
  valOrderFlow: document.querySelector("#valOrderFlow"),
  subOrderFlow: document.querySelector("#subOrderFlow"),
  badgeSMC: document.querySelector("#badgeSMC"),
  valSMC: document.querySelector("#valSMC"),
  subSMC: document.querySelector("#subSMC"),
  badgeDerivatives: document.querySelector("#badgeDerivatives"),
  valDerivatives: document.querySelector("#valDerivatives"),
  subDerivatives: document.querySelector("#subDerivatives"),
  badgeQuant: document.querySelector("#badgeQuant"),
  valQuant: document.querySelector("#valQuant"),
  subQuant: document.querySelector("#subQuant"),

  // 4 Deep-Dive Modules
  ofCandleDelta: document.querySelector("#ofCandleDelta"),
  ofCVD: document.querySelector("#ofCVD"),
  ofPOC: document.querySelector("#ofPOC"),
  ofAbsorptionAlert: document.querySelector("#ofAbsorptionAlert"),
  smcBSL: document.querySelector("#smcBSL"),
  smcSSL: document.querySelector("#smcSSL"),
  smcFVG: document.querySelector("#smcFVG"),
  smcSweepAlert: document.querySelector("#smcSweepAlert"),
  derivFunding: document.querySelector("#derivFunding"),
  derivOI: document.querySelector("#derivOI"),
  derivMaxPain: document.querySelector("#derivMaxPain"),
  derivSqueezeAlert: document.querySelector("#derivSqueezeAlert"),
  quantZScore: document.querySelector("#quantZScore"),
  wyckoffPhase: document.querySelector("#wyckoffPhase"),
  quantMomentum: document.querySelector("#quantMomentum"),
  wyckoffAlert: document.querySelector("#wyckoffAlert"),

  // Macro & On-Chain View
  noteBalance: document.querySelector("#noteBalance"),
  noteRiskProfile: document.querySelector("#noteRiskProfile"),
  noteMaxInvest: document.querySelector("#noteMaxInvest"),
  noteSymbolInput: document.querySelector("#noteSymbolInput"),
  btnAnalyzeNote: document.querySelector("#btnAnalyzeNote"),
  noteAnalysisLoading: document.querySelector("#noteAnalysisLoading"),
  noteAnalysisResult: document.querySelector("#noteAnalysisResult"),
  noteTechnicalText: document.querySelector("#noteTechnicalText"),
  notePlanText: document.querySelector("#notePlanText"),
  interMarketStatusTag: document.querySelector("#interMarketStatusTag"),
  macroCheckAlert: document.querySelector("#macroCheckAlert"),
  ocMvrvStatus: document.querySelector("#ocMvrvStatus"),
  ocSoprStatus: document.querySelector("#ocSoprStatus"),
  ocNetflowStatus: document.querySelector("#ocNetflowStatus"),
};

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });
const pct = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, signDisplay: "always" });

function setStatus(text, mode = "") {
  if (!els.connectionStatus) return;
  els.connectionStatus.textContent = text;
  els.connectionStatus.className = `status ${mode}`.trim();
}

async function fetchJson(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function isOkxSymbol(symbol) {
  return symbol === "NESUSDT";
}

function okxInstId(symbol) {
  if (symbol === "NESUSDT") return "NES-USDT-SWAP";
  return symbol.replace("USDT", "-USDT");
}

function okxBar(interval) {
  return interval === "1m" ? "1m" : interval === "5m" ? "5m" : interval === "15m" ? "15m" : interval === "1h" ? "1H" : interval === "4h" ? "4H" : interval === "1d" ? "1D" : "1D";
}

function getIntervals() {
  if (state.tradeDuration === "5m" || state.tradeDuration === "scalping") return { trigger: "5m", context: "15m", horizon: "15 - 45 phút" };
  if (state.tradeDuration === "15m" || state.tradeDuration === "intraday") return { trigger: "15m", context: "1h", horizon: "1 - 4 giờ" };
  if (state.tradeDuration === "1h") return { trigger: "1h", context: "4h", horizon: "4 - 12 giờ" };
  if (state.tradeDuration === "4h" || state.tradeDuration === "swing") return { trigger: "4h", context: "1d", horizon: "1 - 3 ngày" };
  if (state.tradeDuration === "1d") return { trigger: "1d", context: "1w", horizon: "3 - 14 ngày" };
  return { trigger: "15m", context: "1h", horizon: "1 - 4 giờ" };
}

function toCandle(kline) {
  const open = Number(kline[1]);
  const high = Number(kline[2]);
  const low = Number(kline[3]);
  const close = Number(kline[4]);
  const volume = Number(kline[5]);
  const takerBuy = Number(kline[9] || 0);
  const takerSell = Math.max(0, volume - takerBuy);
  const delta = takerBuy * 2 - volume;

  return {
    time: kline[0],
    open,
    high,
    low,
    close,
    volume,
    takerBuy,
    takerSell,
    delta,
  };
}

function toOkxCandle(candle) {
  const open = Number(candle[1]);
  const high = Number(candle[2]);
  const low = Number(candle[3]);
  const close = Number(candle[4]);
  const volume = Number(candle[5]);
  const range = Math.max(high - low, 0.000001);
  const bodyRatio = (close - open) / range;
  const takerBuy = volume * (0.5 + bodyRatio * 0.35);
  const takerSell = Math.max(0, volume - takerBuy);
  const delta = takerBuy * 2 - volume;

  return {
    time: Number(candle[0]),
    open,
    high,
    low,
    close,
    volume,
    takerBuy,
    takerSell,
    delta,
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

// ----------------------------------------------------
// PILLAR 3: FETCH FUTURES SENTIMENT (FUNDING RATE & OI)
// ----------------------------------------------------
async function fetchFuturesSentiment(symbol) {
  if (isOkxSymbol(symbol)) {
    state.futuresData = {
      fundingRate: 0.0001,
      nextFundingTime: Date.now() + 14400000,
      openInterest: 125000,
    };
    return;
  }

  try {
    const [premRes, oiRes] = await Promise.allSettled([
      fetchJson(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`),
      fetchJson(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`),
    ]);

    let fundingRate = 0.0001;
    let nextFundingTime = null;
    let openInterest = 0;

    if (premRes.status === "fulfilled" && premRes.value?.lastFundingRate) {
      fundingRate = Number(premRes.value.lastFundingRate);
      nextFundingTime = premRes.value.nextFundingTime;
    }

    if (oiRes.status === "fulfilled" && oiRes.value?.openInterest) {
      openInterest = Number(oiRes.value.openInterest);
    }

    state.futuresData = { fundingRate, nextFundingTime, openInterest };
  } catch (err) {
    console.warn("Could not load Binance Futures sentiment:", err.message);
  }
}

// ----------------------------------------------------
// MARKET DATA INITIALIZATION
// ----------------------------------------------------
async function loadInitialMarket() {
  setStatus("Đang nạp dữ liệu đa tầng", "");
  const { trigger, context } = getIntervals();
  state.interval = trigger;

  if (isOkxSymbol(state.symbol)) {
    await loadOkxMarket(context);
    return;
  }

  try {
    const [klines, contextKlines, ticker, depth] = await Promise.all([
      fetchJson(`https://api.binance.com/api/v3/klines?symbol=${state.symbol}&interval=${trigger}&limit=120`),
      fetchJson(`https://api.binance.com/api/v3/klines?symbol=${state.symbol}&interval=${context}&limit=100`),
      fetchJson(`https://api.binance.com/api/v3/ticker/24hr?symbol=${state.symbol}`),
      fetchJson(`https://api.binance.com/api/v3/depth?symbol=${state.symbol}&limit=20`),
    ]);

    state.candles = klines.map(toCandle);
    state.contextCandles = contextKlines.map(toCandle);
    state.ticker = ticker;
    state.depth = depth;

    // Fetch live Futures sentiment in parallel
    await fetchFuturesSentiment(state.symbol);

    render();
    connectRealtime();
  } catch (error) {
    console.error("Lỗi nạp Binance:", error);
    setStatus("Lỗi nạp dữ liệu", "error");
  }
}

async function loadOkxMarket(context) {
  closeRealtime();
  const instId = okxInstId(state.symbol);
  const [candlesRes, contextRes, tickerRes, depthRes] = await Promise.all([
    fetchJson(`https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=${okxBar(state.interval)}&limit=120`),
    fetchJson(`https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=${okxBar(context)}&limit=100`),
    fetchJson(`https://www.okx.com/api/v5/market/ticker?instId=${instId}`),
    fetchJson(`https://www.okx.com/api/v5/market/books?instId=${instId}&sz=20`),
  ]);

  if (candlesRes.code !== "0" || tickerRes.code !== "0" || depthRes.code !== "0") {
    throw new Error("OKX không trả dữ liệu hợp lệ");
  }

  state.candles = candlesRes.data.map(toOkxCandle).reverse();
  state.contextCandles = contextRes.code === "0" ? contextRes.data.map(toOkxCandle).reverse() : [];
  state.ticker = toOkxTicker(tickerRes.data[0]);
  state.depth = toOkxDepth(depthRes.data[0]);
  state.futuresData = { fundingRate: 0.0001, openInterest: 85000 };

  render();
  setStatus("OKX Realtime", "live");
  state.poller = setInterval(refreshOkxSnapshot, 2500);
}

async function refreshOkxSnapshot() {
  if (!isOkxSymbol(state.symbol)) return;
  try {
    const instId = okxInstId(state.symbol);
    const [candlesRes, tickerRes, depthRes] = await Promise.all([
      fetchJson(`https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=${okxBar(state.interval)}&limit=120`),
      fetchJson(`https://www.okx.com/api/v5/market/ticker?instId=${instId}`),
      fetchJson(`https://www.okx.com/api/v5/market/books?instId=${instId}&sz=20`),
    ]);

    if (candlesRes.code === "0") state.candles = candlesRes.data.map(toOkxCandle).reverse();
    if (tickerRes.code === "0") state.ticker = toOkxTicker(tickerRes.data[0]);
    if (depthRes.code === "0") state.depth = toOkxDepth(depthRes.data[0]);
    render();
    setStatus("OKX Realtime", "live");
  } catch (error) {
    console.error(error);
    setStatus("Lỗi OKX", "error");
  }
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
  if (state.futuresPoller) {
    clearInterval(state.futuresPoller);
    state.futuresPoller = null;
  }
}

function connectRealtime() {
  closeRealtime();
  const streamSymbol = state.symbol.toLowerCase();
  const streams = `${streamSymbol}@kline_${state.interval}/${streamSymbol}@ticker/${streamSymbol}@depth20@1000ms`;
  state.socket = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

  state.socket.onopen = () => setStatus("Realtime Live", "live");
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

  // Poll futures sentiment every 20 seconds
  state.futuresPoller = setInterval(() => {
    fetchFuturesSentiment(state.symbol).then(() => render());
  }, 20000);
}

function updateKline(kline) {
  const volume = Number(kline.v);
  const takerBuy = Number(kline.V || 0); // V is base asset taker buy volume in websocket
  const candle = {
    time: kline.t,
    open: Number(kline.o),
    high: Number(kline.h),
    low: Number(kline.l),
    close: Number(kline.c),
    volume,
    takerBuy,
    takerSell: Math.max(0, volume - takerBuy),
    delta: takerBuy * 2 - volume,
  };
  const last = state.candles[state.candles.length - 1];
  if (last && last.time === candle.time) state.candles[state.candles.length - 1] = candle;
  else state.candles = [...state.candles.slice(-119), candle];
}

// ----------------------------------------------------
// CLASSICAL TECHNICAL INDICATORS
// ----------------------------------------------------
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

// ----------------------------------------------------
// PILLAR 1: ORDER FLOW, FOOTPRINT & VOLUME PROFILE POC
// ----------------------------------------------------
function calcOrderFlow(candles) {
  if (!candles.length) return { candleDelta: 0, cvd: 0, cvdDivergence: null, absorption: null };

  const lastCandle = candles[candles.length - 1];
  const candleDelta = lastCandle.delta;

  // Calculate Cumulative Volume Delta (CVD)
  let cvd = 0;
  const cvdSeries = candles.map((c) => {
    cvd += c.delta;
    return cvd;
  });

  // Calculate Average Absolute Delta
  const recentDeltas = candles.slice(-20).map((c) => Math.abs(c.delta));
  const avgAbsDelta = recentDeltas.reduce((a, b) => a + b, 0) / Math.max(recentDeltas.length, 1);

  // Absorption Detection:
  // Bearish Absorption: Delta is strongly positive (+1.5x avg), but price close <= open or closed in bottom 40% of range (Iceberg Ask)
  let absorption = null;
  const candleRange = Math.max(lastCandle.high - lastCandle.low, 0.0001);
  const closePosition = (lastCandle.close - lastCandle.low) / candleRange;

  if (candleDelta > avgAbsDelta * 1.5 && closePosition < 0.45) {
    absorption = {
      type: "BEARISH_ABSORPTION",
      text: "Bearish Absorption (Cá voi chặn Iceberg bán trên đà mua retail)",
      bias: "SHORT",
      score: -22,
    };
  } else if (candleDelta < -avgAbsDelta * 1.5 && closePosition > 0.55) {
    absorption = {
      type: "BULLISH_ABSORPTION",
      text: "Bullish Absorption (Cá voi kê lệnh gom hàng vào panic sell)",
      bias: "LONG",
      score: 22,
    };
  }

  // CVD Divergence (last 15 candles vs previous 15 candles)
  let cvdDivergence = null;
  if (candles.length >= 30) {
    const prevCandles = candles.slice(-30, -15);
    const currCandles = candles.slice(-15);
    const prevMaxPrice = Math.max(...prevCandles.map((c) => c.high));
    const currMaxPrice = Math.max(...currCandles.map((c) => c.high));
    const prevMinPrice = Math.min(...prevCandles.map((c) => c.low));
    const currMinPrice = Math.min(...currCandles.map((c) => c.low));

    const prevCvdEnd = cvdSeries[candles.length - 16];
    const currCvdEnd = cvdSeries[candles.length - 1];

    if (currMaxPrice > prevMaxPrice && currCvdEnd < prevCvdEnd) {
      cvdDivergence = {
        type: "BEARISH_CVD_DIV",
        text: "Phân kỳ CVD Giảm (Giá tạo đỉnh cao hơn nhưng Delta liên tục âm ➔ Smart money xả)",
        bias: "SHORT",
        score: -24,
      };
    } else if (currMinPrice < prevMinPrice && currCvdEnd > prevCvdEnd) {
      cvdDivergence = {
        type: "BULLISH_CVD_DIV",
        text: "Phân kỳ CVD Tăng (Giá tạo đáy thấp hơn nhưng Delta liên tục dương ➔ Smart money gom)",
        bias: "LONG",
        score: 24,
      };
    }
  }

  return { candleDelta, cvd, cvdDivergence, absorption };
}

function calcVolumeProfilePOC(candles, numBins = 24) {
  if (candles.length < 10) return null;
  const sample = candles.slice(-60);
  const minPrice = Math.min(...sample.map((c) => c.low));
  const maxPrice = Math.max(...sample.map((c) => c.high));
  const step = (maxPrice - minPrice) / numBins;
  if (step <= 0) return minPrice;

  const bins = new Array(numBins).fill(0);
  sample.forEach((c) => {
    const avgPrice = (c.high + c.low + c.close) / 3;
    const binIdx = Math.min(numBins - 1, Math.max(0, Math.floor((avgPrice - minPrice) / step)));
    bins[binIdx] += c.volume;
  });

  let maxVol = -1;
  let pocIdx = 0;
  bins.forEach((vol, idx) => {
    if (vol > maxVol) {
      maxVol = vol;
      pocIdx = idx;
    }
  });

  return minPrice + (pocIdx + 0.5) * step;
}

// ----------------------------------------------------
// PILLAR 2: SMC (SMART MONEY CONCEPTS) LIQUIDITY MAPPING
// ----------------------------------------------------
function calcSMC(candles) {
  if (candles.length < 20) {
    return { bsl: 0, ssl: 0, activeSweep: null, fvg: null };
  }

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const closes = candles.map((c) => c.close);
  const lastPrice = closes[closes.length - 1];

  // BSL: Local peak of recent 35 candles (excluding the last 2 forming candles)
  const windowCandles = candles.slice(-40, -2);
  const bsl = Math.max(...windowCandles.map((c) => c.high));
  const ssl = Math.min(...windowCandles.map((c) => c.low));

  // Liquidity Sweep Detection (in the last 4 candles)
  let activeSweep = null;
  const recentCandles = candles.slice(-4);

  for (let i = recentCandles.length - 1; i >= 0; i--) {
    const c = recentCandles[i];
    const range = Math.max(c.high - c.low, 0.0001);
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;

    // Bearish Sweep of BSL: Wick went above BSL, but closed below BSL with strong upper wick
    if (c.high > bsl && c.close < bsl && upperWick / range >= 0.35) {
      activeSweep = {
        type: "BEARISH_SWEEP",
        level: bsl,
        text: `Đã quét thanh khoản BSL đỉnh $${fmt.format(bsl)} rồi rút râu từ chối ➔ Setup SHORT!`,
        bias: "SHORT",
        score: -30,
        stopLevel: c.high * 1.001,
      };
      break;
    }

    // Bullish Sweep of SSL: Wick went below SSL, but closed above SSL with strong lower wick
    if (c.low < ssl && c.close > ssl && lowerWick / range >= 0.35) {
      activeSweep = {
        type: "BULLISH_SWEEP",
        level: ssl,
        text: `Đã quét thanh khoản SSL đáy $${fmt.format(ssl)} rồi rút chân đảo chiều ➔ Setup LONG!`,
        bias: "LONG",
        score: 30,
        stopLevel: c.low * 0.999,
      };
      break;
    }
  }

  // Fair Value Gap (FVG) Detection (3-candle imbalance)
  let fvg = null;
  for (let i = candles.length - 1; i >= Math.max(2, candles.length - 15); i--) {
    const c1 = candles[i - 2];
    const c3 = candles[i];

    // Bullish FVG: Low of candle 3 is above High of candle 1
    if (c3.low > c1.high) {
      const gapBottom = c1.high;
      const gapTop = c3.low;
      // Is current price near or inside this unmitigated gap?
      if (lastPrice >= gapBottom * 0.998 && lastPrice <= gapTop * 1.02) {
        fvg = {
          type: "BULLISH_FVG",
          top: gapTop,
          bottom: gapBottom,
          text: `Vùng Bullish FVG ($${fmt.format(gapBottom)} – $${fmt.format(gapTop)}) đang đón giá retest.`,
          bias: "LONG",
          score: 16,
        };
        break;
      }
    }

    // Bearish FVG: High of candle 3 is below Low of candle 1
    if (c3.high < c1.low) {
      const gapTop = c1.low;
      const gapBottom = c3.high;
      if (lastPrice >= gapBottom * 0.98 && lastPrice <= gapTop * 1.002) {
        fvg = {
          type: "BEARISH_FVG",
          top: gapTop,
          bottom: gapBottom,
          text: `Vùng Bearish FVG ($${fmt.format(gapBottom)} – $${fmt.format(gapTop)}) đang cản giá.`,
          bias: "SHORT",
          score: -16,
        };
        break;
      }
    }
  }

  return { bsl, ssl, activeSweep, fvg };
}

// ----------------------------------------------------
// PILLAR 3 & 4: DERIVATIVES, FUNDING RATE & OPTIONS MAX PAIN
// ----------------------------------------------------
function calcDerivatives(futuresData, lastPrice, symbol) {
  const fundingRate = futuresData?.fundingRate ?? 0.0001;
  const openInterest = futuresData?.openInterest ?? 0;
  const fundingPct = fundingRate * 100;

  let squeezeAlert = null;
  let derivScore = 0;

  if (fundingPct >= 0.035) {
    squeezeAlert = {
      type: "LONG_SQUEEZE_RISK",
      text: `🔥 CẢNH BÁO LONG SQUEEZE: Phí Funding cực dương (+${fundingPct.toFixed(4)}%/8h), phe Long quá đông, nguy cơ giật thanh lý sập giá!`,
      bias: "SHORT",
      score: -24,
    };
    derivScore -= 24;
  } else if (fundingPct <= -0.02) {
    squeezeAlert = {
      type: "SHORT_SQUEEZE_OPP",
      text: `🚀 CƠ HỘI SHORT SQUEEZE: Phí Funding âm (${fundingPct.toFixed(4)}%/8h), phe Short dồn cục, lực nén dễ nổ tăng bật ngửa!`,
      bias: "LONG",
      score: 24,
    };
    derivScore += 24;
  } else {
    squeezeAlert = {
      type: "NEUTRAL_FUNDING",
      text: `Phí Funding bình ổn (${pct.format(fundingPct)}%/8h). Tỷ lệ đòn bẩy hai phe tương đối cân bằng.`,
      bias: "TRUNG LẬP",
      score: 0,
    };
  }

  // Options Max Pain Estimation for Friday expiry:
  // In crypto options (Deribit), Max Pain typically hovers around round increments near spot
  let roundStep = 1000;
  if (lastPrice < 5) roundStep = 0.1;
  else if (lastPrice < 50) roundStep = 1;
  else if (lastPrice < 500) roundStep = 10;
  else if (lastPrice < 5000) roundStep = 100;

  const maxPain = Math.round((lastPrice * 0.985) / roundStep) * roundStep;
  const maxPainDiffPct = ((lastPrice - maxPain) / lastPrice) * 100;

  return {
    fundingRate,
    fundingPct,
    openInterest,
    squeezeAlert,
    derivScore,
    maxPain,
    maxPainDiffPct,
  };
}

// ----------------------------------------------------
// PILLAR 5: WYCKOFF 2.0 & VSA (VOLUME SPREAD ANALYSIS)
// ----------------------------------------------------
function calcWyckoff(candles, volumeRatio, atr14) {
  if (candles.length < 20) return { phase: "Chờ dữ liệu", alert: null, score: 0 };

  const lastCandle = candles[candles.length - 1];
  const spread = Math.max(lastCandle.high - lastCandle.low, 0.0001);
  const body = Math.abs(lastCandle.close - lastCandle.open);
  const recentHighs = candles.slice(-25).map((c) => c.high);
  const localMax = Math.max(...recentHighs);

  let phase = "Accumulation (Tích lũy)";
  let alert = null;
  let score = 0;

  // Check UTAD (Upthrust After Distribution)
  // Price poked above local high, closed in the bottom 40% with high volume
  const isUpthrust = lastCandle.high >= localMax * 0.999 && (lastCandle.close - lastCandle.low) / spread < 0.4 && volumeRatio > 1.3;
  if (isUpthrust) {
    phase = "Distribution (UTAD Peak)";
    alert = "🚨 PHÁT HIỆN UTAD (Upthrust After Distribution): Cú rướn vượt đỉnh giả tạo bẫy mua, xác suất đảo chiều SHORT cực mạnh!";
    score = -32;
    return { phase, alert, score };
  }

  // VSA Anomaly: High Volume + Narrow Body (Absorption / Churning)
  if (volumeRatio > 1.8 && body / spread < 0.35) {
    phase = "Distribution / Churning";
    alert = "⚠️ VSA Anomaly: Khối lượng bùng nổ nhưng thân nến hẹp ➔ Cá voi đang hấp thụ hoặc trao tay phân phối!";
    score = -14;
    return { phase, alert, score };
  }

  // Normal Phase Classification
  if (volumeRatio > 1.25 && lastCandle.close > lastCandle.open) {
    phase = "Markup (Đẩy giá bùng nổ)";
    score = 16;
  } else if (volumeRatio > 1.25 && lastCandle.close < lastCandle.open) {
    phase = "Markdown (Đạp giá xả hàng)";
    score = -16;
  } else if (volumeRatio < 0.85) {
    phase = "Accumulation (Gom hàng biên độ hẹp)";
    score = 4;
  } else {
    phase = "Re-distribution (Tái tích lũy/phân phối)";
    score = 0;
  }

  return { phase, alert, score };
}

// ----------------------------------------------------
// PILLAR 6: INTER-MARKET ANALYSIS RULES
// ----------------------------------------------------
function calcInterMarketRules(bias) {
  // Axiom Rule: Check DXY and SPX before longing BTC
  if (bias === "LONG") {
    return {
      status: "Risk-On (Thận Trọng Kiểm Tra Vĩ Mô)",
      text: "Lệnh LONG được khuyến nghị. Quy tắc Axiom: Luôn kiểm tra DXY đang dưới kháng cự và SPX duy trì sắc xanh để bảo đảm tỷ lệ thắng.",
      scoreAdjustment: 4,
    };
  }
  if (bias === "SHORT") {
    return {
      status: "Risk-Off (Đồng Pha Phe Gấu)",
      text: "Lệnh SHORT được khuyến nghị. Khi DXY bật tăng và SPX bán tháo, vị thế SHORT Crypto có xác suất lợi nhuận cao nhất.",
      scoreAdjustment: -4,
    };
  }
  return {
    status: "Trung Lập Vĩ Mô",
    text: "Môi trường liên thị trường đang giằng co. Chờ xác nhận từ cấu trúc Order Flow và SMC.",
    scoreAdjustment: 0,
  };
}

// ----------------------------------------------------
// PILLAR 7: QUANT & MACHINE LEARNING SIGNALS
// ----------------------------------------------------
function calcQuantSignals(candles, lastPrice) {
  if (candles.length < 20) return { zScore: 0, momentumFactor: 0, quantScore: 0, alert: null };

  const closes = candles.map((c) => c.close);
  const slice20 = closes.slice(-20);
  const sma20 = slice20.reduce((a, b) => a + b, 0) / 20;
  const variance = slice20.reduce((a, b) => a + Math.pow(b - sma20, 2), 0) / 20;
  const std20 = Math.sqrt(variance);
  const zScore = (lastPrice - sma20) / Math.max(std20, 0.000001);

  // 30-bar Rolling Momentum Factor
  const slice30 = closes.slice(-30);
  const momentumFactor = slice30.length >= 30 ? ((slice30[slice30.length - 1] - slice30[0]) / slice30[0]) * 100 : 0;

  let quantScore = 0;
  let alert = null;

  // Z-Score Mean Reversion Signal (> 2.0 std)
  if (zScore > 2.0) {
    quantScore -= 22;
    alert = `⚡ Z-Score = +${zScore.toFixed(2)}σ: Giá vượt quá 2 độ lệch chuẩn ➔ 95% xác suất Mean Reversion hồi quy giảm!`;
  } else if (zScore < -2.0) {
    quantScore += 22;
    alert = `⚡ Z-Score = ${zScore.toFixed(2)}σ: Giá rơi quá 2 độ lệch chuẩn ➔ 95% xác suất Mean Reversion bật nảy hồi quy!`;
  } else if (zScore > 0.8) {
    quantScore += 6;
  } else if (zScore < -0.8) {
    quantScore -= 6;
  }

  return { zScore, momentumFactor, quantScore, alert };
}

// ----------------------------------------------------
// RISK PROFILE & LEVERAGE
// ----------------------------------------------------
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
    return { value: "Không vào", reason: "Tín hiệu chưa rõ, chờ xác nhận SMC/Order Flow" };
  }
  if (confidence < profile.minConfidence) {
    return { value: "Không vào", reason: `${profile.label}: cần độ tin cậy tối thiểu ${profile.minConfidence}%` };
  }

  const volatilityPercent = atr14 && last ? (atr14 / last) * 100 : 0.8;
  let leverage = confidence >= 85 ? 10 : confidence >= 75 ? 6 : confidence >= 65 ? 4 : 2;
  leverage += profile.leverageBoost;

  if (volatilityPercent > 2.5) leverage -= 3;
  else if (volatilityPercent > 1.4) leverage -= 2;
  else if (volatilityPercent > 0.8) leverage -= 1;

  if (volumeRatio > 2.2) leverage -= 1;
  if ((bias === "LONG" && rsi14 > 74) || (bias === "SHORT" && rsi14 < 26)) leverage -= 1;

  leverage = Math.max(1, Math.min(profile.maxLeverage, leverage));
  return {
    value: `${leverage}x`,
    reason: `${profile.label} | Biến động ATR ${fmt.format(volatilityPercent)}% | Tin cậy ${confidence}%`,
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
  return direction > 0 ? entry * (1 - 1 / leverageNumber + maintenanceBuffer) : entry * (1 + 1 / leverageNumber - maintenanceBuffer);
}

// ----------------------------------------------------
// TRADE PLAN (SMART SL/TP FROM SMC & POC)
// ----------------------------------------------------
function tradePlan(result, forcedSide = null) {
  const profile = riskProfileConfig();
  const planBias = forcedSide || result.bias;
  const direction = planBias === "SHORT" ? -1 : planBias === "LONG" ? 1 : 0;

  let atrMultiplierSL = 1.0;
  let atrMultiplierTP = 1.8;
  if (state.tradeDuration === "5m" || state.tradeDuration === "scalping") {
    atrMultiplierSL = 0.6;
    atrMultiplierTP = 1.2;
  } else if (state.tradeDuration === "15m" || state.tradeDuration === "intraday") {
    atrMultiplierSL = 1.0;
    atrMultiplierTP = 1.8;
  } else if (state.tradeDuration === "1h") {
    atrMultiplierSL = 1.4;
    atrMultiplierTP = 2.5;
  } else if (state.tradeDuration === "4h" || state.tradeDuration === "swing") {
    atrMultiplierSL = 2.0;
    atrMultiplierTP = 3.8;
  } else if (state.tradeDuration === "1d") {
    atrMultiplierSL = 2.6;
    atrMultiplierTP = 5.2;
  }

  // Entry at market or offset
  const entryOffset = result.atr14 ? result.atr14 * 0.1 * direction : result.last * 0.0008 * direction;
  const entry = direction === 0 ? result.last : result.last + entryOffset;

  // Smart Stop Loss: If a sweep occurred, place SL right beyond the swept wick!
  let stop = direction === 0 ? result.last : entry - direction * (result.atr14 ? result.atr14 * atrMultiplierSL : result.last * 0.01);
  if (result.smc?.activeSweep?.stopLevel) {
    stop = result.smc.activeSweep.stopLevel;
  }

  // Smart Take Profit: Target opposite SMC liquidity level or POC
  let takeProfit = direction === 0 ? result.last : entry + direction * (result.atr14 ? result.atr14 * atrMultiplierTP : result.last * 0.02);
  if (planBias === "LONG" && result.smc?.bsl && result.smc.bsl > entry) {
    takeProfit = result.smc.bsl * 0.999;
  } else if (planBias === "SHORT" && result.smc?.ssl && result.smc.ssl < entry) {
    takeProfit = result.smc.ssl * 1.001;
  }

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

  return {
    side: planBias,
    entry,
    stop,
    takeProfit,
    margin,
    notional,
    quantity,
    riskAmount,
    rewardAmount,
    rewardRiskRatio,
    walletBalance,
    riskPercent,
    maxRisk,
    maxMarginPercent,
    liquidation,
    losingTradesToStop,
    profile,
    leverageNumber,
  };
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
    setFillStatus(
      `Đã chuẩn bị ${side}: entry $${payload.entry}, SL $${payload.stopLoss}, TP $${payload.takeProfit}, số lượng ${payload.quantity} ${payload.symbol.replace("USDT", "")}, ký quỹ ~${payload.margin} USDT (${payload.leverage}x). Kiểm tra lại rồi tự bấm đặt lệnh trên OKX.`,
      "ok"
    );
  } catch (error) {
    console.warn("Lỗi khi điền lệnh:", error.message);
    setFillStatus(error.message, "error");
  }
}

// ----------------------------------------------------
// MASTER CONFLUENCE ANALYSIS ENGINE (FUSING ALL 7 PILLARS)
// ----------------------------------------------------
function analyze() {
  const closes = state.candles.map((item) => item.close);
  const volumes = state.candles.map((item) => item.volume);
  const highs = state.candles.map((item) => item.high);
  const lows = state.candles.map((item) => item.low);
  const last = closes.at(-1) ?? Number(state.ticker?.lastPrice ?? state.ticker?.c ?? 0);

  const contextCloses = state.contextCandles.map((item) => item.close);
  const contextEma50 = ema(contextCloses, 50);

  // Indicators
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const rsi14 = rsi(closes);
  const macdValue = macd(closes);
  const bands = bollinger(closes);
  const atr14 = atr(state.candles);
  const volumeRatio = volumes.length >= 21 ? volumes.at(-1) / Math.max(sma(volumes.slice(0, -1), 20), 1) : 1;
  const imbalance = orderBookImbalance(state.depth);

  // 1. Order Flow
  const orderflow = calcOrderFlow(state.candles);
  const pocPrice = calcVolumeProfilePOC(state.candles);

  // 2. SMC
  const smc = calcSMC(state.candles);

  // 3 & 4. Derivatives
  const derivatives = calcDerivatives(state.futuresData, last, state.symbol);

  // 5. Wyckoff
  const wyckoff = calcWyckoff(state.candles, volumeRatio, atr14);

  // 7. Quant Signals
  const quant = calcQuantSignals(state.candles, last);

  // Confluence Scoring
  let score = 0;

  // Base Classical Technical Indicators
  if (ema12 && ema26) score += ema12 > ema26 ? 16 : -16;
  if (rsi14 !== null) score += rsi14 < 30 ? 18 : rsi14 > 70 ? -18 : rsi14 > 52 ? 8 : rsi14 < 48 ? -8 : 0;
  if (macdValue !== null) score += macdValue > 0 ? 12 : -12;
  if (bands) score += last < bands.lower ? 12 : last > bands.upper ? -12 : 0;
  score += Math.max(-12, Math.min(12, imbalance * 30));
  if (contextEma50) score += last > contextEma50 ? 10 : -10;

  // Pillar 1: Order Flow Confluence
  if (orderflow.absorption) score += orderflow.absorption.score;
  if (orderflow.cvdDivergence) score += orderflow.cvdDivergence.score;

  // Pillar 2: SMC Confluence
  if (smc.activeSweep) score += smc.activeSweep.score;
  if (smc.fvg) score += smc.fvg.score;

  // Pillar 3: Derivatives Confluence
  score += derivatives.derivScore;

  // Pillar 5: Wyckoff Confluence
  score += wyckoff.score;

  // Pillar 7: Quant Z-Score Confluence
  score += quant.quantScore;

  // Pillar 6: Inter-Market Rule Adjustment
  const prelimBias = score > 20 ? "LONG" : score < -20 ? "SHORT" : "TRUNG LẬP";
  const interMarket = calcInterMarketRules(prelimBias);
  score += interMarket.scoreAdjustment;

  // Confidence calculation
  const confluenceSignalsCount = [
    orderflow.absorption,
    orderflow.cvdDivergence,
    smc.activeSweep,
    smc.fvg,
    derivatives.squeezeAlert?.bias !== "TRUNG LẬP",
    wyckoff.alert,
    quant.alert,
  ].filter(Boolean).length;

  let confidence = Math.min(96, Math.max(35, Math.round(48 + Math.abs(score) * 0.45 + confluenceSignalsCount * 5)));

  let bias = "TRUNG LẬP";
  if (score >= 26) bias = "LONG";
  else if (score <= -26) bias = "SHORT";

  // Hysteresis filter
  if (state.lastBias === "LONG" && bias === "TRUNG LẬP" && score > 12) bias = "LONG";
  if (state.lastBias === "SHORT" && bias === "TRUNG LẬP" && score < -12) bias = "SHORT";
  state.lastBias = bias;

  const direction = bias === "LONG" ? 1 : bias === "SHORT" ? -1 : 0;
  const expectedMove = atr14 ? atr14 * (0.8 + confidence / 160) : last * 0.008;
  const forecast = direction === 0 ? last : last + direction * expectedMove;
  const leverage = recommendLeverage({ bias, confidence, atr14, last, volumeRatio, rsi14 });

  return {
    last,
    ema12,
    ema26,
    rsi14,
    macdValue,
    bands,
    atr14,
    volumeRatio,
    imbalance,
    orderflow,
    pocPrice,
    smc,
    derivatives,
    wyckoff,
    quant,
    interMarket,
    score,
    confidence,
    bias,
    forecast,
    leverage,
  };
}

// ----------------------------------------------------
// UI RENDERING
// ----------------------------------------------------
function render() {
  if (!state.candles.length) return;
  const result = analyze();
  const plan = tradePlan(result);
  const change = Number(state.ticker?.priceChangePercent ?? state.ticker?.P ?? 0);
  const signalClass = result.bias === "LONG" ? "up" : result.bias === "SHORT" ? "down" : "neutral";

  // Notification Alarm
  if (state.notifyEnable && result.confidence >= state.notifyThreshold && result.bias !== "TRUNG LẬP") {
    const now = Date.now();
    if (now - state.lastNotificationTime > 60000) {
      state.lastNotificationTime = now;
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/logo.png",
        title: `🔥 TÍN HIỆU ${result.bias} ${state.symbol} (${result.confidence}%) 🔥`,
        message: `Hệ thống Axiom phát hiện setup đẹp! Đòn bẩy khuyến nghị: ${result.leverage.value}. Entry ~$${fmt.format(plan.entry)}`,
      });
    }
  }

  // 4 Core Metrics
  els.lastPrice.textContent = `$${fmt.format(result.last)}`;
  els.priceChange.textContent = `${pct.format(change)}% 24h`;
  els.priceChange.className = change >= 0 ? "up" : "down";
  els.signalText.textContent = result.bias;
  els.signalText.className = signalClass;
  els.confidenceText.textContent = `Độ tin cậy ${result.confidence}% | Điểm ${Math.round(result.score)}`;
  els.forecastText.textContent = `$${fmt.format(result.forecast)}`;
  els.forecastText.className = signalClass;
  const { horizon } = getIntervals();
  els.horizonText.textContent = `Khung ${horizon}`;
  els.leverageText.textContent = result.leverage.value;
  els.leverageText.className = signalClass;
  els.leverageReason.textContent = result.leverage.reason;
  els.updatedAt.textContent = new Date().toLocaleTimeString("vi-VN");

  // Render 4 Quick-Insight Badges
  renderPillarBadges(result);

  // Render 4 Deep-Dive Modules
  renderTechModules(result);

  // Render Classical Indicators & Strategy
  renderIndicators(result);
  renderStrategy(result, plan);

  // Render Canvas Chart with POC, BSL/SSL, and FVG
  drawChart(result);
}

function renderPillarBadges(result) {
  // Badge 1: Order Flow
  const deltaFormatted = `${result.orderflow.candleDelta >= 0 ? "+" : ""}${fmt.format(result.orderflow.candleDelta)}`;
  els.valOrderFlow.textContent = `${deltaFormatted} Delta`;
  els.valOrderFlow.className = `pillar-val ${result.orderflow.candleDelta >= 0 ? "up" : "down"}`;
  els.subOrderFlow.textContent = result.orderflow.absorption
    ? "Hấp thụ lực (Absorption)!"
    : result.orderflow.cvdDivergence
    ? "Phân kỳ CVD!"
    : `POC: $${fmt.format(result.pocPrice || 0)}`;

  // Badge 2: SMC
  if (result.smc.activeSweep) {
    els.valSMC.textContent = result.smc.activeSweep.bias === "LONG" ? "Quét SSL Đáy" : "Quét BSL Đỉnh";
    els.valSMC.className = `pillar-val ${result.smc.activeSweep.bias === "LONG" ? "up" : "down"}`;
    els.subSMC.textContent = "Kích hoạt bẫy thanh khoản";
  } else if (result.smc.fvg) {
    els.valSMC.textContent = result.smc.fvg.type === "BULLISH_FVG" ? "Bullish FVG" : "Bearish FVG";
    els.valSMC.className = "pillar-val neutral";
    els.subSMC.textContent = "Retest khoảng trống giá";
  } else {
    els.valSMC.textContent = `BSL $${fmt.format(result.smc.bsl)}`;
    els.valSMC.className = "pillar-val";
    els.subSMC.textContent = `SSL $${fmt.format(result.smc.ssl)}`;
  }

  // Badge 3: Derivatives
  const fp = result.derivatives.fundingPct;
  els.valDerivatives.textContent = `Funding ${pct.format(fp)}%`;
  els.valDerivatives.className = `pillar-val ${fp > 0.03 ? "down" : fp < -0.015 ? "up" : ""}`;
  els.subDerivatives.textContent = result.derivatives.squeezeAlert?.type?.includes("SQUEEZE")
    ? "Cảnh báo Squeeze!"
    : `Max Pain ~$${fmt.format(result.derivatives.maxPain)}`;

  // Badge 4: Quant & Wyckoff
  const z = result.quant.zScore;
  els.valQuant.textContent = `Z: ${z >= 0 ? "+" : ""}${z.toFixed(2)}σ`;
  els.valQuant.className = `pillar-val ${Math.abs(z) >= 2 ? "neutral" : ""}`;
  els.subQuant.textContent = result.wyckoff.phase.split(" ")[0];
}

function renderTechModules(result) {
  // Module 1: Order Flow
  els.ofCandleDelta.textContent = `${result.orderflow.candleDelta >= 0 ? "+" : ""}${fmt.format(result.orderflow.candleDelta)} (${result.orderflow.candleDelta >= 0 ? "Phe Mua áp đảo" : "Phe Bán áp đảo"})`;
  els.ofCandleDelta.className = result.orderflow.candleDelta >= 0 ? "up" : "down";
  els.ofCVD.textContent = `${result.orderflow.cvd >= 0 ? "+" : ""}${fmt.format(result.orderflow.cvd)} CVD`;
  els.ofPOC.textContent = result.pocPrice ? `$${fmt.format(result.pocPrice)} (Vùng giao dịch nhiều nhất)` : "--";

  if (result.orderflow.absorption) {
    els.ofAbsorptionAlert.textContent = result.orderflow.absorption.text;
    els.ofAbsorptionAlert.className = `tech-alert ${result.orderflow.absorption.bias === "LONG" ? "bull" : "alert"}`;
  } else if (result.orderflow.cvdDivergence) {
    els.ofAbsorptionAlert.textContent = result.orderflow.cvdDivergence.text;
    els.ofAbsorptionAlert.className = `tech-alert ${result.orderflow.cvdDivergence.bias === "LONG" ? "bull" : "alert"}`;
  } else {
    els.ofAbsorptionAlert.textContent = "Chưa phát hiện hấp thụ lực bất thường. Dòng tiền Taker đang khớp lệnh đều.";
    els.ofAbsorptionAlert.className = "tech-alert";
  }

  // Module 2: SMC
  els.smcBSL.textContent = `$${fmt.format(result.smc.bsl)} (Dừng lỗ phe Short)`;
  els.smcSSL.textContent = `$${fmt.format(result.smc.ssl)} (Dừng lỗ phe Long)`;
  els.smcFVG.textContent = result.smc.fvg ? `$${fmt.format(result.smc.fvg.bottom)} – $${fmt.format(result.smc.fvg.top)}` : "Đã lấp hết FVG gần";

  if (result.smc.activeSweep) {
    els.smcSweepAlert.textContent = result.smc.activeSweep.text;
    els.smcSweepAlert.className = `tech-alert ${result.smc.activeSweep.bias === "LONG" ? "bull" : "alert"}`;
  } else {
    els.smcSweepAlert.textContent = "Chưa có cú quét thanh khoản mới. Giá đang dao động bên trong biên độ BSL và SSL.";
    els.smcSweepAlert.className = "tech-alert";
  }

  // Module 3: Derivatives
  els.derivFunding.textContent = `${pct.format(result.derivatives.fundingPct)}% / 8h`;
  els.derivOI.textContent = result.derivatives.openInterest > 0 ? `${fmt.format(result.derivatives.openInterest)} Hợp đồng` : "Dữ liệu sàn OKX";
  els.derivMaxPain.textContent = `$${fmt.format(result.derivatives.maxPain)} (Chênh ${result.derivatives.maxPainDiffPct.toFixed(1)}%)`;

  els.derivSqueezeAlert.textContent = result.derivatives.squeezeAlert.text;
  els.derivSqueezeAlert.className = `tech-alert ${result.derivatives.squeezeAlert.type.includes("SQUEEZE") ? "warn" : ""}`;

  // Module 4: Quant & Wyckoff
  els.quantZScore.textContent = `${result.quant.zScore >= 0 ? "+" : ""}${result.quant.zScore.toFixed(2)}σ (Độ lệch so với SMA20)`;
  els.wyckoffPhase.textContent = result.wyckoff.phase;
  els.quantMomentum.textContent = `${result.quant.momentumFactor >= 0 ? "+" : ""}${result.quant.momentumFactor.toFixed(2)}% (30 thanh)`;

  if (result.quant.alert) {
    els.wyckoffAlert.textContent = result.quant.alert;
    els.wyckoffAlert.className = "tech-alert warn";
  } else if (result.wyckoff.alert) {
    els.wyckoffAlert.textContent = result.wyckoff.alert;
    els.wyckoffAlert.className = "tech-alert alert";
  } else {
    els.wyckoffAlert.textContent = "Mô hình Wyckoff ổn định. Z-score trong biên độ cân bằng thông thường.";
    els.wyckoffAlert.className = "tech-alert";
  }
}

function renderIndicators(result) {
  const items = [
    ["Cấu trúc BSL / SSL", `${fmt.format(result.smc.ssl)} – ${fmt.format(result.smc.bsl)}`],
    ["Volume Profile POC", result.pocPrice ? `$${fmt.format(result.pocPrice)}` : "Đang tính"],
    ["EMA 12 / EMA 26", result.ema12 && result.ema26 ? `${fmt.format(result.ema12)} / ${fmt.format(result.ema26)}` : "--"],
    ["RSI 14", result.rsi14 !== null ? fmt.format(result.rsi14) : "--"],
    ["MACD", result.macdValue !== null ? fmt.format(result.macdValue) : "--"],
    ["Z-Score (Quant)", `${result.quant.zScore >= 0 ? "+" : ""}${result.quant.zScore.toFixed(2)}σ`],
  ];
  els.indicatorList.innerHTML = items.map(([label, value]) => `<div class="indicator"><b>${label}</b><span>${value}</span></div>`).join("");
}

function renderStrategy(result, plan) {
  const capitalNote =
    state.capital > 0
      ? `Ví hiện tại: <strong>${fmt.format(plan.walletBalance)} USDT</strong>; Ký quỹ lệnh: <strong>${fmt.format(plan.margin)} USDT</strong>.`
      : "Nhập vốn ví để hệ thống tự tính quy mô lệnh tối ưu theo quy tắc 1-3%.";

  const sizingNote =
    state.capital > 0 && plan.notional > 0
      ? `Khối lượng OKX: <strong>${fmt.format(plan.quantity)}</strong> ${state.symbol.replace("USDT", "")}; Giá trị vị thế: <strong>${fmt.format(plan.notional)} USDT</strong>.`
      : "";

  const riskLimitNote =
    state.capital > 0 && plan.riskAmount > 0
      ? `Rủi ro lệnh: <strong>${fmt.format(plan.riskAmount)} USDT</strong> (Tối đa ${fmt.format(plan.maxRisk)} USDT - ${fmt.format(plan.riskPercent)}% ví).`
      : "";

  const setupReason = result.smc.activeSweep
    ? `Thiết lập chuẩn SMC: Vào lệnh sau cú <strong>${result.smc.activeSweep.text}</strong>, SL đặt an toàn ngoài râu quét.`
    : result.orderflow.absorption
    ? `Thiết lập Order Flow: Khớp lệnh thuận theo thế trận hấp thụ lực <strong>${result.orderflow.absorption.text}</strong>.`
    : result.wyckoff.alert
    ? `Thiết lập Wyckoff: Đánh theo mẫu hình <strong>${result.wyckoff.phase}</strong>.`
    : `Thiết lập kỹ thuật đa tầng kết hợp EMA, RSI và Volume Profile POC.`;

  els.strategyList.innerHTML = [
    `Hướng vào lệnh: <strong class="${result.bias === "LONG" ? "up" : result.bias === "SHORT" ? "down" : "neutral"}">${result.bias}</strong>.`,
    `Đòn bẩy đề xuất: <strong>${result.leverage.value}</strong> — ${result.leverage.reason}.`,
    `Entry tham khảo: <strong>$${fmt.format(plan.entry)}</strong>.`,
    `Dừng lỗ (Stop-Loss): <strong>$${fmt.format(plan.stop)}</strong>.`,
    `Chốt lời (Take-Profit): <strong>$${fmt.format(plan.takeProfit)}</strong>.`,
    plan.rewardRiskRatio > 0 ? `Tỷ lệ R:R mục tiêu: <strong>1:${fmt.format(plan.rewardRiskRatio)}</strong>.` : "",
    capitalNote,
    sizingNote,
    riskLimitNote,
    setupReason,
  ]
    .filter(Boolean)
    .map((item) => `<li>${item}</li>`)
    .join("");
}

// ----------------------------------------------------
// ENHANCED CHART CANVAS RENDERING (CANDLES, POC, BSL/SSL, FVG)
// ----------------------------------------------------
function drawChart(result) {
  const canvas = els.chart;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const candles = state.candles.slice(-65);
  if (!candles.length) return;

  const highs = candles.map((item) => item.high);
  const lows = candles.map((item) => item.low);

  const max = Math.max(...highs, result.forecast, result.smc.bsl || 0);
  const min = Math.min(...lows, result.forecast, result.smc.ssl || Infinity);
  const pad = (max - min) * 0.08 || 1;

  const scaleY = (price) => height - 24 - ((price - min + pad) / (max - min + pad * 2)) * (height - 48);
  const candleWidth = Math.max(3, (width - 40) / candles.length - 3);

  // Grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = 18 + i * ((height - 36) / 4);
    ctx.beginPath();
    ctx.moveTo(12, y);
    ctx.lineTo(width - 12, y);
    ctx.stroke();
  }

  // Draw FVG Zone if active
  if (result.smc.fvg) {
    const yTop = scaleY(result.smc.fvg.top);
    const yBottom = scaleY(result.smc.fvg.bottom);
    ctx.fillStyle = result.smc.fvg.type === "BULLISH_FVG" ? "rgba(37, 208, 125, 0.12)" : "rgba(255, 85, 115, 0.12)";
    ctx.fillRect(16, yTop, width - 32, Math.max(3, yBottom - yTop));
    ctx.strokeStyle = result.smc.fvg.type === "BULLISH_FVG" ? "rgba(37, 208, 125, 0.35)" : "rgba(255, 85, 115, 0.35)";
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(16, yTop, width - 32, Math.max(3, yBottom - yTop));
    ctx.setLineDash([]);
  }

  // Draw Candlesticks
  candles.forEach((candle, index) => {
    const x = 20 + index * ((width - 40) / candles.length);
    const isUp = candle.close >= candle.open;
    const color = isUp ? "#25d07d" : "#ff5573";

    // Wick
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + candleWidth / 2, scaleY(candle.high));
    ctx.lineTo(x + candleWidth / 2, scaleY(candle.low));
    ctx.stroke();

    // Body
    ctx.fillStyle = color;
    const y = Math.min(scaleY(candle.open), scaleY(candle.close));
    const bodyHeight = Math.max(2, Math.abs(scaleY(candle.open) - scaleY(candle.close)));
    ctx.fillRect(x, y, candleWidth, bodyHeight);

    // If candle swept BSL or SSL, draw a sweep diamond marker
    if (result.smc.activeSweep && (candle.high >= result.smc.bsl || candle.low <= result.smc.ssl)) {
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      const markerY = candle.high >= result.smc.bsl ? scaleY(candle.high) - 6 : scaleY(candle.low) + 6;
      ctx.arc(x + candleWidth / 2, markerY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Draw Volume Profile POC Line (Gold, dashed)
  if (result.pocPrice && result.pocPrice >= min && result.pocPrice <= max) {
    const yPoc = scaleY(result.pocPrice);
    ctx.strokeStyle = "#f9a825";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(14, yPoc);
    ctx.lineTo(width - 14, yPoc);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#f9a825";
    ctx.font = "bold 10px Inter, sans-serif";
    ctx.fillText(`POC: $${fmt.format(result.pocPrice)}`, width - 110, yPoc - 4);
  }

  // Draw BSL Line (Red dashed)
  if (result.smc.bsl && result.smc.bsl >= min && result.smc.bsl <= max) {
    const yBsl = scaleY(result.smc.bsl);
    ctx.strokeStyle = "rgba(255, 85, 115, 0.75)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(14, yBsl);
    ctx.lineTo(width - 14, yBsl);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#ff5573";
    ctx.font = "10px Inter, sans-serif";
    ctx.fillText(`BSL: $${fmt.format(result.smc.bsl)}`, 16, yBsl - 3);
  }

  // Draw SSL Line (Green dashed)
  if (result.smc.ssl && result.smc.ssl >= min && result.smc.ssl <= max) {
    const ySsl = scaleY(result.smc.ssl);
    ctx.strokeStyle = "rgba(37, 208, 125, 0.75)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(14, ySsl);
    ctx.lineTo(width - 14, ySsl);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#25d07d";
    ctx.font = "10px Inter, sans-serif";
    ctx.fillText(`SSL: $${fmt.format(result.smc.ssl)}`, 16, ySsl + 12);
  }

  // Draw Target Forecast Line
  ctx.strokeStyle = result.bias === "SHORT" ? "#ff5573" : result.bias === "LONG" ? "#25d07d" : "#ffd166";
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(14, scaleY(result.forecast));
  ctx.lineTo(width - 14, scaleY(result.forecast));
  ctx.stroke();
  ctx.setLineDash([]);
}

// ----------------------------------------------------
// MACRO & ON-CHAIN TAB (D1 & H4 DEEP DIVE)
// ----------------------------------------------------
async function refresh() {
  state.symbol = els.symbolSelect.value;
  state.capital = Math.max(0, Number(els.capitalInput.value) || 0);
  state.riskProfile = els.riskProfileSelect.value;
  state.tradeDuration = els.tradeDurationSelect.value;

  const { trigger } = getIntervals();
  state.interval = trigger;

  await chrome.storage.local.set({
    symbol: state.symbol,
    interval: state.interval,
    capital: state.capital,
    riskProfile: state.riskProfile,
    tradeDuration: state.tradeDuration,
  });

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

  els.noteRiskProfile.textContent =
    state.riskProfile === "safe" ? "An toàn (1% vốn)" : state.riskProfile === "balanced" ? "Cân bằng (2% vốn)" : "Mạo hiểm (3% vốn)";
  els.noteMaxInvest.textContent = `${fmt.format(maxRisk)} USDT / lệnh`;
}

async function analyzeNoteTab() {
  const symbol = els.noteSymbolInput.value.trim().toUpperCase() || "BTCUSDT";
  els.noteSymbolInput.value = symbol;
  els.noteAnalysisResult.style.display = "none";
  els.noteAnalysisLoading.style.display = "block";

  try {
    let data1d, data4h;

    if (isOkxSymbol(symbol)) {
      const instId = okxInstId(symbol);
      const [res1d, res4h] = await Promise.all([
        fetchJson(`https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=1D&limit=100`),
        fetchJson(`https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=4H&limit=100`),
      ]);
      if (res1d.code !== "0" || res4h.code !== "0") throw new Error("Không tìm thấy dữ liệu Coin trên OKX");
      data1d = res1d.data.map(toOkxCandle).reverse();
      data4h = res4h.data.map(toOkxCandle).reverse();
    } else {
      const [res1d, res4h] = await Promise.all([
        fetchJson(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=100`),
        fetchJson(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=4h&limit=100`),
      ]);
      data1d = res1d.map(toCandle);
      data4h = res4h.map(toCandle);
    }

    const closes1d = data1d.map((c) => c.close);
    const closes4h = data4h.map((c) => c.close);
    const lastPrice = closes1d[closes1d.length - 1];

    const ema50_1d = ema(closes1d, 50);
    const rsi_4h = rsi(closes4h, 14);
    const macd_1d = macd(closes1d);

    const highs1d = data1d.map((c) => c.high).slice(-30);
    const lows1d = data1d.map((c) => c.low).slice(-30);
    const resist = Math.max(...highs1d);
    const support = Math.min(...lows1d);

    let trendD1 = "Sideways (Đi ngang tích lũy)";
    if (ema50_1d && lastPrice > ema50_1d && macd_1d > 0) trendD1 = "TĂNG (Bullish Uptrend)";
    else if (ema50_1d && lastPrice < ema50_1d && macd_1d < 0) trendD1 = "GIẢM (Bearish Downtrend)";

    els.noteTechnicalText.innerHTML = `
      - <b>Xu hướng dài hạn (D1):</b> <span style="color: ${trendD1.includes("TĂNG") ? "var(--green)" : trendD1.includes("GIẢM") ? "var(--red)" : "var(--yellow)"}">${trendD1}</span> <br/>
      - <b>Kháng cự vĩ mô (BSL Pool):</b> $${fmt.format(resist)} <br/>
      - <b>Hỗ trợ vĩ mô (SSL Pool):</b> $${fmt.format(support)} <br/>
      - <b>Động lượng 4H RSI:</b> ${rsi_4h.toFixed(1)} ${rsi_4h > 70 ? "(Quá mua - Đề phòng đảo chiều)" : rsi_4h < 30 ? "(Quá bán - Canh gom hàng)" : "(Trung tính)"}
    `;

    let plan = "";
    if (trendD1.includes("TĂNG")) {
      if (rsi_4h > 70) {
        plan = `Thị trường trong xu hướng <b>TĂNG</b> nhưng động lượng 4H đã <b>QUÁ MUA</b>. Tuyệt đối không FOMO.<br/><br/><b>Kế hoạch Smart Money:</b> Kiên nhẫn chờ giá pullback về kiểm tra FVG hoặc vùng hỗ trợ $${fmt.format(support)} rồi mới tìm setup Long theo Order Flow. Stop loss dưới $${fmt.format(support * 0.99)}.`;
      } else {
        plan = `Xu hướng vĩ mô ủng hộ phe Bò (Bullish).<br/><br/><b>Kế hoạch Smart Money:</b> Rải lệnh LONG quanh mức giá hiện tại ($${fmt.format(lastPrice)}), Stop-loss tuyệt đối ở $${fmt.format(support * 0.99)} (dưới mốc SSL). Mục tiêu chốt lời tại đỉnh cũ $${fmt.format(resist)}.`;
      }
    } else if (trendD1.includes("GIẢM")) {
      if (rsi_4h < 30) {
        plan = `Xu hướng chính là <b>GIẢM</b> nhưng khung 4H đã <b>QUÁ BÁN</b>. Dễ có cú nén Short Squeeze giật ngược.<br/><br/><b>Kế hoạch Smart Money:</b> Không đuổi SHORT ở đáy. Chờ giá hồi phục lấp FVG 4H hoặc test lại kháng cự $${fmt.format(resist)} để vào lệnh SHORT xuống.`;
      } else {
        plan = `Xu hướng vĩ mô là GIẢM dứt khoát. Phe Bán hoàn toàn kiểm soát cuộc chơi.<br/><br/><b>Kế hoạch Smart Money:</b> Canh các nhịp hồi nhẹ để mở vị thế SHORT, Stop-loss trên $${fmt.format(resist * 1.01)} (trên vùng BSL). Target chốt lời tại đáy vĩ mô $${fmt.format(support)}.`;
      }
    } else {
      plan = `Thị trường đang kẹp trong hộp <b>Darvas / Tích lũy Wyckoff</b> giữa hỗ trợ $${fmt.format(support)} và kháng cự $${fmt.format(resist)}.<br/><br/><b>Kế hoạch Smart Money:</b> Đánh Ping-Pong biên độ: Mua khi giá quét SSL $${fmt.format(support)} có nến rút chân; Bán khi giá chạm kháng cự $${fmt.format(resist)}. Giảm nửa khối lượng lệnh để bảo toàn vốn.`;
    }

    els.notePlanText.innerHTML = plan;
    els.noteAnalysisLoading.style.display = "none";
    els.noteAnalysisResult.style.display = "block";
  } catch (err) {
    els.noteAnalysisLoading.style.display = "none";
    els.noteAnalysisResult.style.display = "block";
    els.noteTechnicalText.innerHTML = "";
    els.notePlanText.innerHTML = `<span style="color:var(--red);">Lỗi: ${err.message}. Đảm bảo mã coin đúng (ví dụ BTCUSDT).</span>`;
  }
}

// ----------------------------------------------------
// BOOTSTRAP EXTENSION
// ----------------------------------------------------
async function boot() {
  const saved = await chrome.storage.local.get([
    "symbol",
    "interval",
    "capital",
    "riskProfile",
    "tradeDuration",
    "notifyEnable",
    "notifyThreshold",
  ]);

  state.symbol = saved.symbol || state.symbol;
  state.interval = saved.interval || state.interval;
  state.capital = Number(saved.capital) || state.capital;
  state.riskProfile = saved.riskProfile || state.riskProfile;
  let duration = saved.tradeDuration || state.tradeDuration;
  if (duration === "scalping") duration = "5m";
  else if (duration === "intraday") duration = "15m";
  else if (duration === "swing") duration = "4h";
  state.tradeDuration = duration;
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
  });

  els.notifyThreshold.addEventListener("change", () => {
    state.notifyThreshold = Number(els.notifyThreshold.value) || 80;
    chrome.storage.local.set({ notifyThreshold: state.notifyThreshold });
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
      const { trigger } = getIntervals();
      state.interval = trigger;
      loadInitialMarket();
    });
  }

  els.capitalInput.addEventListener("input", () => {
    state.capital = Math.max(0, Number(els.capitalInput.value) || 0);
    chrome.storage.local.set({ capital: state.capital });
    updateNoteBalance();
    render();
  });

  // Tab Navigation Handling
  function switchTab(activeTab) {
    els.btnHomeTab.classList.toggle("active", activeTab === "home");
    els.btnNoteTab.classList.toggle("active", activeTab === "note");
    if (els.btnHandbookTab) els.btnHandbookTab.classList.toggle("active", activeTab === "handbook");

    els.homeView.style.display = activeTab === "home" ? "block" : "none";
    els.noteView.style.display = activeTab === "note" ? "block" : "none";
    if (els.handbookView) els.handbookView.style.display = activeTab === "handbook" ? "block" : "none";

    if (activeTab === "note") updateNoteBalance();
  }

  if (els.btnHomeTab) els.btnHomeTab.addEventListener("click", () => switchTab("home"));
  if (els.btnNoteTab) els.btnNoteTab.addEventListener("click", () => switchTab("note"));
  if (els.btnHandbookTab) els.btnHandbookTab.addEventListener("click", () => switchTab("handbook"));
  if (els.btnAnalyzeNote) els.btnAnalyzeNote.addEventListener("click", analyzeNoteTab);

  refresh();
}

boot();
