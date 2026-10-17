/**
 * Mask the middle of ID-like numbers (student IDs, phone numbers…): every run of 6+ digits gets
 * ⌈n/3⌉ digits replaced by "x", centred. 10 digits → 4 masked: 2251052127 → 225xxxx127.
 * Shorter numbers (prize ranks, years) are left alone.
 */
export function maskIds(text: string): string {
  return text.replace(/\d{6,}/g, (run) => {
    const n = run.length
    const k = Math.ceil(n / 3)
    const pre = Math.floor((n - k) / 2)
    return run.slice(0, pre) + 'x'.repeat(k) + run.slice(pre + k)
  })
}
