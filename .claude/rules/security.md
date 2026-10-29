# Security Rules

## Absolute bans (no exceptions, ever)

- NEVER store raw Aadhaar number in any DB column, log, or response
- NEVER store raw mobile number or email as plaintext — SHA-256 hash only
- NEVER log JWT tokens, OTPs, or any credential to console or log files
- NEVER expose stack traces or internal error messages in API responses
- NEVER trust institution_id, student_id, or apaar_id from request body for data access
  Always use the value from req.user (JWT claim)
- NEVER commit .env or any file containing secrets
- NEVER return the full student object — always select only needed fields

## JWT rules

```typescript
// Access token: 15 minutes
// Refresh token: 7 days
// Both stored in httpOnly, Secure, SameSite=Strict cookies
// Never return tokens in response body
// Never accept tokens in Authorization header for browser clients
//   (header is acceptable for M2M/API calls only)

// JWT payload shape:
{
  sub: userId,
  role: UserRole,
  institutionId?: string,   // present for institution roles
  sessionId: string          // for refresh token invalidation
}
