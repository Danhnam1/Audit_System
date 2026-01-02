# LeadAuditor Create Plan Analysis

## 🔍 Phát hiện mâu thuẫn

### 1. **Comment vs Code**

**Comment (Line 67):**
```typescript
// Note: Draft plans are created by Auditors, not Lead Auditors
```

**Nhưng Code có logic CREATE:**
```typescript
// Line 980-1108: handleSubmitPlan
} else {
  // Create new audit - Business Rule Validation
  const resp = await createAudit(basicPayload); // Line 1108
  // ...
  status: 'Draft', // Line 952
}
```

**Modal Title (Line 1633):**
```typescript
{formState.isEditMode ? "Edit Audit Plan" : "Create New Audit Plan"}
```

---

## 📊 Phân tích

### **LeadAuditor có thể tạo plan không?**

#### ✅ **Code hiện tại: CÓ**
- `handleSubmitPlan` có logic create (line 980-1108)
- Tạo với status `'Draft'` (line 952)
- Modal có title "Create New Audit Plan"
- Có validation `validateBeforeCreateAudit` (line 995)

#### ❌ **Comment nói: KHÔNG**
- "Draft plans are created by Auditors, not Lead Auditors"

#### ✅ **Document nói: CÓ**
- `LEADAUDITOR_AUDITOR_COMPARISON.md` line 77: "Lead Auditor có thể tạo plans mới"

---

## 🎯 Kết luận

### **Có 2 khả năng:**

### **Khả năng 1: LeadAuditor VẪN tạo plan (nhưng có thể không tạo Draft)**

**Logic:**
- LeadAuditor có thể tạo plan mới
- Nhưng không tạo với status `Draft`
- Có thể tạo với status khác (ví dụ: `PendingReview` trực tiếp)

**Vấn đề:**
- Code hiện tại tạo với status `'Draft'` (line 952) → **Mâu thuẫn với comment**

### **Khả năng 2: LeadAuditor KHÔNG tạo plan nữa (legacy code)**

**Logic:**
- Business rule đã thay đổi
- LeadAuditor chỉ EDIT và REVIEW plans
- Code create là legacy code cần cleanup

**Vấn đề:**
- Code vẫn có logic create → **Cần xóa**

---

## 💡 Đề xuất

### **Option 1: Nếu LeadAuditor KHÔNG tạo plan nữa**

**Actions:**
1. ✅ Xóa logic create trong `handleSubmitPlan` (line 980-1108)
2. ✅ Chỉ giữ logic edit (line 967-979)
3. ✅ Xóa button "Create New Plan" (nếu có)
4. ✅ Update comment để rõ ràng
5. ✅ Chuyển Step components về Auditor (vì chỉ Auditor dùng để create)

**Benefits:**
- Code rõ ràng hơn
- Đúng với business rule
- Có thể chuyển Step components về Auditor

### **Option 2: Nếu LeadAuditor VẪN tạo plan**

**Actions:**
1. ✅ Update comment để rõ ràng
2. ✅ Xác nhận status khi create (có phải `Draft` không?)
3. ✅ Giữ nguyên code hiện tại
4. ✅ Step components giữ ở LeadAuditor (vì cả 2 đều dùng)

---

## ❓ Câu hỏi cần làm rõ

1. **LeadAuditor có thể tạo plan mới không?**
   - Nếu KHÔNG → Cleanup code
   - Nếu CÓ → Update comment và xác nhận status

2. **Nếu LeadAuditor tạo plan, status là gì?**
   - `Draft`?
   - `PendingReview`?
   - Status khác?

3. **LeadAuditor có button "Create New Plan" không?**
   - Nếu không có button → Code create là dead code
   - Nếu có button → Cần xác nhận business rule

---

## 🔧 Next Steps

**Chờ xác nhận từ user về business rule thực tế:**
- LeadAuditor có tạo plan không?
- Nếu không → Tiến hành cleanup và chuyển Step components về Auditor
- Nếu có → Update comment và giữ nguyên code

---

**Status:** ⚠️ **Cần xác nhận business rule**

