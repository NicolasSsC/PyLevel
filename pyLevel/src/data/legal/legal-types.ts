export interface LegalCommonInfo {
  platform: string;
  nature: string;
  projectLeaders: string;
  dataController: string;
  contactEmail: string;
  address: string;
  version: string;
  date: string;
  versionDateString: string;
  introNotice: string;
  organizationNote: string;
}

export interface LegalTable {
  caption?: string;
  headers: string[];
  rows: string[][];
}

export interface LegalSubsection {
  id: string;
  number?: string;
  title: string;
  lead?: string;
  paragraphs?: string[];
  list?: string[];
  table?: LegalTable;
}

export interface LegalSection {
  id: string;
  number?: string;
  title: string;
  lead?: string;
  paragraphs?: string[];
  list?: string[];
  table?: LegalTable;
  subsections?: LegalSubsection[];
}

export interface LegalDocument {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  lead: string;
  sections: LegalSection[];
}
