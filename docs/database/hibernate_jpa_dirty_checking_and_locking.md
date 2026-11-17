# 1. Dirty Checking in Hibernate/JPA

## 1.1 What is Dirty Checking?
**Dirty Checking** is a Hibernate mechanism that automatically detects changes made to a managed entity and generates the required `UPDATE` SQL query when the transaction is flushed.

**In simple words:**
- Fetch an employee from the database.
- Change the employee's name.
- Don't call `repository.save()`.
- Hibernate automatically detects the change.
- Hibernate generates an `UPDATE` query during flush/commit.

This is called **Dirty Checking**.

---

## 1.2 How does Dirty Checking work?
Suppose we have an `Employee` table:

**Initial Database State (`employee` table):**

| id | name | salary |
| :--- | :--- | :--- |
| 101 | Rahul | 30000 |
| 102 | Amit | 40000 |

Now we want to change Rahul's salary from **₹30,000** to **₹50,000**. Hibernate internally follows these steps:

1. **Fetch entity from database**
   ```java
   Employee employee = repository.findById(101L).get();
   ```
2. **Hibernate stores the original state (Snapshot)**
   ```text
   id = 101
   name = Rahul
   salary = 30000
   ```
3. **Modify entity**
   ```java
   employee.setSalary(50000);
   ```
4. **Hibernate compares entity with snapshot**
   - Original salary: `30000`
   - Current salary: `50000`
   - *Difference detected!*
5. **Hibernate generates `UPDATE` SQL**
   ```sql
   UPDATE employee
   SET salary = 50000
   WHERE id = 101;
   ```
6. **Transaction commits**
   - Changes are persisted in the database.

---

## 1.3 Practical Spring Boot Example

### `Employee.java`
```java
@Entity
@Table(name = "employee")
public class Employee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private double salary;

    // Getters and Setters
}
```

### `EmployeeRepository.java`
```java
@Repository
public interface EmployeeRepository extends JpaRepository<Employee, Long> {
}
```

### `EmployeeService.java`
```java
@Service
public class EmployeeService {

    private final EmployeeRepository employeeRepository;

    public EmployeeService(EmployeeRepository employeeRepository) {
        this.employeeRepository = employeeRepository;
    }

    @Transactional
    public void updateSalary(Long employeeId) {

        // Step 1: Fetch employee from database.
        // Hibernate makes this entity managed.
        Employee employee = employeeRepository
                .findById(employeeId)
                .orElseThrow(() -> new RuntimeException("Employee not found"));

        // Step 2: Modify the managed entity.
        // Hibernate detects this modification automatically.
        employee.setSalary(50000);

        // Step 3: No repository.save() required!
        // Hibernate detects changes during flush/commit.
    }
}
```
> **Important:** `save()` is not required here because the entity is already managed by the persistence context.

---

## 1.4 Managed vs Detached Entity
Dirty checking works only on **managed** entities.

| Entity State | Dirty Checking? |
| :--- | :--- |
| **Transient** | No |
| **Managed** | Yes |
| **Detached** | No |
| **Removed** | No normal update tracking |

**Managed Example:**
```java
@Transactional
public void updateEmployee() {
    Employee employee = employeeRepository.findById(101L).get();

    // Managed entity
    employee.setName("Rahul Kumar");

    // Dirty checking detects this change.
}
```

**Detached Example:**
```java
Employee employee = employeeRepository.findById(101L).get();

// Entity is detached after its persistence context closes.
employee.setName("Rahul Kumar");

// No automatic dirty checking here.
```

---

## 1.5 When does Hibernate execute `UPDATE`?
An important interview point: **Hibernate generally checks entity changes during flush.**

Flush can happen:
- Before transaction commit.
- When `EntityManager.flush()` is called.
- Automatically before certain queries, depending on flush mode.

> **Remember:** Flush is **not** the same as commit.
> - **Flush** sends pending SQL statements to the database.
> - **Commit** completes the database transaction.

---

## 1.6 Interview Questions (Dirty Checking)

**Q1. Is `save()` mandatory when updating an existing entity?**  
No. If the entity is managed within an active persistence context, Hibernate automatically detects modifications through dirty checking.

**Q2. Does dirty checking work for detached entities?**  
No. Detached entities are not tracked by the current persistence context.

**Q3. Does dirty checking execute `UPDATE` immediately?**  
No. Hibernate normally detects changes during flush and executes SQL then.

**Q4. How can we improve dirty checking performance?**  
- Avoid unnecessarily loading large numbers of entities.
- Use read-only transactions (`@Transactional(readOnly = true)`) for read-only operations.
- Use appropriate batch processing.
- Use DTO projections when entity management is unnecessary.

---

# 2. Optimistic vs Pessimistic Locking

These concepts are used to handle concurrent database updates.

**The Scenario:** Imagine two users trying to update the same bank account balance simultaneously:
- **Initial account balance:** ₹10,000
- **User A:** Withdraw ₹3,000
- **User B:** Withdraw ₹5,000

Both users read ₹10,000 at almost the same time. Without proper concurrency control, both transactions may overwrite each other's changes. This is called the **Lost Update Problem**.

There are two common solutions:
1. Optimistic Locking
2. Pessimistic Locking

---

## 2.1 Optimistic Locking
**Optimistic Locking** assumes that conflicts are rare. It allows multiple transactions to read the same record but checks for conflicting updates when they write. It commonly uses a `@Version` field.

### How does it work?
Suppose the database contains:

| id | balance | version |
| :--- | :--- | :--- |
| 101 | 10000 | 0 |

**Optimistic Locking Workflow:**
1. **Transaction A** reads `balance = 10000`, `version = 0`
2. **Transaction B** reads `balance = 10000`, `version = 0`
3. **Transaction A updates successfully:**
   ```sql
   UPDATE account
   SET balance = 7000,
       version = 1
   WHERE id = 101
     AND version = 0;
   -- Result: 1 row updated
   ```
4. **Transaction B tries to update:**
   ```sql
   UPDATE account
   SET balance = 5000,
       version = 1
   WHERE id = 101
     AND version = 0;
   -- Result: 0 rows updated
   ```
Version is now `1`, not `0`. Hibernate detects the conflict and throws an optimistic locking exception. Transaction B must reload the latest balance and retry or return a conflict response.

### Practical Implementation

#### `Account.java`
```java
@Entity
@Table(name = "account")
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private double balance;

    // Hibernate maintains this version automatically.
    @Version
    private Integer version;

    // Getters and Setters
}
```

#### `AccountService.java`
```java
@Service
public class AccountService {

    private final AccountRepository accountRepository;

    public AccountService(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    @Transactional
    public void withdraw(Long accountId, double amount) {

        // Fetch account and its current version.
        Account account = accountRepository
                .findById(accountId)
                .orElseThrow(() -> new RuntimeException("Account not found"));

        if (account.getBalance() < amount) {
            throw new RuntimeException("Insufficient balance");
        }

        // Modify the managed entity.
        account.setBalance(account.getBalance() - amount);

        // Hibernate checks the version during flush/commit.
        // If another transaction updated the record,
        // an optimistic locking exception is thrown.
    }
}
```
> **Note:** You don't need to manually increment the version. Hibernate handles it.  
> **Exception to know:** `ObjectOptimisticLockingFailureException` (Spring can translate the underlying Hibernate optimistic locking exception into this exception).

### When should you use Optimistic Locking?
- Multiple users update the same data occasionally.
- Conflicts are relatively rare.
- You don't want to lock database records while users are reading.
- High-read applications.
- Inventory or account update operations where version conflicts should be detected.

---

## 2.2 Pessimistic Locking
**Pessimistic Locking** assumes that conflicts may occur. It locks the database record so that competing transactions cannot modify it concurrently. Instead of detecting a conflict after an update, it prevents competing updates by acquiring a database lock first.

### How does it work?
Initial database:

| id | balance |
| :--- | :--- |
| 101 | 10000 |

**Pessimistic Locking Workflow:**
1. **Transaction A** reads account using `SELECT FOR UPDATE`:
   ```sql
   SELECT * FROM account
   WHERE id = 101
   FOR UPDATE;
   -- Exclusive row lock acquired
   ```
2. **Transaction B** tries to acquire the same row lock:
   - *Must wait.* It cannot acquire the conflicting lock until Transaction A releases it.
3. **Transaction A commits:**
   - Balance becomes ₹7,000. Lock is released.
4. **Transaction B continues:**
   - Reads the updated balance of ₹7,000 and performs its operation against the latest state.

### Practical Implementation

#### `AccountRepository.java`
```java
@Repository
public interface AccountRepository extends JpaRepository<Account, Long> {

    // Acquire a database write lock when fetching the account.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Account a WHERE a.id = :id")
    Optional<Account> findByIdWithLock(@Param("id") Long id);
}
```

#### `AccountService.java`
```java
@Service
public class AccountService {

    private final AccountRepository accountRepository;

    public AccountService(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    @Transactional
    public void withdraw(Long accountId, double amount) {

        // Fetch account with a database-level lock.
        Account account = accountRepository
                .findByIdWithLock(accountId)
                .orElseThrow(() -> new RuntimeException("Account not found"));

        if (account.getBalance() < amount) {
            throw new RuntimeException("Insufficient balance");
        }

        // Other transactions requesting conflicting locks
        // must wait until this transaction completes.
        account.setBalance(account.getBalance() - amount);
    }
}
```

Hibernate typically generates SQL similar to (exact SQL depends on the database):
```sql
SELECT *
FROM account
WHERE id = 101
FOR UPDATE;
```

### Types of Pessimistic Locking

| Lock Type | Meaning |
| :--- | :--- |
| `PESSIMISTIC_READ` | Acquires a shared/read lock where supported |
| `PESSIMISTIC_WRITE` | Acquires an exclusive/write lock |
| `PESSIMISTIC_FORCE_INCREMENT` | Acquires a lock and forces version increment for versioned entities |

### When should you use Pessimistic Locking?
- High contention on the same database record.
- Critical inventory updates.
- Financial operations requiring serialized access.
- Multiple transactions frequently update the same row.

> **Be careful:** Pessimistic locks can cause blocking, deadlocks, and reduced throughput.

---

# 3. Optimistic vs Pessimistic Locking – Comparison

| Feature | Optimistic | Pessimistic |
| :--- | :--- | :--- |
| **Approach** | Detect conflict | Prevent conflict |
| **Mechanism** | `@Version` | Database locks |
| **Lock acquired** | No long-held row lock | Yes |
| **Concurrent reads** | Allowed | Generally allowed depending on lock |
| **Conflict handling** | Exception | Waiting or timeout |
| **Performance** | Better with rare conflicts | Can reduce throughput |
| **Deadlock risk** | Lower | Higher |
| **Best for** | Low contention | High contention |

---

# 4. Real-World Banking Example

Suppose you are developing a banking application with two scenarios:

### Scenario A: Updating customer profile
Two users might occasionally update a customer's address.
- **Choice:** Use **Optimistic Locking**.
- **Why?**
  - Conflicts are rare.
  - No need to block other transactions.
  - If a conflict occurs, notify the user to refresh.

### Scenario B: Withdrawing money from an account
Multiple transactions may try to withdraw money from the same account.
- **Choice:** **Pessimistic Locking** can be useful when contention is high and you need to serialize access to the account row.
- **Note:** However, Optimistic Locking with proper atomic database updates and transaction handling can also work well. The correct choice depends on contention and consistency requirements.

---

# 5. Important Interview Questions

Test your understanding by answering these questions:

1. **Q1.** What is dirty checking in Hibernate?
2. **Q2.** Is `repository.save()` required when updating a managed entity?
3. **Q3.** What is `@Version` in JPA?
4. **Q4.** What happens when two transactions update the same versioned entity?
5. **Q5.** Does pessimistic locking block `SELECT` queries?
6. **Q6.** Can optimistic locking prevent lost updates?
7. **Q7.** Which locking strategy is better for banking applications?

---

# 6. Final Revision Notes

Remember these four points for interviews:
1. **Dirty Checking:** Automatically detects modifications in managed entities.
2. **Persistence Context:** Maintains managed entities and their snapshots.
3. **Optimistic Locking:** Uses `@Version` to detect concurrent modifications.
4. **Pessimistic Locking:** Uses database locks to control concurrent access.

> **Recommendation:** Practice all three concepts together using a Bank Account application. Implement dirty checking, then optimistic locking with `@Version`, and finally pessimistic locking with `PESSIMISTIC_WRITE`. This gives you a strong practical answer for a Senior Java Backend interview.