import { describe, expect, it } from 'vitest'
import {
  isReceptionVisibleJob,
  receptionMayCancelJob,
} from '@/lib/access/reception-scope'

describe('reception job scope', () => {
  it('allows unlock jobs', () => {
    expect(
      isReceptionVisibleJob({
        jobType: 'unlock',
        credentialId: null,
        personType: null,
      }),
    ).toBe(true)
    expect(
      receptionMayCancelJob({
        jobType: 'unlock',
        credentialId: null,
      }),
    ).toBe(true)
  })

  it('allows tenant credential enroll/provision/revoke', () => {
    for (const jobType of [
      'provision',
      'revoke',
      'assign_card',
      'enroll_card_capture',
      'enroll_face_capture',
      'enroll_fingerprint_capture',
      'update_validity',
    ]) {
      expect(
        isReceptionVisibleJob({
          jobType,
          credentialId: 'cred-1',
          personType: 'tenant',
        }),
      ).toBe(true)
    }
  })

  it('hides staff credential jobs', () => {
    expect(
      isReceptionVisibleJob({
        jobType: 'revoke',
        credentialId: 'staff-1',
        personType: 'housekeeping',
      }),
    ).toBe(false)
    expect(
      receptionMayCancelJob({
        jobType: 'provision',
        credentialId: 'staff-1',
        personType: 'manager',
      }),
    ).toBe(false)
  })

  it('hides attendance and sync_device', () => {
    expect(
      isReceptionVisibleJob({
        jobType: 'pull_attendance',
        credentialId: null,
      }),
    ).toBe(false)
    expect(
      isReceptionVisibleJob({
        jobType: 'sync_device',
        credentialId: null,
      }),
    ).toBe(false)
  })

  it('hides credential jobs when person type unknown', () => {
    expect(
      isReceptionVisibleJob({
        jobType: 'revoke',
        credentialId: 'cred-x',
        personType: null,
      }),
    ).toBe(false)
  })
})
