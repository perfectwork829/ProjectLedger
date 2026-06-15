import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import QuillTableBetter from 'quill-table-better';
import 'react-quill-new/dist/quill.snow.css';
import 'quill-table-better/dist/quill-table-better.css';
import { cn } from '@/lib/utils';
import {
  ensureQuillTableBetterRegistered,
  patchQuillSetContentsForTables,
  quillTableBetterModuleConfig,
  setQuillHtml,
} from '@/lib/quillTableSetup';

ensureQuillTableBetterRegistered();

type QuillEditorFieldProps = {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
};

const quillModules = {
  table: false,
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'table-better'],
    ['clean'],
  ],
  'table-better': quillTableBetterModuleConfig,
  keyboard: {
    bindings: QuillTableBetter.keyboardBindings,
  },
};

export default function QuillEditorField({ value, onChange, placeholder, className }: QuillEditorFieldProps) {
  const quillRef = useRef<ReactQuill>(null);
  const onChangeRef = useRef(onChange);
  const lastHtmlRef = useRef(value);
  onChangeRef.current = onChange;

  const modules = useMemo(() => quillModules, []);

  const handleChange = useCallback((html: string) => {
    lastHtmlRef.current = html;
    onChangeRef.current(html);
  }, []);

  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    patchQuillSetContentsForTables(quill);
    if (value !== quill.root.innerHTML && value !== lastHtmlRef.current) {
      setQuillHtml(quill, value);
      lastHtmlRef.current = value;
    }
  }, [value]);

  return (
    <div
      className={cn(
        'rich-editor [&_.ql-editor]:min-h-[180px] [&_.ql-editor_table]:border-collapse [&_.ql-editor_td]:border [&_.ql-editor_th]:border [&_.ql-editor_td]:border-border [&_.ql-editor_th]:border-border [&_.ql-editor_td]:p-2 [&_.ql-editor_th]:p-2',
        className,
      )}
    >
      <p className="mb-2 text-xs text-muted-foreground">
        Paste tables from Excel or Sheets as tables. Use the table button in the toolbar; use Wrap in the table menu to add text
        before or after a table.
      </p>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={handleChange}
        useSemanticHTML={false}
        modules={modules}
        placeholder={placeholder || 'Write here…'}
      />
    </div>
  );
}
