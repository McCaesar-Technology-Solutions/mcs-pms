'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Check,
  Download,
  Eye,
  FileText,
  Filter,
  Pencil,
  Plus,
  Search,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  approvePayRun,
  createOrRegeneratePayRun,
  deleteCommissionRule,
  getCommissionEntriesForLine,
  markPayRunPaid,
  submitPayRunForApproval,
  updatePayRunLine,
  upsertCommissionRule,
} from '@/app/actions/payroll'
import { PayrollHistoryChart } from '@/components/dashboard/payroll-history-chart'
import { DataEmptyState } from '@/components/dashboard/data-empty-state'
import { BulkSelectCheckbox } from '@/components/dashboard/bulk-select-checkbox'
import { FormField, APP_FIELD_CLASS } from '@/components/ui/form-field'
import {
  CenteredModal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@/components/ui/centered-modal'
import { downloadCsv } from '@/lib/export/download-csv'
import { formatPeriodLabel, percentChange } from '@/lib/payroll/calculate'
import { buildMoMoPaymentChecklist, buildPayRunCsv } from '@/lib/payroll/exports'
import { downloadPayRunSummaryPdf, downloadPayslipPdf } from '@/lib/payroll/payslip'
import { formatGhs, MONEY_CLASS } from '@/lib/format/money'
import type {
  CommissionRuleRow,
  PayRunLineRow,
  PayrollOverviewData,
} from '@/lib/payroll/types'
import type { UserRole } from '@/types'

const ROLE_BADGE: Record<UserRole, { label: string; chip: string }> = {
  owner: { label: 'Owner', chip: 'bg-[#3C216C] text-white' },
  manager: { label: 'Manager', chip: 'bg-[#D4A62E]/20 text-[#9a7615]' },
  receptionist: { label: 'Receptionist', chip: 'bg-teal-100 text-teal-800' },
  technician: { label: 'Technician', chip: 'bg-violet-100 text-violet-800' },
}

interface PayrollOverviewProps {
  data: PayrollOverviewData
  role: 'owner' | 'manager'
  staffInviteHref: string
}

function TrendPill({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
        vs last period
      </span>
    )
  }
  const up = value >= 0
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
      }`}
    >
      {up ? '↑' : '↓'} {Math.abs(value)}% vs last period
    </span>
  )
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function PayrollOverview({ data, role, staffInviteHref }: PayrollOverviewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editLine, setEditLine] = useState<PayRunLineRow | null>(null)
  const [viewLine, setViewLine] = useState<PayRunLineRow | null>(null)
  const [commissionDetail, setCommissionDetail] = useState<
    Array<{ id: string; description: string; amount: number; accruedOn: string }>
  >([])
  const [ruleOpen, setRuleOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<CommissionRuleRow | null>(null)

  const canManageRates = role === 'owner'
  const canApprove = role === 'owner'
  const canEditLines = role === 'owner'
  const canExportDisbursement = role === 'owner'
  const run = data.currentRun
  const period = data.currentPeriod
  const needsNextPeriod = period?.status === 'closed' || run?.status === 'paid'
  const canRegenerate =
    Boolean(run) &&
    (run?.status === 'draft' || (run?.status === 'pending_approval' && role === 'owner'))
  const createDisabled =
    pending ||
    run?.status === 'approved' ||
    (Boolean(run) && !canRegenerate && !needsNextPeriod)

  const periodLabel =
    period?.periodStart && period?.periodEnd
      ? formatPeriodLabel(period.periodStart, period.periodEnd)
      : 'Current period'

  const netDelta = percentChange(run?.totalNet ?? 0, data.previousRun?.totalNet ?? 0)
  const commissionDelta = percentChange(
    run?.totalCommission ?? 0,
    data.previousRun?.totalCommission ?? 0,
  )
  const unpaidDelta = percentChange(data.unpaidNet, data.previousRun?.totalNet ?? 0)

  const filteredLines = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.lines.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false
      if (!q) return true
      return (
        l.staffName.toLowerCase().includes(q) ||
        l.staffRole.toLowerCase().includes(q) ||
        (l.staffSpecialty ?? '').toLowerCase().includes(q)
      )
    })
  }, [data.lines, search, statusFilter])

  const year = new Date().getFullYear()
  const paidYtdNet = useMemo(
    () =>
      data.history
        .filter((h) => h.status === 'paid' && h.periodStart.startsWith(String(year)))
        .reduce((s, h) => s + h.net, 0),
    [data.history, year],
  )

  const periodSelectValue = searchParams.get('periodId')
    || (period?.id ? period.id : 'current')

  function selectPeriod(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'current') params.set('periodId', 'current')
    else params.set('periodId', value)
    router.push(`${pathname}?${params.toString()}`)
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function runAction(fn: () => Promise<{ success: boolean; error?: string }>, okMsg: string) {
    startTransition(async () => {
      const result = await fn()
      if (!result.success) {
        toast.error(result.error ?? 'Something went wrong.')
        return
      }
      toast.success(okMsg)
      router.refresh()
    })
  }

  function handleCreateRun() {
    // After a paid/closed period, open the current calendar window (no periodId)
    const startNextWindow = needsNextPeriod && !canRegenerate
    startTransition(async () => {
      const result = await createOrRegeneratePayRun(
        startNextWindow || !period
          ? { cycle: data.settings.defaultCycle }
          : {
              periodStart: period.periodStart,
              periodEnd: period.periodEnd,
              cycle: period.cycle,
              periodId: period.id || undefined,
            },
      )
      if (!result.success) {
        toast.error(result.error ?? 'Something went wrong.')
        return
      }
      toast.success(canRegenerate ? 'Pay run regenerated' : 'Pay run created')
      if (startNextWindow && result.data?.periodId) {
        router.push(`${pathname}?periodId=${result.data.periodId}`)
        return
      }
      router.refresh()
    })
  }

  function handleExportCsv() {
    if (!run) {
      toast.error('Create a pay run first.')
      return
    }
    downloadCsv(
      `payroll-${period?.periodStart ?? 'export'}.csv`,
      buildPayRunCsv({ hotelName: data.hotelName, run, lines: data.lines }),
    )
    toast.success('CSV exported')
  }

  function handleExportMoMo() {
    if (!canExportDisbursement) {
      toast.error('Only owners can export the MoMo / bank checklist.')
      return
    }
    if (!run) {
      toast.error('Create a pay run first.')
      return
    }
    downloadCsv(
      `payroll-momo-${period?.periodStart ?? 'export'}.csv`,
      buildMoMoPaymentChecklist({ hotelName: data.hotelName, run, lines: data.lines }),
    )
    toast.success('Payment checklist exported')
  }

  function handleExportPdf() {
    if (!run) {
      toast.error('Create a pay run first.')
      return
    }
    downloadPayRunSummaryPdf({ hotelName: data.hotelName, run, lines: data.lines })
  }

  async function openView(line: PayRunLineRow) {
    setViewLine(line)
    setCommissionDetail([])
    const result = await getCommissionEntriesForLine(line.id)
    if (result.success && result.data) {
      setCommissionDetail(result.data)
    }
  }

  function handlePayslip(line: PayRunLineRow) {
    if (!run) return
    downloadPayslipPdf({
      hotelName: data.hotelName,
      run,
      line,
      commissions: commissionDetail.map((c) => ({
        id: c.id,
        hotelId: line.hotelId,
        profileId: line.profileId,
        ruleId: null,
        sourceType: 'manual' as const,
        sourceId: null,
        description: c.description,
        amount: c.amount,
        accruedOn: c.accruedOn,
        payPeriodId: null,
        payRunLineId: line.id,
        status: 'included' as const,
      })),
    })
  }

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="payroll-period">
              Period
            </label>
            <select
              id="payroll-period"
              value={periodSelectValue}
              onChange={(e) => selectPeriod(e.target.value)}
              className={`${APP_FIELD_CLASS} w-auto min-w-[12rem] py-1.5`}
            >
              <option value="current">Current ({data.settings.defaultCycle})</option>
              {data.periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatPeriodLabel(p.periodStart, p.periodEnd)}
                  {p.status === 'closed' ? ' · closed' : ''}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-muted-foreground">{periodLabel}</p>
          {run && (
            <p className="mt-0.5 text-xs font-medium capitalize text-foreground">
              Run status: <span className="text-primary">{run.status.replace('_', ' ')}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            className="app-btn app-btn-secondary inline-flex items-center gap-1.5"
          >
            <FileText className="h-4 w-4" />
            Export
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="app-btn app-btn-secondary inline-flex items-center gap-1.5"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            type="button"
            onClick={handleCreateRun}
            disabled={createDisabled}
            className="app-btn app-btn-primary inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Wallet className="h-4 w-4" />
            {canRegenerate
              ? 'Regenerate draft'
              : needsNextPeriod
                ? 'Start next period'
                : run?.status === 'approved'
                  ? 'Approved'
                  : 'Run payroll'}
          </button>
        </div>
      </div>

      {/* Metric cards + history */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="grid grid-cols-2 gap-3 lg:col-span-5 lg:grid-cols-2">
          <div className="surface-card flex flex-col p-4">
            <p className="text-xs font-medium text-muted-foreground">Total employees</p>
            <p className={`mt-2 text-2xl font-bold text-foreground ${MONEY_CLASS}`}>
              {data.payrollActiveCount} / {data.activeStaffCount}
            </p>
            <Link
              href={staffInviteHref}
              className="mt-auto pt-3 text-xs font-semibold text-primary hover:underline"
            >
              {data.exceptionsCount > 0
                ? `${data.exceptionsCount} missing pay profiles →`
                : 'Manage staff pay →'}
            </Link>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Period payroll</p>
            <p className={`mt-2 text-2xl font-bold text-foreground ${MONEY_CLASS}`}>
              {formatGhs(run?.totalNet ?? 0)}
            </p>
            <div className="mt-2">
              <TrendPill value={netDelta} />
            </div>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Commission</p>
            <p className={`mt-2 text-2xl font-bold text-foreground ${MONEY_CLASS}`}>
              {formatGhs(run?.totalCommission ?? 0)}
            </p>
            <div className="mt-2">
              <TrendPill value={commissionDelta} />
            </div>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Upcoming payouts</p>
            <p className={`mt-2 text-2xl font-bold text-foreground ${MONEY_CLASS}`}>
              {formatGhs(data.unpaidNet)}
            </p>
            <div className="mt-2">
              <TrendPill value={unpaidDelta} />
            </div>
          </div>
        </div>

        <div className="surface-card p-4 lg:col-span-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Payroll history</p>
              <p className={`mt-1 text-2xl font-bold text-foreground ${MONEY_CLASS}`}>
                {formatGhs(paidYtdNet)}
              </p>
              <p className="text-xs text-muted-foreground">Paid YTD {year}</p>
            </div>
          </div>
          <div className="mt-2">
            <PayrollHistoryChart data={data.history} />
          </div>
        </div>
      </div>

      {/* Run workflow */}
      {run && (
        <div className="soft-panel flex flex-wrap items-center gap-2 px-4 py-3">
          <span className="text-sm text-muted-foreground">Actions:</span>
          {(run.status === 'draft' || run.status === 'pending_approval') && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runAction(() => submitPayRunForApproval(run.id), 'Submitted for approval')
              }
              className="app-btn app-btn-secondary text-xs"
            >
              Submit for approval
            </button>
          )}
          {canApprove && (run.status === 'draft' || run.status === 'pending_approval') && (
            <button
              type="button"
              disabled={pending}
              onClick={() => runAction(() => approvePayRun(run.id), 'Pay run approved')}
              className="app-btn app-btn-secondary inline-flex items-center gap-1 text-xs"
            >
              <Check className="h-3.5 w-3.5" />
              Approve
            </button>
          )}
          {canApprove && run.status !== 'paid' && run.status !== 'void' && (
            <button
              type="button"
              disabled={pending}
              onClick={() => runAction(() => markPayRunPaid(run.id), 'Marked as paid')}
              className="app-btn app-btn-primary text-xs"
            >
              Mark paid
            </button>
          )}
          {canExportDisbursement && (
            <button
              type="button"
              onClick={handleExportMoMo}
              className="app-btn app-btn-secondary text-xs"
            >
              MoMo / bank checklist
            </button>
          )}
        </div>
      )}

      {/* Commission rules (owner) */}
      {canManageRates && (
        <div className="surface-card">
          <div className="surface-card-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Commission rules</h3>
              <p className="text-xs text-muted-foreground">
                Accrue when housekeeping tasks are completed
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingRule(null)
                setRuleOpen(true)
              }}
              className="app-btn app-btn-primary inline-flex items-center gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add rule
            </button>
          </div>
          {data.commissionRules.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No rules yet. Add a flat fee per clean to start accruing commission.
            </p>
          ) : (
            <ul className="soft-list px-4 pb-4">
              {data.commissionRules.map((rule) => (
                <li
                  key={rule.id}
                  className="soft-list-item flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{rule.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {rule.rateType === 'flat'
                        ? `${formatGhs(rule.rateValue)} flat`
                        : `${rule.rateValue}% of ${formatGhs(rule.percentBaseAmount)}`}
                      {rule.taskType ? ` · ${rule.taskType}` : ''}
                      {rule.roleFilter ? ` · ${rule.roleFilter}` : ''}
                      {!rule.active ? ' · inactive' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-primary hover:underline"
                      onClick={() => {
                        setEditingRule(rule)
                        setRuleOpen(true)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-destructive hover:underline"
                      onClick={() =>
                        runAction(() => deleteCommissionRule(rule.id), 'Rule deleted')
                      }
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Employee table */}
      <div className="surface-card">
        <div className="surface-card-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="app-search-field max-w-sm flex-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none"
              aria-label="Search staff pay"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="surface-inset inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="bg-transparent outline-none"
                aria-label="Filter by status"
              >
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>
            <Link
              href={staffInviteHref}
              className="app-btn app-btn-primary inline-flex items-center gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Set pay profile
            </Link>
          </div>
        </div>

        {!run || filteredLines.length === 0 ? (
          <DataEmptyState
            borderless
            icon={Wallet}
            title={run ? 'No matching staff' : 'No pay run yet'}
            message={
              run
                ? 'Try a different search or status filter.'
                : 'Create a pay run to calculate base pay and accrued commissions for this period.'
            }
            action={
              !run ? (
                <button
                  type="button"
                  onClick={handleCreateRun}
                  disabled={pending}
                  className="app-btn app-btn-primary"
                >
                  Run payroll
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden data-table-wrap overflow-x-auto px-4 md:block">
              <table className="data-table w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr>
                    <th>
                      <span className="sr-only">Select</span>
                    </th>
                    <th>Staff member</th>
                    <th>Role</th>
                    <th>Base pay</th>
                    <th>Commission</th>
                    <th>Total payout</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLines.map((line) => {
                    const badge = ROLE_BADGE[line.staffRole]
                    const selectedRow = selected.has(line.id)
                    return (
                      <tr
                        key={line.id}
                        className={selectedRow ? 'is-selected' : undefined}
                      >
                        <td className="px-4 py-3">
                          <BulkSelectCheckbox
                            checked={selectedRow}
                            onChange={() => toggleSelect(line.id)}
                            aria-label={`Select ${line.staffName}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="gradient-primary flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white">
                              {initials(line.staffName)}
                            </div>
                            <span className="font-medium text-foreground">{line.staffName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.chip}`}
                          >
                            {line.staffSpecialty || badge.label}
                          </span>
                        </td>
                        <td className={`px-4 py-3 ${MONEY_CLASS}`}>{formatGhs(line.basePay)}</td>
                        <td className={`px-4 py-3 text-emerald-700 ${MONEY_CLASS}`}>
                          + {formatGhs(line.commission)}
                        </td>
                        <td className={`px-4 py-3 font-semibold ${MONEY_CLASS}`}>
                          {formatGhs(line.netPay)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              line.status === 'paid'
                                ? 'font-semibold text-emerald-600'
                                : 'font-semibold text-rose-500'
                            }
                          >
                            {line.status === 'paid' ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {canEditLines &&
                              (run.status === 'draft' || run.status === 'pending_approval') && (
                              <button
                                type="button"
                                onClick={() => setEditLine(line)}
                                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                aria-label="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => void openView(line)}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                              aria-label="View"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 md:hidden">
              {filteredLines.map((line) => (
                <div key={line.id} className="elevated-list-item p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="gradient-primary flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-bold text-white">
                        {initials(line.staffName)}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{line.staffName}</p>
                        <p className="text-xs text-muted-foreground">
                          {line.staffSpecialty || ROLE_BADGE[line.staffRole].label}
                        </p>
                      </div>
                    </div>
                    <span
                      className={
                        line.status === 'paid'
                          ? 'text-xs font-semibold text-emerald-600'
                          : 'text-xs font-semibold text-rose-500'
                      }
                    >
                      {line.status === 'paid' ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                  <div className={`mt-3 grid grid-cols-3 gap-2 text-xs ${MONEY_CLASS}`}>
                    <div>
                      <p className="text-muted-foreground">Base</p>
                      <p className="font-semibold">{formatGhs(line.basePay)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Comm.</p>
                      <p className="font-semibold text-emerald-700">
                        {formatGhs(line.commission)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Net</p>
                      <p className="font-semibold">{formatGhs(line.netPay)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void openView(line)}
                      className="app-btn app-btn-secondary flex-1 text-xs"
                    >
                      View
                    </button>
                    {canEditLines &&
                      (run.status === 'draft' || run.status === 'pending_approval') && (
                      <button
                        type="button"
                        onClick={() => setEditLine(line)}
                        className="app-btn app-btn-secondary flex-1 text-xs"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Edit line modal */}
      {editLine && (
        <EditLineModal
          line={editLine}
          pending={pending}
          onClose={() => setEditLine(null)}
          onSave={(values) => {
            runAction(
              () =>
                updatePayRunLine({
                  lineId: editLine.id,
                  ...values,
                }),
              'Pay line updated',
            )
            setEditLine(null)
          }}
        />
      )}

      {/* View / payslip modal */}
      {viewLine && (
        <CenteredModal open onClose={() => setViewLine(null)} className="max-w-md" aria-label="Pay line detail">
          <ModalHeader onClose={() => setViewLine(null)}>
            <h3 className="text-lg font-semibold text-foreground">{viewLine.staffName}</h3>
          </ModalHeader>
          <ModalBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Base pay</p>
                <p className={`font-semibold ${MONEY_CLASS}`}>{formatGhs(viewLine.basePay)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Commission</p>
                <p className={`font-semibold text-emerald-700 ${MONEY_CLASS}`}>
                  {formatGhs(viewLine.commission)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deductions</p>
                <p className={`font-semibold ${MONEY_CLASS}`}>{formatGhs(viewLine.deductions)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net payout</p>
                <p className={`font-semibold ${MONEY_CLASS}`}>{formatGhs(viewLine.netPay)}</p>
              </div>
            </div>
            {commissionDetail.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Commission detail</p>
                <ul className="space-y-1.5">
                  {commissionDetail.map((c) => (
                    <li
                      key={c.id}
                      className="flex justify-between gap-2 text-xs text-foreground"
                    >
                      <span>
                        {c.accruedOn} · {c.description}
                      </span>
                      <span className={MONEY_CLASS}>{formatGhs(c.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {viewLine.overrideReason && (
              <p className="text-xs text-muted-foreground">
                Override: {viewLine.overrideReason}
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              className="app-btn app-btn-secondary"
              onClick={() => setViewLine(null)}
            >
              Close
            </button>
            <button
              type="button"
              className="app-btn app-btn-primary"
              onClick={() => handlePayslip(viewLine)}
            >
              Download payslip
            </button>
          </ModalFooter>
        </CenteredModal>
      )}

      {ruleOpen && (
        <CommissionRuleModal
          rule={editingRule}
          pending={pending}
          onClose={() => setRuleOpen(false)}
          onSave={(values) => {
            runAction(
              () =>
                upsertCommissionRule({
                  id: editingRule?.id,
                  ...values,
                }),
              editingRule ? 'Rule updated' : 'Rule created',
            )
            setRuleOpen(false)
          }}
        />
      )}
    </div>
  )
}

function EditLineModal({
  line,
  pending,
  onClose,
  onSave,
}: {
  line: PayRunLineRow
  pending: boolean
  onClose: () => void
  onSave: (v: {
    basePay: number
    commission: number
    allowances: number
    deductions: number
    overrideReason: string
    notes: string | null
  }) => void
}) {
  const [basePay, setBasePay] = useState(String(line.basePay))
  const [commission, setCommission] = useState(String(line.commission))
  const [allowances, setAllowances] = useState(String(line.allowances))
  const [deductions, setDeductions] = useState(String(line.deductions))
  const [reason, setReason] = useState(line.overrideReason ?? '')
  const [notes, setNotes] = useState(line.notes ?? '')

  return (
    <CenteredModal open onClose={onClose} className="max-w-md" aria-label="Edit pay line">
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold text-foreground">Edit · {line.staffName}</h3>
      </ModalHeader>
      <ModalBody className="grid gap-3 sm:grid-cols-2">
        <FormField label="Base pay">
          <input
            type="number"
            min={0}
            step="0.01"
            className={APP_FIELD_CLASS}
            value={basePay}
            onChange={(e) => setBasePay(e.target.value)}
          />
        </FormField>
        <FormField label="Commission">
          <input
            type="number"
            min={0}
            step="0.01"
            className={APP_FIELD_CLASS}
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
          />
        </FormField>
        <FormField label="Allowances">
          <input
            type="number"
            min={0}
            step="0.01"
            className={APP_FIELD_CLASS}
            value={allowances}
            onChange={(e) => setAllowances(e.target.value)}
          />
        </FormField>
        <FormField label="Deductions">
          <input
            type="number"
            min={0}
            step="0.01"
            className={APP_FIELD_CLASS}
            value={deductions}
            onChange={(e) => setDeductions(e.target.value)}
          />
        </FormField>
        <div className="sm:col-span-2">
          <FormField label="Reason for change">
            <input
              className={APP_FIELD_CLASS}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Required"
            />
          </FormField>
        </div>
        <div className="sm:col-span-2">
          <FormField label="Notes">
            <input
              className={APP_FIELD_CLASS}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </FormField>
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="app-btn app-btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          disabled={pending || !reason.trim()}
          className="app-btn app-btn-primary disabled:opacity-50"
          onClick={() =>
            onSave({
              basePay: Number(basePay) || 0,
              commission: Number(commission) || 0,
              allowances: Number(allowances) || 0,
              deductions: Number(deductions) || 0,
              overrideReason: reason.trim(),
              notes: notes.trim() || null,
            })
          }
        >
          Save
        </button>
      </ModalFooter>
    </CenteredModal>
  )
}

function CommissionRuleModal({
  rule,
  pending,
  onClose,
  onSave,
}: {
  rule: CommissionRuleRow | null
  pending: boolean
  onClose: () => void
  onSave: (v: {
    name: string
    rateType: 'flat' | 'percent'
    rateValue: number
    percentBaseAmount: number
    taskType: 'clean' | 'inspect' | 'maintenance' | 'restock' | null
    roleFilter: 'manager' | 'technician' | 'receptionist' | null
    active: boolean
  }) => void
}) {
  const [name, setName] = useState(rule?.name ?? 'Housekeeping clean')
  const [rateType, setRateType] = useState<'flat' | 'percent'>(rule?.rateType ?? 'flat')
  const [rateValue, setRateValue] = useState(String(rule?.rateValue ?? 20))
  const [percentBase, setPercentBase] = useState(String(rule?.percentBaseAmount ?? 100))
  const [taskType, setTaskType] = useState(rule?.taskType ?? 'clean')
  const [roleFilter, setRoleFilter] = useState(rule?.roleFilter ?? '')
  const [active, setActive] = useState(rule?.active ?? true)

  return (
    <CenteredModal open onClose={onClose} className="max-w-md" aria-label="Commission rule">
      <ModalHeader onClose={onClose}>
        <h3 className="text-lg font-semibold text-foreground">
          {rule ? 'Edit commission rule' : 'New commission rule'}
        </h3>
      </ModalHeader>
      <ModalBody className="space-y-3">
        <FormField label="Name">
          <input className={APP_FIELD_CLASS} value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Rate type">
            <select
              className={APP_FIELD_CLASS}
              value={rateType}
              onChange={(e) => setRateType(e.target.value as 'flat' | 'percent')}
            >
              <option value="flat">Flat (GHS)</option>
              <option value="percent">Percent of base</option>
            </select>
          </FormField>
          <FormField label={rateType === 'flat' ? 'Amount (GHS)' : 'Percent'}>
            <input
              type="number"
              min={0}
              step="0.01"
              className={APP_FIELD_CLASS}
              value={rateValue}
              onChange={(e) => setRateValue(e.target.value)}
            />
          </FormField>
        </div>
        {rateType === 'percent' && (
          <FormField label="Percent base amount (GHS)">
            <input
              type="number"
              min={0}
              step="0.01"
              className={APP_FIELD_CLASS}
              value={percentBase}
              onChange={(e) => setPercentBase(e.target.value)}
            />
          </FormField>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Task type">
            <select
              className={APP_FIELD_CLASS}
              value={taskType ?? 'clean'}
              onChange={(e) => setTaskType(e.target.value as typeof taskType)}
            >
              <option value="clean">Clean</option>
              <option value="inspect">Inspect</option>
              <option value="restock">Restock</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </FormField>
          <FormField label="Role filter (optional)">
            <select
              className={APP_FIELD_CLASS}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">Any role</option>
              <option value="technician">Technician</option>
              <option value="receptionist">Receptionist</option>
              <option value="manager">Manager</option>
            </select>
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded border-border"
          />
          Active
        </label>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="app-btn app-btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          disabled={pending || !name.trim()}
          className="app-btn app-btn-primary disabled:opacity-50"
          onClick={() =>
            onSave({
              name: name.trim(),
              rateType,
              rateValue: Number(rateValue) || 0,
              percentBaseAmount: Number(percentBase) || 0,
              taskType: taskType || 'clean',
              roleFilter: (roleFilter || null) as
                | 'manager'
                | 'technician'
                | 'receptionist'
                | null,
              active,
            })
          }
        >
          Save rule
        </button>
      </ModalFooter>
    </CenteredModal>
  )
}
