import React from 'react';
import 'react-quill-new/dist/quill.snow.css';
import { cn } from '@/lib/utils';

type RichTextEditorProps = {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
};

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  const ReactQuill = React.lazy(() => import('react-quill-new'));
  return (
    <React.Suspense
      fallback={
        <div className={cn('h-[200px] border rounded-md flex items-center justify-center text-sm text-muted-foreground', className)}>
          Loading editor…
        </div>
      }
    >
      <div className={cn('rich-editor [&_.ql-editor]:min-h-[180px]', className)}>
        <ReactQuill
          theme="snow"
          value={value}
          onChange={onChange}
          modules={{
            toolbar: [
              [{ header: [1, 2, 3, false] }],
              ['bold', 'italic', 'underline', 'strike'],
              [{ list: 'ordered' }, { list: 'bullet' }],
              ['link'],
              ['clean'],
            ],
          }}
          placeholder={placeholder || 'Write here…'}
        />
      </div>
    </React.Suspense>
  );
}
