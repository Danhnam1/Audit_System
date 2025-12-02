# Hướng dẫn sửa lỗi 404 API trên IIS

## Vấn đề:
- Frontend gọi API với URL: `https://moca.mom/api/Auth/login`
- IIS trả về 404 vì không tìm thấy file/route này
- Rule exclude API trong web.config không hoạt động với absolute URLs

## Giải pháp:

### Cách 1: Sử dụng Relative Path (Khuyến nghị)

1. **Kiểm tra file `.env.production` hoặc biến môi trường:**
   - Đảm bảo `VITE_API_BASE_URL` được set thành relative path: `/api`
   - Hoặc không set (để dùng default)

2. **Sửa file `src/hooks/axios.ts`:**
   ```typescript
   // Thay đổi từ:
   const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://moca.mom/api'
   
   // Thành:
   const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
   ```

3. **Cấu hình IIS để proxy `/api/*` đến backend:**
   - Cài đặt Application Request Routing (ARR) module
   - Tạo reverse proxy rule trong IIS

### Cách 2: Cấu hình Proxy trong IIS (Nếu API ở server khác)

1. **Cài đặt ARR và URL Rewrite:**
   - Download và cài: [Application Request Routing](https://www.iis.net/downloads/microsoft/application-request-routing)
   - URL Rewrite đã có sẵn

2. **Cập nhật web.config để proxy API:**
   ```xml
   <rule name="Proxy API requests" stopProcessing="true">
     <match url="^api/(.*)" />
     <action type="Rewrite" url="https://your-backend-server.com/api/{R:1}" />
     <serverVariables>
       <set name="HTTP_X_FORWARDED_HOST" value="{HTTP_HOST}" />
       <set name="HTTP_X_FORWARDED_PROTO" value="https" />
     </serverVariables>
   </rule>
   ```

### Cách 3: CORS và Direct API Calls (Nếu API ở domain khác)

Nếu API backend ở server/domain khác, đảm bảo:
1. Backend đã cấu hình CORS đúng
2. Frontend gọi trực tiếp đến backend URL
3. Không cần proxy qua IIS

## Kiểm tra:

1. Mở Developer Tools → Network tab
2. Xem request đến `/api/Auth/login`:
   - Nếu là relative path `/api/...` → Cần proxy trong IIS
   - Nếu là absolute URL `https://moca.mom/api/...` → Cần CORS hoặc proxy

## Cấu hình nhanh nhất:

1. **Sửa `src/hooks/axios.ts`:**
   ```typescript
   const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
   ```

2. **Cập nhật `web.config` để proxy:**
   (Xem file web.config đã được cập nhật)

3. **Build và deploy lại**

