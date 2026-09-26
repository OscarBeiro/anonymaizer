import { requestConsentBanner } from '../lib/consentBus';
import type { LegalLang } from './meta';

// P20 — DRAFT FOR LEGAL REVIEW. Verify every row against the live tags before
// publication (the AEPD expects the table to match what is actually set):
// GA4's cookie names carry the measurement ID, and Metricool's set is
// {{METRICOOL_COOKIES}} until checked in a browser with the tag loaded.

interface Row {
  name: string;
  provider: string;
  purpose: [en: string, es: string];
  type: [en: string, es: string];
  duration: [en: string, es: string];
}

const ROWS: Row[] = [
  {
    name: 'anonymaizer.consent',
    provider: 'AnonymAIzer (first party)',
    purpose: ['Remembers your analytics choice and when you made it', 'Recuerda tu elección sobre analítica y cuándo la hiciste'],
    type: ['Technical, exempt from consent; local storage, not a cookie', 'Técnica, exenta de consentimiento; almacenamiento local, no es una cookie'],
    duration: ['Until you clear it; re-asked when this policy changes', 'Hasta que la borres; se vuelve a preguntar si cambia esta política'],
  },
  {
    name: '_ga',
    provider: 'Google (Google Analytics 4)',
    purpose: ['Distinguishes visitors with a random identifier', 'Distingue visitantes mediante un identificador aleatorio'],
    type: ['Analytics, first-party, consent required', 'Analítica, propia, requiere consentimiento'],
    duration: ['2 years', '2 años'],
  },
  {
    name: '_ga_{{GA4_MEASUREMENT_ID}}',
    provider: 'Google (Google Analytics 4)',
    purpose: ['Keeps session state', 'Mantiene el estado de la sesión'],
    type: ['Analytics, first-party, consent required', 'Analítica, propia, requiere consentimiento'],
    duration: ['2 years', '2 años'],
  },
  {
    name: '{{METRICOOL_COOKIES}}',
    provider: 'Metricool Software S.L.',
    purpose: ['Web traffic statistics', 'Estadísticas de tráfico web'],
    type: ['Analytics, consent required', 'Analítica, requiere consentimiento'],
    duration: ['{{METRICOOL_COOKIE_DURATION}}', '{{METRICOOL_COOKIE_DURATION}}'],
  },
];

const Table = ({ lang }: { lang: LegalLang }) => {
  const i = lang === 'es' ? 1 : 0;
  const head = lang === 'es' ? ['Nombre', 'Proveedor', 'Finalidad', 'Tipo', 'Duración'] : ['Name', 'Provider', 'Purpose', 'Type', 'Duration'];
  return (
    <div className="legal-table-wrap">
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.name}>
              <td>
                <code>{r.name}</code>
              </td>
              <td>{r.provider}</td>
              <td>{r.purpose[i]}</td>
              <td>{r.type[i]}</td>
              <td>{r.duration[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ChangeChoice = ({ label }: { label: string }) => (
  <button type="button" className="landing-secondary" onClick={requestConsentBanner}>
    {label}
  </button>
);

const En = () => (
  <>
    <h1>Cookie policy</h1>
    <p>
      This site uses cookies only for analytics, and only after you accept them in the banner. Rejecting is as easy
      as accepting, and the site and the tool work exactly the same either way. The anonymization tool itself uses
      no cookies. The offline (portable) version, and any copy not served from our public website, loads no
      analytics at all.
    </p>
    <p>
      This follows art. 22.2 of Spanish Law 34/2002 (LSSI-CE), which requires informed consent before storing or
      reading non-essential information on your device, and the Spanish Data Protection Agency's (AEPD) guide on
      the use of cookies.
    </p>

    <h2>Cookies and similar storage we use</h2>
    <Table lang="en" />
    <p>
      The app also keeps your session, rules and settings in local storage so a reload loses nothing. That data is
      strictly necessary for the service you asked for, never leaves your device, and is described in the{' '}
      <a href="/privacy">privacy policy</a>.
    </p>

    <h2>Changing or withdrawing your consent</h2>
    <p>
      You can change your choice at any time. Withdrawing stops analytics from loading and deletes the Google
      Analytics cookies this site can reach.
    </p>
    <ChangeChoice label="Change cookie settings" />

    <h2>Blocking cookies in your browser</h2>
    <p>You can also block or delete cookies from your browser's settings:</p>
    <ul>
      <li>Chrome: Settings → Privacy and security → Third-party cookies / Site data.</li>
      <li>Firefox: Settings → Privacy &amp; Security → Cookies and Site Data.</li>
      <li>Safari: Settings → Privacy → Manage Website Data.</li>
      <li>Edge: Settings → Cookies and site permissions.</li>
    </ul>
    <p>
      Google also offers an opt-out add-on for Google Analytics at tools.google.com/dlpage/gaoptout.
    </p>
  </>
);

const Es = () => (
  <>
    <h1>Política de cookies</h1>
    <p>
      Este sitio usa cookies solo para analítica, y solo después de que las aceptes en el aviso. Rechazar es tan
      fácil como aceptar, y el sitio y la herramienta funcionan exactamente igual en ambos casos. La herramienta de
      anonimización no usa cookies. La versión sin conexión (portable), y cualquier copia que no se sirva desde
      nuestro sitio web público, no carga ninguna analítica.
    </p>
    <p>
      Se sigue el art. 22.2 de la Ley 34/2002 (LSSI-CE), que exige consentimiento informado antes de almacenar o leer
      información no esencial en tu dispositivo, y la Guía sobre el uso de las cookies de la Agencia Española de
      Protección de Datos (AEPD).
    </p>

    <h2>Cookies y almacenamiento similar que usamos</h2>
    <Table lang="es" />
    <p>
      La aplicación guarda además tu sesión, reglas y ajustes en el almacenamiento local para que una recarga no
      pierda nada. Esos datos son estrictamente necesarios para el servicio que solicitas, nunca salen de tu
      dispositivo y se describen en la <a href="/privacy?lang=es">política de privacidad</a>.
    </p>

    <h2>Cambiar o retirar tu consentimiento</h2>
    <p>
      Puedes cambiar tu elección en cualquier momento. Al retirarlo, la analítica deja de cargarse y se borran las
      cookies de Google Analytics a las que este sitio puede acceder.
    </p>
    <ChangeChoice label="Configurar cookies" />

    <h2>Bloquear cookies desde el navegador</h2>
    <p>También puedes bloquear o borrar cookies desde la configuración de tu navegador:</p>
    <ul>
      <li>Chrome: Configuración → Privacidad y seguridad → Cookies de terceros / Datos de sitios.</li>
      <li>Firefox: Ajustes → Privacidad y seguridad → Cookies y datos del sitio.</li>
      <li>Safari: Ajustes → Privacidad → Gestionar datos de sitios web.</li>
      <li>Edge: Configuración → Cookies y permisos del sitio.</li>
    </ul>
    <p>Google ofrece además un complemento de inhabilitación de Google Analytics en tools.google.com/dlpage/gaoptout.</p>
  </>
);

export const Cookies = ({ lang }: { lang: LegalLang }) => (lang === 'es' ? <Es /> : <En />);
