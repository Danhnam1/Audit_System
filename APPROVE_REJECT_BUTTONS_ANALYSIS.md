# Phân tích Approve/Reject Buttons trong dự án

## Tổng quan

Dự án có **component Button chung** (`FE/Audit_System/src/components/Button.tsx`) nhưng **KHÔNG được sử dụng nhất quán** cho các approve/reject buttons.

## Component Button chung

**Location:** `FE/Audit_System/src/components/Button.tsx`

**Features:**
- Variants: `primary`, `secondary`, `success`, `danger`, `warning`, `gray`, `ghost`, `outline`
- Sizes: `sm`, `md`, `lg`
- Loading state với spinner
- Left/Right icons support

**Export:** Đã được export trong `components/index.ts`

## Các nơi sử dụng Approve/Reject Buttons

### ✅ Sử dụng Component Button chung

1. **`LeadAuditor/LeadReports/components/AuditReportsTable.tsx`**
   - Sử dụng `<Button variant="success">` cho Approve
   - Sử dụng `<Button variant="danger">` cho Reject
   - Có leftIcon (checkmark cho approve, X cho reject)
   - Có isLoading state
   - **Đây là implementation tốt nhất**

### ❌ Sử dụng HTML button thông thường (không dùng component chung)

2. **`LeadAuditor/Reports/components/AuditReportsTable.tsx`**
   - Button HTML với className tự định nghĩa
   - Sử dụng `getStatusColor('Approved')` và `getStatusColor('Rejected')`
   - Có loading state nhưng không có spinner

3. **`Director/ReviewAuditPlans.tsx`**
   - Button HTML với className tự định nghĩa
   - Approve: `bg-primary-600 text-white hover:bg-primary-700`
   - Reject: `text-red-600 bg-white hover:bg-red-50 border border-red-300`

4. **`AuditeeOwner/EvidenceDetail.tsx`**
   - Button HTML với className tự định nghĩa
   - Approve: `bg-green-600 text-white rounded-lg hover:bg-green-700`
   - Reject: `bg-red-600 text-white rounded-lg hover:bg-red-700`

5. **`Auditor/AuditReview/components/AuditReviewList.tsx`**
   - Button HTML với className tự định nghĩa
   - Sử dụng `getStatusColor('Approved')` và `getStatusColor('Rejected')`
   - Có import Button component nhưng không sử dụng cho approve/reject

6. **`Auditor/AuditPlanning/components/PlanDetailsModal.tsx`**
   - Button HTML với className tự định nghĩa
   - Approve: `bg-primary-500 hover:bg-primary-600 text-white`
   - Reject: `bg-red-500 hover:bg-red-600 text-white`

7. **`LeadAuditor/ActionReview/LeadAuditorActionReviewModal.tsx`**
   - Sử dụng `ActionDetailModal` component (wrapper)
   - Logic approve/reject được handle trong modal này

8. **Các file khác:**
   - `Director/ReviewAuditResults.tsx`
   - `CAPAOwner/ActionDetailModal.tsx`
   - `Auditor/LeadFinalReview/components/AuditDetailsModal.tsx`
   - Và nhiều file khác...

## Vấn đề hiện tại

1. **Không nhất quán về độ rộng:**
   - Mỗi file tự định nghĩa className cho approve/reject buttons
   - Độ rộng (width) của các buttons khác nhau, trông không đẹp khi đặt cạnh nhau
   - Màu sắc có thể khác nhau tùy context (điều này OK), nhưng độ rộng nên được chuẩn hóa

2. **Không tái sử dụng:**
   - Component Button chung đã có nhưng ít được sử dụng
   - Code bị duplicate nhiều lần

3. **Khó maintain:**
   - Khi cần thay đổi độ rộng hoặc layout, phải sửa nhiều file
   - Không có loading state nhất quán
   - Không có icon nhất quán

## Khuyến nghị

### Option 1: Tạo component ApproveRejectButtons chuyên dụng

Tạo component mới `components/ApproveRejectButtons.tsx`:

```tsx
interface ApproveRejectButtonsProps {
  onApprove: () => void;
  onReject: () => void;
  isLoading?: boolean;
  approveText?: string;
  rejectText?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  approveVariant?: 'success' | 'primary' | string; // Cho phép custom màu approve
  rejectVariant?: 'danger' | 'outline' | string; // Cho phép custom màu reject
  buttonWidth?: string; // Cho phép custom độ rộng, mặc định 'min-w-[100px]'
}

export const ApproveRejectButtons: React.FC<ApproveRejectButtonsProps> = ({
  onApprove,
  onReject,
  isLoading = false,
  approveText = 'Approve',
  rejectText = 'Reject',
  disabled = false,
  size = 'md',
  approveVariant = 'success',
  rejectVariant = 'danger',
  buttonWidth = 'min-w-[100px]' // Mặc định chuẩn hóa độ rộng
}) => {
  return (
    <div className="flex gap-2">
      <Button
        variant={approveVariant as any}
        size={size}
        onClick={onApprove}
        disabled={disabled || isLoading}
        isLoading={isLoading}
        className={buttonWidth}
        leftIcon={
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        }
      >
        {approveText}
      </Button>
      <Button
        variant={rejectVariant as any}
        size={size}
        onClick={onReject}
        disabled={disabled || isLoading}
        isLoading={isLoading}
        className={buttonWidth}
        leftIcon={
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        }
      >
        {rejectText}
      </Button>
    </div>
  );
};
```

### Option 2: Sử dụng Button component hiện có

Refactor tất cả các nơi sử dụng approve/reject buttons để dùng `<Button>` component với:
- **Chuẩn hóa độ rộng (width):** Đảm bảo các button approve/reject có cùng độ rộng để trông đẹp và nhất quán
  - Sử dụng `min-w-[XXXpx]` hoặc `w-[XXXpx]` để đảm bảo cùng độ rộng
  - Ví dụ: `min-w-[100px]` hoặc `w-[120px]` cho cả 2 buttons
- **Màu sắc:** Có thể giữ nguyên màu sắc hiện tại của từng file (không bắt buộc phải giống nhau)
  - Approve có thể dùng `variant="success"` hoặc màu xanh/primary tùy context
  - Reject có thể dùng `variant="danger"` hoặc màu đỏ tùy context
- Thêm leftIcon cho consistency (optional)
- Sử dụng `isLoading` prop cho loading state

## Danh sách file cần refactor

1. `LeadAuditor/Reports/components/AuditReportsTable.tsx` ✅ (đã dùng Button)
2. `Director/ReviewAuditPlans.tsx` ❌
3. `AuditeeOwner/EvidenceDetail.tsx` ❌
4. `Auditor/AuditReview/components/AuditReviewList.tsx` ❌
5. `Auditor/AuditPlanning/components/PlanDetailsModal.tsx` ❌
6. `Director/ReviewAuditResults.tsx` ❌
7. `CAPAOwner/ActionDetailModal.tsx` ❌
8. `Auditor/LeadFinalReview/components/AuditDetailsModal.tsx` ❌
9. Và các file khác có approve/reject buttons...

## Kết luận

**Hiện tại:** Chỉ có 1 file (`LeadAuditor/LeadReports/components/AuditReportsTable.tsx`) sử dụng component Button chung cho approve/reject buttons.

**Cần làm:** Refactor tất cả các file còn lại để sử dụng component chung (Button hoặc ApproveRejectButtons mới) để đảm bảo consistency và dễ maintain.

