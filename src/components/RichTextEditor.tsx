import React from 'react';
import { cn } from '@/lib/utils';

const QuillEditorField = React.lazy(() => import('@/components/QuillEditorField'));

type RichTextEditorProps = {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
};

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
  return (
    <React.Suspense
      fallback={
        <div
          className={cn(
            'h-[200px] border rounded-md flex items-center justify-center text-sm text-muted-foreground',
            className,
          )}
        >
          Loading editor…
        </div>
      }
    >
      <QuillEditorField value={value} onChange={onChange} placeholder={placeholder} className={className} />
    </React.Suspense>
  );
}
