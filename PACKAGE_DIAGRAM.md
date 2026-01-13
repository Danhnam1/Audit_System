# Sơ Đồ Gói (Package Diagram) - Frontend Audit System

## Tổng Quan

Sơ đồ gói này mô tả cấu trúc và mối quan hệ phụ thuộc giữa các gói (packages) trong ứng dụng Frontend của Hệ thống Quản lý Kiểm toán (Audit Management System). Ứng dụng được xây dựng bằng React + TypeScript, sử dụng kiến trúc phân lớp (layered architecture).

## Kiến Trúc Tổng Thể

Ứng dụng tuân theo mô hình kiến trúc đa lớp (multi-tier architecture) với các lớp chính:
- **Lớp Presentation**: Pages, Components, Layouts
- **Lớp Application Logic**: Services, Hooks
- **Lớp Data Access**: API
- **Lớp Foundation**: Types, Constants, Config, Utils, Store, Contexts

## Các Gói Hệ Thống

### 1. Gói Foundation (Nền Tảng)

#### 1.1. **types** (Định nghĩa Kiểu dữ liệu)
- **Mô tả**: Chứa các định nghĩa TypeScript types và interfaces cho toàn bộ ứng dụng
- **Nội dung**: 
  - `auditPlan.ts` - Types cho kế hoạch kiểm toán
  - `auth.types.ts` - Types cho xác thực người dùng
  - `index.ts` - Export tập trung
- **Phụ thuộc**: Không có (gói nền tảng)
- **Được sử dụng bởi**: Tất cả các gói khác

#### 1.2. **constants** (Hằng Số)
- **Mô tả**: Chứa các giá trị hằng số, enum, và cấu hình tĩnh
- **Nội dung**:
  - `audit.ts` - Hằng số liên quan đến kiểm toán
  - `enum.ts` - Định nghĩa enum
  - `statusColors.ts` - Màu sắc cho trạng thái
  - `sensitiveAreas.ts` - Khu vực nhạy cảm
  - `type/user.ts` - Types cho người dùng
- **Phụ thuộc**: Không có (gói nền tảng)
- **Được sử dụng bởi**: Components, Pages, Helpers, Hooks

#### 1.3. **config** (Cấu Hình)
- **Mô tả**: Quản lý cấu hình ứng dụng, URL API, environment variables
- **Nội dung**:
  - `index.ts` - Cấu hình chính
  - `react-query.ts` - Cấu hình React Query
- **Phụ thuộc**: Không có (gói nền tảng)
- **Được sử dụng bởi**: API, Services

#### 1.4. **utils** (Tiện Ích)
- **Mô tả**: Các hàm tiện ích, helper functions độc lập
- **Nội dung**:
  - `normalize.ts` - Chuẩn hóa dữ liệu
  - `errorMessages.ts` - Xử lý thông báo lỗi
  - `globalUtil.ts` - Utilities toàn cục
  - `auditSummary.ts` - Tính toán tổng kết kiểm toán
  - `clearOnLogout.ts` - Xóa dữ liệu khi đăng xuất
- **Phụ thuộc**: Không có (gói độc lập)
- **Được sử dụng bởi**: Pages, Components, Hooks, Store

### 2. Gói State Management (Quản Lý Trạng Thái)

#### 2.1. **store** (Kho Lưu Trữ)
- **Mô tả**: Quản lý state toàn cục sử dụng Zustand
- **Nội dung**:
  - `useAuthStore.tsx` - Store quản lý authentication state
  - `index.ts` - Export tập trung
- **Phụ thuộc**: 
  - `types` (<<import>>) - Sử dụng types để định nghĩa state
  - `hooks/auth` (<<import>>) - Sử dụng auth hooks
  - `utils/clearOnLogout` (<<access>>) - Truy cập utility xóa dữ liệu
- **Được sử dụng bởi**: API, Contexts, Components, Pages, Layouts, Routes

#### 2.2. **contexts** (Ngữ Cảnh React)
- **Mô tả**: React Context providers cho state sharing
- **Nội dung**:
  - `AuthContext.tsx` - Context cho authentication
  - `SignalRContext.tsx` - Context cho SignalR real-time communication
  - `index.ts` - Export tập trung
- **Phụ thuộc**:
  - `types` (<<import>>) - Sử dụng types
  - `hooks/useLocalStorage` (<<import>>) - Sử dụng localStorage hook
- **Được sử dụng bởi**: App, Pages, Components, Layouts

### 3. Gói Data Access (Truy Cập Dữ Liệu)

#### 3.1. **api** (API Client)
- **Mô tả**: Lớp giao tiếp với Backend API, sử dụng Axios
- **Nội dung**: 26+ API client modules:
  - `client.ts` - Cấu hình Axios client chính
  - `audits.ts`, `auditAssignments.ts`, `auditSchedule.ts` - API cho kiểm toán
  - `findings.ts`, `checklists.ts`, `auditCriteria.ts` - API cho findings và checklist
  - `departments.ts`, `adminUsers.ts` - API quản lý
  - `notifications.ts`, `chatbot.ts` - API thông báo và chatbot
  - ... và nhiều modules khác
- **Phụ thuộc**:
  - `store/useAuthStore` (<<import>>) - Lấy token từ store để authentication
  - `config` (<<import>>) - Sử dụng base URL từ config
- **Được sử dụng bởi**: Services, Hooks, Pages (trực tiếp)

### 4. Gói Business Logic (Logic Nghiệp Vụ)

#### 4.1. **services** (Dịch Vụ)
- **Mô tả**: Lớp service xử lý logic nghiệp vụ phức tạp, kết hợp nhiều API calls
- **Nội dung**:
  - `auditPlanning.service.ts` - Service cho quy hoạch kiểm toán
  - `auditPlanSubmission.service.ts` - Service cho submit kế hoạch
  - `signalRService.ts` - Service cho SignalR
- **Phụ thuộc**:
  - `api` (<<import>>) - Sử dụng các API clients
  - `types` (<<import>>) - Sử dụng types cho dữ liệu
- **Được sử dụng bởi**: Pages, Hooks

#### 4.2. **helpers** (Trợ Giúp)
- **Mô tả**: Các hàm helper xử lý logic nghiệp vụ cụ thể
- **Nội dung**:
  - `auditPlanHelpers.ts` - Helpers cho kế hoạch kiểm toán
  - `businessRulesValidation.ts` - Validation business rules
  - `formValidation.ts` - Validation forms
  - `roleMenus.ts` - Quản lý menu theo role
  - `rejectionCommentHelper.ts` - Helper cho rejection comments
  - `sensitiveAreasHelper.ts` - Helper cho sensitive areas
- **Phụ thuộc**:
  - `types` (<<import>>) - Sử dụng types
  - `constants` (<<import>>) - Sử dụng constants và enums
- **Được sử dụng bởi**: Pages, Components, Layouts

#### 4.3. **hooks** (React Hooks)
- **Mô tả**: Custom React hooks tái sử dụng logic
- **Nội dung**:
  - `auth.ts` - Hooks cho authentication
  - `axios.ts` - Hooks cho API calls
  - `useAuditPlanData.ts`, `useAuditPlanFilters.ts`, `useAuditPlanForm.ts` - Hooks cho audit plan
  - `useAuditFindings.ts` - Hooks cho findings
  - `usePlanDetails.ts` - Hooks cho plan details
  - `useLocalStorage.ts` - Hook cho localStorage
- **Phụ thuộc**:
  - `api` (<<import>>) - Sử dụng API clients
  - `contexts` (<<access>>) - Truy cập contexts
  - `store` (<<access>>) - Truy cập store
  - `utils` (<<access>>) - Sử dụng utilities
- **Được sử dụng bởi**: Pages, Components, Contexts

### 5. Gói Presentation (Giao Diện)

#### 5.1. **components** (Thành Phần UI)
- **Mô tả**: Các component UI tái sử dụng
- **Nội dung**:
  - `Button.tsx`, `DataTable.tsx`, `Pagination.tsx` - Components cơ bản
  - `Sidebar.tsx`, `Header.tsx`, `PageHeader.tsx` - Layout components
  - `charts/` - Chart components (AreaChartCard, BarChartCard, LineChartCard, PieChartCard)
  - `Dashboard/` - Dashboard components
  - `filters/FilterBar.tsx` - Filter components
  - `NotificationBell.tsx`, `NotificationToast.tsx` - Notification components
  - `ChatBot.tsx` - Chatbot component
  - `PageTransition.tsx` - Animation components
- **Phụ thuộc**:
  - `store` (<<access>>) - Truy cập store (ví dụ: Header sử dụng useAuthStore)
  - `contexts` (<<access>>) - Truy cập contexts (để lấy user info)
  - `hooks` (<<import>>) - Sử dụng custom hooks
  - `utils` (<<access>>) - Sử dụng utilities
  - `types` (<<access>>) - Sử dụng types qua props
- **Được sử dụng bởi**: Pages, Layouts

#### 5.2. **layouts** (Bố Cục)
- **Mô tả**: Layout components tổ chức cấu trúc trang
- **Nội dung**:
  - `MainLayout.tsx` - Layout chính cho ứng dụng
  - `icons.tsx` - Icon definitions
- **Phụ thuộc**:
  - `components` (<<import>>) - Sử dụng Sidebar, Navigation, PageTransition, ChatBot
  - `contexts` (<<access>>) - Truy cập contexts
  - `store` (<<import>>) - Sử dụng useAuthStore, useUserId
  - `helpers/roleMenus` (<<import>>) - Sử dụng role menus helper
  - `api/auditPlanAssignment` (<<import>>) - Kiểm tra permissions
- **Được sử dụng bởi**: Pages

#### 5.3. **pages** (Trang)
- **Mô tả**: Các trang của ứng dụng, được tổ chức theo role
- **Nội dung**: 
  - `Auth/` - Trang xác thực (LoginPage)
  - `Admin/` - Trang quản trị (UserManagement, DepartmentManagement, CriteriaManagement, ...)
  - `Auditor/` - Trang cho Auditor (AuditPlanning, FindingManagement, Schedule, Reports, ...)
  - `LeadAuditor/` - Trang cho Lead Auditor (AuditPlanning, Dashboard, ActionReview, ...)
  - `AuditeeOwner/` - Trang cho Auditee Owner (Dashboard, AuditPlans, Findings, CAPAManagement, ...)
  - `CAPAOwner/` - Trang cho CAPA Owner (Dashboard, Tasks, TodoList, FindingsProgress, ...)
  - `Director/` - Trang cho Director (Dashboard, ReviewAuditPlans, ReviewAuditResults, ...)
  - `Profile/` - Trang profile
  - `Shared/` - Trang dùng chung (ArchivedHistory, ...)
- **Phụ thuộc**:
  - `layouts` (<<import>>) - Sử dụng MainLayout
  - `components` (<<import>>) - Sử dụng các UI components
  - `api` (<<import>>) - Gọi API trực tiếp hoặc qua hooks
  - `hooks` (<<import>>) - Sử dụng custom hooks
  - `services` (<<import>>) - Sử dụng services
  - `contexts` (<<access>>) - Truy cập contexts
  - `types` (<<import>>) - Sử dụng types
  - `utils` (<<import>>) - Sử dụng utilities
  - `helpers` (<<access>>) - Sử dụng helpers
  - `store` (<<access>>) - Truy cập store
- **Được sử dụng bởi**: Routes

#### 5.4. **routes** (Định Tuyến)
- **Mô tả**: Cấu hình routing và route protection
- **Nội dung**:
  - `AppRoutes.tsx` - Định nghĩa tất cả routes
  - `ProtectedRoute.tsx` - Component bảo vệ routes theo role
- **Phụ thuộc**:
  - `pages` (<<import>>) - Import tất cả page components (lazy loading)
  - `components/ProtectedRoute` (<<import>>) - Sử dụng ProtectedRoute component
  - `constants` (<<import>>) - Sử dụng ROUTES constants
  - `store` (<<import>>) - Sử dụng useAuthStore để kiểm tra authentication
- **Được sử dụng bởi**: App

### 6. Gói Application Entry (Điểm Vào Ứng Dụng)

#### 6.1. **App** (Ứng Dụng Chính)
- **Mô tả**: Component root của ứng dụng
- **Nội dung**: `App.tsx`
- **Phụ thuộc**:
  - `routes/AppRoutes` (<<import>>) - Sử dụng routing
  - `contexts` (<<import>>) - Wrap app với AuthProvider, SignalRProvider
- **Được sử dụng bởi**: main

#### 6.2. **main** (Điểm Vào)
- **Mô tả**: Entry point của ứng dụng
- **Nội dung**: `main.tsx`
- **Phụ thuộc**:
  - `App` (<<import>>) - Render App component
- **Được sử dụng bởi**: Build system (Vite)

## Sơ Đồ Phụ Thuộc Tổng Quan

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  main    │───▶│   App    │───▶│  routes  │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│                                 │                            │
│                                 │                            │
│  ┌──────────────────────────────────────────┐              │
│  │              Presentation Layer            │              │
│  ├──────────────────────────────────────────┤              │
│  │  ┌────────┐  ┌──────────┐  ┌──────────┐ │              │
│  │  │ pages  │─▶│ layouts  │─▶│components│ │              │
│  │  └────────┘  └──────────┘  └──────────┘ │              │
│  └──────────────────────────────────────────┘              │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                 Application Logic Layer                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ services │  │  hooks   │  │ helpers  │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                   Data Access Layer                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐                   │
│  │              api                      │                   │
│  └──────────────────────────────────────┘                   │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                    Foundation Layer                          │
├─────────────────────────────────────────────────────────────┤
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐         │
│  │types │  │consts│  │config│  │ utils│  │store │         │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘         │
│                                                               │
│  ┌──────────────────────────────────────┐                   │
│  │           contexts                    │                   │
│  └──────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

## Mối Quan Hệ Phụ Thuộc Chi Tiết

### Phụ Thuộc <<import>> (Import Dependency)
- **api** ──<<import>>──▶ **store**, **config**
- **services** ──<<import>>──▶ **api**, **types**
- **hooks** ──<<import>>──▶ **api**
- **components** ──<<import>>──▶ **hooks**
- **layouts** ──<<import>>──▶ **components**, **store**, **helpers**, **api**
- **pages** ──<<import>>──▶ **layouts**, **components**, **api**, **hooks**, **services**, **types**, **utils**, **helpers**
- **routes** ──<<import>>──▶ **pages**, **components**, **constants**, **store**
- **helpers** ──<<import>>──▶ **types**, **constants**
- **store** ──<<import>>──▶ **types**, **hooks/auth**

### Phụ Thuộc <<access>> (Access Dependency)
- **components** ──<<access>>──▶ **store**, **contexts**, **utils**, **types**
- **pages** ──<<access>>──▶ **contexts**, **store**, **helpers**
- **hooks** ──<<access>>──▶ **contexts**, **store**, **utils**
- **api** ──<<access>>──▶ **store** (để lấy token)

## Đặc Điểm Kiến Trúc

### 1. **Kiến Trúc Phân Lớp (Layered Architecture)**
- **Lớp Presentation**: Pages, Layouts, Components
- **Lớp Application Logic**: Services, Hooks, Helpers
- **Lớp Data Access**: API
- **Lớp Foundation**: Types, Constants, Config, Utils, Store, Contexts

### 2. **Separation of Concerns**
- Mỗi gói có trách nhiệm rõ ràng
- Business logic được tách biệt khỏi UI
- API calls được tập trung trong gói `api`

### 3. **Dependency Direction**
- Dependencies hướng từ trên xuống dưới (top-down)
- Foundation layer không phụ thuộc vào các layer trên
- Presentation layer phụ thuộc vào các layer dưới

### 4. **Role-Based Organization**
- Gói `pages` được tổ chức theo role (Admin, Auditor, LeadAuditor, AuditeeOwner, CAPAOwner, Director)
- Mỗi role có các pages riêng biệt

### 5. **Reusability**
- Components và hooks được thiết kế để tái sử dụng
- Utils và helpers cung cấp chức năng dùng chung

## Ghi Chú Quan Trọng

1. **Tên gói không được trùng lặp**: Mỗi gói có tên duy nhất trong hệ thống
2. **Các lớp bên trong gói khác nhau có thể có cùng tên**: Ví dụ, mỗi role có thể có Dashboard component riêng
3. **Lazy Loading**: Routes sử dụng lazy loading cho các pages để tối ưu performance
4. **Centralized State**: Store sử dụng Zustand để quản lý global state
5. **API Client**: Tất cả API calls đi qua `api/client.ts` với interceptors cho authentication

## Kết Luận

Sơ đồ gói này thể hiện kiến trúc phân lớp rõ ràng của ứng dụng Frontend, với các mối quan hệ phụ thuộc được định nghĩa chặt chẽ. Cấu trúc này hỗ trợ:
- **Maintainability**: Dễ bảo trì và mở rộng
- **Testability**: Dễ test từng layer độc lập
- **Scalability**: Dễ thêm features mới
- **Code Reusability**: Tối đa hóa tái sử dụng code
