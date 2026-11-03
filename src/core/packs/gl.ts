/** Initial Galician lexical pack. Jurisdiction remains separate (Spanish IDs). */
export const GALICIAN_PACK = {
  id: 'gl',
  greetings: ['Saúdos', 'Estimado', 'Estimada', 'Atentamente', 'Bos', 'Boas', 'Grazas'],
  stopwords: ['Que', 'Ola', 'Unha', 'Pregamos', 'Lembramos', 'Comunicámoslles', 'Atentamente', 'Sen', 'Segundo', 'Durante', 'Saúdos', 'Grazas', 'Bos', 'Boas', 'Días', 'Luns', 'Martes', 'Mércores', 'Xoves', 'Venres', 'Sábado', 'Domingo', 'Xaneiro', 'Febreiro', 'Marzo', 'Abril', 'Maio', 'Xuño', 'Xullo', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Decembro'],
  companyPrefixes: ['Concello', 'Xunta', 'Consellería', 'Deputación', 'Universidade', 'Fundación', 'Asociación'],
  nameParticles: ['da', 'do', 'das', 'dos', 'de'],
  // M06-02: Galician headings, labels, job titles, laws and public bodies, so
  // the capitalised-run NAME heuristic stops reading them as people.
  titleLexemes: ['Traballador Social', 'Traballadora Social', 'Xefe', 'Xefa', 'Avogado', 'Avogada', 'Enxeñeiro', 'Enxeñeira', 'Mestre', 'Mestra', 'Titor', 'Titora', 'Alcalde', 'Alcaldesa', 'Axente', 'Procurador', 'Procuradora'],
  structureHeads: ['Enderezo', 'Data', 'Nome', 'Apelidos', 'Emisor', 'Concepto', 'Diagnóstico', 'Revisión', 'Comparecencia', 'Asistentes', 'Nota', 'Asinado', 'Expoñen', 'Reunidos'],
  legalHeads: ['Lei Orgánica', 'Real Decreto Lexislativo', 'Decreto Lexislativo', 'Lei(?!\\p{L})', 'Orde(?!\\p{L})', 'Regulamento(?!\\p{L})', 'Estatuto de Autonomía'],
  legalContinuation: '(?:de|do|da|dos|das|del|la|las|los|e|y|\\p{Lu}\\p{L}*|\\d+(?:\\/(?:\\d+|CE|UE))*)',
  institutionHeads: ['Complexo Hospitalario', 'Centro de Saúde', 'Servizo(?!\\p{L})', 'Servizos(?!\\p{L})', 'Colexio(?!\\p{L})', 'Escola(?!\\p{L})', 'Xulgado(?!\\p{L})', 'Rexistro(?!\\p{L})', 'Caixa(?!\\p{L})', 'Comunidade(?!\\p{L})', 'Valedora do Pobo'],
  institutionContinuation: '(?:de|do|da|dos|das|del|la|las|los|e|\\p{Lu}\\p{L}*|\\d+)',
} as const;
