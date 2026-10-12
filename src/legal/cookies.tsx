import { BrandText } from '../components/BrandName';
import { requestConsentBanner } from '../lib/consentBus';
import type { LegalLang } from './meta';

// The table reflects current first-party consent storage; tracker scripts are removed.

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
              <td><BrandText text={r.provider} /></td>
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
      This version loads no analytics scripts and sets no analytics cookies. Visit events are omitted until a compatible audited browser transport is selected. Rejecting is as easy
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
      Documents and new dictionary rules stay in memory by default. You may separately choose to retain a document or dictionary in plaintext browser storage. Non-sensitive settings and consent preferences may persist. These choices are described in the{' '}
      <a href="/privacy">privacy policy</a>.
    </p>

    <h2>Changing or withdrawing your consent</h2>
    <p>
      You can change your choice at any time. Withdrawing consent prevents future visit events. This version sends no analytics events. Browser settings can remove cookies retained by older versions.
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
      The portable, localhost and self-hosted builds perform no analytics.
    </p>
  </>
);

const Es = () => (
  <>
    <h1>Política de cookies</h1>
    <p>
      Esta versión no carga scripts de analítica ni establece cookies de analítica. Los eventos de visita se omiten hasta elegir un transporte de navegador compatible y auditado. Rechazar es tan
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
      Los documentos y las reglas nuevas permanecen en memoria por defecto. Puedes elegir por separado recordar documentos o reglas en el almacenamiento local, sin cifrar. Los ajustes no sensibles y el consentimiento pueden persistir. Estas opciones se describen en la <a href="/privacy?lang=es">política de privacidad</a>.
    </p>

    <h2>Cambiar o retirar tu consentimiento</h2>
    <p>
      Puedes cambiar tu elección en cualquier momento. Retirarla impide futuros eventos de visita. Esta versión no envía eventos. Puedes borrar cookies de versiones anteriores desde tu navegador.
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
    <p>Las versiones portable, localhost y autoalojadas no realizan analítica.</p>
  </>
);

export const Cookies = ({ lang }: { lang: LegalLang }) => (lang === 'es' ? <Es /> : <En />);
