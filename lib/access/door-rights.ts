/**
 * Pure helpers for grouping door targets by controller (mirrors agent targetsFromDoors).
 * Used in unit tests; agent keeps its own copy for the packaged runtime.
 */

export type DoorTargetLike = {
  deviceKey: string
  doorNo?: number | null
}

export function groupDoorTargetsByDevice(doors: DoorTargetLike[]): Map<string, number[]> {
  const byKey = new Map<string, Set<number>>()
  for (const d of doors) {
    if (!d.deviceKey) continue
    const doorNo = Number(d.doorNo ?? 1)
    const n = Number.isFinite(doorNo) && doorNo >= 1 ? doorNo : 1
    const set = byKey.get(d.deviceKey) ?? new Set<number>()
    set.add(n)
    byKey.set(d.deviceKey, set)
  }
  const out = new Map<string, number[]>()
  for (const [key, set] of byKey) {
    out.set(key, [...set].sort((a, b) => a - b))
  }
  return out
}

export function doorRightString(doorNos: number[]): string {
  const doors =
    doorNos.length > 0
      ? [...new Set(doorNos.map(Number).filter((n) => Number.isFinite(n) && n >= 1))]
      : [1]
  if (!doors.length) doors.push(1)
  return doors.join(',')
}
