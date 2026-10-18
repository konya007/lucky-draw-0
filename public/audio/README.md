# Thêm âm thanh thật

Mọi âm thanh trong game đều đang được **tổng hợp bằng code** (Web Audio), nên chưa có file nào game vẫn có tiếng. Muốn thay âm nào bằng file thật:

1. Chép file vào thư mục này (`public/audio/`), **đặt tên file đúng bằng tên âm** trong bảng bên dưới, ví dụ `hitBall.mp3`, `music.mp3`, `applause.ogg`. Định dạng: `.mp3`, `.ogg`, `.wav`, `.m4a`, `.aac`, `.webm`, `.flac`.
2. Tải lại trang. Xong. Game tự nhận mọi file có tên khớp (khi chạy `npm run dev`, chép file mới vào là trang tự tải lại). Bản build (`npm run build`) lấy danh sách file lúc build, nên thêm file thì build lại.

Hiệu ứng ngắn nên dưới 1 giây và cắt sát đầu file (không để khoảng lặng ở đầu, nếu không tiếng sẽ phát trễ). Âm nào không có file thì vẫn dùng tiếng tổng hợp. File hỏng hoặc không đọc được sẽ báo cảnh báo trong Console (F12) kèm tên file.

**Tùy chọn:** muốn dùng file có tên khác, khai báo trong `manifest.json` (mục này được ưu tiên hơn file cùng tên):

```json
{ "files": { "hitBall": "ball-hit-v2.mp3", "music": "gala-theme.ogg" } }
```

Mỗi lần phát, game tự đổi cao độ ±8% và tiếng trong lồng phát theo vị trí 3D, nên một file cũng nghe không bị lặp đơn điệu.

## Danh sách tên âm

### Hiệu ứng (phát một lần)

| Tên | Khi nào phát | Gợi ý |
|---|---|---|
| `hitBall` | Quả cầu va nhau (trong lồng, máng, khay) | Tiếng "cạch" nhựa/sứ rất ngắn, ~50–150 ms |
| `hitBrass` | Quả cầu va vào thanh đồng của lồng | Tiếng "keng" kim loại nhỏ, ~100–300 ms |
| `lidOpen` | Nắp lồng mở | Bản lề kim loại |
| `lid` | Nắp lồng đóng | Tiếng "cạch" đồng nặng |
| `gate` | Cánh cửa ra bật mở | |
| `roll` | Quả cầu lăn xuống máng | ~1 s |
| `whoosh` | Quả cầu bay vào lồng, vé bay về camera | |
| `ballClose` | Quả cầu "khép vỏ" lúc đóng gói | "Tách" nhỏ |
| `shellOpen` | Quả cầu tách đôi | |
| `cymbal` | Lúc mở quả cầu | Cymbal crash, 2–3 s |
| `confetti` | Pháo giấy | |
| `paper` | Vé mở gấp, cất vé | Tiếng giấy sột soạt |
| `chime` | Nhân vật cười, công bố | |
| `applause` | Khán giả vỗ tay chúc mừng (lúc nhân vật giơ vé và lúc vé hiện trước camera) | Tiếng vỗ tay + reo hò, 3–4 s |
| `curtain` | Rèm mở/khép | Vải nhung kéo, ~3 s |
| `crowd` | Khán phòng xì xào lúc mở rèm | ~3 s |
| `lightOn` | Đèn sân khấu bật "cộp" | |
| `footstep` | Mỗi bước chân của nhân vật | Giày trên sàn gỗ, rất ngắn |
| `rustle` | Nhân vật cúi chào / cúi nhặt | Vải sột soạt |
| `clap` | Nhân vật vỗ tay | Một tiếng vỗ |
| `tick` | Rê chuột lên đạo cụ, nút | Click rất nhỏ |
| `ratchet` | Xoay núm chọn chất lượng đồ họa | |
| `lock` | Bấm vào thứ đang bị khóa (vd. cần quay lúc lồng đang quay) | |
| `voiceStart` | Nhân vật chào ("Bắt đầu nào!") | **Chỉ có tiếng khi có file** · có thể tách theo nhân vật, xem bên dưới |
| `voiceCongrats` | Lúc hiện vé ("Chúc mừng!") | **Chỉ có tiếng khi có file** · có thể tách theo nhân vật, xem bên dưới |

### Âm nền (phát lặp liên tục)

| Tên | Vai trò | Gợi ý |
|---|---|---|
| `music` | Nhạc nền | Cello/piano chậm, loop liền mạch (đầu và cuối khớp nhau) |
| `room` | Tiếng phòng hát lớn (room tone) | Rất nhỏ, 5–10 s loop |
| `drumroll` | Trống dồn lúc lồng chậm lại và lúc trình diện quả cầu | Loop 1–2 s, game tự tăng/giảm âm lượng |

## Giọng nói riêng cho từng nhân vật

Mỗi nhân vật có thể có câu thoại riêng. Thêm hậu tố `_<mã nhân vật>` vào tên file:

| Nhân vật | Mã | Câu chào | Câu chúc mừng |
|---|---|---|---|
| Cô gái anime | `anime` | `voiceStart_anime.mp3` | `voiceCongrats_anime.mp3` |
| MrBeast | `mrbeast` | `voiceStart_mrbeast.mp3` | `voiceCongrats_mrbeast.mp3` |

Thứ tự game tìm: file riêng của nhân vật đang chọn → file chung (`voiceStart.mp3`) → tiếng tổng hợp. Giọng nói phát đúng cao độ gốc, không bị đổi pitch ngẫu nhiên như hiệu ứng.

## Âm lượng

Chỉnh trong game bằng nút ⚙ (góc dưới phải) hoặc bấm vào chiếc radio bên trái sân khấu: Tổng, Nhạc, Hiệu ứng, Tắt tiếng.
