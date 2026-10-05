/**
 * Users Repository - CRUD operations for users.
 * Enforces MAX_USERS limit from system_settings and role assignments.
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class UserRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create a new user. Enforces MAX_USERS limit.
   * Case-insensitive unique usernames and uppercase role enforcement.
   */
  create({ username, password, fullName, role, createdBy, requesterRole }) {
    if (requesterRole && String(requesterRole).toUpperCase() !== 'SUPER_ADMIN') {
      return { success: false, error: 'Access denied: Only Super Admin accounts can create users.' };
    }
    if (!username || !password || !fullName) {
      return { success: false, error: 'Username, password, and full name are required.' };
    }

    const cleanUsername = String(username).trim().toLowerCase().replace(/\s+/g, '');
    const cleanFullName = String(fullName).trim();
    const cleanRole = String(role || 'CASHIER').trim().toUpperCase();

    if (!['SUPER_ADMIN', 'ADMIN', 'CASHIER'].includes(cleanRole)) {
      return { success: false, error: 'Invalid role specified. Must be SUPER_ADMIN, ADMIN, or CASHIER.' };
    }

    // Check MAX_USERS limit
    const maxUsersSetting = this.db.prepare(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'MAX_USERS'"
    ).get();
    const maxUsers = maxUsersSetting ? parseInt(maxUsersSetting.setting_value, 10) : 5;

    const activeUsers = this.db.prepare(
      'SELECT COUNT(*) as count FROM users WHERE is_active = 1'
    ).get();

    if (activeUsers.count >= maxUsers) {
      return {
        success: false,
        error: `Active user limit reached (${maxUsers} users). Disable an inactive user or increase MAX_USERS in Settings.`,
      };
    }

    // Check username uniqueness (case-insensitive)
    const existing = this.db.prepare(
      'SELECT id FROM users WHERE LOWER(TRIM(username)) = LOWER(?)'
    ).get(cleanUsername);
    if (existing) {
      return { success: false, error: `Username "${cleanUsername}" is already taken. Please choose another.` };
    }

    const id = uuidv4();
    const passwordHash = bcrypt.hashSync(String(password), 10);

    this.db.prepare(
      `INSERT INTO users (id, username, password_hash, full_name, role, is_active, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`
    ).run(id, cleanUsername, passwordHash, cleanFullName, cleanRole, createdBy || null);

    // Audit log
    try {
      this.db.prepare(
        "INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
      ).run(uuidv4(), createdBy || id, 'USER_CREATED', 'USER', id, JSON.stringify({ username: cleanUsername, role: cleanRole }));
    } catch (auditErr) {
      console.warn('[Users] Audit log write warning:', auditErr);
    }

    return { success: true, id };
  }

  /**
   * Update a user (supports editing username, full name, role, active status, password).
   */
  update({ id, username, fullName, role, isActive, password, updatedBy, requesterRole }) {
    if (requesterRole && String(requesterRole).toUpperCase() !== 'SUPER_ADMIN') {
      return { success: false, error: 'Access denied: Only Super Admin accounts can edit users.' };
    }
    const user = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    // Update username if supplied and changed
    if (username !== undefined && username.trim() !== '') {
      const cleanUsername = String(username).trim().toLowerCase().replace(/\s+/g, '');
      const existing = this.db.prepare(
        'SELECT id FROM users WHERE LOWER(TRIM(username)) = LOWER(?) AND id != ?'
      ).get(cleanUsername, id);
      if (existing) {
        return { success: false, error: `Username "${cleanUsername}" is already taken.` };
      }
      this.db.prepare(
        "UPDATE users SET username = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(cleanUsername, id);
    }

    if (fullName !== undefined) {
      this.db.prepare(
        "UPDATE users SET full_name = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(String(fullName).trim(), id);
    }

    if (role !== undefined) {
      const cleanRole = String(role).trim().toUpperCase();
      if (['SUPER_ADMIN', 'ADMIN', 'CASHIER'].includes(cleanRole)) {
        this.db.prepare(
          "UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(cleanRole, id);
      }
    }

    if (isActive !== undefined) {
      const nextActive = isActive ? 1 : 0;
      this.db.prepare(
        "UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(nextActive, id);

      try {
        this.db.prepare(
          "INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
        ).run(
          uuidv4(),
          updatedBy || id,
          nextActive ? 'USER_ENABLED' : 'USER_DISABLED',
          'USER',
          id,
          JSON.stringify({ username: user.username })
        );
      } catch (auditErr) {
        console.warn('[Users] Audit log write warning:', auditErr);
      }
    }

    if (password && String(password).trim() !== '') {
      const passwordHash = bcrypt.hashSync(String(password), 10);
      this.db.prepare(
        "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(passwordHash, id);
    }

    try {
      this.db.prepare(
        "INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
      ).run(
        uuidv4(),
        updatedBy || id,
        'USER_MODIFIED',
        'USER',
        id,
        JSON.stringify({
          username: username || user.username,
          fullName: fullName !== undefined ? fullName : user.full_name,
          role: role !== undefined ? role : user.role,
        })
      );
    } catch (auditErr) {
      console.warn('[Users] Audit log write warning:', auditErr);
    }

    return { success: true };
  }

  /**
   * List all users (excluding password hash).
   */
  list(requesterRole) {
    if (requesterRole && String(requesterRole).toUpperCase() !== 'SUPER_ADMIN') {
      return { success: false, error: 'Access denied: Only Super Admin accounts can view user accounts.' };
    }
    const users = this.db.prepare(
      'SELECT id, username, full_name, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC'
    ).all();

    return {
      success: true,
      users: users.map((u) => ({
        ...u,
        role: (u.role || 'CASHIER').toUpperCase().trim(),
      })),
    };
  }

  /**
   * Get a single user by ID.
   */
  get(id) {
    const user = this.db.prepare(
      'SELECT id, username, full_name, role, is_active, created_at, updated_at FROM users WHERE id = ?'
    ).get(id);

    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    return {
      success: true,
      user: {
        ...user,
        role: (user.role || 'CASHIER').toUpperCase().trim(),
      },
    };
  }
}

module.exports = { UserRepository };
