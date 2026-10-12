import { t } from '../i18n';
import { BrandName } from '../components/BrandName';
import { useRef, useState } from 'react';
import '../lib/parsers';
import { supportedExtensions } from '../core/parsers';
import { setHandoff } from '../lib/handoff';
import { linkProps, navigate } from '../lib/router';
import { LABS_URL, PORTABLE_DOWNLOAD_URL } from '../site';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import './landing.css';

const STEPS = () => ([
  {
    title: t('Landing.paste_or_drop_a_document'),
    body: t('Landing.text_word_pdf_spreadsheets_slides_or_an'),
  },
  {
    title: t('Landing.review_what_gets_hidden'),
    body: t('Landing.names_companies_ids_ibans_emails_phones_and'),
  },
  {
    title: t('Landing.send_it_then_restore_the_answer'),
    body: t('Landing.paste_the_sanitized_text_into_any_ai'),
  },
]);

const DETECTS = () => ([
  {
    title: t('Landing.people_companies'),
    body: t('Landing.personal_names_and_company_names_with_an'),
  },
  {
    title: t('Landing.identity_documents'),
    body: t('Landing.dni_and_nie_numbers_other_id_codes'),
  },
  {
    title: t('Landing.money_banking'),
    body: t('Landing.ibans_card_numbers_and_amounts_kept_consistent'),
  },
  {
    title: t('Landing.contact_details'),
    body: t('Landing.emails_phone_numbers_and_postal_addresses'),
  },
  {
    title: t('Landing.your_own_rules'),
    body: t('Landing.add_your_own_terms_and_patterns_for'),
  },
  {
    title: t('Landing.same_value_same_placeholder'),
    body: t('Landing.every_occurrence_maps_to_one_placeholder_so'),
  },
]);

const AUDIENCES = () => ([
  {
    title: t('Landing.healthcare'),
    who: t('Landing.doctors_nurses_therapists_pharmacists_carers'),
    body: t('Landing.summarise_case_notes_draft_referral_letters_or'),
  },
  {
    title: t('Landing.legal'),
    who: t('Landing.lawyers_paralegals_notaries_advisers_mediators'),
    body: t('Landing.review_contracts_prepare_briefs_or_answer_clients'),
  },
  {
    title: t('Landing.education'),
    who: t('Landing.teachers_tutors_counsellors_school_administrators'),
    body: t('Landing.write_reports_feedback_and_letters_to_families'),
  },
  {
    title: t('Landing.people_social_care'),
    who: t('Landing.hr_teams_recruiters_social_workers_psychologists'),
    body: t('Landing.screen_cvs_write_evaluations_or_case_reports'),
  },
  {
    title: t('Landing.finance_administration'),
    who: t('Landing.accountants_tax_advisers_bank_and_insurance_staff'),
    body: t('Landing.work_on_invoices_statements_claims_and_forms'),
  },
  {
    title: t('Landing.support_it'),
    who: t('Landing.help_desks_service_managers_consultants'),
    body: t('Landing.analyse_tickets_logs_and_email_threads_from'),
  },
]);

const USE_CASES = () => ([
  {
    title: t('Landing.a_medical_report'),
    question: t('Landing.would_you_paste_your_lab_results_or'),
    risk: t('Landing.health_data_is_a_special_category_under'),
    fix: t('Landing.ask_the_ai_to_explain_the_terms'),
  },
  {
    title: t('Landing.a_legal_document'),
    question: t('Landing.would_you_upload_a_contract_a_lawsuit'),
    risk: t('Landing.it_names_every_party_their_id_numbers'),
    fix: t('Landing.get_a_summary_a_risk_review_or'),
  },
  {
    title: t('Landing.a_cv'),
    question: t('Landing.would_you_share_a_candidate_s_cv'),
    risk: t('Landing.a_cv_is_a_full_profile_name'),
    fix: t('Landing.improve_the_wording_tailor_it_to_a'),
  },
]);

// P19: the landing. The paste/upload control is the call to action — it hands
// the document to /app instead of merely linking there.
export default function Landing() {
  const [text, setText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const startWithFile = (file: File) => {
    setHandoff({ kind: 'file', file });
    navigate('/app');
  };

  const startWithText = () => {
    if (text.trim()) setHandoff({ kind: 'text', text });
    navigate('/app');
  };

  return (
    <div className="landing">
      <SiteHeader />

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">{t('Landing.free_open_source_no_sign_up')}</p>
            <h1>{t('Landing.take_the_personal_data_out_before_you')}</h1>
            <p className="landing-lede">
              <BrandName /> {t('Landing.swaps_names_ids_bank_details_and_other')}{' '}
              <strong>{t('Landing.it_runs_entirely_in_your_browser_there')}</strong>
            </p>
            <ul className="landing-badges">
              <li>{t('Landing.runs_100_in_your_browser')}</li>
              <li>{t('Landing.works_with_any_ai')}</li>
              <li>{t('Landing.reversible')}</li>
            </ul>
          </div>

          <div
            className={dragOver ? 'landing-cta is-drag' : 'landing-cta'}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) startWithFile(file);
            }}
          >
            <label htmlFor="landing-paste" className="landing-cta-label">
              {t('Landing.paste_text_or_drop_a_file')}</label>
            <textarea
              id="landing-paste"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('Landing.dear_ms_garc_a_regarding_contract_2024')}
              rows={6}
            />
            <div className="landing-cta-actions">
              <button type="button" className="landing-primary" onClick={startWithText}>
                {text.trim() ? t('Landing.anonymize_this_text') : t('Landing.open_the_tool')}
              </button>
              <button type="button" className="landing-secondary" onClick={() => fileRef.current?.click()}>
                {t('Landing.choose_a_file')}</button>
              <input
                ref={fileRef}
                type="file"
                hidden
                accept={supportedExtensions()
                  .map((ext) => `.${ext}`)
                  .join(',')}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) startWithFile(file);
                }}
              />
            </div>
            <p className="landing-cta-note">{t('Landing.nothing_you_put_here_leaves_this_tab')}</p>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="how">
          <h2 id="how">{t('Landing.how_it_works')}</h2>
          <ol className="landing-steps">
            {STEPS().map((s, i) => (
              <li key={s.title}>
                <span className="landing-step-number">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-section" aria-labelledby="detects">
          <h2 id="detects">{t('Landing.what_it_catches')}</h2>
          <ul className="landing-cards landing-cards-3">
            {DETECTS().map((d) => (
              <li key={d.title}>
                <h3>{d.title}</h3>
                <p>{d.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-section" aria-labelledby="realistic">
          <h2 id="realistic">{t('Landing.placeholders_or_realistic_fake_data')}</h2>
          <p>{t('Landing.choose_how_the_hidden_values_look_in')}</p>
          <div className="landing-modes">
            <div className="landing-mode">
              <h3>{t('Landing.placeholders_reversible')}</h3>
              <p className="landing-mode-sample">
                <code>[[NAME_001]]</code> {t('Landing.signed_with')}<code>[[COMPANY_001]]</code> {t('Landing.for')}<code>[[MONEY_001]]</code>.
              </p>
              <p>{t('Landing.obvious_tokens_the_ai_keeps_intact_so')}</p>
            </div>
            <div className="landing-mode">
              <h3>{t('Landing.realistic_one_way')}</h3>
              <p className="landing-mode-sample">
                <em>Emily Carter</em> {t('Landing.signed_with')}<em>Northbridge Holdings Ltd</em> {t('Landing.for')}<em>£13,870.00</em>.
              </p>
              <p>
                {t('Landing.names_and_companies_are_swapped_for_invented')}</p>
            </div>
          </div>

          <h3 className="landing-subhead">{t('Landing.what_realistic_is_for_test_data_that')}</h3>
          <p>
            {t('Landing.developers_testers_and_analysts_need_data_to')}</p>
          <p>
            {t('Landing.realistic_mode_gives_you_both_your_real')}</p>
          <ul className="landing-claims">
            <li>
              <strong>{t('Landing.invoices')}</strong> {t('Landing.clients_and_suppliers_become_invented_companies_amounts')}</li>
            <li>
              <strong>{t('Landing.payroll_and_salaries')}</strong> {t('Landing.employees_get_fake_names_and_every_salary')}</li>
            <li>
              <strong>{t('Landing.tickets_contracts_emails')}</strong> {t('Landing.seed_a_staging_environment_write_a_reproducible')}</li>
          </ul>
          <p>{t('Landing.within_a_session_the_document_always_renders')}</p>
        </section>

        <section className="landing-section landing-privacy" id="privacy" aria-labelledby="privacy-title">
          <h2 id="privacy-title">{t('Landing.your_data_never_leaves_this_tab')}</h2>
          <ul className="landing-claims">
            <li>
              <strong>{t('Landing.no_backend')}</strong> {t('Landing.there_is_no_server_to_receive_your')}</li>
            <li>
              <strong>{t('Landing.nothing_is_uploaded')}</strong> {t('Landing.documents_are_parsed_in_the_browser_your')}</li>
          </ul>
          <p className="landing-exceptions-title">{t('Landing.two_exceptions_stated_precisely')}</p>
          <ul className="landing-exceptions">
            <li>
              <strong>{t('Landing.the_optional_ai_name_detector')}</strong> {t('Landing.if_you_switch_it_on_your_browser')}</li>
            <li>
              <strong>{t('Landing.analytics_on_this_website_only_if_you')}</strong> {t('Landing.page_views_never_the_content_you_process')}<a {...linkProps('/cookies')}>{t('Landing.cookie_policy')}</a>.
            </li>
          </ul>
        </section>

        <section className="landing-section" aria-labelledby="formats">
          <h2 id="formats">{t('Landing.supported_formats')}</h2>
          <p>
            {t('Landing.plain_text_and_pasted_rich_text_plus')}{' '}
            {supportedExtensions()
              .filter((e) => e !== 'txt' && e !== 'md')
              .map((e) => `.${e}`)
              .join(', ')}
            {t('Landing.sanitized_output_can_be_copied_or_saved')}</p>
        </section>

        <section className="landing-section" aria-labelledby="use-cases">
          <h2 id="use-cases">{t('Landing.would_you_upload_this_to_an_ai')}</h2>
          <p>{t('Landing.probably_not_as_it_is_with')}<BrandName />{t('Landing.you_can_still_get_the_help')}</p>
          <ul className="landing-cards landing-cards-3 landing-cases">
            {USE_CASES().map((c) => (
              <li key={c.title}>
                <h3>{c.title}</h3>
                <p className="landing-case-question">{c.question}</p>
                <p>
                  <strong>{t('Landing.the_problem')}</strong> {c.risk}
                </p>
                <p>
                  <strong>{t('Landing.with')}<BrandName />.</strong> {c.fix}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-section" aria-labelledby="audiences">
          <h2 id="audiences">{t('Landing.for_anyone_trusted_with_other_people_s')}</h2>
          <p>
            {t('Landing.if_your_job_means_handling_someone_else')}<BrandName /> {t('Landing.lets_you_use_ai_on_that_work')}</p>
          <ul className="landing-cards landing-cards-3">
            {AUDIENCES().map((a) => (
              <li key={a.title}>
                <h3>{a.title}</h3>
                <p className="landing-audience-who">{a.who}</p>
                <p>{a.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-section" aria-labelledby="offline">
          <h2 id="offline">{t('Landing.works_offline_too')}</h2>
          <p>
            {t('Landing.download_the_portable_version_a_single_html')}</p>
          <a className="landing-secondary" href={PORTABLE_DOWNLOAD_URL}>
            {t('Landing.download_the_offline_version')}</a>
        </section>

        <section className="landing-section landing-labs" aria-labelledby="labs">
          <p className="landing-eyebrow">{t('Landing.a_ticgal_labs_project')}</p>
          <h2 id="labs">{t('Landing.built_by_people_who_handle_sensitive_data')}</h2>
          <p>
            <BrandName /> {t('Landing.comes_from')}<a href={LABS_URL}>TICGAL Labs</a>{t('Landing.where_the_ticgal_team_a_glpi_network')}</p>
          <p className="about-motto">{t('Landing.local_roots_global_reach_it')}</p>
          <p>
            {t('Landing.that_is_why')}<BrandName /> {t('Landing.is_being_built_for_more_than_one')}</p>
          <a className="landing-secondary" {...linkProps('/about')}>
            {t('Landing.about_us')}</a>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
