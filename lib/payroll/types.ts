import type { UserRole } from '@/types'

export type PayType = 'salary' | 'daily' | 'hourly'
export type PayCycle = 'monthly' | 'biweekly' | 'weekly'
export type PayPeriodStatus = 'open' | 'closed'
export type PayRunStatus = 'draft' | 'pending_approval' | 'approved' | 'paid' | 'void'
export type PayLineStatus = 'unpaid' | 'paid' | 'excluded'
export type CommissionRateType = 'flat' | 'percent'
export type CommissionTrigger = 'housekeeping_complete' | 'manual'
export type CommissionEntryStatus = 'accrued' | 'included' | 'void'

export interface EmployeeCompensationRow {
  id: string
  hotelId: string
  profileId: string
  payType: PayType
  baseAmount: number
  currency: string
  momoNumber: string | null
  bankName: string | null
  bankAccount: string | null
  tin: string | null
  ssnitNumber: string | null
  hireDate: string | null
  payrollActive: boolean
  notes: string | null
  /** Joined from profiles when loaded with staff */
  staffName?: string
  staffRole?: UserRole
  staffSpecialty?: string | null
  staffEmail?: string | null
  staffActive?: boolean
  profileImagePath?: string | null
}

export interface PayPeriodRow {
  id: string
  hotelId: string
  cycle: PayCycle
  periodStart: string
  periodEnd: string
  status: PayPeriodStatus
}

export interface PayRunRow {
  id: string
  hotelId: string
  payPeriodId: string
  status: PayRunStatus
  totalBase: number
  totalCommission: number
  totalAllowances: number
  totalDeductions: number
  totalNet: number
  employeeCount: number
  notes: string | null
  approvedAt: string | null
  paidAt: string | null
  expenseId: string | null
  periodStart?: string
  periodEnd?: string
  cycle?: PayCycle
}

export interface PayRunLineRow {
  id: string
  hotelId: string
  payRunId: string
  profileId: string
  basePay: number
  commission: number
  allowances: number
  deductions: number
  netPay: number
  status: PayLineStatus
  overrideReason: string | null
  notes: string | null
  staffName: string
  staffRole: UserRole
  staffSpecialty: string | null
  profileImagePath: string | null
  momoNumber?: string | null
  bankName?: string | null
  bankAccount?: string | null
}

export interface CommissionRuleRow {
  id: string
  hotelId: string
  name: string
  trigger: CommissionTrigger
  rateType: CommissionRateType
  rateValue: number
  percentBaseAmount: number
  taskType: 'clean' | 'inspect' | 'maintenance' | 'restock' | null
  roleFilter: 'manager' | 'technician' | 'receptionist' | null
  active: boolean
}

export interface CommissionEntryRow {
  id: string
  hotelId: string
  profileId: string
  ruleId: string | null
  sourceType: 'housekeeping_task' | 'manual'
  sourceId: string | null
  description: string
  amount: number
  accruedOn: string
  payPeriodId: string | null
  payRunLineId: string | null
  status: CommissionEntryStatus
}

export interface PayrollSettingsRow {
  id: string
  hotelId: string
  defaultCycle: PayCycle
  postExpenseOnPaid: boolean
}

export interface PayrollHistoryPoint {
  label: string
  periodStart: string
  periodEnd: string
  net: number
  commission: number
  runId: string | null
  status: PayRunStatus | null
}

export interface PayrollOverviewData {
  hotelName: string
  settings: PayrollSettingsRow
  compensation: EmployeeCompensationRow[]
  activeStaffCount: number
  payrollActiveCount: number
  periods: PayPeriodRow[]
  currentPeriod: PayPeriodRow | null
  currentRun: PayRunRow | null
  lines: PayRunLineRow[]
  history: PayrollHistoryPoint[]
  commissionRules: CommissionRuleRow[]
  previousRun: PayRunRow | null
  unpaidNet: number
  exceptionsCount: number
}
