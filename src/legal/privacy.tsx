import { t, type TranslationKey } from '../i18n';
import { BrandName } from '../components/BrandName';
import { OPERATOR as o, SITE_ORIGIN } from '../site';
import type { LegalLang } from './meta';

// P20 — DRAFT FOR LEGAL REVIEW, not legal advice. Every double-brace placeholder comes
// from src/site.ts and must be filled before publication.

const AEPD_ES = "Agencia Española de Protección de Datos (AEPD), C/ Jorge Juan, 6, 28001 Madrid — www.aepd.es";

const En = ({ lang }: { lang: LegalLang }) => {
  const translate = (key: TranslationKey) => t(key, {}, lang);
  return (
  <>
    <h1>{translate('privacy.privacy_policy')}</h1>

    <h2>{translate('privacy.1_the_short_version')}</h2>
    <p>
      <strong>
        <BrandName /> {translate('privacy.has_no_backend_the_text_and_documents')}</strong>{' '}
      {translate('privacy.we_cannot_see_store_or_recover_them')}</p>

    <h2>{translate('privacy.2_who_is_responsible')}</h2>
    <p>
      {translate('privacy.controller')}{o.legalName}{translate('privacy.tax_id_nif')}{o.nif}, {o.address}{translate('privacy.contact')}<a href={`mailto:${o.contactEmail}`}>{o.contactEmail}</a>{translate('privacy.data_protection_officer')}{o.dpo}.
    </p>

    <h2>{translate('privacy.3_what_is_not_processed')}</h2>
    <ul>
      <li>
        {translate('privacy.the_content_you_paste_or_import_the')}</li>
      <li>
        {translate('privacy.our_analytics_never_receive_any_of_the')}</li>
    </ul>
    <p>
      {translate('privacy.if_the_documents_you_process_contain_personal')}<strong>{translate('privacy.you')}</strong> {translate('privacy.are_the_controller_of_that_processing_under')}<a href="/terms">{translate('privacy.terms_of_use')}</a>).
    </p>

    <h2>{translate('privacy.4_what_is_processed_why_and_on')}</h2>
    <table>
      <thead>
        <tr>
          <th>{translate('privacy.processing')}</th>
          <th>{translate('privacy.data')}</th>
          <th>{translate('privacy.purpose')}</th>
          <th>{translate('privacy.legal_basis')}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{translate('privacy.web_analytics_google_analytics_4_metricool')}</td>
          <td>
            {translate('privacy.pseudonymous_cookie_identifiers_pages_visited_approximate_location')}</td>
          <td>{translate('privacy.understand_how_many_people_use_the_site')}</td>
          <td>{translate('privacy.your_consent_gdpr_art_6_1_a')}</td>
        </tr>
        <tr>
          <td>{translate('privacy.hosting_and_delivery_cloudflare')}</td>
          <td>{translate('privacy.ip_address_request_metadata_in_server_logs')}</td>
          <td>{translate('privacy.deliver_the_site_and_protect_it_against')}</td>
          <td>{translate('privacy.legitimate_interest_in_operating_a_secure_website')}</td>
        </tr>
        <tr>
          <td>{translate('privacy.optional_ai_model_download')}</td>
          <td>{translate('privacy.your_ip_address_and_request_metadata_received')}</td>
          <td>{translate('privacy.download_the_name_detection_model_to_your')}</td>
          <td>
            {translate('privacy.your_request_you_switch_it_on_we')}</td>
        </tr>
        <tr>
          <td>{translate('privacy.emails_you_send_us')}</td>
          <td>{translate('privacy.your_address_and_message')}</td>
          <td>{translate('privacy.answer_you')}</td>
          <td>{translate('privacy.legitimate_interest_in_replying_gdpr_art_6')}</td>
        </tr>
      </tbody>
    </table>

    <h2>{translate('privacy.5_data_stored_on_your_device')}</h2>
    <p>
      {translate('privacy.the_app_keeps_its_state_in_your')}<em>{translate('privacy.settings_clear_all_local_data')}</em>{translate('privacy.or_by_clearing_this_site_s_data')}</p>

    <h2>{translate('privacy.6_recipients')}</h2>
    <ul>
      <li>{translate('privacy.google_ireland_ltd_google_llc_google_analytics')}</li>
      <li>{translate('privacy.metricool_software_s_l_metricool_analytics_only')}</li>
      <li>{translate('privacy.cloudflare_inc_hosting_and_content_delivery')}</li>
      <li>
        {translate('privacy.hugging_face_inc_and_jsdelivr_prospect_one')}</li>
    </ul>
    <p>{translate('privacy.we_do_not_sell_data_or_use')}</p>

    <h2>{translate('privacy.7_international_transfers')}</h2>
    <p>
      {translate('privacy.google_analytics_and_cloudflare_may_transfer_data')}</p>

    <h2>{translate('privacy.8_retention')}</h2>
    <ul>
      <li>{translate('privacy.google_analytics_4_event_data_retained_for')}</li>
      <li>{translate('privacy.metricool')}{'{{METRICOOL_RETENTION}}'}.</li>
      <li>{translate('privacy.cloudflare_logs_per_cloudflare_s_standard_retention')}{'{{CLOUDFLARE_LOG_RETENTION}}'}.</li>
      <li>{translate('privacy.emails_as_long_as_needed_to_handle')}</li>
      <li>{translate('privacy.local_storage_until_you_delete_it')}</li>
    </ul>

    <h2>{translate('privacy.9_your_rights')}</h2>
    <p>
      {translate('privacy.under_gdpr_arts_15_22_you_may')}{' '}
      <a href={`mailto:${o.contactEmail}`}>{o.contactEmail}</a> {translate('privacy.with_proof_of_identity_note_that_we')}{' '}
      <a href="/cookies">{translate('privacy.cookie_policy')}</a>.
    </p>
    <p>{translate('privacy.if_you_believe_your_rights_have_not')}{translate('privacy.spanish_data_protection_agency_aepd_c_jorge')}.</p>

    <h2>{translate('privacy.10_changes')}</h2>
    <p>
      {translate('privacy.we_will_publish_any_change_on_this')}{SITE_ORIGIN}{translate('privacy.privacy_if_a_change_affects_what_analytics')}</p>
  </>
);
};

const Es = () => (
  <>
    <h1>Política de privacidad</h1>

    <h2>1. En resumen</h2>
    <p>
      <strong>
        <BrandName /> no tiene servidor. Los textos y documentos que anonimizas se procesan únicamente en tu navegador y
        nunca se envían a nosotros ni a nadie.
      </strong>{' '}
      No podemos verlos, guardarlos ni recuperarlos. Esta política cubre, por tanto, lo poco que sí implica datos
      personales: la analítica de este sitio web (solo si la aceptas), el alojamiento del sitio y la descarga
      opcional del modelo de IA de detección de nombres.
    </p>

    <h2>2. Responsable del tratamiento</h2>
    <p>
      {o.legalName}, NIF {o.nif}, {o.address}. Contacto: <a href={`mailto:${o.contactEmail}`}>{o.contactEmail}</a>.
      Delegado de protección de datos: {o.dpo}.
    </p>

    <h2>3. Qué no tratamos</h2>
    <ul>
      <li>
        El contenido que pegas o importas, los archivos que abres, sus nombres, las entidades detectadas, los
        marcadores y el texto restaurado. Todo ello permanece en tu dispositivo.
      </li>
      <li>
        La analítica nunca recibe nada de lo anterior, ni siquiera un recuento. Solo mide páginas vistas e
        interacciones generales.
      </li>
    </ul>
    <p>
      Si los documentos que procesas contienen datos personales de terceros, <strong>tú</strong> eres el responsable
      de ese tratamiento según el RGPD y te corresponde contar con una base jurídica. La herramienta te ayuda a
      minimizar lo que compartes con servicios de IA de terceros; no convierte por sí sola esa comunicación en
      lícita, y la detección automática puede pasar datos por alto (ver las <a href="/terms?lang=es">condiciones de uso</a>).
    </p>

    <h2>4. Qué tratamos, para qué y con qué base jurídica</h2>
    <table>
      <thead>
        <tr>
          <th>Tratamiento</th>
          <th>Datos</th>
          <th>Finalidad</th>
          <th>Base jurídica</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Analítica web (Google Analytics 4, Metricool)</td>
          <td>
            Identificadores seudónimos en cookies, páginas visitadas, ubicación aproximada derivada de una IP
            truncada, tipo de dispositivo y navegador, página de procedencia
          </td>
          <td>Saber cuántas personas usan el sitio y cómo llegan a él</td>
          <td>Tu consentimiento, art. 6.1.a RGPD y art. 22.2 LSSI-CE. No se carga nada hasta que aceptas.</td>
        </tr>
        <tr>
          <td>Alojamiento y distribución (Cloudflare)</td>
          <td>Dirección IP y metadatos de la petición en los registros del servidor</td>
          <td>Servir el sitio y protegerlo frente a abusos</td>
          <td>Interés legítimo en operar un sitio web seguro, art. 6.1.f RGPD</td>
        </tr>
        <tr>
          <td>Descarga opcional del modelo de IA</td>
          <td>Tu dirección IP y metadatos de la petición, que recibe el proveedor del modelo</td>
          <td>Descargar una vez el modelo de detección de nombres en tu navegador, cuando lo activas</td>
          <td>
            Tu solicitud (lo activas tú). Nosotros no recibimos estos datos; Hugging Face y jsDelivr actúan como
            proveedores independientes.
          </td>
        </tr>
        <tr>
          <td>Correos que nos envíes</td>
          <td>Tu dirección y tu mensaje</td>
          <td>Responderte</td>
          <td>Interés legítimo en responder, art. 6.1.f RGPD</td>
        </tr>
      </tbody>
    </table>

    <h2>5. Datos guardados en tu dispositivo</h2>
    <p>
      La aplicación guarda su estado en el almacenamiento local de tu navegador para que una recarga no pierda nada:
      la sesión actual (texto, marcadores y sus originales), tus reglas personalizadas, tus ajustes (categorías de
      detección, modo de salida, tema) y tu decisión sobre cookies. El modelo de IA, si lo descargas, se guarda en
      IndexedDB. Nada de esto sale de tu dispositivo. Puedes borrarlo todo en cualquier momento desde{' '}
      <em>Ajustes → Borrar todos los datos locales</em>, o borrando los datos de este sitio en tu navegador.
    </p>

    <h2>6. Destinatarios</h2>
    <ul>
      <li>Google Ireland Ltd. / Google LLC — Google Analytics 4 (solo con consentimiento).</li>
      <li>Metricool Software S.L. — analítica de Metricool (solo con consentimiento).</li>
      <li>Cloudflare, Inc. — alojamiento y distribución de contenidos.</li>
      <li>
        Hugging Face, Inc. y jsDelivr (Prospect One) — solo si activas el modelo de IA, y solo para la descarga.
      </li>
    </ul>
    <p>No vendemos datos ni los usamos con fines publicitarios.</p>

    <h2>7. Transferencias internacionales</h2>
    <p>
      Google Analytics y Cloudflare pueden transferir datos a Estados Unidos. Google LLC y Cloudflare, Inc. están
      certificadas en el Marco de Privacidad de Datos UE-EE. UU. (decisión de adecuación de la Comisión de 10 de julio
      de 2023) y ofrecen además las Cláusulas Contractuales Tipo de la Comisión Europea (Decisión (UE) 2021/914) como
      garantía. GA4 está configurado sin señales publicitarias ni identificadores de usuario, y Google Analytics 4
      no almacena direcciones IP.
    </p>

    <h2>8. Plazos de conservación</h2>
    <ul>
      <li>Google Analytics 4: datos de eventos durante 2 meses (el mínimo configurable); cookies según la política de cookies.</li>
      <li>Metricool: {'{{METRICOOL_RETENTION}}'}.</li>
      <li>Registros de Cloudflare: según su política estándar, {'{{CLOUDFLARE_LOG_RETENTION}}'}.</li>
      <li>Correos: el tiempo necesario para atender tu solicitud y, después, los plazos de prescripción aplicables.</li>
      <li>Almacenamiento local: hasta que lo borres.</li>
    </ul>

    <h2>9. Tus derechos</h2>
    <p>
      Conforme a los arts. 15 a 22 del RGPD y a la LOPDGDD (Ley Orgánica 3/2018) puedes solicitar el acceso,
      rectificación, supresión, limitación, portabilidad y oposición, y retirar tu consentimiento en cualquier
      momento sin que ello afecte al tratamiento previo (art. 7.3 RGPD). Escribe a{' '}
      <a href={`mailto:${o.contactEmail}`}>{o.contactEmail}</a> acreditando tu identidad. No tenemos datos sobre los
      documentos que procesas, y los identificadores de analítica son seudónimos: para actuar sobre ellos podemos
      necesitar el identificador de tu navegador. Puedes retirar el consentimiento de analítica directamente desde la{' '}
      <a href="/cookies?lang=es">política de cookies</a>.
    </p>
    <p>Si consideras que no se han respetado tus derechos, puedes reclamar ante la {AEPD_ES}.</p>

    <h2>10. Cambios</h2>
    <p>
      Publicaremos cualquier cambio en esta página, {SITE_ORIGIN}/privacy. Si un cambio afecta a la analítica
      utilizada, volveremos a pedirte el consentimiento.
    </p>
  </>
);

export const Privacy = ({ lang }: { lang: LegalLang }) => (lang === 'es' ? <Es /> : <En lang={lang} />);
