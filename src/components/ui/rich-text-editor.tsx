import React, { useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Button } from '@/components/ui/button';
import { Code2, Eye } from 'lucide-react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    [{ font: [] }],
    [{ size: ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ align: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    ['blockquote', 'code-block'],
    ['link', 'image'],
    ['clean'],
  ],
  clipboard: {
    // Avoid Quill inserting &nbsp; and extra <p><br></p> to mimic visual spacing
    matchVisual: false,
  },
};

export const RichTextEditor: React.FC<Props> = ({ value, onChange, placeholder, className }) => {
  const [mode, setMode] = useState<'visual' | 'code'>('visual');

  return (
    <div className={`bg-background rounded-md border border-input ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-1 border-b border-border px-2 py-1 bg-muted/30">
        <span className="text-[11px] text-muted-foreground pl-1">
          {mode === 'code'
            ? 'Mode HTML: el codi es desa tal qual, sense modificar.'
            : 'Mode visual: en editar, el codi HTML pot ser reformatat.'}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant={mode === 'visual' ? 'secondary' : 'ghost'}
            className="h-7 gap-1 text-xs"
            onClick={() => {
              if (mode === 'code' && !confirm('Canviar a visual pot reformatar el codi HTML. Continuar?')) return;
              setMode('visual');
            }}
          >
            <Eye className="h-3.5 w-3.5" /> Visual
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'code' ? 'secondary' : 'ghost'}
            className="h-7 gap-1 text-xs"
            onClick={() => setMode('code')}
          >
            <Code2 className="h-3.5 w-3.5" /> HTML
          </Button>
        </div>
      </div>

      {mode === 'visual' ? (
        <ReactQuill
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          placeholder={placeholder}
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || '<p>HTML cru…</p>'}
          spellCheck={false}
          className="w-full min-h-[320px] font-mono text-xs p-3 bg-background rounded-b-md focus:outline-none focus:ring-0 resize-y"
        />
      )}
    </div>
  );
};

export default RichTextEditor;
