import { useRef, useState } from 'react';
import '../lib/parsers';
import { supportedExtensions } from '../core/parsers';
import { setHandoff } from '../lib/handoff';
import { linkProps, navigate } from '../lib/router';
import { LABS_URL, PORTABLE_DOWNLOAD_URL } from '../site';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';
import './landing.css';

const STEPS = [
  {
    title: 'Paste or drop a document',
    body: 'Text, Word, PDF, spreadsheets, slides or an email. It is read inside this tab.',
  },
  {
    title: 'Review what gets hidden',
    body: 'Names, companies, IDs, IBANs, emails, phones and amounts become placeholders like [[NAME_001]]. You decide what stays.',
  },
  {
    title: 'Send it, then restore the answer',
    body: 'Paste the sanitized text into any AI. When the reply comes back, paste it here and the real values return.',
  },
];

const DETECTS = [
  {
    title: 'People & companies',
    body: 'Personal names and company names, with an optional on-device AI model for the tricky ones.',
  },
  {
    title: 'Identity documents',
    body: 'DNI and NIE numbers, other ID codes and already-masked IDs.',
  },
  {
    title: 'Money & banking',
    body: 'IBANs, card numbers and amounts — kept consistent so the AI can still reason about them.',
  },
  {
    title: 'Contact details',
    body: 'Emails, phone numbers and postal addresses.',
  },
  {
    title: 'Your own rules',
    body: 'Add your own terms and patterns for project names, client codes, anything.',
  },
  {
    title: 'Same value, same placeholder',
    body: 'Every occurrence maps to one placeholder, so the text stays coherent — and fully reversible.',
  },
];

const AUDIENCES = [
  {
    title: 'Healthcare',
    who: 'Doctors, nurses, therapists, pharmacists, carers',
    body: 'Summarise case notes, draft referral letters or patient information in plain language — without a patient’s identity leaving your hands.',
  },
  {
    title: 'Legal',
    who: 'Lawyers, paralegals, notaries, advisers, mediators',
    body: 'Review contracts, prepare briefs or answer clients faster, while professional secrecy stays intact.',
  },
  {
    title: 'Education',
    who: 'Teachers, tutors, counsellors, school administrators',
    body: 'Write reports, feedback and letters to families about real students, without naming them to an AI.',
  },
  {
    title: 'People & social care',
    who: 'HR teams, recruiters, social workers, psychologists',
    body: 'Screen CVs, write evaluations or case reports about people who never agreed to be sent to a chatbot.',
  },
  {
    title: 'Finance & administration',
    who: 'Accountants, tax advisers, bank and insurance staff, civil servants',
    body: 'Work on invoices, statements, claims and forms full of IDs and IBANs, with the numbers kept consistent.',
  },
  {
    title: 'Support & IT',
    who: 'Help desks, service managers, consultants',
    body: 'Analyse tickets, logs and email threads from customers and colleagues without exposing who wrote them.',
  },
];

const USE_CASES = [
  {
    title: 'A medical report',
    question: 'Would you paste your lab results or a diagnosis into a chatbot?',
    risk: 'Health data is a special category under the GDPR. The report carries your name, date of birth, patient and ID numbers, your doctor and the hospital — once sent, you cannot take it back, and it may be stored, reviewed by people or used for training.',
    fix: 'Ask the AI to explain the terms or draft questions for your doctor. It sees [[NAME_001]] and the medicine; you get the answer back with the real names.',
  },
  {
    title: 'A legal document',
    question: 'Would you upload a contract, a lawsuit or a settlement?',
    risk: 'It names every party, their ID numbers, addresses, bank accounts and the amounts at stake. Much of it may be covered by confidentiality clauses or professional secrecy.',
    fix: 'Get a summary, a risk review or a plain-language rewrite while parties, IBANs and figures stay placeholders. Amounts stay consistent, so the reasoning still holds.',
  },
  {
    title: 'A CV',
    question: 'Would you share a candidate’s CV — or your own — to polish or screen it?',
    risk: 'A CV is a full profile: name, phone, email, home address, sometimes an ID number and date of birth, plus every employer and date. For a recruiter, it is someone else’s personal data.',
    fix: 'Improve the wording, tailor it to a job offer or compare candidates without exposing who they are, then restore the details in the final version.',
  },
];

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
            <p className="landing-eyebrow">Free · open source · no sign-up</p>
            <h1>Take the personal data out before you ask the AI. Put it back after.</h1>
            <p className="landing-lede">
              AnonymAIzer swaps names, IDs, bank details and other identifiers for placeholders, then restores them in
              the AI's reply.{' '}
              <strong>It runs entirely in your browser: there is no server, and your text is never uploaded.</strong>
            </p>
            <ul className="landing-badges">
              <li>Runs 100% in your browser</li>
              <li>Works with any AI</li>
              <li>Reversible</li>
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
              Paste text, or drop a file
            </label>
            <textarea
              id="landing-paste"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Dear Ms. García, regarding contract 2024-118 with Acme S.L. …"
              rows={6}
            />
            <div className="landing-cta-actions">
              <button type="button" className="landing-primary" onClick={startWithText}>
                {text.trim() ? 'Anonymize this text' : 'Open the tool'}
              </button>
              <button type="button" className="landing-secondary" onClick={() => fileRef.current?.click()}>
                Choose a file
              </button>
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
            <p className="landing-cta-note">Nothing you put here leaves this tab.</p>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="how">
          <h2 id="how">How it works</h2>
          <ol className="landing-steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="landing-step-number">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-section" aria-labelledby="detects">
          <h2 id="detects">What it catches</h2>
          <ul className="landing-cards landing-cards-3">
            {DETECTS.map((d) => (
              <li key={d.title}>
                <h3>{d.title}</h3>
                <p>{d.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-section" aria-labelledby="realistic">
          <h2 id="realistic">Placeholders — or realistic fake data</h2>
          <p>Choose how the hidden values look in the text you send (Realistic is in Fine-tune mode).</p>
          <div className="landing-modes">
            <div className="landing-mode">
              <h3>Placeholders (reversible)</h3>
              <p className="landing-mode-sample">
                <code>[[NAME_001]]</code> signed with <code>[[COMPANY_001]]</code> for <code>[[MONEY_001]]</code>.
              </p>
              <p>Obvious tokens the AI keeps intact, so its reply can be restored to the real values. The default.</p>
            </div>
            <div className="landing-mode">
              <h3>Realistic (one-way)</h3>
              <p className="landing-mode-sample">
                <em>Emily Carter</em> signed with <em>Northbridge Holdings Ltd</em> for <em>£13,870.00</em>.
              </p>
              <p>
                Names and companies are swapped for invented ones and amounts shift by a percentage you choose, keeping
                the same format and magnitude. The text reads naturally — good for examples, demos or sharing — but it
                cannot be restored. IDs, IBANs and cards stay as placeholders: a fake number that looks valid is worse
                than an obvious one.
              </p>
            </div>
          </div>

          <h3 className="landing-subhead">What Realistic is for: test data that behaves like the real thing</h3>
          <p>
            Developers, testers and analysts need data to build and check software. Invented data is too clean: it
            misses the odd formats, the long names and the awkward edge cases real documents are full of. Real data is
            perfect — and exactly what you must not copy into a test system, a bug report or a demo.
          </p>
          <p>
            Realistic mode gives you both: your real documents, heavily altered. The structure, the layout and the
            formats stay the same; the people, the companies and the figures do not.
          </p>
          <ul className="landing-claims">
            <li>
              <strong>Invoices.</strong> Clients and suppliers become invented companies, amounts shift but keep their
              currency, decimals and grouping — so totals still look plausible and parsers still get real-world input.
            </li>
            <li>
              <strong>Payroll and salaries.</strong> Employees get fake names and every salary moves, so nobody’s pay
              can be read off the file, yet the spread and the formats remain realistic for testing reports and imports.
            </li>
            <li>
              <strong>Tickets, contracts, emails.</strong> Seed a staging environment, write a reproducible bug report
              or record a demo with documents that look genuine and expose no one.
            </li>
          </ul>
          <p>Within a session, the document always renders the same fake values, so you can re-export it and compare runs.</p>
        </section>

        <section className="landing-section landing-privacy" id="privacy" aria-labelledby="privacy-title">
          <h2 id="privacy-title">Your data never leaves this tab</h2>
          <ul className="landing-claims">
            <li>
              <strong>No backend.</strong> There is no server to receive your document — the detection, the placeholders
              and the restoring are JavaScript running on your device.
            </li>
            <li>
              <strong>Nothing is uploaded.</strong> Documents are parsed in the browser. Your current session is kept in
              this browser's local storage so a reload loses nothing, and you can wipe it from Settings.
            </li>
          </ul>
          <p className="landing-exceptions-title">Two exceptions, stated precisely:</p>
          <ul className="landing-exceptions">
            <li>
              <strong>The optional AI name detector.</strong> If you switch it on, your browser downloads a ~104MB
              language model once, from Hugging Face, and caches it. That request reveals your IP address to the host.
              Your text is not sent — the model runs locally.
            </li>
            <li>
              <strong>Analytics on this website, only if you accept them.</strong> Page views, never the content you
              process, a file name or anything detected in it. Reject and nothing loads. The offline version has none at
              all. Details in the <a {...linkProps('/cookies')}>cookie policy</a>.
            </li>
          </ul>
        </section>

        <section className="landing-section" aria-labelledby="formats">
          <h2 id="formats">Supported formats</h2>
          <p>
            Plain text and pasted rich text, plus{' '}
            {supportedExtensions()
              .filter((e) => e !== 'txt' && e !== 'md')
              .map((e) => `.${e}`)
              .join(', ')}
            . Sanitized output can be copied or saved back as a file.
          </p>
        </section>

        <section className="landing-section" aria-labelledby="use-cases">
          <h2 id="use-cases">Would you upload this to an AI?</h2>
          <p>Probably not as it is. With AnonymAIzer, you can still get the help.</p>
          <ul className="landing-cards landing-cards-3 landing-cases">
            {USE_CASES.map((c) => (
              <li key={c.title}>
                <h3>{c.title}</h3>
                <p className="landing-case-question">{c.question}</p>
                <p>
                  <strong>The problem.</strong> {c.risk}
                </p>
                <p>
                  <strong>With AnonymAIzer.</strong> {c.fix}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-section" aria-labelledby="audiences">
          <h2 id="audiences">For anyone trusted with other people’s data</h2>
          <p>
            If your job means handling someone else’s personal details, you are responsible for where they go.
            AnonymAIzer lets you use AI on that work without handing the details over.
          </p>
          <ul className="landing-cards landing-cards-3">
            {AUDIENCES.map((a) => (
              <li key={a.title}>
                <h3>{a.title}</h3>
                <p className="landing-audience-who">{a.who}</p>
                <p>{a.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="landing-section" aria-labelledby="offline">
          <h2 id="offline">Works offline, too</h2>
          <p>
            Download the portable version: a single HTML file that runs from your disk with no network at all — no
            analytics, no updates, nothing to install. Useful when the documents are too sensitive for any website,
            including this one.
          </p>
          <a className="landing-secondary" href={PORTABLE_DOWNLOAD_URL}>
            Download the offline version
          </a>
        </section>

        <section className="landing-section landing-labs" aria-labelledby="labs">
          <p className="landing-eyebrow">A TICGAL Labs project</p>
          <h2 id="labs">Built by people who handle sensitive data every day (and who doesn’t?)</h2>
          <p>
            AnonymAIzer comes from <a href={LABS_URL}>TICGAL Labs</a>, where the TICGAL team — a GLPI Network Platinum
            Partner from Pontevedra, Galicia — turns “what if” ideas into working tools.
          </p>
          <p className="about-motto">Local Roots, Global Reach IT.</p>
          <p>
            That is why AnonymAIzer is being built for more than one language: it handles Spanish documents today, and
            packs for Galician — our own language — and Portuguese are on the way.
          </p>
          <a className="landing-secondary" {...linkProps('/about')}>
            About us
          </a>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
