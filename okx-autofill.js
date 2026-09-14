if (typeof window.okxAutofillInjected === 'undefined') {
  window.okxAutofillInjected = true;

  const OKX_AUTOFILL_DEBUG = false;

  function log(...args) {
    if (OKX_AUTOFILL_DEBUG) console.log("[Crypto Signal Radar]", ...args);
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function setNativeValue(element, value) {
    const stringValue = String(value);
    const prototype = Object.getPrototypeOf(element);
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (descriptor?.set) descriptor.set.call(element, stringValue);
    else element.value = stringValue;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }));
  }

  function okxNumber(value, decimals = 8) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";
    return number.toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
  }

  function editableElements() {
    return [...document.querySelectorAll('input:not([disabled]), textarea:not([disabled]), [contenteditable="true"]')]
      .filter((element) => element.offsetParent !== null || element.getClientRects().length > 0);
  }

  function elementText(element) {
    const nearby = [element, element.parentElement, element.parentElement?.parentElement, element.closest("label")]
      .filter(Boolean)
      .map((node) => normalizeText(`${node.innerText || ""} ${node.getAttribute?.("aria-label") || ""} ${node.getAttribute?.("placeholder") || ""}`))
      .join(" ");
    return nearby;
  }

  function findByKeywords(groups) {
    const elements = editableElements();
    for (const keywords of groups) {
      const found = elements.find((element) => keywords.some((keyword) => elementText(element).includes(keyword)));
      if (found) return found;
    }
    return null;
  }

  function fillElement(element, value) {
    if (!element || value === null || value === undefined || Number.isNaN(value)) return false;
    element.focus();
    if (element.isContentEditable) {
      element.textContent = String(value);
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: String(value) }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      setNativeValue(element, value);
    }
    element.blur();
    return true;
  }

  function findOrderPanel() {
    const candidates = [...document.querySelectorAll("section, aside, form, div")]
      .filter((node) => node.offsetParent !== null && /mua|bán|long|short|tp\/sl|giá|số lượng|amount|price/i.test(node.innerText || ""));
    return candidates.sort((a, b) => (a.getBoundingClientRect().width * a.getBoundingClientRect().height) - (b.getBoundingClientRect().width * b.getBoundingClientRect().height))[0] || document.body;
  }

  function inputsInsideOrderPanel() {
    const panel = findOrderPanel();
    return [...panel.querySelectorAll('input:not([disabled]), textarea:not([disabled]), [contenteditable="true"]')]
      .filter((element) => element.offsetParent !== null || element.getClientRects().length > 0);
  }

  function fallbackFill(payload, filled) {
    log("Fallback disabled to avoid filling the wrong OKX field", payload, filled);
  }

  function fillOkxOrder(payload) {
    const priceInput = findByKeywords([["giá", "price"], ["limit"]]);
    const quantityInput = findByKeywords([["số lượng", "amount", "quantity", "qty"], ["nes", "usdt"]]);
    const leverageInput = findByKeywords([["đòn bẩy", "leverage"]]);
    const takeProfitInput = findByKeywords([["chốt lời", "take profit", "tp"]]);
    const stopLossInput = findByKeywords([["dừng lỗ", "stop loss", "sl"]]);

    const filled = {
      price: fillElement(priceInput, okxNumber(payload.entry, 8)),
      quantity: fillElement(quantityInput, okxNumber(payload.quantity, 6)),
      leverage: fillElement(leverageInput, String(payload.leverage)),
      takeProfit: fillElement(takeProfitInput, okxNumber(payload.takeProfit, 8)),
      stopLoss: fillElement(stopLossInput, okxNumber(payload.stopLoss, 8)),
    };

    fallbackFill(payload, filled);
    log("Filled OKX order", payload, filled);

    const count = Object.values(filled).filter(Boolean).length;
    if (count === 0) throw new Error("Không tìm thấy ô nhập phù hợp trên OKX. Hãy mở bảng đặt lệnh Limit/Futures rồi thử lại.");

    return { filled, count };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "FILL_OKX_ORDER") return false;
    try {
      const result = fillOkxOrder(message.payload);
      sendResponse({ ok: true, ...result });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
    return true;
  });
}
