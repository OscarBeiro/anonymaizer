import { linkProps } from '../lib/router';
import { COPYRIGHT, LABS_URL, REPO_URL } from '../site';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import './landing.css';

const VALUES = [
  { title: 'Universal inclusivity', body: 'Tools anyone can use, whatever their budget or technical background.' },
  { title: 'Global mindset, local heart', body: 'Built in Pontevedra, Galicia, for teams everywhere.' },
  { title: 'Open collaboration', body: 'Open-licence software first. AnonymAIzer’s source is public.' },
  { title: 'Integrity & transparency', body: 'We say exactly what the tool does — and what it doesn’t.' },
];

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
            <p className="landing-eyebrow">A TICGAL Labs project</p>
            <h1>A thought is a spark; a product is the fire.</h1>
            <p className="landing-lede">
              AnonymAIzer was built at <a href={LABS_URL}>TICGAL Labs</a>, the space where the TICGAL team experiments
              with new technology and solves niche problems — and ships the result as a working tool, not vaporware.
            </p>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="why">
          <h2 id="why">Why we built it</h2>
          <p>
            Our own team, and the organisations we support, wanted to use AI assistants on real work: contracts,
            tickets, invoices, emails. Those documents are full of names, IDs and bank details that should never be
            pasted into a third-party service. AnonymAIzer is the small, honest tool we wanted: it removes the
            personal data, lets you use any AI, and puts the data back — all without a server of its own.
          </p>
        </section>

        <section className="landing-section" aria-labelledby="who">
          <h2 id="who">Who we are</h2>
          <p>
            <a href={COPYRIGHT.url}>TICGAL</a> is a people’s company from Pontevedra, Galicia: IT specialists,
            software developers and support professionals with over a decade of collective experience. We are a GLPI
            Network Platinum Partner, build GLPI plugins and the Gapp mobile solution, and work with organisations
            such as Würth, Bellota, the Government of Navarre, Votorantim, UNIR and several universities.
          </p>
          <p className="about-motto">Local Roots, Global Reach IT.</p>
          <p>
            Our mission: empower businesses and communities with innovative, tailored IT solutions that enable
            sustainable growth while positively impacting our local community.
          </p>
          <ul className="landing-cards about-values">
            {VALUES.map((v) => (
              <li key={v.title}>
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-section" aria-labelledby="timeline">
          <h2 id="timeline">Along the way</h2>
          <ol className="about-timeline">
            {MILESTONES.map((m) => (
              <li key={m.year}>
                <span className="about-year">{m.year}</span>
                <span>{m.text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-section" aria-labelledby="labs">
          <h2 id="labs">TICGAL Labs</h2>
          <p>
            We value the human element: critical and creative thinking over mere task execution. Labs is where a
            “what if” becomes something you can deploy today — then the lessons flow back into our core services.{' '}
            <em>A cabeza non para</em> — the mind never rests.
          </p>
          <div className="landing-cta-actions">
            <a className="landing-secondary" href={LABS_URL}>See other Labs projects</a>
            <a className="landing-secondary" href={REPO_URL}>AnonymAIzer on GitHub</a>
            <a className="landing-primary" {...linkProps('/app')}>Try AnonymAIzer</a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
