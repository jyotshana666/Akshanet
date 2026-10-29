# Database Rules

## Prisma usage

- Import Prisma client ONLY from /apps/api/src/lib/prisma.ts (singleton)
- Raw Prisma client calls ONLY in *.repository.ts files
- Route handlers and service functions never import Prisma directly
- Always use `select` or `omit` to avoid returning sensitive fields

## Multi-tenancy guard (enforce on every query)

```typescript
// WRONG — never do this
const records = await prisma.admission.findMany()

// CORRECT — always filter by institution from JWT
const records = await prisma.admission.findMany({
  where: {
    institution_id: req.user.institutionId, // from JWT claim
    ...otherFilters
  }
})
