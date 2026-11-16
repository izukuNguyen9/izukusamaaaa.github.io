# Hướng dẫn quản lý website Izuku Nguyen

Tài liệu này hướng dẫn quản lý website bằng giao diện GitHub trên điện thoại hoặc máy tính. Không cần cài ứng dụng lập trình hay dùng terminal.

## 1. Các địa chỉ quan trọng

- Website: <https://izukunguyen9.github.io/izukusamaaaa.github.io/>
- Mã nguồn: <https://github.com/izukuNguyen9/izukusamaaaa.github.io>
- Theo dõi build và deploy: <https://github.com/izukuNguyen9/izukusamaaaa.github.io/actions>

Website được GitHub Pages tạo từ nhánh `main`. Mỗi lần bạn lưu thay đổi (commit) vào `main`, GitHub Actions sẽ tự kiểm tra, build và cập nhật trang. Đừng xóa workflow `Deploy to GitHub Pages` trong `.github/workflows/`.

## 2. Thao tác GitHub trên điện thoại

1. Đăng nhập GitHub bằng tài khoản có quyền sửa repo.
2. Mở repo từ liên kết ở trên.
3. Vào thư mục hoặc tệp muốn sửa. Đường dẫn tệp hiển thị dưới dạng các thư mục có thể bấm.
4. Chọn **Add file**:
   - **Create new file** để tạo Markdown hoặc tệp văn bản.
   - **Upload files** để tải ảnh, nhạc và tệp khác lên.
5. Sau khi nhập hoặc tải tệp, chọn **Commit changes**. Có thể để thông điệp mặc định hoặc viết mô tả ngắn.
6. Giữ nhánh đích là `main`, rồi xác nhận commit.
7. Mở **Actions** và chờ workflow `Deploy to GitHub Pages` có dấu xanh **Success**. Sau đó tải lại website. Đôi khi CDN cần thêm vài phút để cập nhật.

Trên màn hình nhỏ, một số nút có thể nằm trong menu `...`. Nếu trình duyệt hiển thị giao diện khó thao tác, bật **Request Desktop Website / Trang web cho máy tính**.

## 3. Đăng bài blog mới

### Bước A: Tải ảnh lên trước

1. Mở thư mục [`src/content/posts`](https://github.com/izukuNguyen9/izukusamaaaa.github.io/tree/main/src/content/posts).
2. Chọn **Add file → Upload files**.
3. Chọn ảnh trên điện thoại, ví dụ `mars-rover.png` và `mars-cover.png`.
4. Chọn **Commit changes** vào `main`.

Tải ảnh trước giúp bài viết không bị hiện ảnh lỗi trong lúc chờ deploy. Nên dùng tên tệp ngắn, chữ thường, không dấu, không dấu cách; ví dụ `mars-cover.png`.

### Bước B: Tạo bài viết

1. Trong cùng thư mục `src/content/posts`, chọn **Add file → Create new file**.
2. Đặt tên tệp, ví dụ `ghi-chep-ve-sao-hoa.md`.
3. Dán mẫu dưới đây rồi thay nội dung:

```md
---
title: "Ghi chép về Sao Hỏa"
published: 2026-11-14
description: "Một vài ghi chép về nghiên cứu Sao Hỏa."
image: ./mars-cover.png
tags: ["Planetary Science", "Mars"]
category: "Research"
draft: false
---

## Tiêu đề phần đầu tiên

Viết nội dung bài ở đây. Có thể dùng **chữ đậm**, *chữ nghiêng*,
danh sách và liên kết.

![Mô tả ảnh Sao Hỏa](./mars-rover.png)
```

4. Chọn **Commit changes** vào `main`.
5. Chờ workflow deploy thành công, sau đó mở trang chủ hoặc mục **Blog**.

### PNG, JPG và các định dạng ảnh khác

**Có, PNG được hỗ trợ** cho ảnh bìa và ảnh trong nội dung. Có thể dùng `.png`, `.jpg`, `.jpeg`, `.webp` hoặc `.avif`. Ảnh nằm cùng thư mục với bài thì dùng đường dẫn tương đối như `./mars-cover.png`. Đường dẫn và tên tệp phải viết đúng chữ hoa/chữ thường.

- PNG phù hợp với hình có nền trong suốt, sơ đồ và ảnh chụp màn hình.
- Ảnh chụp phong cảnh thường nhẹ hơn ở định dạng JPG hoặc WebP.
- Nên nén ảnh trước khi tải lên để trang mở nhanh trên điện thoại.
- Không đặt ảnh ở thư mục máy tính cá nhân rồi dùng đường dẫn kiểu `C:\...`; ảnh phải được tải lên repo.

### Sửa, ẩn nháp hoặc xóa bài

- **Sửa bài:** mở tệp `.md` trong `src/content/posts`, bấm biểu tượng bút chì **Edit**, sửa rồi commit.
- **Lưu nháp:** đặt `draft: true`. Bài nháp không xuất hiện như bài đã xuất bản.
- **Xuất bản:** đặt `draft: false`, kiểm tra `published` là ngày muốn hiển thị rồi commit.
- **Xóa:** mở menu `...` của tệp và chọn **Delete file**, rồi commit. Xóa bài sẽ loại URL đó khỏi site; nếu muốn khôi phục, có thể xem lịch sử commit trên GitHub.

Không xóa `src/content.config.ts` hoặc các tệp trong `src/pages` để xóa một bài cụ thể. Nội dung bài nằm trong `src/content/posts`.

## 4. Đổi tên trang, tiêu đề đầu trang và biểu tượng

Mở [src/config/siteConfig.ts](../src/config/siteConfig.ts). Ba mục thường cần sửa:

```ts
title: "Izuku Nguyen",
subtitle: "Personal blog",
description: "The personal blog of Izuku Nguyen, a planetary scientist and astrobiologist.",
```

- `title`: tên website dùng cho tiêu đề trang và một số thông tin SEO.
- `subtitle`: dòng mô tả ngắn.
- `description`: mô tả dài hơn dùng trong thông tin chia sẻ và tìm kiếm.

Trong cùng tệp, `navbar.title` là chữ trên thanh điều hướng. Nếu muốn tên trang và tên thanh điều hướng giống nhau, hãy sửa cả `title` lẫn `navbar.title`. Sau đó commit và chờ deploy.

Biểu tượng bên trái tiêu đề đang dùng icon `material-symbols:public`. Có thể thay bằng icon khác đã cài trong dự án, hoặc đổi cấu hình `logo` sang ảnh. Favicon được đặt trong `siteConfig.favicon`; ảnh favicon hiện nằm trong `public/favicon/`.

## 5. Đổi ảnh đại diện, giới thiệu và liên kết mạng xã hội

Mở [src/config/profileConfig.ts](../src/config/profileConfig.ts).

### Ảnh đại diện

1. Mở `public/assets/images/` trong repo.
2. Chọn **Add file → Upload files**, tải lên ảnh, ví dụ `izuku-avatar.png`, rồi commit.
3. Trong `profileConfig.ts`, đặt:

```ts
avatar: "/assets/images/izuku-avatar.png",
```

Nếu chưa đặt `avatar`, sidebar sẽ hiện chữ viết tắt tên thay vì ảnh.

### Tên và giới thiệu

Sửa các giá trị `name` và `bio` trong cùng tệp:

```ts
name: "Izuku Nguyen",
bio: "I'm a planetary scientist and astrobiologist.",
```

### Mạng xã hội

Thêm mục vào mảng `links`. Ví dụ:

```ts
{
  name: "GitHub",
  icon: "fa7-brands:github",
  url: "https://github.com/TEN_TAI_KHOAN",
  showName: true,
},
```

Thay `TEN_TAI_KHOAN` bằng tên tài khoản của bạn. Mỗi liên kết cần dấu phẩy sau `}` nếu có mục tiếp theo. Chỉ đưa thông tin bạn muốn công khai; không đưa mật khẩu, token, địa chỉ riêng hoặc dữ liệu cá nhân nhạy cảm vào website.

Nội dung trang **About** nằm ở `src/content/spec/about.md`. Mở tệp này, sửa văn bản Markdown theo thông tin bạn muốn giới thiệu, rồi commit.

## 6. Thêm ảnh vào trang Gallery

Gallery đang được bật nhưng hiện chưa có album mẫu. Để thêm album:

1. Tạo thư mục ảnh bằng giao diện GitHub: vào **Add file → Create new file**, nhập đường dẫn như `public/gallery/mars-trip/.gitkeep`, rồi commit. Tệp `.gitkeep` chỉ để GitHub lưu thư mục; có thể giữ lại.
2. Mở `public/gallery/mars-trip/`, chọn **Add file → Upload files**, tải ảnh lên và commit. Có thể tải lên ảnh `cover.png` cùng các ảnh khác.
3. Mở [src/config/galleryConfig.ts](../src/config/galleryConfig.ts), thêm một mục trong `albums`:

```ts
{
  id: "mars-trip",
  name: "Chuyến đi Sao Hỏa",
  description: "Ảnh và ghi chú của chuyến đi.",
  location: "Tên địa điểm",
  date: "2026-11-14",
  tags: ["Mars", "Research"],
},
```

`id` phải giống tên thư mục `public/gallery/mars-trip/`. Album dùng `cover.png` làm ảnh bìa tự động nếu tệp đó có trong thư mục. Cuối cùng commit cấu hình và chờ deploy.

Các trang tùy chọn như VNDB, Bangumi, Projects và Friends được bật/tắt trong `pages` ở `src/config/siteConfig.ts`. Đặt giá trị `true` để bật hoặc `false` để tắt. Chỉ bật trang khi đã chuẩn bị nội dung và cấu hình tương ứng.

### Mục Earth (NASA EPIC và Sentinel-2)

Mục **Earth** có hai nguồn ảnh:

- **NASA EPIC:** ảnh JPEG lớn hơn dùng làm thumbnail; chọn ảnh để mở PNG độ phân giải cao trong trình xem.
- **Sentinel-2:** 15 cảnh vệ tinh Level-2A mới nhất trên toàn cầu trong 90 ngày gần nhất. GitHub Actions lấy tối đa 100 kết quả, sắp xếp theo thời gian chụp giảm dần và hiển thị 15 cảnh đầu tiên. Mỗi ảnh ghi ngày chụp, độ mây và mã cảnh; ảnh nhiều mây vẫn được hiển thị vì danh sách ưu tiên cảnh mới nhất, không lọc theo độ mây. Thumbnail 1280 px; chọn ảnh để mở bản xem trước 2048 px.

Không cần API key. Ảnh gallery tải lười; chọn ảnh để xem ảnh lớn ngay trên trang, và có liên kết mở ảnh lớn trong tab mới. Dữ liệu Sentinel được làm mới mỗi ngày bởi GitHub Actions từ [Earth Search STAC API](https://earth-search.aws.element84.com/); ảnh Sentinel dùng [TiTiler](https://titiler.xyz/). Menu được cấu hình trong `src/config/navBarConfig.ts`; trang và giao diện ở `src/pages/earth.astro`, `src/components/pages/EarthGallery.svelte` và `src/components/pages/SentinelGallery.svelte`.

### Mục Mars (ảnh camera mới nhất từ Curiosity và Perseverance)

Mục **Mars** lấy ảnh camera theo từng sol trực tiếp từ các API của [NASA Mars](https://mars.nasa.gov/), không cần API key và không chờ dữ liệu tạo theo lịch:

- **Curiosity (MSL):** sol mới nhất lấy từ `raw_image_items/msl/latest/`; ảnh lấy theo sol, phân trang tối đa 200 kết quả/lần.
- **Perseverance (M20):** sol mới nhất lấy từ nguồn ảnh mới nhất; ảnh lấy theo sol, cùng các URL ảnh nhỏ và ảnh gốc.
- Trường **Sol** chỉ nhận giá trị từ 0 đến sol mới nhất mà NASA trả về. Trường **Camera** được tạo từ những ảnh nhận được của rover/sol đang chọn, không dùng danh sách camera cố định.
- Trang hiển thị 50 ảnh mỗi đợt; ảnh dùng tải lười. Với Curiosity, trang ưu tiên ảnh không phải thumbnail khi NASA đã trả ảnh đó; với Perseverance, ảnh xem trước dùng bản lớn (1200 px). Nhấn ảnh để phóng trong trình xem ngay trên trang; liên kết bên dưới mở ảnh NASA tương ứng ở tab mới. Kích hoạt **Load 50 more** để xem tiếp. Nếu sol không có ảnh, trang báo rõ và cho phép chọn sol khác.

Các API được dùng là [MSL raw images](https://mars.nasa.gov/api/v1/raw_image_items/), [MSL latest sol](https://mars.nasa.gov/api/v1/raw_image_items/msl/latest/) và [M20 raw images](https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json). Menu được cấu hình trong `src/config/navBarConfig.ts`; giao diện nằm ở `src/pages/mars.astro` và `src/components/pages/MarsGallery.svelte`.

### Mục Cassini (ảnh xem trước từ PDS Rings OPUS)

Mục **Cassini** tra cứu ảnh của Cassini Imaging Science Subsystem theo ngày UTC qua [PDS Rings OPUS](https://opus.pds-rings.seti.org/opus/). Trang dùng bộ lọc `instrument=Cassini ISS` và `COISSfilter=CLEAR`; `CLEAR` là giá trị đúng của bộ lọc này, không thay bằng `CL1` hoặc `CL2`.

- Ngày được giới hạn theo khoảng OPUS trả về (hiện từ 1999-01-09 đến 2017-09-14). Mỗi ngày được truy vấn theo cửa sổ UTC nửa mở `[ngày, ngày kế tiếp)`.
- Số ảnh của ngày hiện cạnh nút **Show date**. Ngày không có ảnh hiện thông báo cụ thể thay vì lưới trống.
- Mỗi lần tải tối đa 24 ảnh xem trước; chọn **Load 24 more** để phân trang tiếp. Ảnh lớn được ghép với thumbnail theo `opus_id`.
- ID `co-iss-n...` là Narrow Angle, còn `co-iss-w...` là Wide Angle. Ảnh lớn mở trong trình xem ngay trên trang; có thể chọn **Open full-size image in new tab** để mở riêng.
- Đây là ảnh xem trước PNG/JPG và metadata để duyệt, không phải dữ liệu khoa học của thiết bị.

Trang và giao diện nằm ở `src/pages/cassini.astro` và `src/components/pages/CassiniGallery.svelte`; mục menu được khai báo trong `src/config/navBarConfig.ts`.

## 7. Thay đổi nhạc

Trình phát hiện dùng playlist cục bộ, cấu hình tại [src/config/musicConfig.ts](../src/config/musicConfig.ts).

### Cách đơn giản: dùng tệp nhạc trong repo

1. Tạo thư mục nhạc bằng **Add file → Create new file**, nhập `public/assets/music/ten-bai/.gitkeep`, commit; hoặc dùng thư mục `public/assets/music/` đã có.
2. Mở thư mục `public/assets/music/ten-bai/` (hoặc `public/assets/music/`), chọn **Add file → Upload files**, tải tệp MP3 và ảnh bìa lên, rồi commit. Ví dụ: `song.mp3`, `cover.jpg`.
3. Trong `musicConfig.ts`, giữ `mode: "local"` và thêm/thay bài trong `local.playlist`:

```ts
{
  name: "Tên bài hát",
  artist: "Tên nghệ sĩ",
  url: "/assets/music/ten-bai/song.mp3",
  cover: "/assets/music/ten-bai/cover.jpg",
  lrc: "",
},
```

Đường dẫn `url` và `cover` bắt đầu từ `public/`, nhưng trong cấu hình **không** viết chữ `public`. Nhiều bài được đặt trong mảng `playlist`, mỗi bài ngăn cách bằng dấu phẩy.

Trình duyệt điện thoại thường không cho website tự phát nhạc khi vừa mở trang; người đọc cần chạm nút phát. Chỉ tải lên nhạc bạn có quyền sử dụng và chia sẻ.

### Ẩn trình phát hoặc dùng playlist từ dịch vụ ngoài

- Ẩn nút trên thanh điều hướng: `showInNavbar: false`.
- Ẩn widget trong sidebar: `showInSidebar: false`.
- Để dùng Meting thay playlist local: đặt `mode: "meting"` và cập nhật `meting.server`, `meting.type`, `meting.id`. API bên ngoài có thể ngừng hoạt động hoặc giới hạn truy cập; playlist local ổn định hơn nhưng làm repo lớn hơn.

## 8. Chỉnh menu và sidebar

- Menu trên thanh điều hướng nằm trong [src/config/navBarConfig.ts](../src/config/navBarConfig.ts). Mỗi mục có tên `name`, địa chỉ `url` và icon `icon`.
- Các mục Gallery và About đã có sẵn. Mục Blog dẫn thẳng đến `/archive/`.
- Bố cục và widget sidebar nằm trong [src/config/sidebarConfig.ts](../src/config/sidebarConfig.ts). Có thể bật/tắt widget bằng `enable: true` hoặc `false`.
- Cài đặt bật/tắt các trang như Gallery nằm trong `siteConfig.pages` ở `src/config/siteConfig.ts`.

Nếu thêm đường dẫn menu nội bộ, dùng URL có dấu `/` đầu/cuối, ví dụ `/gallery/`. Không cần gõ tên miền GitHub Pages vào từng link.

## 9. Kiểm tra khi thay đổi không xuất hiện

1. Mở tab **Actions** của repo.
2. Mở lần chạy mới nhất trên nhánh `main`.
3. Nếu có dấu xanh **Success**, mở lại website. Nếu chưa thấy thay đổi, tải lại trang hoặc thử tab ẩn danh; bộ nhớ đệm có thể giữ phiên bản cũ một lúc.
4. Nếu workflow đỏ **Failure**, mở bước **Build site** để đọc lỗi. Các nguyên nhân thường gặp:
   - YAML frontmatter thiếu dấu `---`, ngày không hợp lệ hoặc sai dấu nháy.
   - Tên/đường dẫn ảnh sai chữ hoa-thường.
   - Thiếu dấu phẩy hoặc ngoặc trong tệp cấu hình TypeScript.
   - Bài viết trỏ tới ảnh chưa được tải lên repo.
5. Sửa tệp báo lỗi trên GitHub rồi commit lại. Mỗi commit mới sẽ tự chạy deploy lại.

## 10. Cách quản lý an toàn

- Thay đổi từng việc một và commit với mô tả dễ hiểu, ví dụ `Add Mars research post`.
- Kiểm tra lại đường dẫn ảnh, nhạc và nội dung trước khi commit; repo và website hiện là công khai.
- Không tải dữ liệu riêng tư, bí mật nghiên cứu, mật khẩu, API key hoặc token lên repo.
- Giữ nguyên thư mục `.github/workflows/` để tự động deploy tiếp tục hoạt động.
- Bài viết, ảnh và cấu hình đều nằm trong lịch sử GitHub; trước khi xóa hoặc sửa lớn, có thể xem lại **History** của tệp.
