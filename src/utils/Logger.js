import fs from 'fs/promises';
import path from 'path';

/**
 * Logger utility for IFC conversion with file and console output
 */
export class Logger {
  constructor(options = {}) {
    this.options = {
      logLevel: options.logLevel || 'INFO', // DEBUG, INFO, WARN, ERROR
      logToFile: options.logToFile !== false,
      logToConsole: options.logToConsole !== false,
      logFile: options.logFile || 'conversion.log',
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      ...options
    };
    
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    };
    
    this.currentLevel = this.levels[this.options.logLevel];
    this.logBuffer = [];
  }

  /**
   * Log debug message (detailed processing info)
   */
  debug(message, ...args) {
    this.log('DEBUG', message, ...args);
  }

  /**
   * Log info message (general progress)
   */
  info(message, ...args) {
    this.log('INFO', message, ...args);
  }

  /**
   * Log warning message (non-critical issues)
   */
  warn(message, ...args) {
    this.log('WARN', message, ...args);
  }

  /**
   * Log error message (critical issues)
   */
  error(message, ...args) {
    this.log('ERROR', message, ...args);
  }

  /**
   * Internal log method
   */
  log(level, message, ...args) {
    const levelNum = this.levels[level];
    
    if (levelNum < this.currentLevel) {
      return; // Skip if below current log level
    }

    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.join(' ') : '';
    const logEntry = `[${timestamp}] ${level}: ${message}${formattedArgs}`;

    // Console output (only INFO, WARN, ERROR by default)
    if (this.options.logToConsole) {
      if (level === 'ERROR') {
        console.error(this.formatConsoleMessage(level, message, ...args));
      } else if (level === 'WARN') {
        console.warn(this.formatConsoleMessage(level, message, ...args));
      } else if (level === 'INFO') {
        console.log(this.formatConsoleMessage(level, message, ...args));
      }
      // DEBUG messages are not shown in console unless explicitly enabled
    }

    // File output (all levels)
    if (this.options.logToFile) {
      this.logBuffer.push(logEntry);
      
      // Flush buffer periodically
      if (this.logBuffer.length > 100) {
        this.flushToFile();
      }
    }
  }

  /**
   * Format console message with colors and symbols
   */
  formatConsoleMessage(level, message, ...args) {
    const symbols = {
      DEBUG: '🔍',
      INFO: 'ℹ️ ',
      WARN: '⚠️ ',
      ERROR: '❌'
    };
    
    const formattedArgs = args.length > 0 ? ' ' + args.join(' ') : '';
    return `${symbols[level]} ${message}${formattedArgs}`;
  }

  /**
   * Progress logger for repeated operations
   */
  logProgress(operation, current, total, details = '') {
    const percentage = Math.round((current / total) * 100);
    
    // Only log progress at certain intervals to avoid spam
    if (current === 1 || current === total || current % Math.max(1, Math.floor(total / 10)) === 0) {
      this.info(`${operation}: ${current}/${total} (${percentage}%)${details ? ' - ' + details : ''}`);
    }
    
    // Always log detailed progress to file
    this.debug(`${operation}: Processing item ${current}/${total}${details ? ' - ' + details : ''}`);
  }

  /**
   * Flush log buffer to file
   */
  async flushToFile() {
    if (!this.options.logToFile || this.logBuffer.length === 0) {
      return;
    }

    try {
      const logDir = path.dirname(this.options.logFile);
      await fs.mkdir(logDir, { recursive: true });
      
      const logContent = this.logBuffer.join('\n') + '\n';
      await fs.appendFile(this.options.logFile, logContent);
      
      this.logBuffer = [];
    } catch (error) {
      console.error('Failed to write log file:', error.message);
    }
  }

  /**
   * Close logger and flush remaining logs
   */
  async close() {
    await this.flushToFile();
  }

  /**
   * Create a child logger with specific context
   */
  createChild(context, options = {}) {
    return new Logger({
      ...this.options,
      ...options,
      logFile: this.options.logFile.replace('.log', `_${context}.log`)
    });
  }

  /**
   * Clear log file
   */
  async clearLogFile() {
    if (this.options.logToFile) {
      try {
        await fs.writeFile(this.options.logFile, '');
      } catch (error) {
        console.error('Failed to clear log file:', error.message);
      }
    }
  }
}

/**
 * Create a logger instance for IFC conversion
 */
export function createIFCLogger(options = {}) {
  const logFile = options.logFile || path.join(process.cwd(), 'logs', 'ifc-conversion.log');
  
  return new Logger({
    logLevel: options.verbose ? 'DEBUG' : 'INFO',
    logFile,
    logToFile: true,
    logToConsole: true,
    ...options
  });
}