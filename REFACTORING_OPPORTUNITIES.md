# Refactoring Opportunities - Toàn bộ dự án

## 📊 Tổng quan

Phân tích toàn bộ dự án để tìm các cơ hội refactoring, cải thiện code quality và maintainability.

---

## 🔴 Priority 1: Files lớn cần refactor ngay

### 1. **Auditor/Reports/index.tsx** (2,380 dòng)
**Vấn đề:**
- File quá lớn, nhiều responsibilities
- Nhiều state management (33+ useState)
- Logic phức tạp cho charts, reports, uploads

**Đề xuất refactor:**
- ✅ Extract hooks:
  - `useReportsData` - Data fetching cho reports
  - `useChartsData` - Chart data processing
  - `useReportUpload` - File upload logic
- ✅ Extract services:
  - `reportsService.ts` - Business logic cho reports
  - `chartsService.ts` - Chart generation logic
- ✅ Extract components:
  - `ReportsTable.tsx`
  - `ChartsSection.tsx`
  - `UploadSection.tsx`
  - `RejectReasonModal.tsx`

**Estimated reduction:** ~1,500 dòng (63%)

---

### 2. **Auditor/FindingManagement/DepartmentChecklist.tsx** (2,566 dòng)
**Vấn đề:**
- File cực lớn với nhiều logic phức tạp
- Duplicate `getStatusColor` function (local)
- Nhiều nested conditions

**Đề xuất refactor:**
- ✅ Extract hooks:
  - `useChecklistData` - Checklist items management
  - `useCompliantStatus` - Compliant/Non-compliant logic
- ✅ Extract services:
  - `checklistService.ts` - Checklist operations
- ✅ Extract components:
  - `ChecklistItemCard.tsx`
  - `CompliantModal.tsx`
  - `FindingCreationModal.tsx`
- ✅ Replace local `getStatusColor` với centralized version

**Estimated reduction:** ~1,600 dòng (62%)

---

### 3. **LeadAuditor/auditplanning/index.tsx** (2,443 dòng)
**Vấn đề:**
- Tương tự `Auditor/AuditPlanning/index.tsx` (đã refactor)
- Có thể áp dụng cùng pattern

**Đề xuất refactor:**
- ✅ Apply cùng refactoring pattern như `Auditor/AuditPlanning`:
  - Extract helpers (sensitiveAreasHelper, rejectionCommentHelper)
  - Extract hooks (usePlanDetails, useAuditPlanData)
  - Extract service (auditPlanSubmission.service)
- ✅ Share common logic giữa 2 files

**Estimated reduction:** ~1,200 dòng (49%)

---

### 4. **Auditor/FindingManagement/FindingDetailModal.tsx** (1,734 dòng)
**Vấn đề:**
- Modal component quá lớn
- Nhiều tabs và logic phức tạp
- History/log parsing logic

**Đề xuất refactor:**
- ✅ Extract components:
  - `FindingInfoTab.tsx`
  - `FindingHistoryTab.tsx`
  - `FindingActionsTab.tsx`
  - `FindingAttachmentsTab.tsx`
- ✅ Extract hooks:
  - `useFindingDetails` - Load và manage finding data
  - `useFindingHistory` - Parse và format history logs
- ✅ Extract services:
  - `findingHistoryService.ts` - History parsing logic

**Estimated reduction:** ~1,000 dòng (58%)

---

### 5. **AuditeeOwner/findings/FindingsProgress.tsx** (1,951 dòng)
**Vấn đề:**
- File lớn với nhiều state
- Logic phức tạp cho findings progress

**Đề xuất refactor:**
- ✅ Extract hooks:
  - `useFindingsProgress` - Data fetching và state management
- ✅ Extract components:
  - `FindingsTable.tsx`
  - `ProgressFilters.tsx`
  - `StatusBadges.tsx`

**Estimated reduction:** ~1,200 dòng (62%)

---

### 6. **Auditor/AuditPlanning/components/PlanDetailsModal.tsx** (1,659 dòng)
**Vấn đề:**
- Modal component lớn với nhiều tabs
- Logic phức tạp cho different roles

**Đề xuất refactor:**
- ✅ Extract tab components:
  - `OverviewTab.tsx`
  - `DepartmentsTab.tsx`
  - `CriteriaTab.tsx`
  - `SchedulesTab.tsx`
  - `TeamTab.tsx`
  - `TemplatesTab.tsx`
  - `FindingsTab.tsx`
- ✅ Extract hooks:
  - `usePlanDetailsModal` - Modal state management

**Estimated reduction:** ~800 dòng (48%)

---

## 🟡 Priority 2: Code Duplication

### 1. **Duplicate `getStatusBadgeColor` Functions**

**Files affected:**
- `CAPAOwner/AuditList.tsx` (lines 19-33)
- `AuditeeOwner/findings/AuditList.tsx` (lines 27-41)

**Solution:**
```typescript
// src/constants/statusColors.ts
export const getStatusBadgeColor = (status: string): string => {
  const statusLower = status?.toLowerCase() || '';
  switch (statusLower) {
    case 'assigned':
      return 'bg-blue-100 text-blue-800 border border-blue-300';
    case 'in progress':
      return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'archived':
      return 'bg-gray-100 text-gray-800 border border-gray-300';
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-300';
  }
};
```

**Impact:** Remove ~30 dòng duplicate code

---

### 2. **Duplicate Form Validation Patterns**

**Files affected:**
- `Admin/UserManagement/index.tsx` (validateForm)
- `Auditor/FindingManagement/CreateFindingModal.tsx` (validateForm)
- `LeadAuditor/auditplanning/index.tsx` (validateStep1-5)
- `Auditor/AuditPlanning/index.tsx` (validateStep1-5)

**Solution:**
- ✅ Create `helpers/formValidation.ts`:
  - `validateEmail()`
  - `validatePassword()`
  - `validateDateRange()`
  - `validateRequired()`
  - `validateFileSize()`

**Impact:** Reduce duplication, improve consistency

---

### 3. **Duplicate File Upload Logic**

**Files affected:**
- `Auditor/FindingManagement/CreateFindingModal.tsx`
- `Auditor/Reports/index.tsx`
- `AuditeeOwner/ReviewEvidence.tsx`

**Solution:**
- ✅ Create `hooks/useFileUpload.ts`:
  ```typescript
  const useFileUpload = (options: {
    maxSize?: number;
    allowedTypes?: string[];
    onError?: (error: string) => void;
  }) => {
    // File validation, upload logic
  };
  ```

**Impact:** Standardize file upload across app

---

## 🟢 Priority 3: Extract Common Patterns

### 1. **Data Fetching Patterns**

**Pattern:** Nhiều components có cùng pattern:
```typescript
const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

useEffect(() => {
  const fetch = async () => {
    setLoading(true);
    try {
      const result = await api.getData();
      setData(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };
  fetch();
}, []);
```

**Solution:**
- ✅ Create `hooks/useAsyncData.ts`:
  ```typescript
  const useAsyncData = <T>(
    fetchFn: () => Promise<T>,
    deps: any[] = []
  ) => {
    // Standard async data fetching
  };
  ```

**Files to refactor:**
- `Auditor/Reports/index.tsx`
- `Auditor/FindingManagement/index.tsx`
- `LeadAuditor/LeadReports/index.tsx`
- `Director/ReviewAuditPlans.tsx`

---

### 2. **Modal Management Pattern**

**Pattern:** Nhiều modals có cùng state management:
```typescript
const [isOpen, setIsOpen] = useState(false);
const [data, setData] = useState(null);

const open = (item) => {
  setData(item);
  setIsOpen(true);
};

const close = () => {
  setIsOpen(false);
  setData(null);
};
```

**Solution:**
- ✅ Create `hooks/useModal.ts`:
  ```typescript
  const useModal = <T>() => {
    const [isOpen, setIsOpen] = useState(false);
    const [data, setData] = useState<T | null>(null);
    // ... modal logic
  };
  ```

**Impact:** Reduce boilerplate code

---

### 3. **Table/List Filtering Pattern**

**Pattern:** Nhiều tables có filtering logic tương tự:
```typescript
const [searchTerm, setSearchTerm] = useState('');
const [statusFilter, setStatusFilter] = useState('');
const [filteredData, setFilteredData] = useState([]);

useEffect(() => {
  // Filter logic
}, [searchTerm, statusFilter, data]);
```

**Solution:**
- ✅ Create `hooks/useTableFilters.ts`:
  ```typescript
  const useTableFilters = <T>(
    data: T[],
    filters: FilterConfig[]
  ) => {
    // Generic filtering logic
  };
  ```

**Files to refactor:**
- `Auditor/AuditPlanning/index.tsx` (đã có useAuditPlanFilters)
- `Auditor/FindingManagement/index.tsx`
- `LeadAuditor/auditplanning/index.tsx`

---

## 🔵 Priority 4: Type Safety & Constants

### 1. **Extract Magic Strings/Numbers**

**Issues:**
- Hardcoded status strings: `'Draft'`, `'Pending Review'`, etc.
- Magic numbers: `16` (MIN_PERIOD_DAYS), `10 * 1024 * 1024` (file size)

**Solution:**
- ✅ Create `constants/auditStatuses.ts`:
  ```typescript
  export const AUDIT_STATUSES = {
    DRAFT: 'Draft',
    PENDING_REVIEW: 'Pending Review',
    // ...
  } as const;
  ```

- ✅ Create `constants/validation.ts`:
  ```typescript
  export const VALIDATION = {
    MIN_PERIOD_DAYS: 16,
    MAX_FILE_SIZE: 10 * 1024 * 1024,
    // ...
  } as const;
  ```

---

### 2. **Improve Type Definitions**

**Issues:**
- Nhiều `any` types
- Inconsistent interfaces

**Solution:**
- ✅ Create comprehensive types:
  - `types/audit.ts` - Audit-related types
  - `types/finding.ts` - Finding-related types
  - `types/user.ts` - User-related types
  - `types/form.ts` - Form-related types

---

## 📋 Refactoring Roadmap

### Phase 1: High Priority Files (Weeks 1-4)
1. ✅ **Week 1:** `Auditor/Reports/index.tsx`
2. ✅ **Week 2:** `Auditor/FindingManagement/DepartmentChecklist.tsx`
3. ✅ **Week 3:** `LeadAuditor/auditplanning/index.tsx`
4. ✅ **Week 4:** `Auditor/FindingManagement/FindingDetailModal.tsx`

### Phase 2: Code Duplication (Weeks 5-6)
1. ✅ **Week 5:** Extract common utilities (status colors, validation)
2. ✅ **Week 6:** Extract common hooks (useFileUpload, useModal, useAsyncData)

### Phase 3: Patterns & Types (Weeks 7-8)
1. ✅ **Week 7:** Extract constants và magic values
2. ✅ **Week 8:** Improve type definitions

---

## 📊 Expected Impact

### Code Reduction
- **Total lines reduced:** ~6,000+ dòng (across all files)
- **Average reduction per file:** 50-60%

### Quality Improvements
- ✅ Better separation of concerns
- ✅ Improved reusability
- ✅ Easier testing
- ✅ Better maintainability
- ✅ Reduced bugs from duplication

### Performance
- ✅ Smaller bundle size (tree-shaking)
- ✅ Better code splitting opportunities
- ✅ Faster development (less code to read)

---

## 🎯 Quick Wins (Có thể làm ngay)

### 1. Extract Status Color Functions (30 phút)
- Move `getStatusBadgeColor` to `constants/statusColors.ts`
- Update 2 files

### 2. Extract Validation Helpers (1 giờ)
- Create `helpers/formValidation.ts`
- Extract common validation functions

### 3. Extract File Upload Hook (2 giờ)
- Create `hooks/useFileUpload.ts`
- Update 3 files to use it

### 4. Extract Modal Hook (1 giờ)
- Create `hooks/useModal.ts`
- Update 5-10 modal components

---

## 📝 Notes

- **Testing:** Mỗi refactoring cần có tests hoặc manual verification
- **Incremental:** Refactor từng file một, không làm tất cả cùng lúc
- **Documentation:** Update docs khi refactor
- **Code Review:** Review kỹ trước khi merge

---

**Last Updated:** [DATE]
**Status:** 🟢 Ready for Planning

