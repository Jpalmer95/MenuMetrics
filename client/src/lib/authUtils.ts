// REPLIT AUTH INTEGRATION: Helper functions for handling auth errors
export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}
