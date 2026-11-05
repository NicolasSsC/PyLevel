export interface ManualMetadata {
  title: string;
  subtitle: string;
  author: string;
  date: string;
  version: string;
}

export interface ManualLink {
  label: string;
  target: string;
}

export interface CellLinkData {
  text: string;
  links: ManualLink[];
}

export interface PendingCellData {
  isPending: boolean;
  text: string;
}

export type TableCell = string | CellLinkData | PendingCellData;

export interface ManualTable {
  caption: string;
  headers: string[];
  rows: TableCell[][];
}

export interface ManualFormula {
  latex: string;
  numerator: string;
  denominator: string;
  multiplier: string;
  label: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface ManualSubsection {
  id: string;
  aliasId?: string;
  number: string;
  title: string;
  lead?: string;
  paragraphs?: string[];
  paragraphsAfter?: string[];
  steps?: string[];
  list?: string[];
  table?: ManualTable;
  formula?: ManualFormula;
  note?: string;
  noteLinks?: ManualLink[];
  isAccordion?: boolean;
  faqs?: FAQItem[];
  footerNote?: string;
}

export interface ManualSection {
  id: string;
  number: string;
  title: string;
  role?: 'Estudiante' | 'Docente' | 'Administrador';
  lead?: string;
  paragraphs?: string[];
  subsections?: ManualSubsection[];
}

export interface UserManualData {
  metadata: ManualMetadata;
  sections: ManualSection[];
}

