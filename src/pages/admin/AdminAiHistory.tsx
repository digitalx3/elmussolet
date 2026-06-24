import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LogRow {
  id: string;
  created_at: string;
  function_name: string;
  scope: string | null;
  source_language: string | null;
  target_language: string | null;
  items_count: number;
  success_count: number;
  error_count: number;
  status: 'success' | 'partial' | 'error';
  provider: string | null;
  error_message: string | null;
  duration_ms: number | null;
}

const STATUS_LABEL: Record<string, string> = {
  success: 'OK',
  partial: 'Parcial',
  error: 'Error',
};

const StatusBadge: React.FC<{ status: LogRow['status'] }> = ({ status }) => {
  const map = {
    success: { icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    partial: { icon: AlertTriangle, cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    error: { icon: XCircle, cls: 'bg-red-100 text-red-700 border-red-200' },
  } as const;
  const Icon = map[status].icon;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium', map[status].cls)}>
      <Icon className="h-3 w-3" />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
};

const AdminAiHistory: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LogRow['status']>('all');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['ai_translation_logs'],
    queryFn: async (): Promise<LogRow[]> => {
      const { data, error } = await supabase
        .from('ai_translation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as LogRow[]) || [];
    },
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data || []).filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        r.function_name,
        r.scope,
        r.target_language,
        r.source_language,
        r.provider,
        r.error_message,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, search, statusFilter]);

  const stats = useMemo(() => {
    const all = data || [];
    return {
      total: all.length,
      success: all.filter(r => r.status === 'success').length,
      partial: all.filter(r => r.status === 'partial').length,
      error: all.filter(r => r.status === 'error').length,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/ia" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Configuració d'IA
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">Historial de traduccions IA</h1>
            <p className="text-muted-foreground text-sm">
              Últimes 200 crides a <code>ai-translate</code> i <code>ai-product-seo</code>.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
            Actualitzar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Èxit" value={stats.success} cls="text-emerald-700" />
        <StatCard label="Parcial" value={stats.partial} cls="text-amber-700" />
        <StatCard label="Errors" value={stats.error} cls="text-red-700" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cerca per funció, idioma, scope o error..."
          className="max-w-sm"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          className="border rounded-md px-3 py-2 text-sm bg-background"
        >
          <option value="all">Tots els estats</option>
          <option value="success">Èxit</option>
          <option value="partial">Parcial</option>
          <option value="error">Error</option>
        </select>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Funció</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Idioma</TableHead>
              <TableHead>Proveïdor</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">OK / Err</TableHead>
              <TableHead className="text-right">Durada</TableHead>
              <TableHead>Estat</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-6">
                  Carregant...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-6">
                  Sense registres.
                </TableCell>
              </TableRow>
            )}
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-xs font-mono">
                  {format(new Date(r.created_at), 'dd/MM/yy HH:mm:ss')}
                </TableCell>
                <TableCell className="text-xs font-mono">{r.function_name}</TableCell>
                <TableCell className="text-xs">{r.scope || '—'}</TableCell>
                <TableCell className="text-xs">
                  {r.source_language ? <Badge variant="outline">{r.source_language}</Badge> : '—'}
                  {' → '}
                  {r.target_language ? <Badge>{r.target_language}</Badge> : '—'}
                </TableCell>
                <TableCell className="text-xs">{r.provider || '—'}</TableCell>
                <TableCell className="text-right text-xs">{r.items_count}</TableCell>
                <TableCell className="text-right text-xs">
                  <span className="text-emerald-700">{r.success_count}</span>
                  {' / '}
                  <span className={r.error_count > 0 ? 'text-red-700 font-semibold' : ''}>
                    {r.error_count}
                  </span>
                </TableCell>
                <TableCell className="text-right text-xs">
                  {r.duration_ms != null ? `${r.duration_ms} ms` : '—'}
                </TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell className="max-w-xs">
                  {r.error_message ? (
                    <span className="text-xs text-red-700 break-words" title={r.error_message}>
                      {r.error_message.length > 100
                        ? `${r.error_message.slice(0, 100)}…`
                        : r.error_message}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; cls?: string }> = ({ label, value, cls }) => (
  <div className="border rounded-md p-3 bg-card">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={cn('text-2xl font-bold', cls)}>{value}</div>
  </div>
);

export default AdminAiHistory;
