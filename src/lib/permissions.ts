// Centralized list of premium/extra permissions that the Super Admin can
// grant or revoke per admin user. Keys must match the `app_permission` enum
// values declared in the database.

export type PermissionKey =
  | 'ai_features'
  | 'ai_history'
  | 'manage_translations'
  | 'manage_smtp';

export interface PremiumPermission {
  key: PermissionKey;
  labelKey: string; // i18n key
  fallback: string;
  description: string;
}

export const PREMIUM_PERMISSIONS: PremiumPermission[] = [
  {
    key: 'ai_features',
    labelKey: 'admin.permissions.ai_features',
    fallback: 'IA',
    description: 'Accés a generació de contingut amb IA',
  },
  {
    key: 'ai_history',
    labelKey: 'admin.permissions.ai_history',
    fallback: 'Historial IA',
    description: 'Accés a l\'historial d\'ús de la IA',
  },
  {
    key: 'manage_translations',
    labelKey: 'admin.permissions.manage_translations',
    fallback: 'Traduccions',
    description: 'Gestió d\'idiomes i traduccions',
  },
  {
    key: 'manage_smtp',
    labelKey: 'admin.permissions.manage_smtp',
    fallback: 'SMTP',
    description: 'Configuració del servidor SMTP',
  },
];
