# API Design Rules

## Route structure (enforce always)

```typescript
// Correct pattern — every protected route
router.post(
  '/resource/action',
  authenticate,           // 1. Verify JWT, attach req.user
  requireRole('role'),    // 2. RBAC check
  validate(ZodSchema),    // 3. Validate body/query
  asyncHandler(handler)   // 4. Handler (wrapped for async errors)
)
