export const roles = {super_admin:['*'],admin:['feedback.view','feedback.manage','users.view','audit.view','sandbox.reset'],manager:['feedback.view','feedback.manage','users.view'],staff:['feedback.view','feedback.manage'],viewer:['feedback.view']};
export function can(role, permission) { return Boolean(roles[role]?.some(p=>p==='*'||p===permission)); }
