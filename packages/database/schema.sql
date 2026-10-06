-- PdhSafetyFire Database Schema for MySQL 8 / MariaDB
-- Character set: utf8mb4, Collation: utf8mb4_unicode_ci

CREATE TABLE IF NOT EXISTS migrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  version VARCHAR(50) NOT NULL UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_org_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sites (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  organization_id VARCHAR(64) NOT NULL,
  code VARCHAR(50) NOT NULL,
  site_name VARCHAR(255) NOT NULL,
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_site_tenant (tenant_id),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS buildings (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  site_id VARCHAR(64) NOT NULL,
  code VARCHAR(50) NOT NULL,
  building_name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bld_tenant (tenant_id),
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS floors (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  building_id VARCHAR(64) NOT NULL,
  code VARCHAR(50) NOT NULL,
  floor_name VARCHAR(255) NOT NULL,
  floor_level INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_flr_tenant (tenant_id),
  FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS zones (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  floor_id VARCHAR(64) NOT NULL,
  code VARCHAR(50) NOT NULL,
  zone_name VARCHAR(255) NOT NULL,
  risk_category VARCHAR(50) DEFAULT 'MODERATE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_zn_tenant (tenant_id),
  FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS departments (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  dept_code VARCHAR(50) NOT NULL,
  dept_name VARCHAR(255) NOT NULL,
  head_user_id VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dept_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  department_id VARCHAR(64),
  disabled TINYINT(1) DEFAULT 0,
  must_change_password TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(64) PRIMARY KEY,
  role_code VARCHAR(50) NOT NULL UNIQUE,
  role_name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  id VARCHAR(64) PRIMARY KEY,
  permission_code VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id VARCHAR(64) NOT NULL,
  permission_code VARCHAR(100) NOT NULL,
  PRIMARY KEY (role_id, permission_code),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id VARCHAR(64) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL,
  role_code VARCHAR(50) NOT NULL,
  PRIMARY KEY (user_id, tenant_id, role_code),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS safety_points (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  site_id VARCHAR(64) NOT NULL,
  building_id VARCHAR(64) NOT NULL,
  floor_id VARCHAR(64) NOT NULL,
  zone_id VARCHAR(64) NOT NULL,
  department_id VARCHAR(64),
  point_code VARCHAR(100) NOT NULL,
  point_name VARCHAR(255) NOT NULL,
  location_description TEXT,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  geofence_radius_m INT DEFAULT 30,
  location_accuracy_required_m INT DEFAULT 20,
  qr_token VARCHAR(128) NOT NULL UNIQUE,
  qr_token_status VARCHAR(20) DEFAULT 'ACTIVE',
  status VARCHAR(50) DEFAULT 'ACTIVE',
  responsible_department_id VARCHAR(64),
  responsible_user_id VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sp_tenant (tenant_id),
  INDEX idx_sp_code (point_code),
  INDEX idx_sp_token (qr_token),
  FOREIGN KEY (building_id) REFERENCES buildings(id),
  FOREIGN KEY (floor_id) REFERENCES floors(id),
  FOREIGN KEY (zone_id) REFERENCES zones(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS asset_types (
  id VARCHAR(64) PRIMARY KEY,
  type_code VARCHAR(50) NOT NULL UNIQUE,
  type_name_th VARCHAR(100) NOT NULL,
  type_name_en VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  description TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS safety_assets (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  safety_point_id VARCHAR(64) NOT NULL,
  asset_type_id VARCHAR(64) NOT NULL,
  asset_code VARCHAR(100) NOT NULL,
  asset_name VARCHAR(255) NOT NULL,
  serial_number VARCHAR(100),
  manufacturer VARCHAR(100),
  model VARCHAR(100),
  status VARCHAR(50) DEFAULT 'NORMAL',
  purchase_date DATE,
  manufacture_date DATE,
  install_date DATE,
  expiry_date DATE,
  last_inspection_date DATETIME,
  next_inspection_date DATETIME,
  responsible_department_id VARCHAR(64),
  responsible_user_id VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_asset_tenant (tenant_id),
  INDEX idx_asset_code (asset_code),
  INDEX idx_asset_point (safety_point_id),
  FOREIGN KEY (safety_point_id) REFERENCES safety_points(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_type_id) REFERENCES asset_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fire_extinguisher_details (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  asset_id VARCHAR(64) NOT NULL UNIQUE,
  subtype VARCHAR(50) NOT NULL,
  capacity DECIMAL(10,2),
  capacity_unit VARCHAR(20) DEFAULT 'Kg',
  fire_rating VARCHAR(50),
  agent_type VARCHAR(100),
  pressure_type VARCHAR(50) DEFAULT 'STORED_PRESSURE',
  weight DECIMAL(10,2),
  weight_unit VARCHAR(20) DEFAULT 'Kg',
  last_refill_date DATE,
  next_refill_date DATE,
  last_service_date DATE,
  next_service_date DATE,
  last_hydrostatic_test DATE,
  next_hydrostatic_test DATE,
  supplier VARCHAR(150),
  service_provider VARCHAR(150),
  certificate_number VARCHAR(100),
  FOREIGN KEY (asset_id) REFERENCES safety_assets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS asset_photos (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  asset_id VARCHAR(64) NOT NULL,
  photo_type VARCHAR(50) DEFAULT 'GENERAL',
  file_path VARCHAR(255) NOT NULL,
  file_hash VARCHAR(64) NOT NULL,
  file_size INT,
  mime_type VARCHAR(50),
  uploaded_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (asset_id) REFERENCES safety_assets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS asset_documents (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  asset_id VARCHAR(64) NOT NULL,
  doc_title VARCHAR(255) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  file_hash VARCHAR(64) NOT NULL,
  uploaded_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (asset_id) REFERENCES safety_assets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inspection_templates (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  asset_type_id VARCHAR(64) NOT NULL,
  frequency VARCHAR(50) DEFAULT 'MONTHLY',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (asset_type_id) REFERENCES asset_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inspection_template_versions (
  id VARCHAR(64) PRIMARY KEY,
  template_id VARCHAR(64) NOT NULL,
  version_number VARCHAR(20) NOT NULL,
  standard_name VARCHAR(255) NOT NULL,
  standard_reference VARCHAR(255),
  effective_date DATE,
  is_active TINYINT(1) DEFAULT 1,
  is_locked TINYINT(1) DEFAULT 0,
  created_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES inspection_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inspection_items (
  id VARCHAR(64) PRIMARY KEY,
  version_id VARCHAR(64) NOT NULL,
  category VARCHAR(100) NOT NULL,
  item_order INT DEFAULT 1,
  question_th TEXT NOT NULL,
  question_en TEXT,
  is_critical TINYINT(1) DEFAULT 0,
  require_photo_on_fail TINYINT(1) DEFAULT 1,
  require_note_on_fail TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (version_id) REFERENCES inspection_template_versions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inspection_schedules (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  safety_point_id VARCHAR(64) NOT NULL,
  template_id VARCHAR(64) NOT NULL,
  frequency VARCHAR(50) DEFAULT 'MONTHLY',
  next_due_date DATE NOT NULL,
  assigned_user_id VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inspections (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  safety_point_id VARCHAR(64) NOT NULL,
  safety_asset_id VARCHAR(64) NOT NULL,
  template_version_id VARCHAR(64) NOT NULL,
  inspected_by VARCHAR(64) NOT NULL,
  inspected_at DATETIME NOT NULL,
  status VARCHAR(50) DEFAULT 'PASS',
  overall_result VARCHAR(50) DEFAULT 'PASS',
  checkin_latitude DECIMAL(10,8),
  checkin_longitude DECIMAL(11,8),
  checkin_accuracy_m DECIMAL(8,2),
  distance_from_point_m DECIMAL(8,2),
  location_status VARCHAR(50) DEFAULT 'VERIFIED',
  location_override_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_insp_tenant (tenant_id),
  INDEX idx_insp_point (safety_point_id),
  INDEX idx_insp_asset (safety_asset_id),
  FOREIGN KEY (safety_point_id) REFERENCES safety_points(id),
  FOREIGN KEY (safety_asset_id) REFERENCES safety_assets(id),
  FOREIGN KEY (template_version_id) REFERENCES inspection_template_versions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inspection_results (
  id VARCHAR(64) PRIMARY KEY,
  inspection_id VARCHAR(64) NOT NULL,
  item_id VARCHAR(64) NOT NULL,
  result VARCHAR(20) NOT NULL, -- PASS, FAIL, NA
  note TEXT,
  photo_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES inspection_items(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS defect_reports (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  inspection_id VARCHAR(64),
  safety_point_id VARCHAR(64) NOT NULL,
  safety_asset_id VARCHAR(64),
  reported_by_type VARCHAR(50) DEFAULT 'INSPECTOR', -- INSPECTOR, PUBLIC, STAFF
  reported_by_user_id VARCHAR(64),
  reporter_name VARCHAR(150),
  reporter_phone VARCHAR(50),
  reporter_email VARCHAR(150),
  issue_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  photo_url VARCHAR(255),
  severity INT DEFAULT 1,
  likelihood INT DEFAULT 1,
  risk_score INT DEFAULT 1,
  risk_level VARCHAR(20) DEFAULT 'LOW',
  status VARCHAR(50) DEFAULT 'REPORTED',
  reported_latitude DECIMAL(10,8),
  reported_longitude DECIMAL(11,8),
  reported_accuracy DECIMAL(8,2),
  distance_from_point_m DECIMAL(8,2),
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_def_tenant (tenant_id),
  INDEX idx_def_point (safety_point_id),
  INDEX idx_def_status (status),
  FOREIGN KEY (safety_point_id) REFERENCES safety_points(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS defect_evidence (
  id VARCHAR(64) PRIMARY KEY,
  defect_id VARCHAR(64) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  file_hash VARCHAR(64),
  uploaded_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (defect_id) REFERENCES defect_reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS corrective_actions (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  defect_id VARCHAR(64) NOT NULL UNIQUE,
  problem TEXT NOT NULL,
  root_cause TEXT,
  immediate_correction TEXT,
  corrective_action TEXT,
  preventive_action TEXT,
  risk_level VARCHAR(20) DEFAULT 'LOW',
  owner_user_id VARCHAR(64),
  owner_department_id VARCHAR(64),
  acknowledge_due_at DATETIME,
  corrective_due_at DATETIME,
  verification_due_at DATETIME,
  due_date DATE,
  completed_at DATETIME,
  verification_result VARCHAR(50),
  verified_by VARCHAR(64),
  verified_at DATETIME,
  before_photo_url VARCHAR(255),
  after_photo_url VARCHAR(255),
  status VARCHAR(50) DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (defect_id) REFERENCES defect_reports(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS corrective_action_evidence (
  id VARCHAR(64) PRIMARY KEY,
  capa_id VARCHAR(64) NOT NULL,
  evidence_type VARCHAR(20) DEFAULT 'AFTER',
  file_path VARCHAR(255) NOT NULL,
  file_hash VARCHAR(64),
  uploaded_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (capa_id) REFERENCES corrective_actions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS risk_matrices (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  min_score INT NOT NULL,
  max_score INT NOT NULL,
  level_code VARCHAR(20) NOT NULL,
  level_name VARCHAR(50) NOT NULL,
  color_hex VARCHAR(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sla_rules (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  risk_level VARCHAR(20) NOT NULL,
  acknowledge_hours INT NOT NULL,
  corrective_hours INT NOT NULL,
  verification_hours INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(64),
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL,
  actor_user_id VARCHAR(64),
  actor_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  module VARCHAR(50) DEFAULT 'pdhsafetyfire',
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(64),
  before_json TEXT,
  after_json TEXT,
  reason TEXT,
  request_id VARCHAR(64),
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_tenant (tenant_id),
  INDEX idx_audit_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(191) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT,
  success TINYINT(1) NOT NULL,
  reason VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS two_factor_auth (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL UNIQUE,
  secret_encrypted TEXT NOT NULL,
  is_enabled TINYINT(1) DEFAULT 0,
  enrolled_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recovery_codes (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  used_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
