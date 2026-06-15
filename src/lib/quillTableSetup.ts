import Quill from 'quill';
import QuillTableBetter from 'quill-table-better';

let registered = false;

/** Register table module once before any Quill instance is created. */
export function ensureQuillTableBetterRegistered(): typeof QuillTableBetter {
  if (!registered) {
    Quill.register({ 'modules/table-better': QuillTableBetter }, true);
    registered = true;
  }
  return QuillTableBetter;
}

ensureQuillTableBetterRegistered();

export const quillTableBetterModuleConfig = {
  language: 'en_US',
  menus: ['column', 'row', 'merge', 'table', 'cell', 'wrap', 'delete'],
  toolbarTable: true,
} as const;

type QuillWithPatch = Quill & { __tableContentsPatch?: boolean };

/**
 * react-quill uses setContents for HTML values; quill-table-better requires updateContents
 * so pasted/loaded tables render and edit correctly.
 */
export function patchQuillSetContentsForTables(quill: Quill): void {
  const q = quill as QuillWithPatch;
  if (q.__tableContentsPatch) return;
  q.__tableContentsPatch = true;

  quill.setContents = (delta, source) => {
    const len = quill.getLength();
    if (len > 1) {
      quill.deleteText(0, len - 1, 'silent');
    }
    quill.updateContents(delta, source ?? 'api');
  };
}

export function setQuillHtml(quill: Quill, html: string): void {
  patchQuillSetContentsForTables(quill);
  const delta = quill.clipboard.convert({ html: html || '<p><br></p>' });
  const len = quill.getLength();
  if (len > 1) {
    quill.deleteText(0, len - 1, 'silent');
  }
  quill.updateContents(delta, 'silent');
}
