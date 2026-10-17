import { cryptoInt } from './random'

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý']
const DEM = ['Văn', 'Thị', 'Minh', 'Ngọc', 'Hoàng', 'Thanh', 'Quốc', 'Gia', 'Bảo', 'Thu', 'Đức', 'Khánh', 'Anh', 'Hải']
const TEN = ['An', 'Bình', 'Châu', 'Dũng', 'Giang', 'Hà', 'Hiếu', 'Huy', 'Khoa', 'Lan', 'Linh', 'Long', 'Mai', 'Minh', 'Nam', 'Ngân', 'Nhi', 'Phúc', 'Quân', 'Quyên', 'Sơn', 'Tâm', 'Thảo', 'Trang', 'Trí', 'Tú', 'Vy', 'Yến']
const pick = <T,>(a: readonly T[]) => a[cryptoInt(a.length)]

/**
 * Sample list in the "Name | Student ID | Prize" format (handy to try the show and the ID masking).
 * Prizes: 1 first, 2 second, 3 third, the rest consolation.
 */
export function sampleEntries(count = 30): string {
  const lines: string[] = []
  const used = new Set<string>()
  for (let i = 0; lines.length < count && i < count * 20; i++) {
    const name = `${pick(HO)} ${pick(DEM)} ${pick(TEN)}`
    const mssv = `${pick(['22', '23', '24'])}${String(51000000 + cryptoInt(99999999 - 51000000)).padStart(8, '0')}`
    if (used.has(mssv)) continue
    used.add(mssv)
    const n = lines.length
    const prize = n === 0 ? 'Giải Nhất' : n <= 2 ? 'Giải Nhì' : n <= 5 ? 'Giải Ba' : 'Giải Khuyến khích'
    lines.push(`${name} | ${mssv} | ${prize}`)
  }
  return lines.join('\n')
}
