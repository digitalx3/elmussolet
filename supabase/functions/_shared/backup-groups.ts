// Shared definition of which tables and buckets belong to each backup group.
// Order within each `tables` array is the import order for upsert mode.
// For wipe mode, tables are deleted in reverse order to respect FKs.

export type BackupGroupId =
  | 'catalog'
  | 'content'
  | 'config'
  | 'templates'
  | 'sales'
  | 'messages';

export interface BackupGroup {
  id: BackupGroupId;
  label: string;
  tables: string[];
  buckets: string[];
}

export const BACKUP_GROUPS: BackupGroup[] = [
  {
    id: 'catalog',
    label: 'Catàleg',
    tables: [
      'brands',
      'categories',
      'category_translations',
      'variant_types',
      'variant_type_translations',
      'products',
      'product_variants',
      'product_translations',
      'product_images',
    ],
    buckets: ['product-images', 'brand-logos'],
  },
  {
    id: 'content',
    label: 'Contingut',
    tables: ['hero_slides', 'cms_blocks'],
    buckets: ['site-assets'],
  },
  {
    id: 'config',
    label: 'Configuració',
    tables: [
      'shipping_zones',
      'shipping_rates',
      'tax_rates',
      'order_statuses',
      'order_status_translations',
      'order_status_email_templates',
      'smtp_settings',
      'site_settings',
    ],
    buckets: [],
  },
  {
    id: 'templates',
    label: 'Plantilles',
    tables: [
      'list_templates',
      'list_template_translations',
      'list_template_sections',
      'list_template_items',
    ],
    buckets: [],
  },
  {
    id: 'sales',
    label: 'Clients i vendes',
    tables: [
      'customers',
      'birth_lists',
      'list_sections',
      'list_items',
      'list_owners',
      'orders',
      'order_items',
    ],
    buckets: [],
  },
  {
    id: 'messages',
    label: 'Missatges',
    tables: ['contact_messages'],
    buckets: [],
  },
];

export const ALL_BACKUP_TABLES = BACKUP_GROUPS.flatMap(g => g.tables);
export const ALL_BACKUP_BUCKETS = Array.from(
  new Set(BACKUP_GROUPS.flatMap(g => g.buckets))
);

export const SCHEMA_VERSION = 2;
