# Idempotency – 7 Important Microservices Interview Questions & Answers

These are important follow-up questions for a Java Backend Developer interview, especially when working on banking, wallet, fund transfer, and payment microservices.

Each question is explained in simple language with:
* Easy explanation
* Real-world payment example
* Spring Boot implementation approach
* Interview-ready answer

---

## 1. What is idempotency in REST APIs?

### Easy Explanation
Idempotency means performing the same operation multiple times produces the same final result as performing it once.

**For example:**
A customer sends a payment request to transfer ₹5,000.
* **First request:** ₹5,000 is deducted.
* **Second request:** No additional deduction.
* **Third request:** No additional deduction.

The final result remains the same.

### HTTP Methods and Idempotency

| HTTP Method | Idempotent? | Explanation |
| :--- | :--- | :--- |
| **GET** | Yes | Reading data does not change server state |
| **PUT** | Yes | Replacing a resource with the same data gives the same result |
| **DELETE** | Yes | Deleting an already deleted resource has the same final state |
| **POST** | Usually no | Repeated requests may create multiple records |
| **PATCH** | Depends | Depends on the operation being performed |

**Example:**
```http
PUT /api/accounts/101
{
  "accountHolder": "Praveen",
  "status": "ACTIVE"
}
```
Sending this request multiple times produces the same final account state.

However, with a `POST` request:
```http
POST /api/payments
```
Sending it multiple times could create multiple payments unless we implement idempotency.

### Interview-Ready Answer
> "Idempotency means that executing the same API request multiple times produces the same final result as executing it once. In payment applications, I implement idempotency using a unique idempotency key. If the client retries a request, the server identifies the duplicate and returns the previously stored result instead of processing the payment again."

---

## 2. What happens if two identical requests arrive simultaneously?
*(Important concurrency question)*

### Easy Explanation
Suppose a client sends the same payment request twice at almost the same time, and both requests reach the server.

Consider this scenario:

| Time | Request 1 | Request 2 |
| :--- | :--- | :--- |
| **T1** | Checks key | |
| **T2** | Key not found | |
| **T3** | | Checks key |
| **T4** | | Key not found |
| **T5** | Processes payment | |
| **T6** | | Processes payment |

Both requests see that the key does not exist. This is called a **race condition**. As a result, both requests may process the payment.

### How do we prevent it?
Use a **database unique constraint**.

```sql
CREATE TABLE idempotency_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    idempotency_key VARCHAR(100) NOT NULL,
    status VARCHAR(30),
    response_body TEXT,
    UNIQUE (idempotency_key)
);
```

Now, if two requests try to insert the same key:
* **Request 1** inserts successfully.
* **Request 2** gets a duplicate-key error.
* **Request 2** does not process the payment.

### Spring Boot Approach

```java
@Transactional
public PaymentResponse processPayment(
        String key,
        PaymentRequest request) {

    try {
        // Atomically reserve the idempotency key.
        repository.insertInProgress(key);

    } catch (DuplicateKeyException ex) {

        // Another request already owns this key.
        return handleExistingRequest(key);
    }

    // Only the request that successfully reserved
    // the key can execute the payment.
    return executePayment(request);
}
```

*Note: `insertInProgress()` should use an atomic database insert, not a separate check followed by insert.*

**Production Note:** Be careful with transaction boundaries. Depending on the database and isolation level, a competing insert may wait for the first transaction to commit or roll back. Handle that outcome and read the existing record in a suitable transaction.

### Interview-Ready Answer
> "If two identical requests arrive simultaneously, a simple database check is not sufficient because both requests might find that the key does not exist. I prevent this using a unique constraint on the idempotency key and an atomic insert operation. Only one request can reserve the key and process the payment. The other request either waits for the first transaction or receives a duplicate-key response and returns the existing payment result."

---

## 3. What if the server crashes after deducting money but before saving the idempotency record?
*(Very important banking scenario)*

### Easy Explanation
Suppose:
1. Client sends a ₹5,000 payment.
2. Server deducts ₹5,000.
3. Server crashes.
4. Idempotency record is not saved.
5. Client retries the request.
6. Server thinks it is a new request.
7. Another ₹5,000 may be deducted.

This is a serious problem.

### Solution 1: Database Transaction
If the payment deduction and idempotency record are stored in the same database, use one transaction.

```java
@Transactional
public PaymentResponse processPayment(
        String key,
        PaymentRequest request) {

    // Reserve idempotency key.
    repository.insertInProgress(key);

    // Deduct money.
    accountRepository.debit(
            request.getFromAccount(),
            request.getAmount()
    );

    // Create payment transaction.
    paymentRepository.save(createPayment(request));

    // Update idempotency result.
    repository.markSuccess(
            key,
            "Payment successful"
    );

    return new PaymentResponse("SUCCESS");
}
```

**What happens if the application crashes before commit?**
In a single database transaction:
1. Reserve idempotency key.
2. Deduct account balance.
3. Save payment record.
4. Save successful response.
5. Commit transaction (All changes committed together).

If the transaction fails before commit, all its database changes are rolled back.

### Solution 2: What if an external payment gateway is involved?
A database transaction cannot automatically roll back an external payment gateway transaction.

For example:
* Your service calls an external bank.
* The bank successfully deducts money.
* Your application crashes before recording the result.

In this case, use:
1. A unique payment reference.
2. The gateway's idempotency key, if supported.
3. Payment status reconciliation.
4. Gateway transaction status inquiry.
5. Retry using the same reference, not a new payment reference.

If the outcome is unknown, mark the payment as `UNKNOWN` or `PENDING_RECONCILIATION` rather than blindly retrying the debit.

### Interview-Ready Answer
> "I would handle this using database transactions if the account deduction and idempotency record belong to the same database. Both operations should commit or roll back together.
> However, if an external payment gateway is involved, a local database transaction cannot guarantee rollback of the external payment. In that case, I use a unique transaction reference, gateway-level idempotency, and reconciliation to verify the payment status before retrying."

---

## 4. How do you handle `IN_PROGRESS` payment requests?

### Easy Explanation
Suppose the first request is still processing, and the client sends the same request again. We need to identify whether the payment is:
* Still processing.
* Successfully completed.
* Failed.

For this, maintain payment states.

### Payment Status Lifecycle
* **`IN_PROGRESS`**: Payment request reserved and processing
* **`SUCCESS`**: Return saved response
* **`FAILED`**: Return failure result

### How to Handle Duplicate Requests

| Existing Status | Server Action |
| :--- | :--- |
| **`IN_PROGRESS`** | Return `HTTP 202 Accepted` or a suitable processing response |
| **`SUCCESS`** | Return previously saved successful response |
| **`FAILED`** | Return saved failure response or follow defined retry policy |
| **`UNKNOWN`** | Check payment status before taking further action |

**Example Response (`HTTP 202 Accepted`):**
```json
{
  "paymentId": "PAY1001",
  "status": "IN_PROGRESS",
  "message": "Payment is being processed"
}
```

The client can check payment status using:
```http
GET /api/payments/PAY1001/status
```

**Important:** Don't automatically change an old `IN_PROGRESS` record to `FAILED` just because a timeout occurred. The payment might have succeeded externally.

### Interview-Ready Answer
> "I maintain payment states such as `IN_PROGRESS`, `SUCCESS`, `FAILED` and `UNKNOWN`. When a duplicate request arrives, I check the existing status. If it is `IN_PROGRESS`, I return a processing response instead of executing the payment again. If it is `SUCCESS`, I return the saved response. For uncertain outcomes, I verify the actual payment status before retrying."

---

## 5. What is the difference between idempotency and duplicate request validation?

### Easy Explanation
Both prevent unwanted duplicate operations, but they solve different problems.
* **Duplicate request validation:** Checks whether a request is invalid or duplicated according to business rules.
* **Idempotency:** Ensures that retrying the same logical operation does not execute it again and returns the previous result.

### Example
Suppose a customer transfers ₹5,000.
* **Duplicate validation:** The customer submits the same payment twice because of a double-click. The application checks whether the same transaction reference already exists.
* **Idempotency:** The payment is already processed, but the client did not receive the response due to a network timeout. The client retries with the same idempotency key. The server returns the previous payment result.

### Comparison

| Feature | Duplicate Validation | Idempotency |
| :--- | :--- | :--- |
| **Main purpose** | Detect duplicate business operations | Safely handle retries |
| **Identification** | Business rules or transaction reference | Idempotency key |
| **Previous response** | Not necessarily returned | Usually returned |
| **Retry support** | Not necessarily | Yes |
| **Example** | Prevent duplicate order | Prevent duplicate payment |

### Spring Boot Example

**Duplicate validation:**
```java
if (paymentRepository.existsByTransactionReference(
        request.getTransactionReference())) {

    throw new DuplicatePaymentException(
            "Payment already exists"
    );
}
```

**Idempotency:**
```java
var existing = repository.findByIdempotencyKey(key);
if (existing.isPresent()) {
    return existing.get().getResponseBody();
}
```

### Interview-Ready Answer
> "Duplicate request validation checks whether an operation violates business rules, such as creating the same order twice. Idempotency is different because it handles client retries safely. For example, if a payment succeeds but the response times out, the client can retry with the same idempotency key, and the server returns the previous response without executing the payment again."

---

## 6. How do you implement idempotency in a microservices architecture?
*(Important system design question)*

### Easy Explanation
Suppose we have a banking application with multiple microservices:
* **Client:** Payment request + Idempotency Key
* **API Gateway:** Authentication and routing
* **Payment Service:** Idempotency check, payment reference, and transaction status
* **Account Service:** Debit / Credit
* **Notification Service:** Payment notification

Each service protects its own operations against duplicate processing.

### Practical Implementation
Consider a ₹5,000 transfer from Account A to Account B.

#### Step 1: Client sends the request
```http
POST /api/payments
Idempotency-Key: PAYMENT-101
```

#### Step 2: Payment Service
* Checks the idempotency key.
* Creates a payment record.
* Stores the payment reference.
* Coordinates the payment workflow.

#### Step 3: Account Service
The Payment Service sends a debit command:
```json
{
  "transactionId": "PAYMENT-101",
  "accountId": "ACC101",
  "amount": 5000,
  "operation": "DEBIT"
}
```
The Account Service maintains its own transaction reference with a unique constraint. If the same debit command arrives again, it does not debit the account twice.

#### Step 4: Notification Service
Suppose Kafka delivers the same payment-success event twice. The Notification Service maintains a processed-event table:
```sql
CREATE TABLE processed_events (
    event_id VARCHAR(100) PRIMARY KEY,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
If the event ID already exists, the consumer skips processing it again.

### Important Microservices Concepts

| Concept | Purpose |
| :--- | :--- |
| **Idempotency key** | Identifies the original client request |
| **Unique transaction ID** | Prevents duplicate business operations |
| **Database unique constraint** | Handles concurrent duplicate requests |
| **Kafka event ID** | Identifies duplicate messages |
| **Inbox pattern** | Tracks consumed messages |
| **Outbox pattern** | Reliably publishes database changes as events |
| **Saga pattern** | Coordinates distributed business transactions |
| **Reconciliation** | Resolves uncertain payment outcomes |

### What about the Saga pattern?
In microservices, each service has its own database. We generally cannot use one local `@Transactional` transaction across all services.

For example:
1. Payment Service initiates payment.
2. Account Service debits money.
3. Another operation credits the beneficiary.
4. Notification Service sends confirmation.

If a later step fails, the **Saga pattern** coordinates compensating actions where appropriate. Idempotency is still required in each service because messages and commands may be delivered more than once.

### Interview-Ready Answer
> "In a microservices architecture, I implement idempotency at multiple levels. The Payment Service maintains an idempotency key for incoming API requests. The Account Service uses a unique transaction reference to prevent duplicate debit or credit operations. For Kafka consumers, I use event IDs and an inbox or processed-event table to avoid duplicate message processing.
> I also use the transactional outbox pattern to reliably publish events and Saga for coordinating distributed transactions. This ensures that retries and duplicate messages do not result in duplicate business operations."

---

## 7. How do you handle retries using Resilience4j?
*(Relevant to Spring Boot microservices)*

### Easy Explanation
Sometimes a service fails temporarily because of:
* Network problems.
* Temporary database connectivity issues.
* Another microservice being unavailable.
* Gateway timeout.

Instead of immediately failing, we retry the operation.

**For example:**
Payment Service calls Account Service. The first request fails because of a temporary network issue, so the Payment Service retries the request. However, retrying a payment without idempotency can cause duplicate deductions. Therefore, we combine **Resilience4j Retry** with **idempotency**.

**Request Flow:**
1. **Payment Service** triggers **Resilience4j Retry** (Maximum 3 attempts).
2. Calls **Account Service** using the *same transaction ID* for every retry.
3. **Database** uses a unique transaction ID to prevent duplicate debits.

### Step 1: Add Maven Dependency
```xml
<dependency>
    <groupId>io.github.resilience4j</groupId>
    <artifactId>resilience4j-spring-boot3</artifactId>
</dependency>
```
*(Use the appropriate compatible Resilience4j version through your dependency management or Spring Boot dependency configuration.)*

### Step 2: Configure Retry (`application.yml`)
```yaml
resilience4j:
  retry:
    instances:
      accountService:
        max-attempts: 3
        wait-duration: 2s
        enable-exponential-backoff: true
        exponential-backoff-multiplier: 2
```

| Setting | Meaning |
| :--- | :--- |
| **`max-attempts`** | Maximum 3 total attempts |
| **`wait-duration`** | Initial wait of 2 seconds |
| **`exponential backoff`** | Increase wait time after each failure |
| **`multiplier`** | Double the wait duration |

### Step 3: Apply Retry Annotation
```java
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final AccountClient accountClient;

    @Retry(name = "accountService")
    public String debitAccount(
            String transactionId,
            BigDecimal amount) {

        return accountClient.debit(
                transactionId,
                amount
        );
    }
}
```
*Every retry must use the same `transactionId`.*

### Step 4: Protect Account Service
```java
@Transactional
public String debitAccount(
        String transactionId,
        BigDecimal amount) {

    // Check whether this transaction was already processed.
    if (repository.existsByTransactionId(transactionId)) {
        return "Already processed";
    }

    // Perform the debit and save the transaction
    // atomically in the same database transaction.
    accountRepository.debit(amount);

    repository.save(
        new AccountTransaction(transactionId, amount)
    );

    return "Debit successful";
}
```
*(For production, use an atomic reservation or database unique constraint on `transactionId`; a simple existence check alone is not safe under concurrency.)*

### Step 5: What happens during retry?

| Attempt | Account Service Result |
| :--- | :--- |
| **1** | Debit successful, response times out |
| **2** | Same transaction ID received |
| **3** | Already processed; return previous result |
| **Final Result** | Only ₹5,000 is deducted, even though the service receives three requests. |

### Important Production Considerations
1. **Retry only transient failures**, such as selected network errors and temporary service unavailability.
2. **Do not retry business failures** such as insufficient balance.
3. **Reuse the same idempotency key** or transaction ID on every attempt.
4. **Use exponential backoff and jitter** to avoid overwhelming the downstream service.
5. **Configure a Circuit Breaker** to stop repeated calls when a service is unhealthy.
6. **Be careful with timeouts:** a timeout does not mean the downstream operation failed.
7. **Avoid retrying at multiple layers** without a retry budget, because retries can multiply.

### Interview-Ready Answer
> "In Spring Boot microservices, I use Resilience4j Retry to handle temporary failures when communicating with downstream services. I configure maximum attempts, wait duration and exponential backoff.
> However, for payment operations, retry alone is not sufficient. I pass the same transaction ID or idempotency key with every retry. The downstream Account Service checks that transaction ID and prevents duplicate debit operations.
> I also configure Circuit Breaker and retry only transient failures. This ensures reliable communication without executing the same payment multiple times."

---

## Final Revision – Remember These 7 Concepts

| Question | Key Concept to Remember |
| :--- | :--- |
| **1. What is idempotency?** | Same operation, same final result |
| **2. Simultaneous requests?** | Unique constraint + atomic insert |
| **3. Server crashes?** | Database transaction + reconciliation |
| **4. `IN_PROGRESS` handling?** | Payment state management |
| **5. Idempotency vs validation?** | Safe retries vs business duplicate checks |
| **6. Microservices implementation?** | Idempotency + Inbox + Outbox + Saga |
| **7. Resilience4j retries?** | Retry + backoff + same transaction ID |

---

## Important Concepts to Prepare Next
These concepts are closely connected to payment reliability and are frequently discussed in senior Java backend interviews:
1. **Database:** ACID properties, transaction isolation, optimistic and pessimistic locking.
2. **Concurrency:** Race conditions, atomic operations, distributed locks.
3. **Microservices:** Saga, Outbox, Inbox, eventual consistency.
4. **Kafka:** At-least-once delivery, duplicate messages, consumer idempotency.
5. **Resilience4j:** Retry, Circuit Breaker, Rate Limiter, Bulkhead, TimeLimiter.

> **One important interview lesson:** Idempotency does not mean a request executes only once at the network level. It means the business operation produces its intended effect only once, even when requests or messages are delivered multiple times.