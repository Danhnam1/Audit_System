# LeadAuditor vs Auditor AuditPlanning - Comparison Analysis

## 📊 Tổng quan

Hai files này có **rất nhiều code giống nhau** nhưng có một số khác biệt về business logic và permissions.

---

## 🔍 So sánh chi tiết

### 1. **File Sizes**
- **LeadAuditor/auditplanning/index.tsx**: 2,446 dòng
- **Auditor/AuditPlanning/index.tsx**: 1,752 dòng (đã refactor)
- **Chênh lệch**: 694 dòng (LeadAuditor lớn hơn 28%)

### 2. **Refactoring Status**

#### ✅ Auditor/AuditPlanning (Đã refactor):
- ✅ Dùng `useAuditPlanData` hook - Data fetching
- ✅ Dùng `usePlanDetails` hook - Plan details management
- ✅ Dùng `submitAuditPlan` service - Submission logic
- ✅ Dùng helpers: `sensitiveAreasHelper`, `rejectionCommentHelper`
- ✅ Code đã được tách nhỏ, dễ maintain

#### ❌ LeadAuditor/auditplanning (Chưa refactor):
- ❌ Logic inline trong component (2,446 dòng)
- ❌ Chưa dùng `useAuditPlanData` hook
- ❌ Chưa dùng `usePlanDetails` hook
- ❌ Chưa dùng `submitAuditPlan` service
- ❌ Duplicate code với Auditor version

---

## 🔑 Khác biệt chính

### 1. **Visible Statuses Filter**

**LeadAuditor:**
```typescript
const LEAD_AUDITOR_VISIBLE_STATUSES = [
  'pendingreview',        // Plans submitted by Auditor, waiting Lead review
  'pendingdirectorapproval', // Already forwarded to Director
  'inprogress',          // Audit is being executed
  'approved',            // Approved by Director
  'declined',            // Rejected by Lead Auditor
  'rejected',            // Rejected by Director
];

const visiblePlans = useMemo(() => {
  return existingPlans.filter((plan) => {
    const normStatus = String(plan.status || '').toLowerCase().replace(/\s+/g, '');
    return LEAD_AUDITOR_VISIBLE_STATUSES.includes(normStatus);
  });
}, [existingPlans]);
```

**Auditor:**
```typescript
// Filter by team membership + status
const visiblePlans = useMemo(() => {
  // Only show plans where current user is in AuditTeam
  // AND status is in allowed list (Draft, Pending Review, etc.)
  const currentId = userIdFromToken || user?.userId;
  // ... complex filtering logic
}, [existingPlans, userIdFromToken, user, auditTeams]);
```

**Khác biệt:**
- **LeadAuditor**: Filter theo status only (Lead Auditor có quyền xem tất cả plans trong các status này)
- **Auditor**: Filter theo team membership + status (Auditor chỉ xem plans họ là member)

---

### 2. **Plan Creation/Editing**

**LeadAuditor:**
- Lead Auditor có thể tạo plans mới
- Lead Auditor có thể edit plans (kể cả plans đã được submit)
- Lead Auditor có thể approve/decline plans từ Auditor

**Auditor:**
- Auditor tạo plans mới (Draft)
- Auditor chỉ edit được Draft plans
- Auditor submit plans lên Lead Auditor

---

### 3. **Components Sharing**

**Shared Components:**
- ✅ `Step1BasicInfo`, `Step2Scope`, `Step3Checklist`, `Step4Team`, `Step5Schedule` - Từ `LeadAuditor/auditplanning/components/PlanForm/`
- ✅ `PlanDetailsModal` - Auditor version được dùng bởi cả 2 (LeadAuditor import từ Auditor)
- ✅ `FilterBar`, `PlanTable` - Mỗi role có version riêng nhưng logic tương tự

**Different Components:**
- LeadAuditor có thêm: `PermissionPreviewPanel`, `ActionDetailsModal`, `AuditTeamTab`, `CriteriaTab`, `DepartmentTab`, `FindingsTab`
- Auditor có: `PlanDetailsModal` (local version)

---

### 4. **Submission Logic**

**LeadAuditor:**
- Có logic `handleSubmitPlan` inline (~500+ dòng)
- Có logic approve/decline/forward to Director
- Có logic edit plans đã được submit

**Auditor:**
- Dùng `submitAuditPlan` service (đã extract)
- Chỉ submit lên Lead Auditor
- Không có approve/decline logic

---

## 🎯 Vấn đề hiện tại

### 1. **Code Duplication**
- ~70% code giống nhau giữa 2 files
- Logic validation, form handling, data fetching đều duplicate
- Maintenance khó khăn - fix bug phải sửa 2 chỗ

### 2. **Inconsistent Refactoring**
- Auditor đã được refactor (dùng hooks, services)
- LeadAuditor chưa được refactor (logic inline)
- Dẫn đến code style không đồng nhất

### 3. **Shared Components Confusion**
- Step components ở LeadAuditor folder nhưng Auditor cũng dùng
- PlanDetailsModal ở Auditor folder nhưng LeadAuditor cũng dùng
- Khó biết component nào thuộc role nào

---

## 💡 Đề xuất giải pháp

### Option 1: Refactor LeadAuditor để dùng cùng hooks/services (Recommended)

**Lợi ích:**
- ✅ Giảm duplicate code
- ✅ Consistent code style
- ✅ Dễ maintain hơn
- ✅ Dùng lại code đã test

**Cách làm:**
1. Update `useAuditPlanData` để support LeadAuditor filtering
2. Update `usePlanDetails` để support LeadAuditor actions
3. Update `submitAuditPlan` service để support LeadAuditor workflow
4. Refactor `LeadAuditor/auditplanning/index.tsx` để dùng hooks/services

**Estimated reduction:** ~700 dòng (28%)

---

### Option 2: Tạo shared base component

**Lợi ích:**
- ✅ Tách biệt logic chung
- ✅ Mỗi role có customization riêng

**Cách làm:**
1. Tạo `AuditPlanningBase` component với logic chung
2. `AuditorAuditPlanning` và `LeadAuditorAuditPlanning` extend base
3. Override methods cần thiết

**Estimated reduction:** ~1,000 dòng (40%)

---

### Option 3: Tạo role-agnostic component với props

**Lợi ích:**
- ✅ Single source of truth
- ✅ Dễ test

**Cách làm:**
1. Tạo `AuditPlanning` component nhận `role` prop
2. Conditional rendering dựa trên role
3. Role-specific logic trong separate hooks

**Estimated reduction:** ~1,200 dòng (50%)

---

## 📋 Recommended Action Plan

### Phase 1: Refactor LeadAuditor (Giống như đã làm với Auditor)

1. **Extract hooks:**
   - Update `useAuditPlanData` để support LeadAuditor filtering
   - Update `usePlanDetails` để support LeadAuditor actions

2. **Extract services:**
   - Update `submitAuditPlan` để support LeadAuditor workflow
   - Tạo `leadAuditorPlanActions.service.ts` cho approve/decline/forward logic

3. **Refactor component:**
   - Replace inline logic với hooks/services
   - Giữ nguyên business logic (status filtering, permissions)

**Timeline:** 2-3 days
**Risk:** Low (có thể test từng bước)

---

## 🔍 Code Similarity Analysis

### Similar Code Blocks:

1. **Form State Management** (~200 dòng) - 95% giống
2. **Validation Logic** (~150 dòng) - 90% giống
3. **Data Fetching** (~300 dòng) - 85% giống
4. **Submission Logic** (~500 dòng) - 70% giống
5. **UI Rendering** (~400 dòng) - 80% giống

**Total Similar:** ~1,550 dòng (63% của LeadAuditor file)

---

## ✅ Kết luận

**Tại sao chúng giống nhau:**
- Cả 2 đều quản lý Audit Plans
- Cả 2 đều có form tạo/edit plans
- Cả 2 đều có validation, data fetching logic tương tự
- Chỉ khác về permissions và workflow

**Nên làm gì:**
- ✅ Refactor LeadAuditor để dùng cùng hooks/services như Auditor
- ✅ Extract role-specific logic vào separate hooks/services
- ✅ Maintain shared components structure

**Expected Benefits:**
- Code reduction: ~700-1,200 dòng
- Better maintainability
- Consistent code style
- Easier testing

---

**Status:** 🟡 Ready for Refactoring
**Priority:** High (có nhiều duplicate code)

