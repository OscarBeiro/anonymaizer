import { GALICIAN_PACK } from './gl';

export interface DetectorLexicon {
  readonly companySuffixes: readonly string[];
  readonly companyPrefixes: readonly string[];
  readonly acronymExclusions: readonly string[];
  readonly nameParticles: readonly string[];
  readonly stopwords: readonly string[];
  readonly titleLexemes: readonly string[];
  readonly structureHeads: readonly string[];
  readonly letteredItemHeads: readonly string[];
  readonly honorifics: readonly string[];
  readonly legalHeads: readonly string[];
  readonly legalContinuation: string;
  readonly titleQualifiers: readonly string[];
  readonly institutionHeads: readonly string[];
  readonly institutionContinuation: string;
  readonly streetKeywords: readonly string[];
}

// Kept in the original order and spelling so the default detector remains
// byte-for-byte compatible with the pre-pack vocabulary.
export const LEGACY_LEXICON: DetectorLexicon = {
  companySuffixes: ['S\\.L\\.U\\.', 'S\\.A\\.U\\.', 'S\\.Coop\\.', 'S\\.L\\.', 'S\\.A\\.', 'SLU', 'SAU', 'SCP', 'SL', 'SA', 'Inc\\.', 'Inc', 'Ltd\\.', 'Ltd', 'LLC', 'LLP', 'Corp\\.', 'Corp', 'PLC', 'GmbH', 'AG', 'mbH', 'BV', 'NV', 'SAS', 'SARL', 'Lda', 'Ltda', 'Oy', 'AB', 'A\\/S', 'Pty'],
  companyPrefixes: ['Grupo', 'Banco', 'Fundación', 'Asociación', 'Universidade', 'Universidad', 'Instituto', 'Consellería', 'Ayuntamiento', 'Concello'],
  acronymExclusions: ['IVA', 'IRPF', 'NIF', 'CIF', 'DNI', 'NIE', 'IBAN', 'SEPA', 'PDF', 'URL', 'API', 'OK', 'NDA', 'SLA', 'RGPD', 'GDPR', 'LOPD', 'LOPDGDD', 'BOE', 'DOUE', 'UE', 'EU', 'CEO', 'CTO', 'CFO', 'COO', 'RRHH', 'HR', 'KPI', 'ONG', 'SL', 'SA', 'SLU', 'EUR', 'USD', 'GBP', 'IT', 'TI', 'CRM', 'ERP', 'FAQ', 'PYME', 'PYMES', 'TPV', 'CP', 'NB', 'PS', 'RE', 'CC', 'CCO', 'ID', 'PIN', 'SMS', 'USB', 'WIFI'],
  nameParticles: ['de la', 'von der', 'van der', 'del', 'de', 'y', 'du', 'des', 'le', 'van', 'von', 'da', 'do', 'dos', 'das'],
  stopwords: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Hola', 'Estimado', 'Estimada', 'Buenos', 'Buenas', 'Saludos', 'Gracias', 'Atentamente', 'El', 'La', 'Los', 'Las', 'Un', 'Una', 'Por', 'Para', 'Cuando', 'Aunque', 'Además', 'También', 'Sin', 'Pero', 'Señor', 'Señora', 'Dear', 'Hello', 'Hi', 'Regards', 'Sincerely', 'Best', 'Thanks', 'Yours'],
  titleLexemes: ['Psicólogo', 'Psicóloga', 'Médico', 'Médica', 'Abogado', 'Abogada', 'Ingeniero', 'Ingeniera', 'Graduado', 'Graduada', 'Licenciado', 'Licenciada', 'Trabajador Social', 'Trabajadora Social', 'Técnico', 'Técnica', 'Perito', 'Colegiado', 'Colegiada', 'Director', 'Directora', 'Gerente', 'Presidente', 'Presidenta', 'Secretario', 'Secretaria', 'Responsable', 'Coordinador', 'Coordinadora', 'Administrador', 'Administradora', 'Apoderado', 'Apoderada'],
  structureHeads: ['Informe', 'Expediente', 'Evaluación', 'Evaluacion', 'Anexo', 'Apartado', 'Página', 'Pagina', 'Asunto', 'Fecha', 'Referencia', 'Documento', 'Capítulo', 'Capitulo', 'Sección', 'Seccion', 'Apellidos', 'Nombre', 'Teléfono', 'Telefono', 'Dirección', 'Direccion', 'Correo', 'Datos', 'Resumen', 'Conclusiones', 'Antecedentes', 'Observaciones', 'Motivo', 'Cliente', 'Paciente', 'Empresa', 'Proyecto', 'Factura', 'Contrato', 'Acta', 'Solicitud', 'Registro', 'Título', 'Titulo', 'Tabla', 'Figura', 'Firma', 'Psicológico', 'Psicologico', 'Psicológica', 'Psicologica', 'Clínico', 'Clinico', 'Clínica', 'Clinica', 'Final', 'Anual', 'Mensual', 'Previo', 'Subject', 'Date', 'From', 'Name', 'Phone', 'Address', 'Email', 'Invoice', 'Report', 'Page', 'Summary', 'Notes', 'Slide', 'Client', 'Patient', 'Company', 'Project', 'Contract', 'Reference', 'Title', 'Table', 'Figure'],
  letteredItemHeads: ['Punto', 'Opción', 'Opcion', 'Plan', 'Artículo', 'Articulo', 'Cláusula', 'Clausula', 'Epígrafe', 'Epigrafe', 'Letra', 'Grupo', 'Tipo', 'Modelo', 'Nivel', 'Fase', 'Zona', 'Bloque', 'Parte', 'Caso', 'Según', 'Segun', 'Option', 'Section', 'Clause', 'Article', 'Item', 'Point', 'Appendix', 'Annex'],
  honorifics: ['Dª', 'Da', 'Sra', 'Srta', 'Sr', 'Dra', 'Dr', 'Lic', 'Prof', 'Mrs', 'Mr', 'Ms', 'D'],
  legalHeads: ['Ley Orgánica', 'Real Decreto Legislativo', 'Real Decreto', 'Reglamento', 'Directiva', 'Convenio', 'Convención', 'Texto Refundido', 'Estatuto', 'Orden', 'Resolución', 'Sentencia', 'Ley', 'artículo', 'art\\.'],
  legalContinuation: '(?:de|del|la|las|los|y|\\p{Lu}\\p{L}*|\\d+(?:\\/(?:\\d+|CE|UE))*)',
  titleQualifiers: ['General', 'Sanitaria', 'Sanitario', 'Clínica', 'Clínico', 'Forense', 'Laboral', 'Social', 'Titular', 'Superior'],
  institutionHeads: ['Tesorería General', 'Seguridad Social', 'Agencia Tributaria', 'Hacienda', 'INSS', 'SEPE', 'INEM', 'Ministerio', 'Consellería', 'Consejería', 'Ayuntamiento', 'Diputación', 'Junta', 'Xunta', 'AEAT(?!\\p{L})', 'TGSS(?!\\p{L})', 'CNMV(?!\\p{L})', 'DGT(?!\\p{L})', 'CNMC(?!\\p{L})', 'AEPD(?!\\p{L})'],
  institutionContinuation: '(?:de|del|la|las|los|\\p{Lu}\\p{L}*|\\d+)',
  streetKeywords: ['Rúa', 'Rua', 'Calle', 'C/', 'Avenida', 'Avda', 'Plaza', 'Praza', 'Camiño', 'Street', 'Avenue', 'Road', 'Rd'],
};

const EN: DetectorLexicon = {
  ...LEGACY_LEXICON,
  companySuffixes: ['Inc\\.', 'Inc', 'Ltd\\.', 'Ltd', 'LLC', 'LLP', 'Corp\\.', 'Corp', 'PLC', 'GmbH', 'AG', 'mbH', 'BV', 'NV', 'SAS', 'SARL', 'Oy', 'AB', 'A\\/S', 'Pty'],
  companyPrefixes: [],
  nameParticles: ['von der', 'van der', 'van', 'von', 'de la', 'del', 'de', 'du', 'des', 'le'],
  stopwords: ['Dear', 'Hello', 'Hi', 'Regards', 'Sincerely', 'Best', 'Thanks', 'Yours'],
  titleLexemes: [],
  structureHeads: ['Subject', 'Date', 'From', 'Name', 'Phone', 'Address', 'Email', 'Invoice', 'Report', 'Page', 'Summary', 'Notes', 'Slide', 'Client', 'Patient', 'Company', 'Project', 'Contract', 'Reference', 'Title', 'Table', 'Figure'],
  letteredItemHeads: ['Option', 'Section', 'Clause', 'Article', 'Item', 'Point', 'Appendix', 'Annex'],
  honorifics: ['Mrs', 'Mr', 'Ms'],
  legalHeads: [], legalContinuation: '', titleQualifiers: [], institutionHeads: [], institutionContinuation: '',
  streetKeywords: ['Street', 'Avenue', 'Road', 'Rd'],
};

const ES: DetectorLexicon = {
  ...LEGACY_LEXICON,
  companySuffixes: ['S\\.L\\.U\\.', 'S\\.A\\.U\\.', 'S\\.Coop\\.', 'S\\.L\\.', 'S\\.A\\.', 'SLU', 'SAU', 'SCP', 'SL', 'SA', 'Lda', 'Ltda'],
  companyPrefixes: ['Grupo', 'Banco', 'Fundación', 'Asociación', 'Universidade', 'Universidad', 'Instituto', 'Consellería', 'Ayuntamiento', 'Concello'],
  nameParticles: ['de la', 'del', 'de', 'y', 'da', 'do', 'dos', 'das'],
  stopwords: LEGACY_LEXICON.stopwords.slice(0, LEGACY_LEXICON.stopwords.indexOf('Dear')),
  titleLexemes: LEGACY_LEXICON.titleLexemes,
  structureHeads: LEGACY_LEXICON.structureHeads.slice(0, LEGACY_LEXICON.structureHeads.indexOf('Subject')),
  letteredItemHeads: LEGACY_LEXICON.letteredItemHeads.slice(0, LEGACY_LEXICON.letteredItemHeads.indexOf('Option')),
  honorifics: ['Dª', 'Da', 'Sra', 'Srta', 'Sr', 'Dra', 'Dr', 'Lic', 'Prof', 'D'],
  legalHeads: LEGACY_LEXICON.legalHeads,
  legalContinuation: LEGACY_LEXICON.legalContinuation,
  titleQualifiers: LEGACY_LEXICON.titleQualifiers,
  institutionHeads: LEGACY_LEXICON.institutionHeads,
  institutionContinuation: LEGACY_LEXICON.institutionContinuation,
  streetKeywords: ['Rúa', 'Rua', 'Calle', 'C/', 'Avenida', 'Avda', 'Plaza', 'Praza', 'Camiño'],
};

const GL: DetectorLexicon = {
  ...ES,
  companyPrefixes: [...ES.companyPrefixes, ...GALICIAN_PACK.companyPrefixes],
  nameParticles: [...ES.nameParticles, ...GALICIAN_PACK.nameParticles],
  stopwords: [...ES.stopwords, ...GALICIAN_PACK.stopwords],
};

const unique = (values: readonly string[]): string[] => [...new Set(values)];

export const languageLexicon = (languages: readonly string[]): DetectorLexicon => {
  // Preserve object and array identity/order for the historic default.
  const selected = [...new Set(languages)].sort();
  if (selected.length === 2 && selected.includes('en') && selected.includes('es')) return LEGACY_LEXICON;
  const packs = selected.flatMap((language) => {
    switch (language.toLowerCase()) {
      case 'en': return [EN];
      case 'es': return [ES];
      case 'gl': return [GL];
      default: return [];
    }
  });
  if (packs.length === 0) {
    return { companySuffixes: [], companyPrefixes: [], acronymExclusions: [], nameParticles: [], stopwords: [], titleLexemes: [], structureHeads: [], letteredItemHeads: [], honorifics: [], legalHeads: [], legalContinuation: '', titleQualifiers: [], institutionHeads: [], institutionContinuation: '', streetKeywords: [] };
  }
  if (selected.includes('en') && selected.includes('es')) packs.unshift(LEGACY_LEXICON);
  type ArrayKey = { [K in keyof DetectorLexicon]: DetectorLexicon[K] extends readonly string[] ? K : never }[keyof DetectorLexicon];
  const merge = (key: ArrayKey): string[] => unique(packs.flatMap((pack) => [...pack[key]]));
  return {
    companySuffixes: merge('companySuffixes'), companyPrefixes: merge('companyPrefixes'), acronymExclusions: merge('acronymExclusions'),
    nameParticles: merge('nameParticles'), stopwords: merge('stopwords'), titleLexemes: merge('titleLexemes'), structureHeads: merge('structureHeads'),
    letteredItemHeads: merge('letteredItemHeads'), honorifics: merge('honorifics'), legalHeads: merge('legalHeads'),
    legalContinuation: (() => {
      const values = unique(packs.map((pack) => pack.legalContinuation).filter(Boolean));
      return values.length < 2 ? (values[0] ?? '') : `(?:${values.join('|')})`;
    })(),
    titleQualifiers: merge('titleQualifiers'), institutionHeads: merge('institutionHeads'),
    institutionContinuation: (() => {
      const values = unique(packs.map((pack) => pack.institutionContinuation).filter(Boolean));
      return values.length < 2 ? (values[0] ?? '') : `(?:${values.join('|')})`;
    })(),
    streetKeywords: merge('streetKeywords'),
  };
};
