import React, { useRef, useState, useEffect } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Button } from '@/components/ui/button';
import { Code2, Eye, Pencil, Check, X } from 'lucide-react';

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
    matchVisual: false,
  },
};

const formats = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'align', 'direction',
  'list', 'indent',
  'blockquote', 'code-block', 'code',
  'link', 'image', 'script',
];

type Mode = 'visual' | 'code';

export const RichTextEditor: React.FC<Props> = ({ value, onChange, placeholder, className }) => {
  const [mode, setMode] = useState<Mode>('visual');
  // In visual mode: when false we show a read-only iframe preview; when true we mount Quill.
  const [editingVisual, setEditingVisual] = useState(false);
  // Buffer used by Quill while editing visually. Only committed on "Apply".
  const [draft, setDraft] = useState<string>(value);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Reset edit-visual state when leaving visual mode or when external value changes.
  useEffect(() => {
    if (mode !== 'visual') {
      setEditingVisual(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!editingVisual) setDraft(value);
  }, [value, editingVisual]);

  // Render preview HTML into the sandboxed iframe.
  useEffect(() => {
    if (mode !== 'visual' || editingVisual) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>
  :root{color-scheme:light}
  html,body{margin:0;padding:12px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#222;background:transparent;line-height:1.5}
  img,video,iframe{max-width:100%;height:auto}
  table{border-collapse:collapse}
  pre{white-space:pre-wrap}
  a{color:#7a5430}
</style>
</head><body>${value ?? ''}</body></html>`);
    doc.close();
  }, [mode, editingVisual, value]);

  const startVisualEdit = () => {
    setDraft(value);
    setEditingVisual(true);
  };

  const applyVisualEdit = () => {
    onChange(draft);
    setEditingVisual(false);
  };

  const cancelVisualEdit = () => {
    setDraft(value);
    setEditingVisual(false);
  };

  return (
    <div className={`bg-background rounded-md border border-input ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-1 border-b border-border px-2 py-1 bg-muted/30">
        <span className="text-[11px] text-muted-foreground pl-1">
          {mode === 'code'
            ? 'Mode HTML: el codi es desa tal qual, sense modificar.'
            : editingVisual
              ? 'Edició visual activa: els canvis poden reformatar el HTML. Aplica o cancel·la.'
              : 'Vista prèvia visual (només lectura). El HTML no es modifica.'}
        </span>
        <div className="flex items-center gap-1">
          {mode === 'visual' && !editingVisual && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-xs"
              onClick={startVisualEdit}
            >
              <Pencil className="h-3.5 w-3.5" /> Editar visualment
            </Button>
          )}
          {mode === 'visual' && editingVisual && (
            <>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs"
                onClick={cancelVisualEdit}
              >
                <X className="h-3.5 w-3.5" /> Cancel·lar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 gap-1 text-xs"
                onClick={applyVisualEdit}
              >
                <Check className="h-3.5 w-3.5" /> Aplicar canvis
              </Button>
            </>
          )}
          <Button
            type="button"
            size="sm"
            variant={mode === 'visual' ? 'secondary' : 'ghost'}
            className="h-7 gap-1 text-xs"
            onClick={() => {
              if (editingVisual && !confirm('Hi ha canvis visuals sense aplicar. Es perdran. Continuar?')) return;
              setEditingVisual(false);
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
            onClick={() => {
              if (editingVisual && !confirm('Hi ha canvis visuals sense aplicar. Es perdran. Continuar?')) return;
              setEditingVisual(false);
              setMode('code');
            }}
          >
            <Code2 className="h-3.5 w-3.5" /> HTML
          </Button>
        </div>
      </div>

      {mode === 'visual' ? (
        editingVisual ? (
          <ReactQuill
            key="quill-edit"
            theme="snow"
            value={draft}
            onChange={(html) => setDraft(html)}
            modules={modules}
            formats={formats}
            placeholder={placeholder}
          />
        ) : (
          <iframe
            ref={iframeRef}
            title="HTML preview"
            sandbox="allow-same-origin"
            className="w-full min-h-[320px] rounded-b-md bg-background"
          />
        )
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
