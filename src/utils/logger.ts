import fs from 'fs'
import path from 'path'

const LOG_DIR = path.join(process.cwd(), 'logs')
fs.mkdirSync(LOG_DIR, { recursive: true })

const LOG_FILE = path.join(LOG_DIR, 'melaos-studio.log')

function timestamp() {
  return new Date().toISOString()
}

function write(level: string, ...args: any[]) {
  const line = `[${timestamp()}] [${level}] ${args.map(String).join(' ')}`
  console.log(line)
  fs.appendFileSync(LOG_FILE, line + '\n')
}

export const logger = {
  info:  (...args: any[]) => write('INFO ', ...args),
  warn:  (...args: any[]) => write('WARN ', ...args),
  error: (...args: any[]) => write('ERROR', ...args),
  debug: (...args: any[]) => write('DEBUG', ...args),
  child: () => logger,
  level: 'info',
}
