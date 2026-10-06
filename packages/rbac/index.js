export const permissionsList = [
  'safety.point.read',
  'safety.point.manage',
  'safety.point.override_gps',
  'safety.asset.read',
  'safety.asset.create',
  'safety.asset.update',
  'safety.asset.retire',
  'safety.inspection.read',
  'safety.inspection.perform',
  'safety.inspection.verify',
  'safety.defect.read',
  'safety.defect.report',
  'safety.defect.assign',
  'safety.defect.manage',
  'safety.capa.read',
  'safety.capa.create',
  'safety.capa.update',
  'safety.capa.verify',
  'safety.report.view',
  'safety.report.export',
  'safety.audit.view',
  'safety.configuration.manage',
  'feedback.view',
  'feedback.manage',
  'users.view',
  'audit.view',
  'sandbox.reset'
];

export const roles = {
  super_admin: ['*'],
  admin: ['*'],
  organization_admin: ['*'],
  safety_admin: ['*'],
  safety_manager: [
    'safety.point.read',
    'safety.asset.read',
    'safety.inspection.read',
    'safety.inspection.perform',
    'safety.inspection.verify',
    'safety.defect.read',
    'safety.defect.report',
    'safety.defect.assign',
    'safety.defect.manage',
    'safety.capa.read',
    'safety.capa.create',
    'safety.capa.update',
    'safety.capa.verify',
    'safety.report.view',
    'safety.report.export',
    'safety.audit.view',
    'users.view',
    'feedback.view',
    'feedback.manage',
    'audit.view',
    'sandbox.reset'
  ],
  inspector: [
    'safety.point.read',
    'safety.point.override_gps',
    'safety.asset.read',
    'safety.inspection.read',
    'safety.inspection.perform',
    'safety.defect.read',
    'safety.defect.report',
    'safety.capa.read',
    'safety.report.view',
    'feedback.view'
  ],
  staff: [
    'feedback.view',
    'feedback.manage',
    'safety.point.read',
    'safety.asset.read',
    'safety.inspection.read',
    'safety.defect.read'
  ],
  maintenance: [
    'safety.point.read',
    'safety.asset.read',
    'safety.inspection.read',
    'safety.defect.read',
    'safety.defect.report',
    'safety.capa.read',
    'safety.capa.update',
    'safety.report.view'
  ],
  department_manager: [
    'safety.point.read',
    'safety.asset.read',
    'safety.inspection.read',
    'safety.defect.read',
    'safety.capa.read',
    'safety.report.view',
    'safety.audit.view'
  ],
  auditor: [
    'safety.point.read',
    'safety.asset.read',
    'safety.inspection.read',
    'safety.defect.read',
    'safety.capa.read',
    'safety.report.view',
    'safety.report.export',
    'safety.audit.view',
    'audit.view'
  ],
  viewer: [
    'feedback.view',
    'safety.point.read',
    'safety.asset.read',
    'safety.inspection.read',
    'safety.defect.read',
    'safety.capa.read',
    'safety.report.view'
  ]
};

export function can(role, permission) {
  if (!role) return false;
  const rolePerms = roles[role];
  if (!rolePerms) return false;
  return rolePerms.some(p => p === '*' || p === permission);
}
