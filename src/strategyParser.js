/**
 * XML Strategy Parser
 * Parses Deriv Bot XML strategy files
 */

const fs = require('fs');
const xml2js = require('xml2js');

class StrategyParser {
  constructor() {
    this.parser = new xml2js.Parser();
    this.builder = new xml2js.Builder();
  }

  /**
   * Parse XML strategy file
   */
  async parseFile(filePath) {
    try {
      const xmlContent = fs.readFileSync(filePath, 'utf-8');
      const result = await this.parser.parseStringPromise(xmlContent);
      return this.extractConfig(result);
    } catch (error) {
      throw new Error(`Failed to parse strategy file: ${error.message}`);
    }
  }

  /**
   * Extract configuration from parsed XML
   */
  extractConfig(xmlObj) {
    const strategy = xmlObj.strategy;
    if (!strategy) {
      throw new Error('Invalid XML: missing strategy element');
    }

    const config = {
      name: strategy.$.name,
      version: strategy.$.version,
      market: {},
      entry_point: {},
      stakes: {},
      risk_management: {},
      contract: {}
    };

    // Market
    if (strategy.market) {
      const m = strategy.market[0];
      config.market.symbol = m.symbol ? m.symbol[0] : 'R_100';
      config.market.contract_type = m.contract_type ? m.contract_type[0] : 'DIGITOVER';
    }

    // Entry Point
    if (strategy.entry_point) {
      const ep = strategy.entry_point[0];
      config.entry_point.sample_size = ep.sample_size ? parseInt(ep.sample_size[0]) : 10;
      config.entry_point.barrier = ep.barrier ? parseFloat(ep.barrier[0]) : 5;
      config.entry_point.min_frequency = ep.min_frequency ? parseFloat(ep.min_frequency[0]) : 60;
      config.entry_point.confirmation_type = ep.confirmation_type ? ep.confirmation_type[0] : 'frequency';
      config.entry_point.recent_digit_confirmation = ep.recent_digit_confirmation ? ep.recent_digit_confirmation[0] === 'true' : true;
      config.entry_point.contract_type = config.market.contract_type;
    }

    // Stakes
    if (strategy.stakes) {
      const s = strategy.stakes[0];
      config.stakes.stake1 = s.stake_1 ? parseFloat(s.stake_1[0]) : 1.0;
      config.stakes.stake2 = s.stake_2 ? parseFloat(s.stake_2[0]) : 2.0;
      config.stakes.martingale_multiplier = s.martingale_multiplier ? parseFloat(s.martingale_multiplier[0]) : 2.0;
      config.stakes.max_martingale_steps = s.max_martingale_steps ? parseInt(s.max_martingale_steps[0]) : 4;
    }

    // Risk Management
    if (strategy.risk_management) {
      const rm = strategy.risk_management[0];
      config.risk_management.take_profit = rm.take_profit ? parseFloat(rm.take_profit[0]) : 100;
      config.risk_management.stop_loss = rm.stop_loss ? parseFloat(rm.stop_loss[0]) : 50;
    }

    // Contract
    if (strategy.contract) {
      const c = strategy.contract[0];
      config.contract.duration = c.duration ? parseInt(c.duration[0]) : 1;
      config.contract.duration_unit = c.duration_unit ? c.duration_unit[0] : 't';
    }

    return config;
  }

  /**
   * Validate configuration
   */
  validateConfig(config) {
    const errors = [];

    // Validate stakes
    if (config.stakes.stake1 <= 0) errors.push('stake_1 must be > 0');
    if (config.stakes.stake2 <= 0) errors.push('stake_2 must be > 0');
    if (config.stakes.martingale_multiplier < 1.5) errors.push('martingale_multiplier should be >= 1.5');
    if (config.stakes.max_martingale_steps < 1) errors.push('max_martingale_steps must be >= 1');

    // Validate entry point
    if (config.entry_point.sample_size < 5) errors.push('sample_size should be >= 5');
    if (config.entry_point.barrier < 0 || config.entry_point.barrier > 9) errors.push('barrier must be 0-9');
    if (config.entry_point.min_frequency < 0 || config.entry_point.min_frequency > 100) {
      errors.push('min_frequency must be 0-100');
    }

    // Validate risk management
    if (config.risk_management.take_profit <= 0) errors.push('take_profit must be > 0');
    if (config.risk_management.stop_loss <= 0) errors.push('stop_loss must be > 0');

    // Validate contract
    if (config.contract.duration < 1) errors.push('duration must be >= 1');

    return { valid: errors.length === 0, errors };
  }
}

module.exports = StrategyParser;
