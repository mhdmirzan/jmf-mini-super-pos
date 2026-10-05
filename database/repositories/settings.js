/**
 * Settings Repository - System settings CRUD.
 */

const { v4: uuidv4 } = require('uuid');

class SettingsRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get a single setting by key.
   */
  get(key) {
    const setting = this.db.prepare(
      'SELECT * FROM system_settings WHERE setting_key = ?'
    ).get(key);
    if (!setting) {
      return { success: false, error: 'Setting not found.' };
    }
    return { success: true, setting };
  }

  /**
   * Get all settings.
   */
  getAll() {
    const settings = this.db.prepare('SELECT * FROM system_settings ORDER BY setting_key').all();
    return { success: true, settings };
  }

  /**
   * Set a system setting. Creates if not exists, updates if exists.
   */
  set({ key, value, updatedBy }) {
    const existing = this.db.prepare(
      'SELECT * FROM system_settings WHERE setting_key = ?'
    ).get(key);

    if (existing) {
      this.db.prepare(
        "UPDATE system_settings SET setting_value = ?, updated_at = datetime('now'), updated_by = ? WHERE setting_key = ?"
      ).run(value, updatedBy, key);
    } else {
      this.db.prepare(
        "INSERT INTO system_settings (id, setting_key, setting_value, updated_at, updated_by) VALUES (?, ?, ?, datetime('now'), ?)"
      ).run(uuidv4(), key, value, updatedBy);
    }

    // Audit log
    this.db.prepare(
      "INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
    ).run(uuidv4(), updatedBy, 'SETTING_CHANGED', 'SYSTEM_SETTING', key, JSON.stringify({
      key,
      oldValue: existing ? existing.setting_value : null,
      newValue: value,
    }));

    return { success: true };
  }
}

module.exports = { SettingsRepository };
