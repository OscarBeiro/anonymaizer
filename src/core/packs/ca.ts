import type { DetectorLexicon } from './lexicons';

/** Catalan lexical pack. Jurisdiction stays separate: Spanish IDs apply in Catalonia, Valencia and the Balearics. */
export const CATALAN_PACK = {
  id: 'ca',
  greetings: ['Hola', 'Estimat', 'Estimada', 'Benvolgut', 'Benvolguda', 'Bon', 'Bona', 'Salutacions', 'Gràcies', 'Atentament', 'Cordialment'],
  stopwords: ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte', 'Diumenge', 'Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny', 'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre', 'Hola', 'Estimat', 'Estimada', 'Benvolgut', 'Benvolguda', 'Bon', 'Bona', 'Salutacions', 'Gràcies', 'Atentament', 'Cordialment', 'El', 'La', 'Els', 'Les', 'Un', 'Una', 'Per', 'Quan', 'Tot', 'També', 'Sense', 'Però', 'Senyor', 'Senyora'],
  companyPrefixes: ['Grup', 'Banc', 'Fundació', 'Associació', 'Universitat', 'Institut', 'Ajuntament', 'Generalitat', 'Diputació', 'Consell', 'Departament', 'Conselleria'],
  nameParticles: ['de la', 'de les', 'dels', 'del', 'de', 'des', 'i'],
} as const;

export const CATALAN_LEXICON: DetectorLexicon = {
  companySuffixes: ['S\\.L\\.U\\.', 'S\\.C\\.C\\.L\\.', 'S\\.Coop\\.', 'S\\.L\\.', 'S\\.A\\.', 'SCCL', 'SLU', 'SL', 'SA'],
  companyPrefixes: [...CATALAN_PACK.companyPrefixes],
  acronymExclusions: ['IVA', 'IRPF', 'NIF', 'CIF', 'DNI', 'NIE', 'IBAN', 'SEPA', 'PDF', 'URL', 'API', 'OK', 'NDA', 'SLA', 'RGPD', 'GDPR', 'LOPD', 'DOGC', 'BOE', 'UE', 'EU', 'CEO', 'CTO', 'CFO', 'RRHH', 'KPI', 'ONG', 'SL', 'SA', 'EUR', 'PIME', 'CP', 'ID', 'PIN', 'SMS', 'USB'],
  nameParticles: [...CATALAN_PACK.nameParticles],
  stopwords: [...CATALAN_PACK.stopwords],
  titleLexemes: ['Psicòleg', 'Psicòloga', 'Metge', 'Metgessa', 'Advocat', 'Advocada', 'Enginyer', 'Enginyera', 'Graduat', 'Graduada', 'Llicenciat', 'Llicenciada', 'Treballador Social', 'Treballadora Social', 'Tècnic', 'Tècnica', 'Perit', 'Col·legiat', 'Col·legiada', 'Director', 'Directora', 'Gerent', 'President', 'Presidenta', 'Secretari', 'Secretària', 'Responsable', 'Coordinador', 'Coordinadora', 'Administrador', 'Administradora', 'Apoderat', 'Apoderada'],
  structureHeads: ['Informe', 'Expedient', 'Avaluació', 'Annex', 'Apartat', 'Pàgina', 'Assumpte', 'Data', 'Referència', 'Document', 'Capítol', 'Secció', 'Cognoms', 'Nom', 'Telèfon', 'Adreça', 'Correu', 'Dades', 'Resum', 'Conclusions', 'Antecedents', 'Observacions', 'Motiu', 'Client', 'Pacient', 'Empresa', 'Projecte', 'Factura', 'Contracte', 'Acta', 'Sol·licitud', 'Registre', 'Títol', 'Taula', 'Figura', 'Signatura', 'Final', 'Anual', 'Mensual'],
  letteredItemHeads: ['Punt', 'Opció', 'Pla', 'Article', 'Clàusula', 'Epígraf', 'Lletra', 'Grup', 'Tipus', 'Model', 'Nivell', 'Fase', 'Zona', 'Bloc', 'Part', 'Cas', 'Segons'],
  honorifics: ['Sr', 'Sra', 'Srta', 'Dr', 'Dra', 'Prof', 'Hble', 'Mn'],
  legalHeads: ['Llei Orgànica', 'Reial Decret Legislatiu', 'Reial Decret', 'Decret', 'Reglament', 'Directiva', 'Conveni', 'Estatut', 'Ordre', 'Resolució', 'Sentència', 'Llei', 'article', 'art\\.'],
  legalContinuation: '(?:de|del|la|les|els|i|\\p{Lu}\\p{L}*|\\d+(?:\\/(?:\\d+|CE|UE))*)',
  titleQualifiers: ['General', 'Sanitària', 'Sanitari', 'Clínica', 'Clínic', 'Forense', 'Laboral', 'Social', 'Titular', 'Superior'],
  institutionHeads: ['Tresoreria General', 'Seguretat Social', 'Agència Tributària', 'Hisenda', 'Ministeri', 'Conselleria', 'Departament', 'Ajuntament', 'Diputació', 'Generalitat', 'Parlament', 'AEAT(?!\\p{L})', 'TGSS(?!\\p{L})', 'AEPD(?!\\p{L})'],
  institutionContinuation: '(?:de|del|la|les|els|\\p{Lu}\\p{L}*|\\d+)',
  streetKeywords: ['Carrer', 'C/', 'Avinguda', 'Av', 'Plaça', 'Passeig', 'Passatge', 'Travessia', 'Camí', 'Ronda', 'Via'],
};
