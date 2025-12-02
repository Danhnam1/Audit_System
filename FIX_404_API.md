# Hướng dẫn sửa lỗi 404 API - Giải pháp cuối cùng

## Vấn đề:
- Frontend gọi `https://moca.mom:80/api/Auth/login` → 404 Not Found
- Backend CORS đã cấu hình với `https://moca.mom:80`

## Nguyên nhân có thể:
1. **Port 80 không cần thiết trong URL HTTPS**: `https://moca.mom:80` có thể không đúng, nên dùng `https://moca.mom` (port 443 mặc định)
2. **API backend chạy trên port khác**: Có thể API chạy trên port 5000, 443, hoặc port khác
3. **IIS đang chặn requests**: Web.config cần được cấu hình đúng

## Giải pháp đã áp dụng:

### 1. Frontend (`src/hooks/axios.ts`):
- Sử dụng `https://moca.mom/api` (KHÔNG có port 80)
- HTTPS mặc định dùng port 443, không cần chỉ định

### 2. Backend CORS cần cập nhật:
Backend cần cho phép origin không có port:
```csharp
policy.WithOrigins(
    "http://localhost:5173",
    "http://localhost:8080", 
    "http://127.0.0.1:5500",
    "https://moca.mom",  // ← Bỏ :80
    "https://moca.mom:80"  // ← Giữ lại nếu cần
)
```

### 3. Web.config:
- Đã cấu hình để exclude `/api/*` khỏi React Router
- Requests `/api/*` sẽ đi thẳng đến backend

## Các bước kiểm tra:

### 1. Kiểm tra API backend đang chạy ở đâu:
```bash
# Test API trực tiếp (không có port)
curl https://moca.mom/api/Auth/login -X POST -H "Content-Type: application/json" -d "{\"email\":\"test\",\"password\":\"test\"}"

# Test với port 80
curl https://moca.mom:80/api/Auth/login -X POST -H "Content-Type: application/json" -d "{\"email\":\"test\",\"password\":\"test\"}"

# Test với port 443 (HTTPS mặc định)
curl https://moca.mom:443/api/Auth/login -X POST -H "Content-Type: application/json" -d "{\"email\":\"test\",\"password\":\"test\"}"
```

### 2. Nếu API chạy trên port khác (ví dụ: 5000):
Sửa `src/hooks/axios.ts`:
```typescript
const BASE_URL = 'https://moca.mom:5000/api'
```

### 3. Cập nhật Backend CORS:
Thêm origin không có port vào CORS policy:
```csharp
policy.WithOrigins(
    "https://moca.mom",  // ← Thêm dòng này
    "https://moca.mom:80"
)
```

## Build và Deploy:

1. **Build lại:**
   ```bash
   npm run build
   ```

2. **Upload thư mục `dist/` lên IIS**

3. **Kiểm tra:**
   - Mở Developer Tools → Network
   - Request phải gọi đến `https://moca.mom/api/Auth/login` (KHÔNG có :80)
   - Backend phải trả về JSON response

## Nếu vẫn lỗi:

1. **Kiểm tra API backend có đang chạy không**
2. **Kiểm tra firewall có chặn không**
3. **Kiểm tra IIS có chặn requests không**
4. **Kiểm tra backend CORS có cho phép origin đúng không**

