# NexusAid Security Specification

## 1. Data Invariants
- A **Request** must have a `victimName`, `phone`, `location`, and valid `status`.
- A **Delivery** must reference a valid `requestId` and have `currentLocation`.
- **Obstacles** are public but only verifiable personnel can create them (modeled as open for now, can be restricted later).
- **UpdatedAt** must reflect the `request.time`.

## 2. The Dirty Dozen Payloads (Target: Requests)
1. Missing victimName on create
2. Invalid urgency (ghost urgency)
3. Spoofing createdAt (client-side timestamp)
4. Modifying victimName after creation
5. Deleting someone else's request (if identity was used)
6. Updating status to 'completed' without being an NGO (relational check)
7. Injection of 1MB string into disasterName
8. Negative peopleCount
9. Missing address
10. Orphaned Delivery (requestId doesn't exist)
11. Bypassing state machine (jumping from pending to completed instantly)
12. Creating a request on behalf of another phone number (if phone verification existed)

## 3. Test Runner (Draft)
```ts
// firestore.rules.test.ts
// (Implementation details for testing framework)
```
