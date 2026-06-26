import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Baby, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-primary/15 text-primary',
  closed: 'bg-accent/15 text-accent',
  archived: 'bg-destructive/15 text-destructive',
};

const AdminBirthListList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ['admin-birth-lists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('birth_lists')
        .select(`
          id, list_code, baby_name, expected_date, status, created_at,
          list_owners(first_name, last_name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = lists.filter(l => {
    const matchesSearch = !search.trim() ||
      l.list_code.toLowerCase().includes(search.toLowerCase()) ||
      (l.baby_name || '').toLowerCase().includes(search.toLowerCase()) ||
      l.list_owners?.some((o: any) =>
        `${o.first_name} ${o.last_name}`.toLowerCase().includes(search.toLowerCase())
      );
    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">{t('admin.lists')}</h1>
        <Button onClick={() => navigate('/admin/llistes/nova')} className="gap-2">
          <Plus className="h-4 w-4" />
          {t('admin.newList')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('admin.searchLists')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="draft">{t('admin.statusDraft')}</SelectItem>
            <SelectItem value="active">{t('admin.statusActive')}</SelectItem>
            <SelectItem value="closed">{t('admin.statusClosed')}</SelectItem>
            <SelectItem value="archived">{t('admin.statusArchived')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Baby className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>{t('common.noResults')}</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">{t('list.listCode')}</th>
                <th className="text-left p-3 font-medium">{t('list.babyName')}</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">{t('admin.owners')}</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">{t('list.expectedDate')}</th>
                <th className="text-left p-3 font-medium">{t('account.orderStatus')}</th>
                <th className="text-right p-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(list => (
                <tr
                  key={list.id}
                  className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/admin/llistes/${list.id}`)}
                >
                  <td className="p-3 font-mono text-xs">{list.list_code}</td>
                  <td className="p-3">{list.baby_name || '—'}</td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">
                    {list.list_owners?.map((o: any) => `${o.first_name} ${o.last_name}`).join(', ') || '—'}
                  </td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">
                    {list.expected_date
                      ? new Date(list.expected_date).toLocaleDateString('ca-ES')
                      : '—'}
                  </td>
                  <td className="p-3">
                    <Badge className={statusColors[list.status || 'draft'] || ''}>
                      {t(`admin.status${(list.status || 'draft').charAt(0).toUpperCase() + (list.status || 'draft').slice(1)}`)}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm">{t('common.edit')}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminBirthListList;
