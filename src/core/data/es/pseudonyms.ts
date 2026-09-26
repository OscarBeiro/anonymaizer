// Bundled language data lives under src/core/data/<lang>/<purpose>.ts: one
// file per purpose (these pseudonym pools; later D3's shield lexicon and the
// per-language stopword packs), each exporting plain readonly arrays. Pure
// data — no logic, no imports — so a language is added by copying a folder.

// Common Spanish given names, mixed gender.
export const GIVEN_NAMES: readonly string[] = [
  'Lucía', 'Martín', 'Sofía', 'Hugo', 'Paula', 'Daniel', 'Alba', 'Pablo', 'Carmen', 'Álvaro',
  'Laura', 'Adrián', 'Marta', 'Diego', 'Elena', 'Javier', 'Irene', 'Sergio', 'Nuria', 'Raúl',
  'Cristina', 'Andrés', 'Beatriz', 'Iván', 'Silvia', 'Rubén', 'Patricia', 'Óscar', 'Rosa', 'Jorge',
  'Pilar', 'Alberto', 'Teresa', 'Manuel', 'Clara', 'Fernando', 'Inés', 'Víctor', 'Julia', 'Tomás',
  'Noelia', 'Gonzalo', 'Sara', 'Ricardo', 'Lorena', 'Miguel', 'Eva', 'Francisco', 'Raquel', 'Luis',
];

// Common Spanish surnames.
export const SURNAMES: readonly string[] = [
  'García', 'Fernández', 'González', 'Rodríguez', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín',
  'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Alonso', 'Gutiérrez',
  'Navarro', 'Torres', 'Domínguez', 'Vázquez', 'Ramos', 'Gil', 'Ramírez', 'Serrano', 'Blanco', 'Molina',
  'Morales', 'Suárez', 'Ortega', 'Delgado', 'Castro', 'Ortiz', 'Rubio', 'Marín', 'Sanz', 'Núñez',
  'Iglesias', 'Medina', 'Garrido', 'Cortés', 'Castillo', 'Santos', 'Lozano', 'Guerrero', 'Cano', 'Prieto',
];

// Company names are built "<lead> <tail>", then the original legal suffix.
export const COMPANY_LEADS: readonly string[] = [
  'Soluciones', 'Servicios', 'Grupo', 'Industrias', 'Construcciones', 'Consultoría', 'Distribuciones',
  'Talleres', 'Inversiones', 'Logística', 'Tecnologías', 'Comercial', 'Transportes', 'Estudio', 'Gestión',
];

export const COMPANY_TAILS: readonly string[] = [
  'Norte', 'Levante', 'Atlántico', 'Mediterráneo', 'del Sur', 'Ibérica', 'Horizonte', 'Aurora', 'Vértice',
  'Meridiano', 'Brisa', 'Alameda', 'Roble', 'Cierzo', 'Faro', 'Montaña', 'Ribera', 'Lumen', 'Arco', 'Nexo',
];

// Appended when the original company name carries no legal suffix.
export const DEFAULT_COMPANY_SUFFIX = 'S.L.';
