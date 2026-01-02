# LeadAuditor Cleanup Status

## ✅ Đã hoàn thành

1. ✅ **Xóa Form Modal** (line 1601-2015) - Đã xóa toàn bộ form modal và Step components khỏi JSX
2. ✅ **Update PlanTable** - Đã update để không hiển thị Edit/Delete buttons khi props là undefined
3. ✅ **Update PlanTable Props** - Đã làm `onEditPlan` và `onDeletePlan` thành optional

## ⏳ Cần tiếp tục

### 1. **Xóa Handlers** (cần xóa hoặc comment)
- `handleSubmitPlan` (line 887-1430) - ~540 lines - **Đã comment nhưng cần xóa hoàn toàn**
- `handleEditPlan` (line 1433-1569) - ~136 lines - **Cần xóa**
- `handleDeletePlan` (line 1572-1594) - ~22 lines - **Cần xóa**
- `closeDeleteModal`, `confirmDeletePlan` - **Cần xóa**

### 2. **Xóa Unused Imports**
- `createPortal` (line 5) - Không dùng nữa vì đã xóa form modal
- `Step1BasicInfo`, `Step2Scope`, `Step3Checklist`, `Step4Team`, `Step5Schedule`, `SensitiveAreaForm` (line 51-56)
- `PermissionPreviewPanel` (line 57)
- `loadPlanDetailsForEdit` (line 58)
- `createAudit`, `addAuditScopeDepartment`, `completeUpdateAuditPlan`, `deleteAuditPlan` (line 9, 10, 17, 18)
- `addCriterionToAudit` (line 21)
- `addTeamMember` (line 23)
- `addAuditSchedule` (line 25)
- `createAuditChecklistItemsFromTemplate` (line 7)
- `syncAuditChecklistTemplateMaps` (line 28)
- `validateBeforeCreateAudit`, `validateBeforeAddDepartment`, `validateDepartmentWithConditions` (line 32-34)
- `useAuditPlanForm` (line 39)

### 3. **Xóa Unused State**
- `formState` (line 82)
- `departments`, `criteria`, `checklistTemplates`, `auditorOptions`, `ownerOptions` (line 85-89)
- `selectedCriteriaByDept` (line 95)
- `showConflictModal`, `conflictData`, `filteredCriteria` (line 101-122)
- `originalSelectedAuditorIds` (line 125)
- `showDeleteModal`, `planToDelete` (line 128-129)
- `isSubmittingPlan` (line 132)
- `hasFormData` (line 818-854)
- `scheduleErrors` (line 163-246)
- `validateStep1-5`, `canContinue` (line 249-318)
- Các useEffect liên quan đến form (line 321-420)

### 4. **Chuyển Step Components về Auditor**
- Di chuyển folder `LeadAuditor/auditplanning/components/PlanForm/` → `Auditor/AuditPlanning/components/PlanForm/`
- Update imports trong `Auditor/AuditPlanning/index.tsx` (line 37-42)

## 📝 Lưu ý

- File hiện tại vẫn còn nhiều code không cần thiết nhưng không gây lỗi
- Có thể cleanup dần dần hoặc tạo file mới hoàn toàn
- Cần test sau mỗi bước cleanup

## 🎯 Ưu tiên

1. **Cao:** Xóa handlers (handleEditPlan, handleDeletePlan) - Đang gây confusion
2. **Trung bình:** Xóa unused imports - Giảm bundle size
3. **Thấp:** Xóa unused state - Code cleanup, không ảnh hưởng functionality
4. **Cao:** Chuyển Step components về Auditor - Cần thiết cho cấu trúc code

