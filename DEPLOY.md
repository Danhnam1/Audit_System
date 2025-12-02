# Deployment Guide

## Vấn đề 404 khi deploy React App

Khi deploy React app lên VPS, bạn có thể gặp lỗi 404 khi truy cập các routes. Đây là do server không biết cách xử lý client-side routing của React Router.

## Giải pháp

### 1. Apache Server

Nếu bạn dùng Apache, file `.htaccess` đã được tạo trong thư mục `public/`. Khi build, file này sẽ được copy vào thư mục `dist/`.

**Cách kiểm tra:**
- Sau khi build (`npm run build`), kiểm tra xem file `dist/.htaccess` có tồn tại không
- Nếu không có, copy file `public/.htaccess` vào `dist/` sau khi build

**Cấu hình Apache:**
Đảm bảo module `mod_rewrite` đã được bật:
```bash
sudo a2enmod rewrite
sudo systemctl restart apache2
```

### 2. Nginx Server

Nếu bạn dùng Nginx, sử dụng file `nginx.conf.example` làm template:

1. Copy file `nginx.conf.example` vào cấu hình site của bạn:
```bash
sudo cp nginx.conf.example /etc/nginx/sites-available/your-app
```

2. Chỉnh sửa các thông tin:
   - `server_name`: domain của bạn
   - `root`: đường dẫn đến thư mục `dist` sau khi build
   - `proxy_pass`: URL API của bạn (nếu cần)

3. Enable site và restart nginx:
```bash
sudo ln -s /etc/nginx/sites-available/your-app /etc/nginx/sites-enabled/
sudo nginx -t  # Kiểm tra cấu hình
sudo systemctl restart nginx
```

### 3. IIS Server (Windows) ✅

File `web.config` đã được tạo trong thư mục `public/` và sẽ tự động được copy vào `dist/` khi build.

**Các bước cấu hình IIS:**

1. **Cài đặt URL Rewrite Module:**
   - Tải và cài đặt [IIS URL Rewrite Module](https://www.iis.net/downloads/microsoft/url-rewrite)
   - Nếu chưa có, IIS sẽ không thể xử lý file `web.config`

2. **Build project:**
   ```bash
   npm run build
   ```

3. **Upload thư mục `dist/` lên IIS:**
   - Copy toàn bộ nội dung trong thư mục `dist/` vào thư mục website của IIS
   - Đảm bảo file `web.config` có trong thư mục root của website

4. **Cấu hình Application Pool:**
   - Mở IIS Manager
   - Chọn Application Pool của website
   - Đảm bảo .NET CLR Version là "No Managed Code" (vì đây là static site)
   - Set Managed Pipeline Mode là "Integrated"

5. **Kiểm tra quyền truy cập:**
   - Đảm bảo IIS_IUSRS có quyền đọc thư mục website
   - Right-click vào thư mục website → Properties → Security → Add IIS_IUSRS với quyền Read

6. **Test:**
   - Truy cập: `http://your-server/`
   - Truy cập route bất kỳ: `http://your-server/admin/departments`
   - Tất cả đều phải trả về `index.html`

### 4. Build và Deploy

1. Build project:
```bash
npm run build
```

2. Upload thư mục `dist/` lên VPS

3. Đảm bảo file `.htaccess` (Apache) hoặc cấu hình nginx đã được thiết lập đúng

4. Kiểm tra quyền truy cập:
```bash
chmod -R 755 /path/to/dist
```

### 5. Kiểm tra

Sau khi deploy, kiểm tra:
- Truy cập trang chủ: `http://your-domain.com/`
- Truy cập route bất kỳ: `http://your-domain.com/admin/departments`
- Tất cả đều phải trả về `index.html` và React Router sẽ xử lý routing

## Troubleshooting

### Vẫn gặp lỗi 404?

#### IIS (Windows):

1. **Kiểm tra file web.config có trong dist không:**
   - Mở thư mục `dist/` trên server
   - Đảm bảo file `web.config` có mặt

2. **Kiểm tra URL Rewrite Module đã cài đặt:**
   - Mở IIS Manager
   - Xem trong Features View có "URL Rewrite" không
   - Nếu không có, tải và cài đặt từ: https://www.iis.net/downloads/microsoft/url-rewrite

3. **Kiểm tra Application Pool:**
   - Application Pool phải set .NET CLR Version = "No Managed Code"
   - Managed Pipeline Mode = "Integrated"

4. **Kiểm tra logs:**
   - Windows Event Viewer → Windows Logs → Application
   - Hoặc: `C:\inetpub\logs\LogFiles\W3SVC1\`

5. **Test URL Rewrite:**
   - Mở IIS Manager → Chọn website → URL Rewrite
   - Nếu thấy rule "React Routes" thì đã cấu hình đúng

#### Apache:

1. **Kiểm tra file .htaccess có trong dist không:**
   ```bash
   ls -la dist/.htaccess
   ```

2. **Kiểm tra Apache mod_rewrite:**
   ```bash
   apache2ctl -M | grep rewrite
   ```

3. **Kiểm tra logs:**
   - `/var/log/apache2/error.log`

#### Nginx:

1. **Kiểm tra nginx config:**
   ```bash
   sudo nginx -t
   ```

2. **Kiểm tra logs:**
   - `/var/log/nginx/error.log`

#### Chung:

**Kiểm tra base path trong vite.config.ts:**
Nếu app được deploy ở subdirectory (ví dụ: `/app/`), thêm:
```typescript
base: '/app/',
```
trong `vite.config.ts`

