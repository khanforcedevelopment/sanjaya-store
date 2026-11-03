import { formatINR } from '@/lib/money'

/**
 * Plain-language installment terms shown before the customer agrees.
 * DRAFT: must be reviewed by a lawyer before live installments are switched on (USER_TODO).
 */
export function AgreementText({ schedule, graceDays = 3, version }: { schedule?: number[] | null; graceDays?: number; version?: string }) {
  const count = schedule?.length ?? 6
  return (
    <div className="space-y-2 text-sm text-navy-800">
      <p>Between you and <strong>Sanjaya Trading FZE</strong> (the seller){version && <span className="text-navy-600/80"> · terms version {version}</span>}.</p>
      <ol className="list-decimal space-y-1.5 pl-5">
        <li>You pay the order total in <strong>{count} payments</strong>{schedule?.length ? <> of about <strong>{formatINR(schedule[schedule.length - 1] ?? 0)}</strong></> : null}. The first is paid now by card; the rest are due on the same date each following month.</li>
        <li><strong>No interest and no processing fee</strong> is added. The total you pay equals the order total.</li>
        <li>We send a reminder before each due date. Pay from <em>My account → Installments</em> by card.</li>
        <li>If a payment is more than {graceDays} days late, our collections team will contact you, and you cannot start another installment plan until it is paid.</li>
        <li>The order is dispatched after the first payment and our team's approval. If you cancel before dispatch, payments made are refunded.</li>
        <li>Returns follow our normal returns policy; refunds go back to the card used, after unpaid installments are cancelled.</li>
        <li>We verify your identity (KYC) and mobile number before offering installments. Your ID number is never stored, only a secure fingerprint of it to prevent duplicate accounts.</li>
      </ol>
    </div>
  )
}
