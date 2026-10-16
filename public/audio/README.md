# Thêm âm thanh thật

Mọi âm thanh trong game đều đang được **tổng hợp bằng code** (Web Audio), nên chưa có file nào game vẫn có tiếng. Muốn thay âm nào bằng file thật, làm 2 bước:

1. Chép file vào thư mục này (`public/audio/`). Nên dùng `.mp3` hoặc `.ogg`, 44.1 kHz. Hiệu ứng ngắn nên dưới 1 giây và cắt sát đầu file (không để khoảng lặng ở đầu, nếu không tiếng sẽ phát trễ).
2. Khai báo file trong `manifest.json` theo dạng `"tên âm": "tên file"`:

```json
{
  "files": {
    "hitBall": "ball-hit.mp3",
    "cymbal": "cymbal.mp3",
    "music": "nhac-nen.mp3"
  }
}
```

Tải lại trang là xong (không cần build lại). Âm nào không khai báo thì vẫn dùng tiếng tổng hợp.

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
| `voiceStart` | Nhân vật chào ("Bắt đầu nào!") | **Chỉ có tiếng khi có file** |
| `voiceCongrats` | Lúc hiện vé ("Chúc mừng!") | **Chỉ có tiếng khi có file** |

### Âm nền (phát lặp liên tục)

| Tên | Vai trò | Gợi ý |
|---|---|---|
| `music` | Nhạc nền | Cello/piano chậm, loop liền mạch (đầu và cuối khớp nhau) |
| `room` | Tiếng phòng hát lớn (room tone) | Rất nhỏ, 5–10 s loop |
| `drumroll` | Trống dồn lúc lồng chậm lại và lúc trình diện quả cầu | Loop 1–2 s, game tự tăng/giảm âm lượng |

## Âm lượng

Chỉnh trong game bằng nút ⚙ (góc dưới phải) hoặc bấm vào chiếc radio bên trái sân khấu: Tổng, Nhạc, Hiệu ứng, Tắt tiếng.
