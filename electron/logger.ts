/**
 * Logger Module for AZRAR Desktop
 * نظام تسجيل الأخطاء والأحداث
 */

/** استيراد مسار الـ main فقط — تجنب `src/index.js` الذي يسحب فرع الـ renderer ويكسر الدمج مع esbuild */
import log from 'electron-log/main.js';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

class Logger {
  constructor() {
    this.setupLogger();
  }

  setupLogger() {
    // إعداد مسارات الحفظ
    const logsPath = path.join(app.getPath('userData'), 'logs');

    // إنشاء مجلد logs إذا لم يكن موجوداً
    if (!fs.existsSync(logsPath)) {
      fs.mkdirSync(logsPath, { recursive: true });
    }

    // إعدادات الملف
    log.transports.file.resolvePathFn = () => {
      const date = new Date().toISOString().split('T')[0];
      return path.join(logsPath, `azrar-${date}.log`);
    };

    // حجم الملف الأقصى: 10MB
    log.transports.file.maxSize = 10 * 1024 * 1024;

    // مستوى التسجيل
    log.transports.file.level = 'info';
    log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : 'info';

    // تنسيق الرسائل
    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
    log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] {text}';

    // تفعيل الألوان في Console
    log.transports.console.useStyles = true;

    // Hook للأخطاء غير المعالجة
    this.setupErrorHandlers();

    // تنظيف السجلات القديمة
    this.cleanOldLogs(logsPath, 30); // حذف السجلات الأقدم من 30 يوم
  }

  setupErrorHandlers() {
    // معالجة الأخطاء غير المعالجة
    process.on('uncaughtException', (error) => {
      log.error('Uncaught Exception:', error);
      log.error('Stack:', error.stack);
    });

    process.on('unhandledRejection', (reason, promise) => {
      log.error('Unhandled Rejection at:', promise);
      log.error('Reason:', reason);
    });
  }

  cleanOldLogs(logsPath, daysToKeep) {
    try {
      const files = fs.readdirSync(logsPath);
      const now = Date.now();
      const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

      files.forEach((file) => {
        const filePath = path.join(logsPath, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtime.getTime();

        if (age > maxAge) {
          fs.unlinkSync(filePath);
          log.info(`Deleted old log file: ${file}`);
        }
      });
    } catch (error) {
      log.error('Error cleaning old logs:', error);
    }
  }

  // طرق التسجيل
  info(message, ...args) {
    log.info(message, ...args);
  }

  warn(message, ...args) {
    log.warn(message, ...args);
  }

  error(message, ...args) {
    log.error(message, ...args);
  }

  debug(message, ...args) {
    log.debug(message, ...args);
  }

  verbose(message, ...args) {
    log.verbose(message, ...args);
  }

  // تسجيل حدث بدء التطبيق
  logAppStart() {
    log.info('='.repeat(50));
    log.info('AZRAR Desktop Application Started');
    log.info(`Version: ${app.getVersion()}`);
    log.info(`Electron: ${process.versions.electron}`);
    log.info(`Chrome: ${process.versions.chrome}`);
    log.info(`Node: ${process.versions.node}`);
    log.info(`Platform: ${process.platform}`);
    log.info(`Arch: ${process.arch}`);
    log.info(`User Data: ${app.getPath('userData')}`);
    log.info('='.repeat(50));
  }

  // تسجيل حدث إيقاف التطبيق
  logAppStop() {
    log.info('='.repeat(50));
    log.info('AZRAR Desktop Application Stopped');
    log.info('='.repeat(50));
  }

  // تسجيل عملية
  logOperation(operation, details = {}) {
    log.info(`Operation: ${operation}`, JSON.stringify(details, null, 2));
  }

  // تسجيل خطأ مع Context
  logErrorWithContext(error, context = {}) {
    log.error('Error occurred:', {
      message: error.message,
      stack: error.stack,
      context: context,
      timestamp: new Date().toISOString(),
    });
  }

  // تسجيل أداء
  logPerformance(operation, duration) {
    log.info(`Performance: ${operation} took ${duration}ms`);
  }

  // الحصول على مسار ملف السجل الحالي
  getCurrentLogPath() {
    return log.transports.file.getFile().path;
  }

  // قراءة آخر N سطر من السجل
  async getRecentLogs(lines = 100) {
    try {
      const logPath = this.getCurrentLogPath();
      const content = fs.readFileSync(logPath, 'utf-8');
      const allLines = content.split('\n');
      return allLines.slice(-lines).join('\n');
    } catch (error) {
      log.error('Error reading recent logs:', error);
      return '';
    }
  }
}

// إنشاء instance واحدة
const logger = new Logger();

export default logger;

// تصدير الطرق مباشرة للاستخدام السهل
export const { info, warn, error, debug, verbose } = logger;
export const logAppStart = () => logger.logAppStart();
export const logAppStop = () => logger.logAppStop();
export const logOperation = (op, details) => logger.logOperation(op, details);
export const logErrorWithContext = (err, ctx) => logger.logErrorWithContext(err, ctx);
export const logPerformance = (op, dur) => logger.logPerformance(op, dur);
