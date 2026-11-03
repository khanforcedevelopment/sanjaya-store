import { Link } from 'react-router-dom'
import { CalendarClock, CheckCircle2, Circle } from 'lucide-react'
import { PageTitle, Skeleton, Alert } from '@/components/ui/misc'
import { ButtonLink } from '@/components/ui/Button'
import { useAuth } from '@/features/account/AuthProvider'
import { useCategories } from '@/features/catalog/api'
import { reasonLink, useInstallmentSettings, useMyEligibility } from '@/features/installments/api'
import { AgreementText } from '@/features/installments/Agreement'
import { formatINR } from '@/lib/money'
import { useDocumentMeta } from '@/lib/meta'

export function InstallmentsInfoPage() {
  useDocumentMeta({ title: '6 monthly installments', description: 'Pay for laptops, electronics, watches and handbags in 6 monthly installments with no interest and no fees.' })
  const { user } = useAuth()
  const { data: s, isLoading } = useInstallmentSettings()
  const { data: elig } = useMyEligibility(!!user)
  const { data: cats } = useCategories()
  const phones = cats?.find((c) => c.slug === 'mobiles')
  const eligibleCats = (cats ?? []).filter((c) => c.installment_eligible && !c.parent_id)

  return (
    <div className="container-x max-w-4xl py-10">
      <PageTitle title={`Pay in ${s?.count ?? 6} monthly installments`} subtitle="No interest. No processing fee. Pay the first part today and the rest once a month." />
      {isLoading ? <Skeleton className="h-40" /> : !s?.enabled ? (
        <Alert tone="info">Installments are paused right now. Please check back soon.</Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <section className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-semibold text-navy-900"><CalendarClock className="size-5 text-gold-600" /> How it works</h2>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-navy-800">
                <li>Verify your mobile number and identity once (takes a few minutes).</li>
                <li>Add eligible products worth {formatINR(s.min_order_total_paise)} to {formatINR(s.max_order_total_paise)} to your bag.</li>
                <li>At checkout choose <strong>Pay in {s.count} monthly installments</strong>, read and accept the terms, and pay the first installment by card.</li>
                <li>We approve and dispatch your order. Pay the remaining installments from <em>My account → Installments</em>; we remind you before each due date.</li>
              </ol>
              {!s.live_enabled && <p className="mt-3 text-xs text-navy-600/80">Installments are in test mode while we finish the legal review.</p>}
            </section>
            <section className="card p-5">
              <h2 className="mb-3 font-semibold text-navy-900">The terms</h2>
              <AgreementText graceDays={s.grace_days} version={s.agreement_version} />
            </section>
          </div>
          <aside className="space-y-6">
            <section className="card p-5">
              <h2 className="mb-3 font-semibold text-navy-900">Your eligibility</h2>
              {!user ? (
                <ButtonLink to="/login?next=/installments" className="w-full">Sign in to check</ButtonLink>
              ) : !elig ? <Skeleton className="h-20" /> : elig.eligible ? (
                <p className="flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 className="size-5" /> You can use installments</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {elig.reasons.map((r) => { const l = reasonLink(r); return (
                    <li key={r} className="flex items-start gap-2"><Circle className="mt-0.5 size-4 shrink-0 text-navy-400" /><span>{r}{l && <> · <Link to={l.to} className="font-semibold text-gold-700 underline">{l.label}</Link></>}</span></li>
                  ) })}
                </ul>
              )}
            </section>
            {eligibleCats.length > 0 && (
              <section className="card p-5">
                <h2 className="mb-3 font-semibold text-navy-900">Available on</h2>
                <ul className="space-y-1.5 text-sm">{eligibleCats.map((c) => <li key={c.id}><Link to={`/c/${c.slug}`} className="text-navy-800 hover:text-gold-700">{c.name}</Link></li>)}</ul>
                {phones && !phones.installment_eligible && <p className="mt-3 text-xs text-navy-600/80">Mobile phones are not available on installments.</p>}
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
