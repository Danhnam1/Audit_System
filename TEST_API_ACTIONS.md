# Test API Actions - Đề xuất khắc phục

## Vấn đề đã fix

### 1. **rootCauseId type mismatch**
   - **Trước**: `rootCauseId` được định nghĩa là `number`
   - **Sau**: `rootCauseId` là `string` (GUID) - khớp với backend API
   
### 2. **Files đã fix**

#### a) `src/api/actions.ts`
- ✅ Fixed interface `Action`: `rootCauseId?: string` (thay vì `number`)
- ✅ Fixed function `getActionsByRootCause(rootCauseId: string)` (thay vì `number`)

#### b) `src/api/rootCauses.ts`
- ✅ Fixed interface `RootCause`: `rootCauseId: string` (thay vì `number`)
- ✅ Fixed interface `RemediationProposal`: `rootCauseId: string`
- ✅ Fixed interface `CreateRemediationProposalDto`: `rootCauseId: string`
- ✅ Fixed all functions sử dụng `rootCauseId`:
  - `getRootCauseById(id: string)`
  - `updateRootCause(id: string, ...)`
  - `approveRootCause(id: string)`
  - `rejectRootCause(id: string, ...)`
  - `sendRootCauseForReview(id: string)`
  - `deleteRootCause(id: string)`
  - `getRemediationProposalsByRootCause(rootCauseId: string)`

#### c) `src/pages/CAPAOwner/CAPAOwnerActionDetailModal.tsx`
- ✅ Fixed `loadRootCause` function: nhận `rootCauseId: string`

#### d) `src/pages/CAPAOwner/ActionDetailModal.tsx`
- ✅ Fixed `loadRootCause` function: nhận `rootCauseId: string`

#### e) `src/pages/Auditor/FindingManagement/FindingDetailModal.tsx`
- ✅ Fixed state: `editingRootCauseId: string | null`
- ✅ Fixed state: `rootCauseToDelete: string | null`

## API Endpoint

```typescript
GET /api/Action/by-root-cause/{rootCauseId}
```

### Parameters:
- `rootCauseId` (path, required): string($uuid) - GUID của root cause

### Response Example:
```json
{
  "$id": "14",
  "actionId": "a53626d4-2b8f-48ad-a5e8-bae816c34fb7",
  "findingId": "96156b27-74d5-44b2-b85d-61b416d12174",
  "title": "name rootcause",
  "description": "đề xuất khắc phục",
  "assignedBy": "10384324-7c21-453d-8962-30b6886f887d",
  "assignedTo": null,
  "assignedDeptId": 14,
  "rootCauseId": "1e2ec805-7423-427c-b7c4-b2e5eb8595e0",
  "status": "Active",
  "progressPercent": 0,
  "dueDate": "2026-01-17T08:07:44.374",
  "createdAt": "2026-01-17T08:07:35.0879021",
  "closedAt": null,
  "reviewFeedback": "",
  "acceptedAt": null,
  "rejectedAt": null,
  "rejectionReason": null,
  "targetStartDate": null,
  "verificationComment": null,
  "verifiedBy": null,
  "verifiedAt": null,
  "attachments": {
    "$id": "15",
    "$values": []
  }
}
```

## Cách test

### 1. Test trong browser console:
```javascript
// Lấy rootCauseId từ root cause đã tạo
const rootCauseId = "1e2ec805-7423-427c-b7c4-b2e5eb8595e0";

// Test API call
fetch(`/api/Action/by-root-cause/${rootCauseId}`, {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
})
.then(res => res.json())
.then(data => console.log('Actions:', data))
.catch(err => console.error('Error:', err));
```

### 2. Test trong React component:
```typescript
import { getActionsByRootCause } from '../api/actions';

// Trong component
const testLoadActions = async () => {
  try {
    const rootCauseId = "1e2ec805-7423-427c-b7c4-b2e5eb8595e0"; // GUID string
    const actions = await getActionsByRootCause(rootCauseId);
    console.log('Actions loaded:', actions);
  } catch (error) {
    console.error('Error loading actions:', error);
  }
};
```

## Nơi hiển thị "Đề xuất khắc phục"

### 1. **FindingDetailModal (Auditor)**
- File: `src/pages/Auditor/FindingManagement/FindingDetailModal.tsx`
- Dòng ~1099: Hiển thị `rc.actions` (các đề xuất khắc phục cho mỗi root cause)
- Label: "Proposed solution (1)"

### 2. **CAPAOwnerActionDetailModal**
- File: `src/pages/CAPAOwner/CAPAOwnerActionDetailModal.tsx`
- Load actions khi mở modal action detail
- Hiển thị danh sách actions liên quan đến root cause

## Kiểm tra hoạt động

1. ✅ TypeScript types đã đúng (string thay vì number)
2. ✅ API calls sử dụng GUID string
3. ✅ UI components nhận và hiển thị actions đúng
4. ✅ Không còn lỗi TypeScript

## Lưu ý quan trọng

- **rootCauseId luôn là GUID string**, không phải number
- Backend API trả về `rootCauseId` dạng string GUID
- Khi tạo action mới, cần pass `rootCauseId` dạng string
- Hàm `getActionsByRootCause` giờ chấp nhận string thay vì number
