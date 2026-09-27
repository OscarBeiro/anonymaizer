import { OPERATOR as o, REPO_URL, SITE_ORIGIN } from '../site';
import type { LegalLang } from './meta';

// P20 — DRAFT FOR LEGAL REVIEW. Section 4 (no guarantee of complete
// detection) is the clause that matters most: precision-first detection
// (spec §4a) will miss things, and users trust the tool with confidential text.

const En = () => (
  <>
    <h1>Terms of use</h1>

    <h2>1. Provider</h2>
    <p>
      In accordance with art. 10 of Spanish Law 34/2002 on information society services (LSSI-CE): this website,{' '}
      {SITE_ORIGIN}, is operated by {o.legalName}, tax ID (NIF) {o.nif}, registered office at {o.address}, email{' '}
      <a href={`mailto:${o.contactEmail}`}>{o.contactEmail}</a>. {o.registry}.
    </p>

    <h2>2. The service</h2>
    <p>
      AnonymAIzer is a free tool that replaces personal and confidential data in text with placeholders, and
      restores the original values in text you paste back. It runs entirely in your browser; the provider receives
      none of the content you process. Using the website means accepting these terms.
    </p>

    <h2>3. Acceptable use</h2>
    <ul>
      <li>Use the tool lawfully, and only on documents you are entitled to process.</li>
      <li>
        You remain responsible for the data you process and for what you share with third parties, including AI
        services. Where the documents contain other people's personal data, you are the controller of that
        processing.
      </li>
      <li>Do not attempt to disrupt the website or use it to distribute malicious code.</li>
    </ul>

    <h2>4. No guarantee of complete detection — review before you share</h2>
    <p>
      <strong>
        Detection is automated and best-effort. It is deliberately tuned to avoid false alarms, which means it will
        miss some personal data
      </strong>{' '}
      — unusual names, identifiers in unexpected formats, data inside images or tables it cannot read, context that
      identifies someone indirectly, and more. Realistic-output mode replaces values with invented ones that may
      coincide with real people or entities.
    </p>
    <p>
      <strong>You must review the sanitized output before sharing it with anyone.</strong> The tool is an aid to
      data minimisation, not a guarantee of anonymisation in the sense of the GDPR, and it does not by itself make
      any disclosure lawful.
    </p>

    <h2>5. Warranty and liability</h2>
    <p>
      The tool is provided free of charge and "as is", without warranties of any kind, express or implied, including
      fitness for a particular purpose or uninterrupted availability. To the maximum extent permitted by law, the
      provider is not liable for damages arising from the use of the tool, including data left undetected, errors in
      restoring text, or loss of locally stored sessions. Nothing in these terms limits liability that cannot be
      limited by law, including for wilful misconduct or gross negligence, or the rights of consumers under Spanish
      Royal Legislative Decree 1/2007.
    </p>

    <h2>6. Intellectual property and licence</h2>
    <p>
      The source code is published at <a href={REPO_URL}>{REPO_URL}</a> under the {'{{LICENSE}}'} licence, which
      governs its use, copying and modification. The AnonymAIzer name and logo are {'{{TRADEMARK_STATUS}}'}. You keep
      all rights to the content you process; the provider acquires none.
    </p>

    <h2>7. Changes and availability</h2>
    <p>
      The provider may modify the tool, these terms or the website at any time. Changes to these terms take effect
      when published on this page.
    </p>

    <h2>8. Applicable law and jurisdiction</h2>
    <p>
      These terms are governed by Spanish law. Disputes are submitted to the courts of {o.jurisdiction}, without
      prejudice to a consumer's right to sue in the courts of their domicile. The EU online dispute resolution
      platform is available at ec.europa.eu/consumers/odr.
    </p>
  </>
);

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
      AnonymAIzer es una herramienta gratuita que sustituye datos personales y confidenciales de un texto por
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
      uso, copia y modificación. El nombre y el logotipo de AnonymAIzer son {'{{TRADEMARK_STATUS}}'}. Conservas todos
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

export const Terms = ({ lang }: { lang: LegalLang }) => (lang === 'es' ? <Es /> : <En />);
