/**
 * Logger - Handles all bot logging
 */

const fs = require('fs');
const path = require('path');

class Logger {
  constructor(filePath = './logs/bot.log', level = 'INFO') {
    this.filePath = filePath;
    this.level = level;
    this.levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    
    // Ensure logs directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Format log message
   */
  format(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const dataStr = Object.keys(data).length > 0 ? ` | ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] ${message}${dataStr}`;
  }

  /**
   * Write log
   */
  write(level, message, data = {}) {
    if (this.levels[level] < this.levels[this.level]) {
      return;
    }

    const formatted = this.format(level, message, data);
    
    // Console output
    if (level === 'ERROR') {
      console.error(formatted);
    } else if (level === 'WARN') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }

    // File output
    fs.appendFileSync(this.filePath, formatted + '\n');
  }

  debug(message, data) { this.write('DEBUG', message, data); }
  info(message, data) { this.write('INFO', message, data); }
  warn(message, data) { this.write('WARN', message, data); }
  error(message, data) { this.write('ERROR', message, data); }
}

module.exports = Logger;
