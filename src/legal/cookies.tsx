import { t, type TranslationKey } from '../i18n';
import { BrandText } from '../components/BrandName';
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

const ROWS: (lang: LegalLang) => Row[] = (lang) => ([
  {
    name: 'anonymaizer.consent',
    provider: 'AnonymAIzer (first party)',
    purpose: [t('cookies.remembers_your_analytics_choice_and_when_you', {}, lang), "Recuerda tu elección sobre analítica y cuándo la hiciste"],
    type: [t('cookies.technical_exempt_from_consent_local_storage_not', {}, lang), 'Técnica, exenta de consentimiento; almacenamiento local, no es una cookie'],
    duration: [t('cookies.until_you_clear_it_re_asked_when', {}, lang), "Hasta que la borres; se vuelve a preguntar si cambia esta política"],
  },
  {
    name: '_ga',
    provider: 'Google (Google Analytics 4)',
    purpose: [t('cookies.distinguishes_visitors_with_a_random_identifier', {}, lang), "Distingue visitantes mediante un identificador aleatorio"],
    type: [t('cookies.analytics_first_party_consent_required', {}, lang), "Analítica, propia, requiere consentimiento"],
    duration: [t('cookies.two_years', {}, lang), '2 años'],
  },
  {
    name: '_ga_{{GA4_MEASUREMENT_ID}}',
    provider: 'Google (Google Analytics 4)',
    purpose: [t('cookies.keeps_session_state', {}, lang), "Mantiene el estado de la sesión"],
    type: [t('cookies.analytics_first_party_consent_required', {}, lang), "Analítica, propia, requiere consentimiento"],
    duration: [t('cookies.two_years', {}, lang), '2 años'],
  },
  {
    name: '{{METRICOOL_COOKIES}}',
    provider: 'Metricool Software S.L.',
    purpose: [t('cookies.web_traffic_statistics', {}, lang), "Estadísticas de tráfico web"],
    type: [t('cookies.analytics_consent_required', {}, lang), "Analítica, requiere consentimiento"],
    duration: ['{{METRICOOL_COOKIE_DURATION}}', '{{METRICOOL_COOKIE_DURATION}}'],
  },
]);

const Table = ({ lang }: { lang: LegalLang }) => {
  const translate = (key: TranslationKey) => t(key, {}, lang);
  const i = lang === 'es' ? 1 : 0;
  const head = lang === 'es' ? ['Nombre', 'Proveedor', 'Finalidad', 'Tipo', 'Duración'] : [translate('cookies.name'), translate('cookies.provider'), translate('cookies.purpose'), translate('cookies.type'), translate('cookies.duration')];
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
          {ROWS(lang).map((r) => (
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

const En = ({ lang }: { lang: LegalLang }) => {
  const translate = (key: TranslationKey) => t(key, {}, lang);
  return (
  <>
    <h1>{translate('cookies.cookie_policy')}</h1>
    <p>
      {translate('cookies.this_site_uses_cookies_only_for_analytics')}</p>
    <p>
      {translate('cookies.this_follows_art_22_2_of_spanish')}</p>

    <h2>{translate('cookies.cookies_and_similar_storage_we_use')}</h2>
    <Table lang={lang} />
    <p>
      {translate('cookies.the_app_also_keeps_your_session_rules')}{' '}
      <a href="/privacy">{translate('cookies.privacy_policy')}</a>.
    </p>

    <h2>{translate('cookies.changing_or_withdrawing_your_consent')}</h2>
    <p>
      {translate('cookies.you_can_change_your_choice_at_any')}</p>
    <ChangeChoice label={translate('cookies.change_cookie_settings')} />

    <h2>{translate('cookies.blocking_cookies_in_your_browser')}</h2>
    <p>{translate('cookies.you_can_also_block_or_delete_cookies')}</p>
    <ul>
      <li>{translate('cookies.chrome_settings_privacy_and_security_third_party')}</li>
      <li>{translate('cookies.firefox_settings_privacy_security_cookies_and_site')}</li>
      <li>{translate('cookies.safari_settings_privacy_manage_website_data')}</li>
      <li>{translate('cookies.edge_settings_cookies_and_site_permissions')}</li>
    </ul>
    <p>
      {translate('cookies.google_also_offers_an_opt_out_add')}</p>
  </>
);
};

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

export const Cookies = ({ lang }: { lang: LegalLang }) => (lang === 'es' ? <Es /> : <En lang={lang} />);
