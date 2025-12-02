# Hướng dẫn Setup IIS - Giải pháp cuối cùng

## Vấn đề:
- Frontend gọi API: `https://moca.mom:80/api/Auth/login`
- Nhận lỗi 404 vì IIS không tìm thấy route này
- API backend có thể chạy trên server/port khác

## Giải pháp đã áp dụng:

### 1. Frontend gọi API trực tiếp (không qua IIS proxy)
- File `src/hooks/axios.ts` đã được cấu hình để gọi trực tiếp đến `https://moca.mom/api`
- Backend API phải cấu hình CORS để cho phép frontend gọi

### 2. Web.config chỉ xử lý React Router
- Rule "Exclude API routes" cho phép `/api/*` requests đi thẳng đến backend
- Rule "React Routes" chỉ rewrite các routes không phải `/api/*` về `index.html`

## Các bước kiểm tra:

### 1. Kiểm tra Backend API có chạy không:
```bash
# Test API trực tiếp
curl https://moca.mom/api/Auth/login -X POST -H "Content-Type: application/json" -d "{\"email\":\"test\",\"password\":\"test\"}"
```

### 2. Kiểm tra CORS trên Backend:
Backend API phải có headers:
```
Access-Control-Allow-Origin: https://moca.mom
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

### 3. Nếu API backend chạy trên port khác:
- Ví dụ: `https://moca.mom:5000/api`
- Cần sửa `src/hooks/axios.ts`:
  ```typescript
  const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://moca.mom:5000/api'
  ```

### 4. Nếu cần proxy qua IIS (API cùng server):
- Cài đặt Application Request Routing (ARR) module
- Uncomment rule proxy trong web.config
- Cấu hình backend URL trong rule

## Build và Deploy:

1. **Build project:**
   ```bash
   npm run build
   ```

2. **Upload thư mục `dist/` lên IIS**

3. **Kiểm tra:**
   - Mở Developer Tools → Network
   - Request đến `/api/Auth/login` phải gọi trực tiếp đến `https://moca.mom/api/Auth/login`
   - Backend phải trả về JSON response, không phải HTML 404

## Troubleshooting:

### Nếu vẫn 404:
1. Kiểm tra backend API có đang chạy không
2. Kiểm tra URL API có đúng không (có port không?)
3. Kiểm tra CORS trên backend
4. Kiểm tra firewall có chặn không

### Nếu lỗi CORS:
- Backend cần thêm CORS headers
- Hoặc cấu hình proxy trong IIS

