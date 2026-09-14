# Crypto Signal Radar

Extension web phân tích crypto realtime bằng dữ liệu công khai từ Binance Spot.

## Tính năng

- Giá realtime qua WebSocket.
- Chọn cặp giao dịch và khung nến.
- Phân tích EMA 12/26, RSI 14, MACD, Bollinger Bands, ATR, volume ratio và order book imbalance.
- Tín hiệu LONG / SHORT / TRUNG LẬP kèm độ tin cậy và vùng quản trị rủi ro tham khảo.
- Nhập vốn ví hiện tại để app tự tính số vốn nên vào từng lệnh, quy mô vị thế và rủi ro tối đa.
- Chọn mức rủi ro `An toàn`, `Cân bằng`, hoặc `Mạo hiểm` để điều chỉnh đòn bẩy và phần vốn vào lệnh.
- Cảnh báo tỷ lệ lời/lỗ, thanh lý ước tính và số lệnh thua liên tiếp nên dừng.
- Nút `Chuẩn bị Long` / `Chuẩn bị Short` để tự điền entry, số lượng coin, đòn bẩy nếu có ô nhập, và TP/SL vào form OKX khi tab OKX đang mở.
- Biểu đồ nến tự vẽ, không cần thư viện ngoài.

## Cài trên Chrome / Edge

1. Mở `chrome://extensions` hoặc `edge://extensions`.
2. Bật `Developer mode`.
3. Chọn `Load unpacked`.
4. Chọn thư mục này: `C:\Users\84986\Desktop\bot trading`.
5. Bấm icon `Crypto Signal Radar` trên thanh extension để mở app ở cạnh phải màn hình.
6. Mở OKX ở tab chính, giữ panel bên phải để theo dõi tín hiệu song song.
7. Khi muốn chuẩn bị lệnh, bấm `Chuẩn bị Long` hoặc `Chuẩn bị Short`, kiểm tra lại thông tin trên OKX rồi tự bấm đặt lệnh.

## Lưu ý

Ứng dụng chỉ hỗ trợ ra quyết định bằng xác suất, không thể đảm bảo dự đoán chính xác tuyệt đối. App chỉ tự điền ô nhập liệu, không bấm nút Long/Short/Mua/Bán trên OKX và không tự đặt lệnh. Bạn phải kiểm tra lại entry, số lượng, đòn bẩy, TP/SL và tự chịu trách nhiệm với lệnh giao dịch.
