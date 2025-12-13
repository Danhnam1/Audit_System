# QR Code Expired Test Guide

## Căn cứ để biết QR Code Expired

### Backend Logic (AccessGrantRepository.cs)

```csharp
var now = DateTime.UtcNow;
if (now < entity.ValidFrom || now > entity.ValidTo)
{
    return new ScanQrTokenResponse
    {
        IsValid = false,
        Reason = "Expired"
    };
}
```

**Điều kiện Expired:**
- `now < ValidFrom` → QR code chưa đến thời gian bắt đầu
- `now > ValidTo` → QR code đã quá thời gian kết thúc

### Frontend Display (ScanQR.tsx)

Khi `result.reason === "Expired"`, hiển thị:
```
"QR code has expired. Please request a new QR code from the auditor."
```

---

## Cách Test QR Code Expired

### Method 1: Tạo QR Code với thời gian trong quá khứ (Recommended)

**Bước 1:** Mở file `FE/Audit_System/src/pages/LeadAuditor/AuditAssignment/index.tsx`

**Bước 2:** Tìm dòng 285-294, uncomment test mode:

```typescript
// TEST MODE: Uncomment để test expired QR
const testValidFrom = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
const testValidTo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

const requestPayload: any = {
  // ... other fields
  validFrom: testValidFrom.toISOString(), // Use test date
  validTo: testValidTo.toISOString(),     // Use test date
  // validFrom: validFrom.toISOString(), // Comment out normal dates
  // validTo: validTo.toISOString(),
};
```

**Bước 3:** Issue QR code như bình thường

**Bước 4:** Scan QR code → Sẽ nhận "Expired" message

**Bước 5:** Nhớ comment lại test code sau khi test xong!

---

### Method 2: Sử dụng Database (Direct SQL)

**Bước 1:** Tìm QR code đã được issue trong database

**Bước 2:** Update `ValidTo` thành thời gian trong quá khứ:

```sql
UPDATE AccessGrants
SET ValidTo = DATEADD(day, -1, GETUTCDATE()) -- Set to 1 day ago
WHERE GrantId = 'your-grant-id-here'
```

**Bước 3:** Scan QR code → Sẽ nhận "Expired" message

---

### Method 3: Tạo Audit với thời gian trong quá khứ

**Bước 1:** Tạo một audit với:
- `startDate`: 10 days ago
- `endDate`: 5 days ago

**Bước 2:** Issue QR code cho audit này

**Bước 3:** Frontend sẽ tự động extend 30 days, nhưng bạn có thể modify code để không extend

**Bước 4:** Scan QR code → Sẽ nhận "Expired" message

---

### Method 4: Test với thời gian ngắn (1 phút)

**Bước 1:** Modify `handleIssueQrGrants`:

```typescript
const validFrom = now;
const validTo = new Date(now.getTime() + 1 * 60 * 1000); // 1 minute from now
```

**Bước 2:** Issue QR code

**Bước 3:** Đợi 2 phút

**Bước 4:** Scan QR code → Sẽ nhận "Expired" message

---

## Test Checklist

- [ ] Test QR code expired (ValidTo < now)
- [ ] Test QR code not yet valid (ValidFrom > now)
- [ ] Test QR code valid (now between ValidFrom and ValidTo)
- [ ] Test expired message hiển thị đúng
- [ ] Test expired QR code không thể verify
- [ ] Test expired QR code không mở được checklist

---

## Debug Tips

### Check Console Logs

Khi issue QR code, check console logs:

```javascript
console.log('[AuditAssignment] Issuing QR grant:', {
  validFrom: validFrom.toISOString(),
  validTo: validTo.toISOString(),
  now: now.toISOString(),
  willBeExpired: validTo < now, // Should be true for expired test
});
```

### Check Network Tab

Khi scan QR code, check Network tab:
- Request: `POST /api/AccessGrants/scan`
- Response: `{ isValid: false, reason: "Expired" }`

### Check Database

```sql
SELECT 
    GrantId,
    QrToken,
    ValidFrom,
    ValidTo,
    Status,
    CASE 
        WHEN GETUTCDATE() < ValidFrom THEN 'Not yet valid'
        WHEN GETUTCDATE() > ValidTo THEN 'Expired'
        ELSE 'Valid'
    END AS CurrentStatus
FROM AccessGrants
WHERE GrantId = 'your-grant-id'
```

---

## Common Issues

### Issue 1: QR code không expired dù ValidTo đã qua

**Nguyên nhân:** Timezone mismatch (UTC vs Local)

**Giải pháp:** Đảm bảo cả frontend và backend đều dùng UTC

### Issue 2: QR code expired ngay sau khi issue

**Nguyên nhân:** `audit.endDate` đã trong quá khứ

**Giải pháp:** Frontend đã tự động extend 30 days, nhưng có thể cần check lại logic

### Issue 3: Message không hiển thị đúng

**Nguyên nhân:** Frontend không parse `reason` field đúng

**Giải pháp:** Check `ScanQR.tsx` line 147-148

