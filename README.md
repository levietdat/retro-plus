# Retro Huế · Web gọi món

Web gọi món cho quán Retro Huế, gồm 3 trang:

- `/` — khách xem thực đơn, chọn món, gửi đơn. Đầu trang chỉ hiện **đơn của chính khách** (và đơn nhóm khách tham gia) kèm trạng thái.
- `/order/R012?k=…` — trang theo dõi đơn: thời gian chờ ước tính, trạng thái Mới → Đang pha → Xong. Tự cập nhật.
- `/admin` — quầy pha chế, cần mật khẩu. Xem tất cả đơn theo trạng thái, bấm chuyển bước, huỷ đơn, có chuông báo đơn mới, xem lại ngày cũ và doanh thu trong ngày.

- `/g/HND97U` — **đơn nhóm**: một người bấm *Tạo đơn nhóm* ở trang chủ, gửi link hoặc mã QR cho bạn bè.
  Mỗi người mở link trên điện thoại, nhập tên, tự chọn món và ghi chú riêng cho từng ly.
  Ai cũng thấy cả nhóm đã chọn gì, chỉ sửa được ly của mình. Trưởng nhóm bấm *Gửi đơn cho quầy* một lần;
  quầy nhận một đơn chia theo tên từng người. Nhóm tự đóng sau 6 giờ.

Mã đơn đánh số lại từ R001 mỗi ngày (giờ Việt Nam).

### Tính năng học từ các app lớn

| Tính năng | Lấy ý từ |
|---|---|
| Chọn size, **đường 100/70/50/30/0%**, **đá bình thường/ít/không/riêng**, ghi chú từng ly | Highlands, Phúc Long, Katinat |
| **Gọi lại như lần trước** một chạm | Starbucks (favorites / reorder) |
| **Thời gian chờ ước tính** ở đầu trang và trang đơn | Starbucks (order ahead) |
| **Báo khi món xong**: rung điện thoại, nhấp nháy tiêu đề tab, thông báo hệ thống nếu khách cho phép | Starbucks, McDonald's |
| **Bán chạy tuần này** đặt lên đầu menu, tự tính từ đơn thật 7 ngày | GoTab, Toast (best sellers first) |
| **Thanh toán VietQR** ngay trên trang đơn, nội dung có sẵn mã đơn; quầy bấm *Đã thu* | Các chuỗi F&B Việt |
| Quầy bấm **Tạm ngưng nhận đơn** và **Món hết** lúc đông | GoTab (order pacing, 86'd items) |
| Đồ đóng chai (Sting, Coca…) thêm thẳng, không hỏi đường đá | Ít chạm nhất có thể |

**QR theo bàn:** in QR trỏ tới `https://<tên-site>.netlify.app/?ban=5`. Khách quét sẽ có sẵn số bàn.

### Riêng tư và an toàn

- Khách **không thấy tổng số đơn** hay đơn của người khác. API công khai `/api/storefront` chỉ trả: quán có đang nhận đơn không, món nào tạm hết, thời gian chờ ước tính.
- Mỗi đơn có một **khoá bí mật** trong link (`?k=…`). Thiếu khoá hoặc sai khoá thì trả về "không tìm thấy", nên đoán mã R001, R002… không xem được đơn người khác. Thành viên nhóm nhận khoá của đơn nhóm.
- "Đơn của bạn" lưu trên chính điện thoại của khách, không có tài khoản.
- **Bấm gửi hai lần** hay mạng chập chờn không tạo đơn trùng: mỗi lần thanh toán có một mã riêng, server thấy trùng thì trả lại đơn cũ.
- **Chống spam** cơ bản: tối đa 20 đơn/phút và 150 thao tác nhóm/phút mỗi IP. Mức này rộng có chủ ý, vì cả quán dùng chung wifi là chung một IP. Muốn chặn cứng hơn thì thêm Rate limiting rule trong Netlify (Site configuration → Rate limiting) cho `/api/orders`.

### Tốc độ

- Trang chủ là HTML tĩnh trên CDN, tự dựng lại 5 phút một lần, nên mở rất nhanh sau khi quét QR. Mục "Bán chạy" cũng cập nhật theo nhịp này.
- Trạng thái quán được CDN cache 15 giây, mỗi trình duyệt hỏi 30 giây một lần và hỏi lại ngay khi khách quay lại tab.
- Trang đơn hỏi trạng thái 4 giây một lần, sau 10 phút hoặc khi tab ẩn thì giãn ra 10 giây. "Đơn của bạn" ở header ngừng hỏi khi mọi đơn đã xong.

## Deploy lên Netlify

### Cách 1 — qua GitHub (khuyên dùng, tự deploy mỗi lần push)

1. Tạo repo trên GitHub rồi đẩy thư mục này lên:
   ```bash
   git init && git add . && git commit -m "Retro Hue order site"
   git branch -M main
   git remote add origin git@github.com:<user>/retro-hue-order.git
   git push -u origin main
   ```
2. Vào https://app.netlify.com → **Add new site → Import an existing project → GitHub**, chọn repo.
   Netlify tự đọc `netlify.toml`, bạn không cần đổi gì.
3. Vào **Site configuration → Environment variables**, thêm:
   - `ADMIN_PASSWORD` = mật khẩu vào /admin
   - `SESSION_SECRET` = một chuỗi ngẫu nhiên dài (vd. tạo bằng `openssl rand -hex 32`)
4. Bấm **Deploys → Trigger deploy**. Xong thì mở link `.netlify.app`.

### Cách 2 — bằng lệnh, không cần GitHub

```bash
npm install
npx netlify-cli login
npx netlify-cli init            # tạo site mới
npx netlify-cli env:set ADMIN_PASSWORD "mat-khau-cua-ban"
npx netlify-cli env:set SESSION_SECRET "$(openssl rand -hex 32)"
npx netlify-cli deploy --build --prod
```

Đơn hàng được lưu trong **Netlify Blobs** của site, tự bật khi chạy trên Netlify, không cần tạo database.

## Chạy thử trên máy

```bash
cp .env.example .env.local      # sửa ADMIN_PASSWORD
npm install
npm run dev                     # http://localhost:3000
```

Khi chạy trên máy, đơn được lưu thành file JSON trong `./data/`, mỗi ngày một file.
Cần Node.js 22 trở lên.

## Nối KiotViet (khi đã gia hạn và có key)

Lấy Client ID và Mã bảo mật trong KiotViet (Thiết lập → Thiết lập kết nối API), rồi đặt biến môi trường:

| Biến | Giá trị |
|---|---|
| `MENU_SOURCE` | `kiotviet` — lấy thực đơn trực tiếp từ KiotViet, cache 5 phút |
| `KIOTVIET_RETAILER` | `retrohue` |
| `KIOTVIET_CLIENT_ID` | Client ID |
| `KIOTVIET_CLIENT_SECRET` | Mã bảo mật |
| `KIOTVIET_PUSH_ORDERS` | `true` để đẩy đơn web vào KiotViet (hiện trên máy POS) |
| `KIOTVIET_BRANCH_ID` | ID chi nhánh nhận đơn |

### Thanh toán VietQR và thời gian chờ

| Biến | Giá trị |
|---|---|
| `BANK_ID` | Mã ngân hàng theo VietQR: `VCB`, `MB`, `TCB`, `ACB`, `VPB`, `BIDV`, `ICB`… |
| `BANK_ACCOUNT_NO` | Số tài khoản nhận tiền |
| `BANK_ACCOUNT_NAME` | Tên chủ tài khoản (in hoa, không dấu) |
| `PREP_MINUTES_PER_CUP` | Số phút pha trung bình mỗi ly, mặc định 2 |
| `BARISTAS` | Số người đang pha, mặc định 1 |

Không đặt `BANK_ID` thì trang đơn chỉ ghi "thanh toán tại quầy". Quầy vẫn bấm *Đã thu / Chưa thu* trên từng đơn để biết còn bao nhiêu tiền chưa thu trong ngày.

Nếu KiotViet lỗi hoặc chưa cấu hình, web tự dùng thực đơn có sẵn trong `src/lib/menu-static.ts`, nên quán vẫn nhận đơn bình thường.
Lần đầu bật, nên đối chiếu tên trường trả về trong `src/lib/kiotviet.ts` với dữ liệu thật của gian hàng.

## Sửa thực đơn có sẵn

Sửa danh sách trong `src/lib/menu-static.ts`: mỗi dòng gồm id, tên món, nhóm, giá theo size, nhãn (tuỳ chọn).
Các món có 2 giá đang được hiểu là size L / M.

## Cấu trúc

```
src/lib/constants.ts     enum, hằng số, thông báo (không dùng chuỗi rời)
src/lib/types.ts         interface dữ liệu
src/lib/storage.ts       lưu đơn: Netlify Blobs hoặc file JSON, ghi có kiểm tra phiên bản
src/lib/orders.ts        tạo đơn (tính giá ở server), thống kê, đổi trạng thái
src/lib/groups.ts        đơn nhóm: tạo nhóm, thêm/sửa/xoá ly, trưởng nhóm gửi đơn
src/lib/kiotviet.ts      client KiotViet FnB: token, nhóm hàng, hàng hoá, tạo đơn
src/app/api/...          API cho trang khách và trang quản trị
src/components/...       giao diện: OrderApp, GroupApp, OrderStatusView, AdminBoard
```
