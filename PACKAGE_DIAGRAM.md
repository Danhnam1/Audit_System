# Package Diagram - Audit Management System

## 1. Mô tả theo nhóm các folder

### **Presentation Layer (Lớp Giao diện)**
- **`/pages`**: Các trang chính của ứng dụng (Admin, Auditor, LeadAuditor, Director, CAPAOwner, AuditeeOwner, Profile, Shared)
- **`/components`**: Các component UI có thể tái sử dụng (Button, DataTable, NotificationBell, Sidebar, Header, Charts, v.v.)
- **`/layouts`**: Các layout component (MainLayout, icons)
- **`/routes`**: Quản lý routing và điều hướng (AppRoutes, ProtectedRoute)

### **Application Layer (Lớp Ứng dụng)**
- **`/services`**: Các service xử lý business logic (auditPlanning.service, auditPlanSubmission.service, signalRService)
- **`/hooks`**: Custom React hooks (useAuth, useAuditPlanData, useLocalStorage, axios hooks)
- **`/store`**: State management sử dụng Zustand (useAuthStore)
- **`/contexts`**: React Context providers (AuthContext, SignalRContext)

### **Infrastructure Layer (Lớp Hạ tầng)**
- **`/api`**: Các hàm API cơ bản để gọi backend (audits, departments, notifications, v.v.)
- **`/config`**: Các file cấu hình (react-query config, general config)

### **Shared Layer (Lớp Dùng chung)**
- **`/utils`**: Các utility functions (normalize, clearOnLogout, globalUtil, auditSummary)
- **`/helpers`**: Các hàm helper hỗ trợ (auditPlanHelpers, businessRulesValidation, formValidation)
- **`/types`**: TypeScript type definitions (auditPlan types, auth types)
- **`/constants`**: Các hằng số và enum (audit constants, status colors, enum definitions)

---

## 2. Mô tả các mối liên kết giữa các folder

### **Presentation Layer Relationships:**

#### **`/pages` → `/components`**
- **Loại liên kết**: `<<import>>` (nét liền)
- **Mô tả**: Pages import và sử dụng các components để xây dựng giao diện

#### **`/pages` → `/layouts`**
- **Loại liên kết**: `<<import>>` (nét liền)
- **Mô tả**: Pages sử dụng layouts để bọc nội dung

#### **`/pages` → `/services`** (Application Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Pages sử dụng services để xử lý business logic phức tạp

#### **`/pages` → `/hooks`** (Application Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Pages sử dụng custom hooks để quản lý state và side effects

#### **`/pages` → `/contexts`** (Application Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Pages sử dụng contexts để truy cập global state (Auth, SignalR)

#### **`/pages` → `/store`** (Application Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Pages sử dụng Zustand store để quản lý authentication state

#### **`/pages` → `/api`** (Infrastructure Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Pages gọi trực tiếp các API functions để lấy dữ liệu

#### **`/pages` → `/utils`** (Shared Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Pages sử dụng utility functions để xử lý dữ liệu

#### **`/pages` → `/helpers`** (Shared Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Pages sử dụng helper functions để hỗ trợ xử lý logic

#### **`/pages` → `/constants`** (Shared Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Pages sử dụng constants và enums

#### **`/pages` → `/types`** (Shared Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Pages sử dụng TypeScript types để định nghĩa dữ liệu

#### **`/components` → `/hooks`** (Application Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Components sử dụng hooks để quản lý state và logic

#### **`/components` → `/contexts`** (Application Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Components sử dụng contexts để truy cập global state

#### **`/components` → `/store`** (Application Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Components sử dụng Zustand store để truy cập authentication state

#### **`/components` → `/api`** (Infrastructure Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Components có thể gọi API trực tiếp

#### **`/components` → `/utils`** (Shared Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Components sử dụng utility functions

#### **`/components` → `/services`** (Application Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Components có thể sử dụng services

#### **`/routes` → `/pages`** (Presentation Layer)
- **Loại liên kết**: `<<import>>` (nét liền)
- **Mô tả**: Routes import và render các pages

#### **`/routes` → `/components`** (Presentation Layer)
- **Loại liên kết**: `<<import>>` (nét liền)
- **Mô tả**: Routes sử dụng ProtectedRoute component

#### **`/routes` → `/store`** (Application Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Routes sử dụng store để kiểm tra authentication

#### **`/routes` → `/constants`** (Shared Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Routes sử dụng route constants

---

### **Application Layer Relationships:**

#### **`/services` → `/api`** (Infrastructure Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Services sử dụng API functions để gọi backend

#### **`/services` → `/utils`** (Shared Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Services sử dụng utility functions để xử lý dữ liệu

#### **`/services` → `/types`** (Shared Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Services sử dụng TypeScript types

#### **`/hooks` → `/contexts`** (Application Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Hooks sử dụng contexts để truy cập global state

#### **`/hooks` → `/store`** (Application Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Hooks sử dụng Zustand store

#### **`/hooks` → `/api`** (Infrastructure Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Hooks (như axios hooks) sử dụng API client

#### **`/hooks` → `/utils`** (Shared Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Hooks sử dụng utility functions

#### **`/hooks` → `/config`** (Infrastructure Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Hooks sử dụng config (react-query config)

#### **`/contexts` → `/hooks`** (Application Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Contexts sử dụng hooks (useLocalStorage)

#### **`/contexts` → `/types`** (Shared Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Contexts sử dụng TypeScript types

#### **`/store` → `/hooks`** (Application Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Store sử dụng hooks (auth service hooks)

#### **`/store` → `/utils`** (Shared Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Store sử dụng utils (clearOnLogout)

#### **`/store` → `/constants`** (Shared Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Store sử dụng constants (type definitions)

---

### **Infrastructure Layer Relationships:**

#### **`/api` → `/hooks`** (Application Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: API functions sử dụng axios hooks (apiClient)

#### **`/api` → `/utils`** (Shared Layer)
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: API functions sử dụng utility functions (normalize)

#### **`/config` → `/store`** (Application Layer)
- **Loại liên kết**: Conceptual link (nét đứt)
- **Mô tả**: Config (react-query) có thể tương tác với store để invalidate queries

---

### **Shared Layer Relationships:**

#### **`/utils` → `/api`** (Infrastructure Layer) ⚠️
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Một số utils (như auditSummary.ts) sử dụng API - **VI PHẠM NGUYÊN TẮC KIẾN TRÚC**

#### **`/utils` → `/config`** (Infrastructure Layer) ⚠️
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Một số utils (như clearOnLogout.ts) sử dụng config - **VI PHẠM NGUYÊN TẮC KIẾN TRÚC**

#### **`/helpers` → `/api`** (Infrastructure Layer) ⚠️
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Một số helpers (như rejectionCommentHelper.ts, sensitiveAreasHelper.ts) sử dụng API - **VI PHẠM NGUYÊN TẮC KIẾN TRÚC**

#### **`/constants` → `/api`** (Infrastructure Layer) ⚠️
- **Loại liên kết**: `<<use>>` (nét liền)
- **Mô tả**: Một số constants (như sensitiveAreas.ts) sử dụng API - **VI PHẠM NGUYÊN TẮC KIẾN TRÚC**

---

## Tóm tắt kiến trúc:

### **Kiến trúc 4 Layer:**

1. **Presentation Layer** (`/pages`, `/components`, `/layouts`, `/routes`): 
   - Xử lý giao diện người dùng và routing
   - Phụ thuộc vào Application Layer để xử lý business logic
   - Có thể gọi trực tiếp Infrastructure Layer (API) và sử dụng Shared Layer

2. **Application Layer** (`/services`, `/hooks`, `/store`, `/contexts`):
   - Xử lý business logic, state management, và application flow
   - Phụ thuộc vào Infrastructure Layer để giao tiếp với backend
   - Sử dụng Shared Layer cho utilities và types

3. **Infrastructure Layer** (`/api`, `/config`):
   - Xử lý giao tiếp với backend và cấu hình hệ thống
   - Phụ thuộc vào Shared Layer cho utilities
   - Phụ thuộc vào Application Layer (hooks) cho axios client

4. **Shared Layer** (`/utils`, `/helpers`, `/types`, `/constants`):
   - Cung cấp các utilities, helpers, types và constants dùng chung
   - **Lý tưởng**: Không phụ thuộc vào layer nào khác
   - **Thực tế hiện tại**: Có một số file vi phạm nguyên tắc bằng cách sử dụng Infrastructure Layer

### **Nguyên tắc Dependency (Lý tưởng):**
- **Presentation** → **Application** → **Infrastructure** → **Shared**
- Tất cả các layer đều có thể sử dụng **Shared Layer**
- **Shared Layer không nên phụ thuộc vào bất kỳ layer nào**

### **⚠️ Vấn đề hiện tại (Code Smell):**

**Shared Layer đang vi phạm nguyên tắc kiến trúc:**
- `utils/auditSummary.ts` → sử dụng `api/audits`
- `utils/clearOnLogout.ts` → sử dụng `config/react-query`
- `helpers/rejectionCommentHelper.ts` → sử dụng `api/audits`
- `helpers/sensitiveAreasHelper.ts` → sử dụng `api/`
- `constants/sensitiveAreas.ts` → sử dụng `api/`

**Hậu quả:**
- Tạo circular dependency: Shared → Infrastructure → Shared
- Khó test và maintain
- Vi phạm nguyên tắc Clean Architecture

**Đề xuất refactor:**
- Di chuyển các hàm có gọi API từ Shared Layer sang Application Layer (Services)
- Hoặc tách phần logic thuần (không gọi API) ra khỏi phần có gọi API
- Shared Layer chỉ nên chứa pure functions, types, và constants

### **Đánh giá biểu đồ Package Diagram:**

**✅ Biểu đồ của bạn ĐÚNG theo nguyên tắc kiến trúc lý tưởng:**
- Có đầy đủ 4 layer: Presentation, Application, Shared, Infrastructure
- Dependencies chính đúng:
  - Presentation → Application (`<<use>>`)
  - Presentation → Shared (`<<use>>`) ⬅️ **Nên thêm `<<use>>`**
  - Application → Shared (`<<use>>`) ⬅️ **Nên thêm `<<use>>`**
  - Application → Infrastructure (`<<use>>`)
- **KHÔNG có Shared → Infrastructure** (đúng theo nguyên tắc Clean Architecture)

**💡 Khuyến nghị vẽ biểu đồ:**
- Tất cả các mũi tên dependency giữa các layer nên có stereotype `<<use>>` để nhất quán và rõ ràng
- Format: Mũi tên nét đứt (dashed arrow) với label `<<use>>`

**📝 Lưu ý:**
- Biểu đồ mô tả **kiến trúc lý tưởng** (architecture as intended)
- Trong code thực tế có một số vi phạm (Shared → Infrastructure), nhưng không cần thể hiện trong biểu đồ nếu bạn muốn mô tả kiến trúc chuẩn
- Nếu muốn mô tả đầy đủ, có thể thêm:
  - Presentation → Infrastructure (nếu pages/components gọi trực tiếp API)
  - Infrastructure → Application (nếu API sử dụng hooks)

**Kết luận:** Biểu đồ của bạn **ĐÚNG và PHÙ HỢP** cho báo cáo đồ án. Bạn đang mô tả kiến trúc lý tưởng, không phải code thực tế có vi phạm.

---

## 3. Package Descriptions

| No | Package | Description |
|----|---------|-------------|
| 01 | **pages** | Chứa các trang chính của ứng dụng, được tổ chức theo role (Admin, Auditor, LeadAuditor, Director, CAPAOwner, AuditeeOwner). Mỗi trang xử lý logic hiển thị và tương tác với người dùng cho một chức năng cụ thể. |
| 02 | **components** | Chứa các component UI có thể tái sử dụng như Button, DataTable, NotificationBell, Sidebar, Header, Charts. Các component này được thiết kế để độc lập và có thể sử dụng ở nhiều nơi trong ứng dụng. |
| 03 | **layouts** | Chứa các layout component như MainLayout và icons. Layouts định nghĩa cấu trúc chung của các trang, bao gồm header, sidebar, và footer. |
| 04 | **routes** | Quản lý routing và điều hướng của ứng dụng. Chứa AppRoutes để định nghĩa các route và ProtectedRoute để bảo vệ các route yêu cầu authentication. |
| 05 | **services** | Chứa các service xử lý business logic phức tạp như auditPlanning.service, auditPlanSubmission.service, signalRService. Services đóng vai trò trung gian giữa Presentation Layer và Infrastructure Layer. |
| 06 | **hooks** | Chứa các custom React hooks như useAuth, useAuditPlanData, useLocalStorage, và axios hooks. Hooks cung cấp logic có thể tái sử dụng cho state management và side effects. |
| 07 | **store** | Quản lý global state của ứng dụng sử dụng Zustand. Chứa useAuthStore để quản lý authentication state, user information, và token. |
| 08 | **contexts** | Chứa các React Context providers như AuthContext và SignalRContext. Contexts cung cấp global state và functionality cho các component con thông qua React Context API. |
| 09 | **api** | Chứa các hàm API cơ bản để gọi backend như audits, departments, notifications. Mỗi file trong package này tương ứng với một resource hoặc domain cụ thể từ backend. |
| 10 | **config** | Chứa các file cấu hình như react-query config và general config. Config package định nghĩa các thiết lập và cấu hình cho các thư viện và framework được sử dụng trong ứng dụng. |
| 11 | **utils** | Chứa các utility functions như normalize, clearOnLogout, globalUtil, auditSummary. Utils cung cấp các hàm tiện ích thuần túy (pure functions) để xử lý dữ liệu và thao tác chung. |
| 12 | **helpers** | Chứa các hàm helper hỗ trợ như auditPlanHelpers, businessRulesValidation, formValidation. Helpers cung cấp logic hỗ trợ cho các chức năng cụ thể của ứng dụng. |
| 13 | **types** | Chứa các TypeScript type definitions như auditPlan types và auth types. Types định nghĩa cấu trúc dữ liệu và interfaces được sử dụng trong toàn bộ ứng dụng. |
| 14 | **constants** | Chứa các hằng số và enum như audit constants, status colors, enum definitions. Constants định nghĩa các giá trị không đổi được sử dụng trong ứng dụng. |
