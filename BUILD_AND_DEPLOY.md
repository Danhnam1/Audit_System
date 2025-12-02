# Hướng dẫn Build và Deploy - Sửa lỗi 404 API

## Vấn đề:
Request vẫn đang gọi `https://moca.mom:80/api/Auth/login` và nhận 404

## Giải pháp đã áp dụng:

### 1. Code đã được sửa:
- **`src/hooks/axios.ts`**: 
  - Thêm hàm `getBaseURL()` để normalize URL (loại bỏ port 80)
  - Thêm logic trong request interceptor để loại bỏ port 80 từ baseURL và url
  - Đảm bảo URL luôn là `https://moca.mom/api` (không có port 80)

### 2. Web.config đã được cấu hình:
- Exclude `/api/*` khỏi React Router rewrite
- Cho phép API requests đi thẳng đến backend

## Các bước bắt buộc:

### Bước 1: Build lại project (QUAN TRỌNG!)
```bash
npm run build
```

### Bước 2: Clear browser cache hoàn toàn
**Cách 1: Hard Reload**
- Mở Developer Tools (F12)
- Right-click vào nút Refresh
- Chọn "Empty Cache and Hard Reload"

**Cách 2: Clear Cache thủ công**
- Ctrl + Shift + Delete
- Chọn "Cached images and files"
- Time range: "All time"
- Click "Clear data"

**Cách 3: Incognito/Private mode**
- Mở trình duyệt ở chế độ Incognito/Private
- Test lại để tránh cache

### Bước 3: Upload lại dist/
- Upload toàn bộ thư mục `dist/` lên IIS
- Đảm bảo file `web.config` có trong thư mục root của website

### Bước 4: Restart IIS
- Mở IIS Manager
- Right-click vào website → Manage Website → Restart
- Hoặc restart Application Pool

### Bước 5: Test và kiểm tra
1. Mở Developer Tools → Network tab
2. Thử login
3. Kiểm tra request đến `/api/Auth/login`:
   - **URL phải là**: `https://moca.mom/api/Auth/login` (KHÔNG có :80)
   - **Status code phải là**: 200 (không phải 404)
   - **Response phải là**: JSON (không phải HTML)

## Nếu vẫn thấy :80 trong URL:

### Kiểm tra 1: Code đã được build chưa?
- Kiểm tra file `dist/assets/index-*.js`
- Tìm kiếm `:80` trong file đó
- Nếu vẫn có `:80`, code chưa được build lại

### Kiểm tra 2: Browser cache
- Thử Incognito/Private mode
- Hoặc clear cache hoàn toàn

### Kiểm tra 3: API backend có đang chạy không?
```bash
# Test API trực tiếp (không có port)
curl https://moca.mom/api/Auth/login -X POST -H "Content-Type: application/json" -d "{\"email\":\"test\",\"password\":\"test\"}"
```

### Kiểm tra 4: Backend CORS
Backend cần cho phép origin:
```csharp
policy.WithOrigins(
    "https://moca.mom",        // ← Không có port (QUAN TRỌNG!)
    "https://moca.mom:80"      // ← Có port (nếu cần)
)
```

## Debug steps:

1. **Mở Console và gõ:**
   ```javascript
   console.log(import.meta.env.VITE_API_BASE_URL)
   ```
   - Nếu trả về `undefined` → dùng default `https://moca.mom/api`
   - Nếu trả về giá trị có `:80` → cần sửa biến môi trường

2. **Kiểm tra Network tab:**
   - Xem request URL
   - Nếu vẫn có `:80` → code chưa được build lại hoặc browser cache

3. **Kiểm tra file dist:**
   - Mở file `dist/assets/index-*.js`
   - Tìm `moca.mom:80`
   - Nếu tìm thấy → build lại

## Lưu ý quan trọng:

- **HTTPS mặc định dùng port 443**, không cần chỉ định port
- **Port 80 là cho HTTP**, không phải HTTPS  
- **URL đúng**: `https://moca.mom/api` (không có port)
- **URL sai**: `https://moca.mom:80/api` (có port 80)

## Checklist trước khi test:

- [ ] Đã build lại project (`npm run build`)
- [ ] Đã upload lại thư mục `dist/` lên IIS
- [ ] Đã clear browser cache hoặc dùng Incognito mode
- [ ] Đã restart IIS
- [ ] Đã kiểm tra API backend có đang chạy không
- [ ] Đã kiểm tra Backend CORS có cho phép `https://moca.mom` không

