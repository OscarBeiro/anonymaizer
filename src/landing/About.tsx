import { t } from '../i18n';
import { BrandName, BrandText } from '../components/BrandName';
import { linkProps } from '../lib/router';
import { COPYRIGHT, LABS_URL, REPO_URL } from '../site';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import './landing.css';

const VALUES = () => ([
  { title: t('About.universal_inclusivity'), body: t('About.tools_anyone_can_use_whatever_their_budget') },
  { title: t('About.global_mindset_local_heart'), body: t('About.built_in_pontevedra_galicia_for_teams_everywhere') },
  { title: t('About.open_collaboration'), body: t('About.open_licence_software_first_anonymaizer_s_source') },
  { title: t('About.integrity_transparency'), body: t('About.we_say_exactly_what_the_tool_does') },
]);

const MILESTONES = [
  { year: '2014', text: 'TICGAL is founded in Pontevedra, starting with Zabbix training.' },
  { year: '2016', text: 'First GLPI Silver partner in the Spanish-speaking world.' },
  { year: '2018', text: 'First GLPI plugin released.' },
  { year: '2019', text: 'Gapp, the mobile app for GLPI, launches.' },
  { year: '2024', text: 'UXÍA, an AI chatbot for GLPI.' },
  { year: '2025', text: 'GLPI Network Platinum Partner — the first outside France.' },
  { year: '2026', text: 'AnonymAIzer joins TICGAL Labs.' },
];

export default function About() {
  return (
    <div className="landing">
      <SiteHeader />
      <main>
        <section className="landing-hero about-hero">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow">{t('About.a_ticgal_labs_project')}</p>
            <h1>{t('About.a_thought_is_a_spark_a_product')}</h1>
            <p className="landing-lede">
              <BrandName /> {t('About.was_built_at')}<a href={LABS_URL}>TICGAL Labs</a>{t('About.the_space_where_the_ticgal_team_experiments')}</p>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="why">
          <h2 id="why">{t('About.why_we_built_it')}</h2>
          <p>
            {t('About.our_own_team_and_the_organisations_we')}<BrandName /> {t('About.is_the_small_honest_tool_we_wanted')}</p>
        </section>

        <section className="landing-section" aria-labelledby="who">
          <h2 id="who">{t('About.who_we_are')}</h2>
          <p>
            <a href={COPYRIGHT.url}>TICGAL</a> {t('About.is_a_people_s_company_from_pontevedra')}</p>
          <p className="about-motto">{t('About.local_roots_global_reach_it')}</p>
          <p>
            {t('About.our_mission_empower_businesses_and_communities_with')}</p>
          <ul className="landing-cards about-values">
            {VALUES().map((v) => (
              <li key={v.title}>
                <h3>{v.title}</h3>
                <p><BrandText text={v.body} /></p>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-section" aria-labelledby="timeline">
          <h2 id="timeline">{t('About.along_the_way')}</h2>
          <ol className="about-timeline">
            {MILESTONES.map((m) => (
              <li key={m.year}>
                <span className="about-year">{m.year}</span>
                <span><BrandText text={m.text} /></span>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-section" aria-labelledby="labs">
          <h2 id="labs">TICGAL Labs</h2>
          <p>
            {t('About.we_value_the_human_element_critical_and')}{' '}
            <em>A cabeza non para</em> {t('About.the_mind_never_rests')}</p>
          <div className="landing-cta-actions">
            <a className="landing-secondary" href={LABS_URL}>{t('About.see_other_labs_projects')}</a>
            <a className="landing-secondary" href={REPO_URL}><BrandName /> {t('About.on_github')}</a>
            <a className="landing-primary" {...linkProps('/app')}>{t('About.try')}<BrandName /></a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
