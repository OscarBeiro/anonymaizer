import { t, type TranslationKey } from '../i18n';
import { BrandName } from '../components/BrandName';
import { OPERATOR as o, REPO_URL, SITE_ORIGIN } from '../site';
import type { LegalLang } from './meta';

// P20 — DRAFT FOR LEGAL REVIEW. Section 4 (no guarantee of complete
// detection) is the clause that matters most: precision-first detection
// (spec §4a) will miss things, and users trust the tool with confidential text.

const En = ({ lang }: { lang: LegalLang }) => {
  const translate = (key: TranslationKey) => t(key, {}, lang);
  return (
  <>
    <h1>{translate('terms.terms_of_use')}</h1>

    <h2>{translate('terms.1_provider')}</h2>
    <p>
      {translate('terms.in_accordance_with_art_10_of_spanish')}{' '}
      {SITE_ORIGIN}{translate('terms.is_operated_by')}{o.legalName}{translate('terms.tax_id_nif')}{o.nif}{translate('terms.registered_office_at')}{o.address}{translate('terms.email')}{' '}
      <a href={`mailto:${o.contactEmail}`}>{o.contactEmail}</a>. {o.registry}.
    </p>

    <h2>{translate('terms.2_the_service')}</h2>
    <p>
      <BrandName /> {translate('terms.is_a_free_tool_that_replaces_personal')}</p>

    <h2>{translate('terms.3_acceptable_use')}</h2>
    <ul>
      <li>{translate('terms.use_the_tool_lawfully_and_only_on')}</li>
      <li>
        {translate('terms.you_remain_responsible_for_the_data_you')}</li>
      <li>{translate('terms.do_not_attempt_to_disrupt_the_website')}</li>
    </ul>

    <h2>{translate('terms.4_no_guarantee_of_complete_detection_review')}</h2>
    <p>
      <strong>
        {translate('terms.detection_is_automated_and_best_effort_it')}</strong>{' '}
      {translate('terms.unusual_names_identifiers_in_unexpected_formats_data')}</p>
    <p>
      <strong>{translate('terms.you_must_review_the_sanitized_output_before')}</strong> {translate('terms.the_tool_is_an_aid_to_data')}</p>

    <h2>{translate('terms.5_warranty_and_liability')}</h2>
    <p>
      {translate('terms.the_tool_is_provided_free_of_charge')}</p>

    <h2>{translate('terms.6_intellectual_property_and_licence')}</h2>
    <p>
      {translate('terms.the_source_code_is_published_at')}<a href={REPO_URL}>{REPO_URL}</a> {translate('terms.under_the')}{'{{LICENSE}}'} {translate('terms.licence_which_governs_its_use_copying_and')}<BrandName /> {translate('terms.name_and_logo_are')}{'{{TRADEMARK_STATUS}}'}{translate('terms.you_keep_all_rights_to_the_content')}</p>

    <h2>{translate('terms.7_changes_and_availability')}</h2>
    <p>
      {translate('terms.the_provider_may_modify_the_tool_these')}</p>

    <h2>{translate('terms.8_applicable_law_and_jurisdiction')}</h2>
    <p>
      {translate('terms.these_terms_are_governed_by_spanish_law')}{o.jurisdiction}{translate('terms.without_prejudice_to_a_consumer_s_right')}</p>
  </>
);
};

const Es = () => (
  <>
    <h1>Condiciones de uso</h1>

    <h2>1. Titular</h2>
    <p>
      En cumplimiento del art. 10 de la Ley 34/2002, de servicios de la sociedad de la información y de comercio
      electrónico (LSSI-CE): este sitio web, {SITE_ORIGIN}, es titularidad de {o.legalName}, NIF {o.nif}, con domicilio
      en {o.address}, correo electrónico <a href={`mailto:${o.contactEmail}`}>{o.contactEmail}</a>. {o.registry}.
    </p>

    <h2>2. El servicio</h2>
    <p>
      <BrandName /> es una herramienta gratuita que sustituye datos personales y confidenciales de un texto por
      marcadores y restaura los valores originales en el texto que vuelvas a pegar. Funciona íntegramente en tu
      navegador; el titular no recibe nada del contenido que procesas. El uso del sitio supone la aceptación de
      estas condiciones.
    </p>

    <h2>3. Uso aceptable</h2>
    <ul>
      <li>Usa la herramienta conforme a la ley y solo con documentos que tengas derecho a tratar.</li>
      <li>
        Sigues siendo responsable de los datos que procesas y de lo que compartes con terceros, incluidos servicios
        de IA. Si los documentos contienen datos personales de otras personas, tú eres el responsable de ese
        tratamiento.
      </li>
      <li>No intentes alterar el funcionamiento del sitio ni usarlo para distribuir código malicioso.</li>
    </ul>

    <h2>4. Sin garantía de detección completa — revisa antes de compartir</h2>
    <p>
      <strong>
        La detección es automática y se ofrece sin garantía de exhaustividad. Está ajustada deliberadamente para
        evitar falsos positivos, lo que significa que pasará por alto algunos datos personales
      </strong>{' '}
      — nombres poco comunes, identificadores con formatos inesperados, datos dentro de imágenes o tablas que no
      puede leer, contexto que identifica a alguien de forma indirecta, y otros. El modo de salida realista sustituye
      valores por otros inventados que pueden coincidir con personas o entidades reales.
    </p>
    <p>
      <strong>Debes revisar el texto saneado antes de compartirlo con nadie.</strong> La herramienta es una ayuda para
      la minimización de datos, no una garantía de anonimización en el sentido del RGPD, y no hace lícita por sí sola
      ninguna comunicación de datos.
    </p>

    <h2>5. Garantía y responsabilidad</h2>
    <p>
      La herramienta se ofrece gratuitamente y «tal cual», sin garantías de ningún tipo, expresas o implícitas,
      incluidas la idoneidad para un fin concreto o la disponibilidad ininterrumpida. En la máxima medida permitida
      por la ley, el titular no responde de los daños derivados del uso de la herramienta, incluidos los datos no
      detectados, los errores al restaurar texto o la pérdida de sesiones guardadas localmente. Nada en estas
      condiciones limita la responsabilidad que no pueda limitarse legalmente, incluida la derivada de dolo o culpa
      grave, ni los derechos de los consumidores conforme al Real Decreto Legislativo 1/2007.
    </p>

    <h2>6. Propiedad intelectual y licencia</h2>
    <p>
      El código fuente se publica en <a href={REPO_URL}>{REPO_URL}</a> bajo la licencia {'{{LICENSE}}'}, que rige su
      uso, copia y modificación. El nombre y el logotipo de <BrandName /> son {'{{TRADEMARK_STATUS}}'}. Conservas todos
      los derechos sobre el contenido que procesas; el titular no adquiere ninguno.
    </p>

    <h2>7. Cambios y disponibilidad</h2>
    <p>
      El titular puede modificar la herramienta, estas condiciones o el sitio web en cualquier momento. Los cambios en
      estas condiciones surten efecto desde su publicación en esta página.
    </p>

    <h2>8. Ley aplicable y jurisdicción</h2>
    <p>
      Estas condiciones se rigen por la ley española. Las controversias se someten a los juzgados y tribunales de{' '}
      {o.jurisdiction}, sin perjuicio del derecho del consumidor a acudir a los de su domicilio. La plataforma europea
      de resolución de litigios en línea está disponible en ec.europa.eu/consumers/odr.
    </p>
  </>
);

export const Terms = ({ lang }: { lang: LegalLang }) => (lang === 'es' ? <Es /> : <En lang={lang} />);
