import { OPERATOR as o, SITE_ORIGIN } from '../site';
import type { LegalLang } from './meta';

// P20 — DRAFT FOR LEGAL REVIEW, not legal advice. Every double-brace placeholder comes
// from src/site.ts and must be filled before publication.

const AEPD_ES = 'Agencia Española de Protección de Datos (AEPD), C/ Jorge Juan, 6, 28001 Madrid — www.aepd.es';
const AEPD_EN = 'Spanish Data Protection Agency (AEPD), C/ Jorge Juan, 6, 28001 Madrid, Spain — www.aepd.es';

const En = () => (
  <>
    <h1>Privacy policy</h1>

    <h2>1. The short version</h2>
    <p>
      <strong>
        AnonymAIzer has no backend. The text and documents you anonymize are processed only inside your browser and
        are never sent to us or to anyone else.
      </strong>{' '}
      We cannot see, store or recover them. This policy therefore covers the few things that do involve personal
      data: the analytics on this website (only if you accept them), the hosting of the site, and the optional
      download of the AI name-detection model.
    </p>

    <h2>2. Who is responsible</h2>
    <p>
      Controller: {o.legalName}, tax ID (NIF) {o.nif}, {o.address}. Contact: <a href={`mailto:${o.contactEmail}`}>{o.contactEmail}</a>.
      Data protection officer: {o.dpo}.
    </p>

    <h2>3. What is not processed</h2>
    <ul>
      <li>
        The content you paste or import, the files you open, their names, the entities detected in them, the
        placeholders and the restored text. All of this stays on your device.
      </li>
      <li>
        Our analytics never receive any of the above, nor a count of it. They measure page views and coarse
        interactions only.
      </li>
    </ul>
    <p>
      If the documents you process contain personal data about other people, <strong>you</strong> are the
      controller of that processing under the GDPR, and it is your responsibility to have a legal basis for it. The
      tool helps you minimise what you share with third-party AI services; it does not make that sharing lawful by
      itself, and automated detection can miss data (see the <a href="/terms">terms of use</a>).
    </p>

    <h2>4. What is processed, why, and on what basis</h2>
    <table>
      <thead>
        <tr>
          <th>Processing</th>
          <th>Data</th>
          <th>Purpose</th>
          <th>Legal basis</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Web analytics (Google Analytics 4, Metricool)</td>
          <td>
            Pseudonymous cookie identifiers, pages visited, approximate location derived from a truncated IP, device
            and browser type, referrer
          </td>
          <td>Understand how many people use the site and how they reach it</td>
          <td>Your consent, GDPR art. 6(1)(a) and LSSI-CE art. 22.2. Nothing loads until you accept.</td>
        </tr>
        <tr>
          <td>Hosting and delivery (Cloudflare)</td>
          <td>IP address, request metadata in server logs</td>
          <td>Deliver the site and protect it against abuse</td>
          <td>Legitimate interest in operating a secure website, GDPR art. 6(1)(f)</td>
        </tr>
        <tr>
          <td>Optional AI model download</td>
          <td>Your IP address and request metadata, received by the model host</td>
          <td>Download the name-detection model to your browser, once, when you switch it on</td>
          <td>
            Your request (you switch it on). We do not receive this data; Hugging Face and jsDelivr act as
            independent providers.
          </td>
        </tr>
        <tr>
          <td>Emails you send us</td>
          <td>Your address and message</td>
          <td>Answer you</td>
          <td>Legitimate interest in replying, GDPR art. 6(1)(f)</td>
        </tr>
      </tbody>
    </table>

    <h2>5. Data stored on your device</h2>
    <p>
      The app keeps its state in your browser's local storage so that a reload loses nothing: the current session
      (text, placeholders and their originals), your custom rules, your settings (detection categories, output
      mode, theme) and your cookie-consent decision. The AI model, if downloaded, is kept in IndexedDB. None of this
      leaves your device. You can delete all of it at any time from <em>Settings → Clear all local data</em>, or by
      clearing this site's data in your browser.
    </p>

    <h2>6. Recipients</h2>
    <ul>
      <li>Google Ireland Ltd. / Google LLC — Google Analytics 4 (only with consent).</li>
      <li>Metricool Software S.L. — Metricool analytics (only with consent).</li>
      <li>Cloudflare, Inc. — hosting and content delivery.</li>
      <li>
        Hugging Face, Inc. and jsDelivr (Prospect One) — only if you enable the AI model, and only for the download
        itself.
      </li>
    </ul>
    <p>We do not sell data or use it for advertising.</p>

    <h2>7. International transfers</h2>
    <p>
      Google Analytics and Cloudflare may transfer data to the United States. Google LLC and Cloudflare, Inc. are
      certified under the EU-US Data Privacy Framework (Commission adequacy decision of 10 July 2023), and both also
      offer the European Commission's Standard Contractual Clauses (Decision (EU) 2021/914) as a safeguard. GA4 is
      configured without advertising signals or user IDs, and IP addresses are not stored by Google Analytics 4.
    </p>

    <h2>8. Retention</h2>
    <ul>
      <li>Google Analytics 4: event data retained for 2 months (the minimum setting); cookies as listed in the cookie policy.</li>
      <li>Metricool: {'{{METRICOOL_RETENTION}}'}.</li>
      <li>Cloudflare logs: per Cloudflare's standard retention, {'{{CLOUDFLARE_LOG_RETENTION}}'}.</li>
      <li>Emails: as long as needed to handle your request, then up to the applicable limitation periods.</li>
      <li>Local storage: until you delete it.</li>
    </ul>

    <h2>9. Your rights</h2>
    <p>
      Under GDPR arts. 15–22 you may request access, rectification, erasure, restriction, portability and object to
      processing, and you may withdraw consent at any time without affecting prior processing (art. 7(3)). Write to{' '}
      <a href={`mailto:${o.contactEmail}`}>{o.contactEmail}</a> with proof of identity. Note that we hold no data
      about the documents you process, and analytics identifiers are pseudonymous: to act on them we may need the
      identifier from your browser. You can withdraw analytics consent directly from the{' '}
      <a href="/cookies">cookie policy</a>.
    </p>
    <p>If you believe your rights have not been respected, you may complain to the {AEPD_EN}.</p>

    <h2>10. Changes</h2>
    <p>
      We will publish any change on this page at {SITE_ORIGIN}/privacy. If a change affects what analytics are used,
      we will ask for your consent again.
    </p>
  </>
);

const Es = () => (
  <>
    <h1>Política de privacidad</h1>

    <h2>1. En resumen</h2>
    <p>
      <strong>
        AnonymAIzer no tiene servidor. Los textos y documentos que anonimizas se procesan únicamente en tu navegador y
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

export const Privacy = ({ lang }: { lang: LegalLang }) => (lang === 'es' ? <Es /> : <En />);
