/**
 * Auth Repository - Handles local authentication.
 * Passwords are hashed with bcrypt. Never stores plaintext passwords.
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class AuthRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Authenticate a user by username and password.
   * Case-insensitive username match and trims extra whitespace.
   * Works completely offline using local SQLite.
   */
  login(username, password) {
    if (!username || !password) {
      return { success: false, error: 'Please enter both username and password.' };
    }

    const cleanUsername = String(username).trim();
    const cleanPassword = String(password);

    // Case-insensitive trimmed lookup
    const user = this.db.prepare(
      'SELECT id, username, password_hash, full_name, role, is_active FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))'
    ).get(cleanUsername);

    if (!user) {
      return { success: false, error: 'Invalid username or password.' };
    }

    if (!user.is_active) {
      return { success: false, error: 'Account is disabled. Please contact the administrator.' };
    }

    const isValid = bcrypt.compareSync(cleanPassword, user.password_hash);
    if (!isValid) {
      return { success: false, error: 'Invalid username or password.' };
    }

    // Log the login audit
    try {
      this.db.prepare(
        "INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
      ).run(uuidv4(), user.id, 'LOGIN', 'USER', user.id, JSON.stringify({ username: user.username, role: user.role }));
    } catch (auditErr) {
      console.warn('[Auth] Audit log write warning:', auditErr);
    }

    const normalizedRole = (user.role || 'CASHIER').toUpperCase().trim();

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: normalizedRole,
      },
    };
  }

  /**
   * Verify that a user session is still valid.
   */
  verify(userId) {
    if (!userId) {
      return { success: false, error: 'Session invalid.' };
    }

    const user = this.db.prepare(
      'SELECT id, username, full_name, role, is_active FROM users WHERE id = ?'
    ).get(userId);

    if (!user || !user.is_active) {
      return { success: false, error: 'Session invalid or account deactivated.' };
    }

    const normalizedRole = (user.role || 'CASHIER').toUpperCase().trim();

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: normalizedRole,
      },
    };
  }

  /**
   * Get list of active registered users for the terminal login screen.
   */
  getActiveUsers() {
    const users = this.db.prepare(
      'SELECT id, username, full_name, role FROM users WHERE is_active = 1 ORDER BY role DESC, username ASC'
    ).all();

    return {
      success: true,
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.full_name,
        role: (u.role || 'CASHIER').toUpperCase().trim(),
      })),
    };
  }
}

module.exports = { AuthRepository };
