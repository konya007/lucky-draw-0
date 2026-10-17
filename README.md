# Grand Draw

Web game bốc thăm 3D kiểu sân khấu gala: lồng cầu đồng, rèm nhung, đèn spotlight, và một cô dẫn chương trình (nhân vật anime) tự quay số. Màn soạn danh sách là UI 2D duy nhất. Mọi thao tác khác đi qua vật thể 3D: cần quay, quả cầu, vé, radio, bảng kẹp giấy, hộp vé.

Stack: Vite, React 18, TypeScript (strict), React Three Fiber, drei, Rapier (chỉ cho quả cầu lăn xuống máng), postprocessing, GSAP, Zustand, Tailwind v4, Web Audio.

## Chạy

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # bản production vào dist/
npm run preview
```

Tham số URL:

| URL | Tác dụng |
|---|---|
| `?debug` | bật overlay `r3f-perf` (FPS, draw call, tam giác) |
| `?quality=low\|medium\|high\|ultra\|auto` | ép preset đồ họa (bỏ qua lựa chọn đã lưu) |

Phím tắt (ẩn): `Space` quay hoặc tiếp tục, `Enter` mở quả cầu, `Esc` đóng vé, bảng cài đặt hoặc lịch sử. Bấm vào chỗ trống trong lúc đang diễn sẽ chạy nhanh ×3, bấm đúp sẽ chạy nhanh ×8.

## Deploy lên GitHub Pages

Workflow [`.github/workflows/deploy-gh-pages.yml`](.github/workflows/deploy-gh-pages.yml) chạy mỗi khi push lên `main` (kèm nút **Run workflow** trong tab Actions): cài dependency bằng pnpm, chạy `pnpm build` rồi đẩy nội dung `dist/` sang nhánh `gh-pages`.

Cài một lần trong repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, chọn branch `gh-pages`, thư mục `/ (root)`. Đổi branch nguồn thì sửa `on.push.branches` trong workflow.

Khi build cho Pages, workflow tự đặt `VITE_BASE_PATH` (`vite.config.ts` đọc biến này):

| Loại repo | URL | base |
|---|---|---|
| `<user>/<repo>` | `https://<user>.github.io/<repo>/` | `/<repo>/` |
| `<user>/<user>.github.io` | `https://<user>.github.io/` | `/` |

Vì site có thể nằm dưới một sub-path, mọi file trong `public/` phải lấy đường dẫn qua `assetUrl()` (`src/lib/assetUrl.ts`) chứ đừng viết `'/host.glb'` trực tiếp — đường dẫn tuyệt đối kiểu đó sẽ 404. `pnpm build` ở máy vẫn dùng base `/` như cũ.

## Cách chơi

0. Mở web sẽ thấy màn tải, rồi màn chính với 2 nút **Bắt đầu quay** và **Cài đặt**. Hàng nút bên dưới có **Người đã trúng** (xem các vé đã trúng) và **Xóa kết quả** (bấm 2 lần để xác nhận). Bấm **Bắt đầu quay** để mở màn soạn danh sách.
1. Dán danh sách, mỗi dòng một mục. Có thể dùng `Tên | Giải | Ghi chú`, Tab hoặc CSV. Bấm **Tiến hành quay số**.
2. Cầu được đóng gói, rèm mở, cô dẫn chương trình bước ra, các quả cầu bay vào lồng.
3. Chạm vào **cần quay** (thứ đang phát sáng): bấm một lần thì cô tự quay, còn kéo vòng tròn thì lực quay theo tay bạn.
4. Quả cầu rơi ra khay, cô nhặt lên. Chạm vào quả cầu (hoặc giữ để "bẻ") để mở. Vé hiện ra.
5. Chạm vào vé (hoặc vuốt lên) để cất vào hộp và quay lượt tiếp. Bảng kẹp giấy bên phải mở lại danh sách, radio bên trái mở cài đặt, hộp vé trên bàn mở lịch sử (xuất CSV hoặc sao chép).

Kết quả được chọn bằng `crypto.getRandomValues` đúng lúc quả cầu rời lồng. Quả cầu chỉ mang tính tượng trưng, tối đa 200 quả. Danh sách, tiêu đề, lịch sử và các tùy chọn bên dưới được lưu trong `localStorage`.

### Màn soạn danh sách

- **Thao tác danh sách ▾**: gom mọi công cụ vào một menu: thêm dữ liệu mẫu (30 người có MSSV và giải), nhập file .txt/.csv, xáo trộn, sắp xếp A→Z, đảo ngược, xóa dòng trùng, xóa dòng trống, xóa hết (bấm 2 lần).
- **Che mã số**: chế độ hiển thị, dữ liệu gốc không bị sửa. Mọi dãy từ 6 chữ số trở lên (MSSV, số điện thoại…) bị che ⌈n/3⌉ số ở giữa, ví dụ 10 số thì che 4 số: `2251052127` → `225xxxx127`. Áp dụng cho danh sách xem trước, thẻ bay vào quả cầu, vé trúng thưởng và sổ vé. File CSV xuất ra vẫn giữ số đầy đủ.
- **Số người trúng**: để trống thì quay đến khi hết danh sách. Nhập số (ví dụ 5) thì khi đủ 5 người trúng trong buổi quay, sân khấu tự hạ màn sau khi cất vé cuối.
- **Loại người đã trúng**: bật thì người đã trúng không được quay lại, và lồng không bổ sung quả mới (lồng vơi dần).

### Hạ màn sớm

Rê chuột vào góc dưới phải, bấm **Hạ màn** rồi bấm lần nữa để xác nhận. Nếu đang rảnh thì hạ màn ngay. Nếu vé đang hiện thì cô cất vé trước rồi mới hạ màn. Nếu đang quay thì xong lượt quay này rồi mới hạ màn.

## Cấu trúc

```
src/
  app/        App.tsx (shell, phím tắt, pause khi ẩn tab), Scene.tsx (Canvas, lazy-load)
  store/      useGameStore (state machine + pool + lịch sử), useSettingsStore (âm lượng, đồ họa)
  director/   Director.ts      timeline trung tâm cho từng phase (camera + đèn + nhân vật + âm thanh + VFX)
              CameraDirector   rig 3 lớp, damp, trauma shake, handheld, FOV kick, rack focus, parallax
              cameraShots.ts   các shot khai báo dạng dữ liệu
              LightDirector.ts light cue dạng dữ liệu
              spin.ts          đường cong quay (luôn dừng ở bội số 2π: nắp lên trên, cửa ra phía trước)
              channels.ts      các giá trị animate dùng chung (GSAP ghi, component đọc mỗi frame)
  scene/      Stage, Curtain (shader nhung), Lights, Effects, layout.ts (mọi tọa độ sân khấu)
              Cage/   lồng, cánh gạt, cần quay (kéo), nắp, cửa ra + máng + khay
              Balls/  ballSystem (bộ giải vật lý riêng cho lồng + 1 body Rapier cho máng), BallPool (1 InstancedMesh), HeroBall
              Host/   Host.tsx, useHostAnimator.ts (animator thủ tục + IK), hostIK.ts, hostPaths.ts, HostRig.md
              Props/  SettingsRadio (bảng điều khiển 3D), ListClipboard, Ticket (vé CanvasTexture), TicketBox
              VFX/    Confetti, BallTrail, DustMotes, FloorFog, LightCone
  quality/    qualityPresets.ts, useAutoQuality.ts
  ui/         HomeScreen, EntryModal, PackingOverlay, HistoryOverlay, SettingsPanel, SpeedToggle (góc dưới phải), StageText, LoadingBar
  audio/      audioManager.ts (tổng hợp bằng Web Audio), sfx.ts
  lib/        parseEntries, random (crypto), shuffle, assetUrl (đường dẫn asset theo base khi deploy)
```

## Nhân vật

`public/3d_anime_character_girl_for_blender.glb` (5,3 MB, toàn thân) được nén thành `public/host.glb` (0,63 MB, Meshopt + WebP) bằng lệnh:

```bash
npm run compress-host
```

Kết quả kiểm tra rig nằm trong `src/scene/Host/HostRig.md`. Tóm tắt:

- File **không có animation clip nào**, nên chuyển động được dựng thủ tục (procedural): đi kiểu **chân sáo** (mỗi bước có một nhịp nhún, bàn chân bám sàn bằng IK hai xương), thở, cúi chào, vẫy tay, nhìn theo mục tiêu (đầu xoay có gia tốc và giảm tốc mượt).
- Váy có 12 dải xương. Dải nào nằm trước hoặc sau đùi sẽ bị đùi đẩy theo, nên chân không xuyên qua váy.
- Model không có blendshape khuôn mặt, và bone mắt chỉ di chuyển con ngươi. Vì vậy cảm xúc được thể hiện bằng đầu và thân: vui thì nghiêng đầu và nhún người, ngạc nhiên thì giật nhẹ ra sau. Gọi qua `host.express('happy' | 'surprised' | 'neutral')`.
- Tay dùng IK hai xương. Animator đo trực tiếp trên mesh (tâm đầu, độ dài tay áo) để bàn tay chạm đúng núm cần, quả cầu và mép phiếu.
- Model gốc là unlit. Code chuyển material sang toon (3 bậc) + rim light.

### Thêm animation thật (tùy chọn)

1. Trong Blender: import GLB, tải clip từ Mixamo (Idle, Walking, Waving, Bow, Pick Up), rồi retarget sang rig này (addon Rokoko hoặc Auto-Rig Pro).
2. Đặt tên action đúng `Idle`, `Walking`, `Waving`, `Bow`, `PickUp`. Export **chỉ phần armature và animation** ra `public/host-animations.glb`.
3. Sửa `public/host-manifest.json` thành `"animations": "/host-animations.glb"`.

Khi có `Idle` và `Walking`, clip sẽ điều khiển thân người. IK tay và hướng nhìn của đầu vẫn chạy chồng lên trên.

## Cấu hình sân khấu (`public/stage-config.json`)

Sửa file này rồi tải lại trang (không cần build lại).

- `backstage`: ảnh hậu trường phía sau sân khấu. Chép ảnh vào `public/` (ví dụ `public/backstage.jpg`), đặt `"image": "/backstage.jpg"`. Tham số: `width`, `height`, `position` [x, y, z], `brightness` (độ tối, 0–1), `tint`, `fit` (`cover` = cắt cho vừa, `stretch` = kéo giãn). Ảnh hiển thị bằng material không chiếu sáng nên gần như không tốn hiệu năng.
- `propLights`: ánh đèn từ giàn chiếu xuống đồ vật (luồng sáng + vệt sáng trên sàn). Đây là đèn giả lập nên không thêm nguồn sáng thật. Mỗi mục có `target` (điểm sáng trên sàn), `from` (vị trí đèn) và `radius`.

## Chuyển động lồng cầu

Lồng quay theo phương trình vật lý: quán tính, ma sát ổ trục và một quả nặng lệch tâm ở cửa ra. Các quả cầu trong lồng dùng một bộ giải vật lý viết riêng (`src/scene/Balls/ballSystem.ts`): giữ cầu trong mặt cầu, ma sát với thành lồng đang quay, 4 cánh gạt hất cầu lên, va chạm cầu–cầu bằng lưới băm không gian. 200 quả tốn khoảng 1 ms mỗi khung hình. Khi lồng đứng yên và cầu đã nằm yên, bộ giải tự ngủ. Khi gần dừng, lồng đung đưa ngược lại 2–3 lần như con lắc rồi mới nằm yên (nắp hướng lên, cửa ra ở phía trước). Tham số nằm trong `src/director/spin.ts` (`G`, `c`, `mu`). Tiếng va chạm lấy từ các cú va thật mạnh nhất trong mỗi khung hình (tối đa ~25 tiếng/giây), nên luôn khớp với hình.

## Cài đặt

Bấm vào chiếc radio bên trái sân khấu, nút **Cài đặt** ở màn chính, hoặc rê chuột vào góc dưới phải để hiện các nút Hạ màn / ⚙ / ×2:

- Âm thanh: Tổng, Nhạc nền, Hiệu ứng, Tắt tiếng.
- Sân khấu & nhạc nền: **tải lên ảnh nền** (thay ảnh hậu trường) và **tải lên nhạc nền** (thay nhạc mặc định). File được lưu trong IndexedDB của trình duyệt nên tải lại trang vẫn còn. Tải file mới sẽ ghi đè file cũ, nút “Xóa” để quay về mặc định.
- Đồ họa: Tự động / Thấp / TB / Cao / Ultra. Mục **Tùy chỉnh chi tiết** cho phép chỉnh riêng từng mục trên nền mức đã chọn: độ phân giải, bóng đổ, bóng thật của nhân vật, sàn phản chiếu, luồng sáng, bụi, khói sân khấu (các cụm khói lơ lửng, ăn theo ánh đèn), khói sàn, bloom, DOF, viền màu, hạt phim, khử răng cưa, nhòe chuyển động, lượng pháo giấy. Nút “Đặt lại theo mức đồ họa” để quay về mặc định.
- Tốc độ ×2 cho toàn bộ màn diễn (phím F).

## Thay âm thanh

Mọi âm thanh đều được tổng hợp bằng Web Audio, nên dự án chạy được mà không cần file nào. Để thay một âm:

1. Xem hướng dẫn đầy đủ và danh sách tên âm trong `public/audio/README.md`. Tóm tắt: chép file vào `public/audio/`, ví dụ `cymbal.mp3`.
2. Khai báo trong `public/audio/manifest.json`:

```json
{ "files": { "cymbal": "cymbal.mp3", "music": "nhac-nen.mp3", "voiceCongrats": "chuc-mung.mp3" } }
```

Danh sách tên nằm trong `src/audio/sfx.ts`. Các loop (`music`, `room`, `drumroll`) cũng thay được. Câu thoại `voiceStart` / `voiceCongrats` chỉ phát ra giọng thật khi có file.

## Thay màu

Bảng màu nằm ở `COLORS` và `BALL_COLORS` trong `src/scene/layout.ts`, token UI nằm ở `@theme` trong `src/index.css`. Cường độ và vị trí đèn ở `FIXTURES` (`src/scene/Lights.tsx`). Light cue ở `src/director/LightDirector.ts`. Shot camera ở `src/director/cameraShots.ts`.

## Hiệu năng

- Preset **Tự động** bắt đầu ở Trung bình. `PerformanceMonitor` theo dõi FPS (dưới 50 thì hạ, trên 58 thì nâng; dao động 3 lần thì khóa nấc). Việc đổi preset chỉ áp dụng ở phase an toàn, không bao giờ giữa lúc đang quay.
- 200 quả cầu được vẽ bằng 1 InstancedMesh. Lồng là một geometry gộp. Vật lý trong lồng dùng bộ giải riêng (khoảng 1 ms/khung hình cho 200 quả), không dùng engine vật lý tổng quát.
- Không dùng PointLight hay RectAreaLight nào. Hiệu ứng sáng của quả cầu là sprite 2D và hạt (particle). Đèn đạo cụ là emissive.
- Shadow map chỉ render lại khi có chuyển động (tối đa 30 Hz). Khi ẩn tab hoặc cửa sổ mất focus thì game tạm dừng (render, vật lý, tween, âm thanh).
- Trong lúc mở màn soạn danh sách, sân khấu phía sau render ở DPR 0,5.
- Đo trên máy dev ở 1280×720 với 200 quả cầu: Trung bình khoảng 118 FPS lúc idle. Dùng `?debug` để xem chi tiết.
