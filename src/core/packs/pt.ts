import type { DetectorLexicon } from './lexicons';

/** Portuguese lexical pack. Identifiers (NIF, Cartão de Cidadão) belong to the PT jurisdiction. */
export const PORTUGUESE_PACK = {
  id: 'pt',
  greetings: ['Olá', 'Caro', 'Cara', 'Exmo', 'Exma', 'Bom', 'Boa', 'Cumprimentos', 'Obrigado', 'Obrigada', 'Atenciosamente'],
  stopwords: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro', 'Olá', 'Caro', 'Cara', 'Bom', 'Boa', 'Cumprimentos', 'Obrigado', 'Obrigada', 'Atenciosamente', 'O', 'A', 'Os', 'As', 'Um', 'Uma', 'Por', 'Para', 'Quando', 'Embora', 'Além', 'Também', 'Sem', 'Mas', 'Senhor', 'Senhora'],
  companyPrefixes: ['Grupo', 'Banco', 'Fundação', 'Associação', 'Universidade', 'Instituto', 'Câmara', 'Junta', 'Município', 'Ministério'],
  nameParticles: ['de', 'da', 'do', 'das', 'dos', 'e'],
} as const;

export const PORTUGUESE_LEXICON: DetectorLexicon = {
  companySuffixes: ['S\\.G\\.P\\.S\\.', 'S\\.A\\.', 'Lda\\.', 'Unipessoal', 'SGPS', 'Lda', 'CRL', 'SA'],
  companyPrefixes: [...PORTUGUESE_PACK.companyPrefixes],
  acronymExclusions: ['NIF', 'NIPC', 'IRS', 'IRC', 'IVA', 'RGPD', 'CC', 'AT', 'IRN', 'CNPD', 'ACT', 'IBAN', 'SEPA', 'PDF', 'URL', 'API', 'OK', 'NDA', 'SLA', 'UE', 'CEO', 'CTO', 'CFO', 'RH', 'KPI', 'ONG', 'EUR', 'PME', 'CP', 'ID', 'PIN', 'SMS', 'USB'],
  nameParticles: [...PORTUGUESE_PACK.nameParticles],
  stopwords: [...PORTUGUESE_PACK.stopwords],
  titleLexemes: ['Psicólogo', 'Psicóloga', 'Médico', 'Médica', 'Advogado', 'Advogada', 'Engenheiro', 'Engenheira', 'Licenciado', 'Licenciada', 'Técnico', 'Técnica', 'Perito', 'Diretor', 'Diretora', 'Gerente', 'Presidente', 'Secretário', 'Secretária', 'Responsável', 'Coordenador', 'Coordenadora', 'Administrador', 'Administradora', 'Procurador', 'Procuradora'],
  structureHeads: ['Relatório', 'Processo', 'Avaliação', 'Anexo', 'Ponto', 'Página', 'Assunto', 'Data', 'Referência', 'Documento', 'Capítulo', 'Secção', 'Seção', 'Apelidos', 'Nome', 'Telefone', 'Telemóvel', 'Morada', 'Endereço', 'Correio', 'Dados', 'Resumo', 'Conclusões', 'Antecedentes', 'Observações', 'Motivo', 'Cliente', 'Paciente', 'Empresa', 'Projeto', 'Projecto', 'Fatura', 'Factura', 'Contrato', 'Ata', 'Pedido', 'Registo', 'Registro', 'Título', 'Tabela', 'Figura', 'Assinatura', 'Final', 'Anual', 'Mensal'],
  letteredItemHeads: ['Ponto', 'Opção', 'Plano', 'Artigo', 'Cláusula', 'Alínea', 'Letra', 'Grupo', 'Tipo', 'Modelo', 'Nível', 'Fase', 'Zona', 'Bloco', 'Parte', 'Caso', 'Segundo'],
  honorifics: ['Sr', 'Sra', 'Srta', 'Dr', 'Dra', 'Eng', 'Engª', 'Prof', 'Profª', 'Exmo', 'Exma', 'D'],
  legalHeads: ['Lei Orgânica', 'Decreto-Lei', 'Decreto Regulamentar', 'Regulamento', 'Diretiva', 'Convenção', 'Estatuto', 'Portaria', 'Despacho', 'Resolução', 'Acórdão', 'Sentença', 'Lei', 'artigo', 'art\\.'],
  legalContinuation: '(?:de|do|da|dos|das|e|\\p{Lu}\\p{L}*|\\d+(?:\\/(?:\\d+|CE|UE))*)',
  titleQualifiers: ['Geral', 'Sanitário', 'Clínico', 'Forense', 'Laboral', 'Social', 'Titular', 'Superior'],
  institutionHeads: ['Segurança Social', 'Autoridade Tributária', 'Finanças', 'Ministério', 'Câmara Municipal', 'Junta de Freguesia', 'Governo', 'Tribunal', 'AT(?!\\p{L})', 'IRN(?!\\p{L})', 'CNPD(?!\\p{L})', 'ACT(?!\\p{L})'],
  institutionContinuation: '(?:de|do|da|dos|das|\\p{Lu}\\p{L}*|\\d+)',
  streetKeywords: ['Rua', 'Avenida', 'Av', 'Praça', 'Largo', 'Travessa', 'Alameda', 'Estrada', 'Beco', 'Calçada'],
};
