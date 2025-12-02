# Debug lỗi 404 API - Hướng dẫn chi tiết

## Vấn đề:
Request đang gọi `https://moca.mom:80/api/Auth/login` và nhận 404, mặc dù URL đúng phải là `https://moca.mom/api/Auth/login` (không có port 80)

## Nguyên nhân có thể:

### 1. Browser tự động thêm port 80
- Khi frontend chạy trên `https://moca.mom:80`, browser có thể tự động thêm port 80 vào các requests
- Axios có thể normalize URL và thêm port từ `window.location`

### 2. Code chưa được build lại
- Code đã sửa nhưng chưa build lại
- Browser đang cache code cũ

### 3. API backend không chạy
- API backend có thể không chạy trên `https://moca.mom/api`
- Hoặc API backend chạy trên port/domain khác

## Giải pháp đã áp dụng:

### 1. Code đã được sửa:
- **`src/hooks/axios.ts`**: 
  - Thêm hàm `getBaseURL()` để normalize URL (loại bỏ port 80)
  - Thêm logic trong request interceptor để loại bỏ port 80
  - Thêm console.log để debug

### 2. Các bước debug:

#### Bước 1: Build lại và clear cache
```bash
npm run build
```
- Clear browser cache hoàn toàn
- Hoặc dùng Incognito/Private mode

#### Bước 2: Kiểm tra Console logs
Sau khi build và deploy, mở Console và xem:
- `[axios] Base URL:` - phải là `https://moca.mom/api` (không có :80)
- `[axios] Request URL:` - xem fullUrl có chứa :80 không
- Nếu vẫn thấy :80 → có thể do browser tự động thêm

#### Bước 3: Kiểm tra API backend
```bash
# Test API trực tiếp
curl https://moca.mom/api/Auth/login -X POST -H "Content-Type: application/json" -d "{\"email\":\"test\",\"password\":\"test\"}"
```

Nếu API trả về 404 → API backend không chạy hoặc không đúng endpoint

#### Bước 4: Kiểm tra Network tab
- Mở Developer Tools → Network tab
- Xem request đến `/api/Auth/login`
- Kiểm tra:
  - **Request URL**: Phải là `https://moca.mom/api/Auth/login` (không có :80)
  - **Status**: Phải là 200 (không phải 404)
  - **Response**: Phải là JSON (không phải HTML)

## Nếu vẫn thấy :80 trong URL:

### Giải pháp 1: Force normalize trong interceptor
Code đã có logic normalize, nhưng nếu vẫn không work, có thể cần normalize ở level khác.

### Giải pháp 2: Kiểm tra window.location
Có thể browser đang lấy port từ `window.location.port` và thêm vào URL. Kiểm tra:
```javascript
console.log('window.location:', window.location.href);
console.log('window.location.port:', window.location.port);
```

### Giải pháp 3: Sử dụng relative path
Nếu API backend chạy trên cùng domain, có thể dùng relative path:
```typescript
const BASE_URL = '/api'  // Relative path
```

Nhưng cần cấu hình proxy trong IIS để forward `/api/*` đến backend.

## Checklist:

- [ ] Đã build lại project (`npm run build`)
- [ ] Đã clear browser cache hoặc dùng Incognito
- [ ] Đã upload lại `dist/` lên IIS
- [ ] Đã restart IIS
- [ ] Đã kiểm tra Console logs
- [ ] Đã kiểm tra Network tab
- [ ] Đã test API backend trực tiếp bằng curl
- [ ] Đã kiểm tra Backend CORS

## Next steps:

1. **Build lại và test**
2. **Xem Console logs** để biết URL được normalize như thế nào
3. **Xem Network tab** để biết request URL thực tế
4. **Test API backend** trực tiếp để đảm bảo API đang chạy

