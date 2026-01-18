# Collaborative Auditing Fix

## Vấn đề ban đầu
Khi có 2 auditor (A và B) cùng làm việc trên 1 checklist của cùng 1 department:
- Auditor A tạo finding → Auditor B **KHÔNG thể xem** finding đó
- Mỗi auditor chỉ thấy findings của chính họ

## Nguyên nhân
Hệ thống sử dụng API `getMyFindings()` (`/Findings/my-findings`) - API này chỉ trả về findings do **chính user hiện tại** tạo ra.

## Giải pháp đã thực hiện
Thay đổi logic load findings từ `getMyFindings()` sang `getFindingsByDepartment()` để:
- ✅ Tất cả auditors làm việc trên cùng 1 department có thể thấy **TẤT CẢ** findings của department đó
- ✅ Hỗ trợ collaborative auditing - nhiều auditor có thể làm việc song song
- ✅ Tăng tính minh bạch và khả năng phối hợp trong team audit

## Files đã thay đổi

### 1. `DepartmentChecklist.tsx`
**Locations changed:**

#### a) Function `loadMyFindings()` (line ~1422)
**Trước:**
```typescript
const allFindings = await getMyFindings();
```

**Sau:**
```typescript
// Load ALL findings for this department so all auditors can see them
let allFindings: Finding[] = [];
if (deptId) {
  allFindings = await getFindingsByDepartment(parseInt(deptId, 10));
} else {
  allFindings = await getFindings();
}
```

#### b) Function `loadDisagreedFindings()` (line ~1495)
**Trước:**
```typescript
const allFindings = await getMyFindings();
```

**Sau:**
```typescript
let allFindings: Finding[] = [];
if (deptId) {
  allFindings = await getFindingsByDepartment(parseInt(deptId, 10));
} else {
  allFindings = await getFindings();
}
```

#### c) `useEffect` - Initial data load (line ~1264)
**Trước:**
```typescript
let allMyFindings = await getMyFindings();
if (allMyFindings.length === 0) {
  const allFindings = await getFindings();
  allMyFindings = unwrap(allFindings);
}
```

**Sau:**
```typescript
let allMyFindings: Finding[] = [];
if (deptId) {
  allMyFindings = await getFindingsByDepartment(deptIdNum);
} else {
  allMyFindings = await getFindings();
}
```

#### d) Reload findings trong `handleEditFindingSubmit` (line ~847)
**Trước:**
```typescript
let allMyFindings = await getMyFindings();
if (allMyFindings.length === 0) {
  const allFindings = await getFindings();
  allMyFindings = unwrap(allFindings);
}
```

**Sau:**
```typescript
let allMyFindings: Finding[] = [];
if (deptId) {
  allMyFindings = await getFindingsByDepartment(parseInt(deptId, 10));
} else {
  allMyFindings = await getFindings();
}
```

#### e) Reload findings trong `CreateFindingModal onSuccess` (line ~2494)
Tương tự như trên.

#### f) Import statement (line ~12)
**Thêm:**
```typescript
import { getFindings, getMyFindings, getFindingsByDepartment, getFindingById, updateFinding, type Finding} from '../../../api/findings';
```

## API Reference

### `getFindingsByDepartment(deptId: number)`
- **Endpoint:** `GET /Findings/by-department/{deptId}`
- **Mô tả:** Lấy TẤT CẢ findings của một department cụ thể
- **Returns:** `Promise<Finding[]>`

## Testing
Sau khi thay đổi, test các scenario sau:

### Test Case 1: Multiple Auditors - Same Checklist
1. Auditor A đăng nhập, vào checklist của Department X
2. Auditor A tạo finding cho một checklist item
3. Auditor B đăng nhập, vào cùng checklist của Department X
4. **Expected:** Auditor B phải **THẤY ĐƯỢC** finding mà Auditor A vừa tạo

### Test Case 2: Actions Tab
1. Auditor A tạo finding và thêm root causes, actions
2. Auditor B vào tab "My Findings"
3. **Expected:** Auditor B thấy finding của Auditor A với đầy đủ actions

### Test Case 3: Color Coding
1. Auditor A tạo finding với status "NonCompliant"
2. Auditor B reload checklist
3. **Expected:** Checklist item tương ứng phải có màu đỏ (NonCompliant)

### Test Case 4: Witness Disagreed Tab
1. Witness disagree một finding
2. Cả Auditor A và B vào tab "Witness Disagreed"
3. **Expected:** Cả hai đều thấy finding bị disagree

## Lưu ý
- API `getMyFindings()` vẫn còn trong code và import để tương thích với các component khác có thể đang sử dụng
- Có thể cân nhắc xóa import `getMyFindings` nếu không còn sử dụng ở đâu trong file này

## Date
January 18, 2026
