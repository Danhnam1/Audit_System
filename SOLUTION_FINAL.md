# Giải pháp cuối cùng cho lỗi 404 API

## Vấn đề:
Request vẫn đang gọi `https://moca.mom:80/api/Auth/login` và nhận 404

## Nguyên nhân:
1. **Browser cache**: Browser có thể đang cache code cũ
2. **Chưa build lại**: Code đã sửa nhưng chưa build lại
3. **Port 80 không đúng cho HTTPS**: HTTPS mặc định dùng port 443, không phải 80

## Giải pháp đã áp dụng:

### 1. Code đã được sửa:
- `src/hooks/axios.ts`: Đã thêm logic để loại bỏ port 80 khỏi baseURL trong request interceptor
- Base URL: `https://moca.mom/api` (không có port 80)

### 2. Các bước cần làm:

#### Bước 1: Build lại project
```bash
npm run build
```

#### Bước 2: Clear browser cache
- Mở Developer Tools (F12)
- Right-click vào nút Refresh
- Chọn "Empty Cache and Hard Reload"
- Hoặc: Ctrl + Shift + Delete → Clear cache

#### Bước 3: Upload lại dist/
- Upload toàn bộ thư mục `dist/` lên IIS
- Đảm bảo file `web.config` có trong thư mục root

#### Bước 4: Restart IIS
- Mở IIS Manager
- Right-click vào website → Restart

#### Bước 5: Test lại
- Mở Developer Tools → Network tab
- Thử login
- Kiểm tra request URL phải là `https://moca.mom/api/Auth/login` (KHÔNG có :80)

## Nếu vẫn lỗi 404:

### Kiểm tra 1: API backend có đang chạy không?
```bash
# Test API trực tiếp
curl https://moca.mom/api/Auth/login -X POST -H "Content-Type: application/json" -d "{\"email\":\"test\",\"password\":\"test\"}"
```

### Kiểm tra 2: API backend chạy trên port nào?
- Nếu API chạy trên port khác (ví dụ: 5000), sửa `src/hooks/axios.ts`:
  ```typescript
  const BASE_URL = 'https://moca.mom:5000/api'
  ```

### Kiểm tra 3: Backend CORS đã cấu hình đúng chưa?
Backend cần cho phép origin:
```csharp
policy.WithOrigins(
    "https://moca.mom",  // ← Không có port
    "https://moca.mom:80"  // ← Có port (nếu cần)
)
```

### Kiểm tra 4: IIS có chặn requests không?
- Kiểm tra file `web.config` có trong thư mục website không
- Kiểm tra URL Rewrite module đã được cài đặt chưa

## Debug:

1. **Mở Developer Tools → Network tab**
2. **Xem request đến `/api/Auth/login`:**
   - URL phải là `https://moca.mom/api/Auth/login` (không có :80)
   - Status code phải là 200 (không phải 404)
   - Response phải là JSON (không phải HTML)

3. **Nếu vẫn thấy :80 trong URL:**
   - Clear browser cache hoàn toàn
   - Build lại project
   - Upload lại dist/

## Lưu ý quan trọng:

- **HTTPS mặc định dùng port 443**, không cần chỉ định port
- **Port 80 là cho HTTP**, không phải HTTPS
- **URL đúng**: `https://moca.mom/api` (không có port)
- **URL sai**: `https://moca.mom:80/api` (có port 80)

