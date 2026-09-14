# Crypto Signal Radar (Axiom Quant Edition)

Extension Chrome / Edge phân tích thị trường Crypto realtime tích hợp toàn bộ **7 Trụ Cột Kỹ Thuật Thực Chiến** (Order Flow, SMC Liquidity Mapping, On-Chain, Phái Sinh & Options, Wyckoff 2.0, Inter-Market và Quant Signals).

---

## 7 Trụ Cột Kỹ Thuật Được Tích Hợp

### 1. Order Flow & Footprint
- **Delta & CVD (Cumulative Volume Delta):** Đo lường trực tiếp Taker Buy vs Taker Sell từ Klines.
- **Phát hiện Absorption (Hấp thụ lực):** Nhận diện cá voi chặn lệnh bán ẩn Iceberg khi retail mua FOMO hoặc ngược lại.
- **Phân kỳ CVD (CVD Divergence):** Bắt bài phân kỳ giữa biến động giá và dòng tiền nỗ lực thực (ví dụ kinh điển BTC 60k ➔ 65k nhưng Delta âm liên tục).
- **Volume Profile POC (Point of Control):** Xác định chính xác vùng giá giao dịch nhiều nhất phiên, đóng vai trò nam châm hút giá.

### 2. Smart Money Concepts (SMC) & Liquidity Mapping
- **BSL (Buy-Side Liquidity) & SSL (Sell-Side Liquidity):** Tự động phát hiện các cụm thanh khoản cắt lỗ của đám đông trên đỉnh và đáy cũ.
- **Liquidity Sweeps (Quét thanh khoản):** Báo động cú rướn quét râu qua BSL/SSL rồi rút chân đóng nến từ chối (Rejection) ➔ Setup đảo chiều xác suất cao nhất.
- **Fair Value Gap (FVG):** Nhận diện khoảng trống mất cân bằng 3 nến và theo dõi trạng thái lấp gap (Mitigated / Unmitigated).
- **Điểm cắt lỗ thông minh:** Đặt Stop-Loss ngay ngoài râu nến đã sweep thanh khoản theo đúng nguyên tắc SMC.

### 3. On-Chain Analysis (2024-2025)
- **MVRV Z-Score Tracker:** Thước đo định giá chu kỳ (< 0.1: Đáy hoảng loạn Capitulation; > 7.0: Đỉnh chu kỳ xả hàng).
- **SOPR (Spent Output Profit Ratio):** Giám sát tỷ lệ lãi/lỗ của coin trên mạng blockchain để tìm điểm cạn kiệt phe bán.
- **Exchange Netflow:** Cảnh báo dòng tiền coin nạp/rút sàn để phòng ngừa xả hàng tại vùng kháng cự.

### 4. Phái Sinh & Options Analysis
- **Funding Rate Realtime:** Kết nối trực tiếp Binance Futures API (`/fapi/v1/premiumIndex`).
- **Cảnh báo Squeeze:** Cảnh báo Long Squeeze khi Funding quá dương (> +0.035%/8h) hoặc Short Squeeze khi Funding âm (< -0.02%/8h).
- **Open Interest (OI):** Xác nhận dòng tiền mới mở vị thế hay chỉ là chốt lời đóng lệnh.
- **Options Max Pain:** Tính toán mức giá Max Pain kỳ hạn thứ 6 hàng tuần và lực kéo ghim giá của Market Maker.

### 5. Wyckoff 2.0 (Phát Hiện Thao Túng Cá Voi)
- **4 Pha Thị Trường:** Tự động phân loại Accumulation (Tích lũy), Markup (Đẩy giá), Distribution (Phân phối), Markdown (Đạp giá).
- **Phát hiện UTAD (Upthrust After Distribution):** Bắt bài cú giật vượt đỉnh dụ mua rồi xả hàng dứt khoát ➔ Tín hiệu SHORT kinh điển.
- **VSA Anomaly:** Cảnh báo khi khối lượng bùng nổ nhưng thân nến hẹp (nỗ lực lớn nhưng không đem lại kết quả).

### 6. Inter-Market Analysis (Liên Thị Trường)
- **Ma trận tương quan:** Giám sát tác động của DXY (Đô La Mỹ), US10Y (Lợi suất trái phiếu), SPX (Chứng khoán Mỹ) và Gold (Vàng).
- **Quy tắc Axiom:** Kiểm tra DXY và SPX trước khi vào lệnh Long BTC; từ chối Long nếu DXY tại kháng cự và SPX suy yếu.

### 7. Machine Learning & Quant Signals
- **Z-Score Mean Reversion:** $Z = \frac{\text{Giá} - \text{SMA}_{20}}{\sigma_{20}}$. Khi $|Z| > 2.0\sigma$, cảnh báo 95% xác suất giá sẽ hồi quy về vùng trung bình.
- **Momentum Factor:** Đo lường xung lực luân chuyển 30 kỳ để đánh giá độ bền của xu hướng.
- **Chế độ thị trường:** Thích ứng tự động với biến động ATR để điều chỉnh đòn bẩy và stop loss.

---

## Giao Diện 3 Tab Tiện Ích

1. **⚡ Radar Realtime:**
   - 4 Thẻ chỉ số cốt lõi (Giá, Tín hiệu tổng hợp, Dự đoán mục tiêu, Đòn bẩy khuyến nghị).
   - 4 Thẻ Badge cập nhật tức thì (Order Flow Delta, SMC Sweeps/FVG, Futures Funding/OI, Quant Z-Score).
   - Biểu đồ nến tương tác Canvas vẽ trực tiếp đường **POC (Vàng)**, **BSL (Đỏ)**, **SSL (Xanh)**, và **vùng FVG**.
   - 4 Khối kỹ thuật chi tiết cùng bộ công cụ tự điền lệnh OKX (Entry, SL ngoài sweep, TP tại FVG).

2. **🌐 Vĩ Mô & On-Chain:**
   - Quản trị vốn (quy tắc 1-3% rủi ro cho mỗi lệnh).
   - Bảng phân tích liên thị trường (DXY, US10Y, SPX, Vàng) và trạng thái Risk-On / Risk-Off.
   - Bảng đồng hồ chu kỳ On-Chain (MVRV Z-Score, SOPR, Netflow).
   - Công cụ phân tích Swing đa khung thời gian D1 & H4 cho bất kỳ đồng coin nào.

3. **📖 Cẩm Nang Axiom:**
   - Sổ tay tra cứu chi tiết toàn bộ 7 kỹ thuật và công thức thực chiến.

---

## Cài Đặt Trên Chrome / Edge

1. Mở `chrome://extensions` hoặc `edge://extensions`.
2. Bật công tắc **Developer mode** ở góc phải trên.
3. Bấm **Load unpacked**.
4. Chọn thư mục: `C:\Users\ADMIN-PC\Desktop\trading bot\Crypto-Signal-Radar`.
5. Bấm icon **Crypto Signal Radar** để mở bảng Side Panel ở cạnh phải màn hình.
6. Mở tab OKX Futures song song, theo dõi tín hiệu và bấm **Chuẩn bị Long** / **Chuẩn bị Short** khi có setup chuẩn!
