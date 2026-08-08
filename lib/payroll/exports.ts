import type { PayRunLineRow, PayRunRow } from '@/lib/payroll/types'
import { formatPeriodLabel } from '@/lib/payroll/calculate'

export function buildPayRunCsv(input: {
  hotelName: string
  run: PayRunRow
  lines: PayRunLineRow[]
}): string[][] {
  const period =
    input.run.periodStart && input.run.periodEnd
      ? formatPeriodLabel(input.run.periodStart, input.run.periodEnd)
      : input.run.payPeriodId

  const header = [
    ['Hotel', input.hotelName],
    ['Period', period],
    ['Status', input.run.status],
    ['Total net', String(input.run.totalNet)],
    [],
    [
      'Staff',
      'Role',
      'Base pay',
      'Commission',
      'Allowances',
      'Deductions',
      'Net pay',
      'Status',
      'MoMo',
      'Bank name',
      'Bank account',
    ],
  ]

  const rows = input.lines
    .filter((l) => l.status !== 'excluded')
    .map((l) => [
      l.staffName,
      l.staffSpecialty || l.staffRole,
      String(l.basePay),
      String(l.commission),
      String(l.allowances),
      String(l.deductions),
      String(l.netPay),
      l.status,
      l.momoNumber ?? '',
      l.bankName ?? '',
      l.bankAccount ?? '',
    ])

  return [...header, ...rows]
}

export function buildMoMoPaymentChecklist(input: {
  hotelName: string
  run: PayRunRow
  lines: PayRunLineRow[]
}): string[][] {
  const period =
    input.run.periodStart && input.run.periodEnd
      ? formatPeriodLabel(input.run.periodStart, input.run.periodEnd)
      : ''

  return [
    ['MoJo Payroll — payment checklist'],
    ['Hotel', input.hotelName],
    ['Period', period],
    [],
    ['Staff', 'Net pay (GHS)', 'MoMo number', 'Bank name', 'Bank account', 'Paid?'],
    ...input.lines
      .filter((l) => l.status !== 'excluded')
      .map((l) => [
        l.staffName,
        String(l.netPay),
        l.momoNumber ?? '',
        l.bankName ?? '',
        l.bankAccount ?? '',
        l.status === 'paid' ? 'Yes' : '',
      ]),
  ]
}
