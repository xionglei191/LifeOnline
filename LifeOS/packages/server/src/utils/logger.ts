export class Logger {
  constructor(private moduleName: string) {}

  private formatMessage(level: string, message: string, meta: any[]): string {
    const timestamp = new Date().toISOString();
    const metaString = meta.length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] [${this.moduleName}] ${message}${metaString}`;
  }

  info(message: string, ...meta: any[]): void {
    console.log(this.formatMessage('INFO', message, meta));
  }

  warn(message: string, ...meta: any[]): void {
    console.warn(this.formatMessage('WARN', message, meta));
  }

  error(message: string, error?: any): void {
    const timestamp = new Date().toISOString();
    let errString = '';
    
    if (error instanceof Error) {
      errString = `\n  Error: ${error.message}\n  Stack: ${error.stack}`;
    } else if (error !== undefined) {
      errString = `\n  Error: ${JSON.stringify(error)}`;
    }
    
    console.error(`[${timestamp}] [ERROR] [${this.moduleName}] ${message}${errString}`);
  }

  debug(message: string, ...meta: any[]): void {
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production') {
      console.debug(this.formatMessage('DEBUG', message, meta));
    }
  }
}
