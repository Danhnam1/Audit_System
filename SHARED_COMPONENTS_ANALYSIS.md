# Shared Components Analysis - LeadAuditor vs Auditor

## 📊 Tổng quan

Phân tích các components được share giữa LeadAuditor và Auditor để xác định nơi đặt chúng hợp lý nhất.

---

## 🔍 Components được Auditor import từ LeadAuditor

### 1. **Step Components** (PlanForm folder)

**Files:**
- `Step1BasicInfo.tsx`
- `Step2Scope.tsx`
- `Step3Checklist.tsx`
- `Step4Team.tsx`
- `Step5Schedule.tsx`
- `SensitiveAreaForm.tsx`

**Usage:**

#### ✅ LeadAuditor CÓ sử dụng:
```typescript
// LeadAuditor/auditplanning/index.tsx
import { Step1BasicInfo } from './components/PlanForm/Step1BasicInfo';
import { Step2Scope } from './components/PlanForm/Step2Scope';
// ... other imports

// Used in JSX:
<Step1BasicInfo ... />  // Line 1728
<Step2Scope ... />      // Line 1754
<SensitiveAreaForm ... /> // Line 1786
<Step3Checklist ... />  // Line 1812
<Step4Team ... />       // Line 1827
<Step5Schedule ... />   // Line 1847
```

#### ✅ Auditor CŨNG sử dụng:
```typescript
// Auditor/AuditPlanning/index.tsx
import { Step1BasicInfo } from "../../LeadAuditor/auditplanning/components/PlanForm/Step1BasicInfo";
// ... other imports

// Used in JSX (similar usage)
```

**Kết luận:** ❌ **KHÔNG thể chuyển** - Cả 2 role đều dùng

---

### 2. **loadPlanDetailsForEdit Service**

**File:** `editPlanService.ts`

**Usage:**

#### ✅ LeadAuditor CÓ sử dụng:
```typescript
// LeadAuditor/auditplanning/index.tsx
import { loadPlanDetailsForEdit } from './components/editPlanService';

// Used at line 1433:
const detailsWithId = await loadPlanDetailsForEdit(
  // ... parameters
);
```

#### ✅ Auditor CŨNG sử dụng:
```typescript
// Auditor/AuditPlanning/index.tsx
import { loadPlanDetailsForEdit } from "../../LeadAuditor/auditplanning/components/editPlanService";

// Used in handleEditPlan function
```

**Kết luận:** ❌ **KHÔNG thể chuyển** - Cả 2 role đều dùng

---

### 3. **PermissionPreviewPanel**

**File:** `PermissionPreviewPanel.tsx`

**Usage:**

#### ✅ LeadAuditor CÓ sử dụng:
```typescript
// LeadAuditor/auditplanning/index.tsx
import { PermissionPreviewPanel } from './components/PlanForm/PermissionPreviewPanel';

// Used at line 1840:
<PermissionPreviewPanel
  sensitiveFlag={formState.sensitiveFlag}
/>
```

#### ❌ Auditor KHÔNG sử dụng:
- Không có import
- Không có usage

**Kết luận:** ✅ **Có thể giữ ở LeadAuditor** - Chỉ LeadAuditor dùng

---

## 📋 Tổng kết

| Component | LeadAuditor Uses? | Auditor Uses? | Action |
|-----------|-------------------|---------------|--------|
| `Step1BasicInfo` | ✅ Yes | ✅ Yes | ❌ **Keep in LeadAuditor** (shared) |
| `Step2Scope` | ✅ Yes | ✅ Yes | ❌ **Keep in LeadAuditor** (shared) |
| `Step3Checklist` | ✅ Yes | ✅ Yes | ❌ **Keep in LeadAuditor** (shared) |
| `Step4Team` | ✅ Yes | ✅ Yes | ❌ **Keep in LeadAuditor** (shared) |
| `Step5Schedule` | ✅ Yes | ✅ Yes | ❌ **Keep in LeadAuditor** (shared) |
| `SensitiveAreaForm` | ✅ Yes | ✅ Yes | ❌ **Keep in LeadAuditor** (shared) |
| `loadPlanDetailsForEdit` | ✅ Yes | ✅ Yes | ❌ **Keep in LeadAuditor** (shared) |
| `PermissionPreviewPanel` | ✅ Yes | ❌ No | ✅ **Keep in LeadAuditor** (LeadAuditor only) |

---

## 💡 Đề xuất

### Option 1: Giữ nguyên cấu trúc hiện tại (Recommended)

**Lý do:**
- ✅ Tất cả shared components đều được LeadAuditor sử dụng
- ✅ LeadAuditor là nơi tạo ra các components này
- ✅ Auditor import từ LeadAuditor là hợp lý (Auditor là "consumer")
- ✅ Không cần di chuyển files

**Cấu trúc:**
```
LeadAuditor/auditplanning/components/PlanForm/
  ├── Step1BasicInfo.tsx      (shared)
  ├── Step2Scope.tsx          (shared)
  ├── Step3Checklist.tsx      (shared)
  ├── Step4Team.tsx           (shared)
  ├── Step5Schedule.tsx       (shared)
  ├── SensitiveAreaForm.tsx   (shared)
  └── PermissionPreviewPanel.tsx (LeadAuditor only)

LeadAuditor/auditplanning/components/
  └── editPlanService.ts      (shared)
```

---

### Option 2: Tạo shared folder (Nếu muốn rõ ràng hơn)

**Cấu trúc mới:**
```
src/pages/Shared/AuditPlanning/
  ├── components/
  │   ├── PlanForm/
  │   │   ├── Step1BasicInfo.tsx
  │   │   ├── Step2Scope.tsx
  │   │   ├── Step3Checklist.tsx
  │   │   ├── Step4Team.tsx
  │   │   ├── Step5Schedule.tsx
  │   │   └── SensitiveAreaForm.tsx
  │   └── editPlanService.ts
```

**Lợi ích:**
- ✅ Rõ ràng là shared components
- ✅ Không phụ thuộc vào role nào

**Nhược điểm:**
- ❌ Phải di chuyển files
- ❌ Phải update tất cả imports
- ❌ Có thể gây breaking changes

---

## ✅ Kết luận

**Tất cả components mà Auditor import từ LeadAuditor đều được LeadAuditor sử dụng.**

**Khuyến nghị:**
- ✅ **GIỮ NGUYÊN** cấu trúc hiện tại
- ✅ Không cần di chuyển files
- ✅ Cấu trúc hiện tại là hợp lý:
  - LeadAuditor là "owner" của các Step components
  - Auditor là "consumer" - import và sử dụng
  - Đây là pattern hợp lý trong React (shared components ở một nơi, các nơi khác import)

**Lý do:**
1. LeadAuditor tạo ra các components này trước
2. Cả 2 role đều dùng → Giữ ở LeadAuditor là hợp lý
3. Không có lý do kỹ thuật để di chuyển
4. Di chuyển sẽ tốn thời gian và có risk breaking changes

---

**Status:** 🟢 Current structure is correct - No action needed

