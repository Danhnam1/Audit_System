# LeadAuditor Cleanup Plan

## 🎯 Mục tiêu
Xóa toàn bộ logic create/edit/delete khỏi LeadAuditor vì đã chuyển cho Auditor thực hiện.

## 📋 Các thay đổi cần thực hiện

### 1. **Xóa Form Modal và Step Components khỏi LeadAuditor**
- Xóa toàn bộ form modal (line 1602-2015)
- Xóa imports Step components (line 51-58)
- Xóa `useAuditPlanForm` hook (line 39, 82)
- Xóa các state liên quan đến form

### 2. **Xóa Handlers**
- `handleSubmitPlan` (line 887-1427) - ~540 lines
- `handleEditPlan` (line 1430-1566) - ~136 lines  
- `handleDeletePlan` (line 1569-1591) - ~22 lines
- `closeDeleteModal`, `confirmDeletePlan` (line 1574-1591)

### 3. **Xóa PlanTable Edit/Delete Actions**
- Xóa `onEditPlan` prop (line 2040)
- Xóa `onDeletePlan` prop (line 2041)
- Update PlanTable component để không hiển thị Edit/Delete buttons

### 4. **Xóa Unused Imports và State**
- Xóa imports: `createAudit`, `completeUpdateAuditPlan`, `deleteAuditPlan`, `addAuditScopeDepartment`, `addCriterionToAudit`, `addTeamMember`, `addAuditSchedule`, `createAuditChecklistItemsFromTemplate`, `syncAuditChecklistTemplateMaps`
- Xóa validation imports: `validateBeforeCreateAudit`, `validateBeforeAddDepartment`, `validateDepartmentWithConditions`
- Xóa state: `formState`, `departments`, `criteria`, `checklistTemplates`, `auditorOptions`, `ownerOptions`, `selectedCriteriaByDept`, `showConflictModal`, `conflictData`, `filteredCriteria`, `originalSelectedAuditorIds`, `showDeleteModal`, `planToDelete`, `isSubmittingPlan`, `hasFormData`, `scheduleErrors`

### 5. **Xóa Unused Functions**
- `validatePlanPeriod` (line 857-884)
- `hasFormData` (line 818-854)
- `scheduleErrors` (line 163-220)
- `canContinue` (nếu có)

### 6. **Chuyển Step Components về Auditor**
- Di chuyển folder `LeadAuditor/auditplanning/components/PlanForm/` → `Auditor/AuditPlanning/components/PlanForm/`
- Update imports trong `Auditor/AuditPlanning/index.tsx` (line 37-42)

### 7. **Giữ lại cho LeadAuditor**
- ✅ `handleViewDetails` - Xem chi tiết plan
- ✅ `PlanDetailsModal` - Modal xem chi tiết
- ✅ `approveForwardDirector` - Approve và forward
- ✅ `declinedPlanContent` - Reject plan
- ✅ Filter và table hiển thị plans

## 📊 Ước tính giảm code
- **Trước:** ~2443 lines
- **Sau:** ~800-1000 lines (giảm ~60%)
- **Xóa:** ~1400-1600 lines

## ✅ Checklist
- [ ] Xóa form modal
- [ ] Xóa Step components imports
- [ ] Xóa handlers (submit, edit, delete)
- [ ] Xóa unused imports
- [ ] Xóa unused state
- [ ] Xóa unused functions
- [ ] Update PlanTable (xóa Edit/Delete)
- [ ] Chuyển Step components về Auditor
- [ ] Update imports trong Auditor
- [ ] Test LeadAuditor chỉ xem và approve/reject
- [ ] Test Auditor vẫn create/edit/delete được

