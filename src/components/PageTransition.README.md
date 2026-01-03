# PageTransition Component

Component chung để áp dụng animation cho tất cả các pages trong ứng dụng.

## Cách sử dụng

### 1. Tự động qua MainLayout

`MainLayout` đã tự động wrap tất cả children với `PageTransition`, nên tất cả pages đã có animation fadeIn mặc định.

### 2. Sử dụng PageSection cho các phần tử con

Sử dụng `PageSection` để tạo animation cho các section trong page với delay khác nhau:

```tsx
import { PageSection } from '../../../components';

return (
  <MainLayout>
    {/* Header - Slide từ trái, không delay */}
    <PageSection animation="slideInLeft" delay={0} className="mb-6">
      <div className="...">Header Content</div>
    </PageSection>

    {/* Stats Cards - Slide từ phải, delay 100ms */}
    <PageSection animation="slideInRight" delay={1} className="mb-6">
      <div className="grid...">Stats Cards</div>
    </PageSection>

    {/* Table - Slide lên, delay 200ms */}
    <PageSection animation="slideUp" delay={2} className="...">
      <table>...</table>
    </PageSection>
  </MainLayout>
);
```

## Props

### PageTransition

| Prop | Type | Default | Mô tả |
|------|------|---------|-------|
| `children` | `ReactNode` | - | Nội dung cần animate |
| `className` | `string` | `''` | CSS classes bổ sung |
| `animation` | `'fadeIn' \| 'slideUp' \| 'slideInLeft' \| 'slideInRight'` | `'fadeIn'` | Loại animation |
| `delay` | `number` | `0` | Delay tính bằng milliseconds |
| `animate` | `boolean` | `true` | Bật/tắt animation |

### PageSection

| Prop | Type | Default | Mô tả |
|------|------|---------|-------|
| `children` | `ReactNode` | - | Nội dung cần animate |
| `className` | `string` | `''` | CSS classes bổ sung |
| `animation` | `'fadeIn' \| 'slideUp' \| 'slideInLeft' \| 'slideInRight'` | `'slideUp'` | Loại animation |
| `delay` | `0 \| 1 \| 2 \| 3 \| 4` | `0` | Delay multiplier (0=0ms, 1=100ms, 2=200ms, ...) |

## Các loại Animation

1. **fadeIn** - Mờ dần xuất hiện (0.4s)
2. **slideUp** - Trượt lên từ dưới (0.5s)
3. **slideInLeft** - Trượt từ trái (0.6s)
4. **slideInRight** - Trượt từ phải (0.6s)

## Ví dụ đầy đủ

```tsx
import { MainLayout } from '../../../layouts';
import { PageSection } from '../../../components';

const MyPage = () => {
  return (
    <MainLayout>
      {/* Header section */}
      <PageSection animation="slideInLeft" delay={0} className="mb-6">
        <div className="bg-white p-6 rounded-xl">
          <h1>Page Title</h1>
        </div>
      </PageSection>

      {/* Content section */}
      <PageSection animation="slideUp" delay={1} className="mb-6">
        <div className="bg-white p-6 rounded-xl">
          <p>Content here</p>
        </div>
      </PageSection>

      {/* Table section */}
      <PageSection animation="slideUp" delay={2}>
        <div className="bg-white p-6 rounded-xl">
          <table>...</table>
        </div>
      </PageSection>
    </MainLayout>
  );
};
```

## Migration từ code cũ

Thay vì:
```tsx
<div className="animate-slideInLeft">...</div>
<div className="animate-slideUp animate-delay-200">...</div>
```

Sử dụng:
```tsx
<PageSection animation="slideInLeft" delay={0}>...</PageSection>
<PageSection animation="slideUp" delay={2}>...</PageSection>
```

## Lưu ý

- `MainLayout` đã tự động wrap với `PageTransition`, không cần wrap thêm
- Sử dụng `PageSection` cho các phần tử con để tạo hiệu ứng staggered
- Delay được tính bằng multiplier: 0=0ms, 1=100ms, 2=200ms, 3=300ms, 4=400ms

