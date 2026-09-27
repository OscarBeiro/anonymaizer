import { useRef, useState } from 'react';
import '../lib/parsers';
import { supportedExtensions } from '../core/parsers';
import { setHandoff } from '../lib/handoff';
import { linkProps, navigate } from '../lib/router';
import { PORTABLE_DOWNLOAD_URL, REPO_URL } from '../site';
import { SiteFooter } from './SiteFooter';
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
      <header className="landing-nav">
        <a className="landing-brand" {...linkProps('/')}>
          <span className="app-mark" aria-hidden="true">A</span> AnonymAIzer
        </a>
        <nav aria-label="Main">
          <a {...linkProps('/#privacy')}>How private?</a>
          <a {...linkProps('/app')} className="landing-nav-cta">Open the tool</a>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <h1>Take the personal data out before you ask the AI. Put it back after.</h1>
            <p className="landing-lede">
              AnonymAIzer swaps names, IDs, bank details and other identifiers for placeholders, then restores
              them in the AI's reply. It runs entirely in your browser: there is no server, and your text is never
              uploaded.
            </p>
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

        <section className="landing-section landing-privacy" id="privacy" aria-labelledby="privacy-title">
          <h2 id="privacy-title">Your data never leaves this tab</h2>
          <ul className="landing-claims">
            <li>
              <strong>No backend.</strong> There is no server to receive your document — the detection, the
              placeholders and the restoring are JavaScript running on your device.
            </li>
            <li>
              <strong>Nothing is uploaded.</strong> Documents are parsed in the browser. Your current session is
              kept in this browser's local storage so a reload loses nothing, and you can wipe it from Settings.
            </li>
            <li>
              <strong>Open source.</strong> You can read exactly what it does <a href={REPO_URL}>on GitHub</a>.
            </li>
          </ul>
          <p className="landing-exceptions-title">Two exceptions, stated precisely:</p>
          <ul className="landing-exceptions">
            <li>
              <strong>The optional AI name detector.</strong> If you switch it on, your browser downloads a ~104MB
              language model once, from Hugging Face, and caches it. That request reveals your IP address to the
              host. Your text is not sent — the model runs locally.
            </li>
            <li>
              <strong>Analytics on this website, only if you accept them.</strong> Page views, never the content
              you process, a file name or anything detected in it. Reject and nothing loads. The offline version
              has none at all. Details in the <a {...linkProps('/cookies')}>cookie policy</a>.
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

        <section className="landing-section" aria-labelledby="offline">
          <h2 id="offline">Works offline, too</h2>
          <p>
            Download the portable version: a single HTML file that runs from your disk with no network at all —
            no analytics, no updates, nothing to install. Useful when the documents are too sensitive for any
            website, including this one.
          </p>
          <a className="landing-secondary" href={PORTABLE_DOWNLOAD_URL}>
            Download the offline version
          </a>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
