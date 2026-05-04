"use server";

/**
 * Server-side logging action to redirect client logs to the terminal.
 */
export async function logToServer(level: 'log' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = `[CLIENT-LOG][${timestamp}]`;
  
  const content = data ? `${message} ${JSON.stringify(data, null, 2)}` : message;

  switch (level) {
    case 'warn':
      console.warn(`${prefix} ⚠️ ${content}`);
      break;
    case 'error':
      console.error(`${prefix} ❌ ${content}`);
      break;
    default:
      console.log(`${prefix} ℹ️ ${content}`);
  }
}
