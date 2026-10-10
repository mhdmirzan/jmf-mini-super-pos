/**
 * Reports Repository - Comprehensive operational and profit queries.
 * Covers: daily sales, monthly sales, product sales, low stock, stock value, and profit margins.
 */

class ReportsRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Daily sales report with revenue and gross profit.
   */
  dailySales(date) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const invoices = this.db.prepare(`
      SELECT i.*, u.full_name as cashier_name
      FROM invoices i
      LEFT JOIN users u ON i.cashier_id = u.id
      WHERE DATE(i.created_at) = ? AND i.status = 'COMPLETED'
      ORDER BY i.created_at DESC
    `).all(targetDate);

    const summary = this.db.prepare(`
      SELECT 
        COUNT(*) as total_invoices,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(total_discount), 0) as total_discounts,
        COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'CARD' THEN total_amount ELSE 0 END), 0) as card_sales
      FROM invoices
      WHERE DATE(created_at) = ? AND status = 'COMPLETED'
    `).get(targetDate) || {
      total_invoices: 0,
      total_sales: 0,
      total_discounts: 0,
      cash_sales: 0,
      card_sales: 0,
    };

    const costSummary = this.db.prepare(`
      SELECT COALESCE(SUM(ii.quantity * p.cost), 0) as total_cost
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      JOIN products p ON ii.product_id = p.id
      WHERE DATE(i.created_at) = ? AND i.status = 'COMPLETED'
    `).get(targetDate);

    const totalCost = costSummary ? costSummary.total_cost : 0;
    const grossProfit = Math.max(0, summary.total_sales - totalCost);
    const profitMargin = summary.total_sales > 0 ? (grossProfit / summary.total_sales) * 100 : 0;

    summary.total_cost = totalCost;
    summary.gross_profit = grossProfit;
    summary.profit_margin = profitMargin;

    return { success: true, date: targetDate, invoices, summary };
  }

  /**
   * Monthly sales report with revenue and gross profit.
   */
  monthlySales(year, month) {
    const y = year || new Date().getFullYear();
    const m = month || new Date().getMonth() + 1;
    const monthStr = `${y}-${String(m).padStart(2, '0')}`;

    const dailyBreakdown = this.db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as invoice_count,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(total_discount), 0) as total_discounts
      FROM invoices
      WHERE strftime('%Y-%m', created_at) = ? AND status = 'COMPLETED'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all(monthStr);

    const summary = this.db.prepare(`
      SELECT 
        COUNT(*) as total_invoices,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(total_discount), 0) as total_discounts,
        COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'CARD' THEN total_amount ELSE 0 END), 0) as card_sales
      FROM invoices
      WHERE strftime('%Y-%m', created_at) = ? AND status = 'COMPLETED'
    `).get(monthStr) || {
      total_invoices: 0,
      total_sales: 0,
      total_discounts: 0,
      cash_sales: 0,
      card_sales: 0,
    };

    const costSummary = this.db.prepare(`
      SELECT COALESCE(SUM(ii.quantity * p.cost), 0) as total_cost
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      JOIN products p ON ii.product_id = p.id
      WHERE strftime('%Y-%m', i.created_at) = ? AND i.status = 'COMPLETED'
    `).get(monthStr);

    const totalCost = costSummary ? costSummary.total_cost : 0;
    const grossProfit = Math.max(0, summary.total_sales - totalCost);
    const profitMargin = summary.total_sales > 0 ? (grossProfit / summary.total_sales) * 100 : 0;

    summary.total_cost = totalCost;
    summary.gross_profit = grossProfit;
    summary.profit_margin = profitMargin;

    return { success: true, month: monthStr, dailyBreakdown, summary };
  }

  /**
   * Product sales report with quantity, revenue, cost, and profit.
   */
  productSales(filters = {}) {
    let dateFilter = '';
    const params = [];

    if (filters.dateFrom) {
      dateFilter += ' AND i.created_at >= ?';
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      dateFilter += ' AND i.created_at <= ?';
      params.push(filters.dateTo);
    }

    const products = this.db.prepare(`
      SELECT 
        ii.product_id,
        ii.item_code,
        ii.item_name,
        COALESCE(p.unit, 'PCS') as unit,
        SUM(ii.quantity) as total_quantity_sold,
        SUM(ii.amount) as total_sales,
        COALESCE(SUM(ii.quantity * p.cost), 0) as total_cost,
        COALESCE((SUM(ii.amount) - SUM(ii.quantity * p.cost)), 0) as gross_profit,
        COUNT(DISTINCT ii.invoice_id) as invoice_count
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      LEFT JOIN products p ON ii.product_id = p.id
      WHERE i.status = 'COMPLETED' ${dateFilter}
      GROUP BY ii.product_id
      ORDER BY total_sales DESC
    `).all(...params);

    return { success: true, products };
  }

  /**
   * Low stock report.
   */
  lowStock() {
    const products = this.db.prepare(`
      SELECT p.*
      FROM products p
      WHERE p.is_active = 1 AND p.quantity <= p.minimum_quantity
      ORDER BY p.quantity ASC
    `).all();

    return { success: true, products };
  }

  /**
   * Stock value report with valuation at retail, valuation at cost, and projected margin.
   */
  stockValue() {
    const products = this.db.prepare(`
      SELECT 
        p.id, p.item_code, p.item_name, p.unit, p.quantity, p.cost, p.retail_price,
        (p.quantity * p.cost) as cost_value,
        (p.quantity * p.retail_price) as retail_value
      FROM products p
      WHERE p.is_active = 1
      ORDER BY retail_value DESC
    `).all();

    const summary = this.db.prepare(`
      SELECT 
        COUNT(*) as total_products,
        COALESCE(SUM(quantity), 0) as total_quantity,
        COALESCE(SUM(quantity * cost), 0) as total_cost_value,
        COALESCE(SUM(quantity * retail_price), 0) as total_retail_value
      FROM products
      WHERE is_active = 1
    `).get() || {
      total_products: 0,
      total_quantity: 0,
      total_cost_value: 0,
      total_retail_value: 0,
    };

    summary.projected_profit = Math.max(0, summary.total_retail_value - summary.total_cost_value);
    summary.projected_margin = summary.total_retail_value > 0
      ? (summary.projected_profit / summary.total_retail_value) * 100
      : 0;

    return { success: true, products, summary };
  }
}

module.exports = { ReportsRepository };
