# Spring Boot Database Connection Exhaustion: Production Troubleshooting Guide

This is a very common Spring Boot production performance issue, especially in microservices and banking applications. 

The first thing I would investigate is **why database connections are not being released** or **why all connections are busy for too long**.

Let's understand it step by step.

---

## 1. Understand the Problem

Suppose your Spring Boot application normally responds in **200 ms**. Suddenly, in production:
* API response time increases to **5–10 seconds**.
* CPU usage is **normal**.
* Database connections are **exhausted**.
* New API requests are waiting for database connections.

Imagine your application has a maximum of 10 database connections.

### Example: Database Connection Pool
| Metric | Value |
| :--- | :--- |
| **Maximum connections** | 10 |
| **Currently busy** | 10 / 10 |
| **Available connections** | 0 |

All 10 connections are occupied. New requests must wait until a connection becomes available, and this waiting period increases API response time.

---

## 2. What Would I Investigate First?

I would investigate these five things, in this order:

### 1. Connection Leaks
**Question:** Are database connections being released properly?

**Bad Example (Connection Leak):**
```java
Connection connection = dataSource.getConnection();

// Execute database operation

// Connection is not closed!
```
If connections are not released, they remain occupied indefinitely.

**Correct Approach:**
```java
try (Connection connection = dataSource.getConnection()) {

    // Execute database operation

} // Connection automatically closes here
```
> **Note:** In Spring Data JPA, Spring normally manages connections for you. I would check custom JDBC code and manual transaction handling.

---

### 2. Long-Running Database Queries
**Question:** Are SQL queries taking too much time?

**Example:**
```sql
SELECT * FROM accounts WHERE account_id = 101;
```
* **Previously:** Execution time was `20 ms`.
* **Now:** Because of missing indexes or increased data volume, execution time is `5 seconds`.

The connection remains occupied while the query executes. To resolve this, I would check:
* Slow SQL queries.
* Missing database indexes.
* Database execution plans (`EXPLAIN`).
* Database locks.

---

### 3. Long-Running Transactions
**Question:** Are transactions staying open for too long?

**Example:**
```java
@Transactional
public void transferMoney() {

    Account account = accountRepository.findById(1L)
            .orElseThrow();

    // Database transaction remains open.

    callExternalPaymentService(); // Takes 5 seconds

    account.setBalance(account.getBalance() - 1000);

}
```
Here, the application makes an external API call while the database transaction is open, holding a database connection unnecessarily. I would move external API calls **outside** the database transaction where the business flow allows it.

---

### 4. Connection Pool Configuration
Spring Boot commonly uses **HikariCP**. I would check the following properties in `application.properties` or `application.yml`:

```properties
spring.datasource.hikari.maximum-pool-size=10
spring.datasource.hikari.connection-timeout=30000
spring.datasource.hikari.leak-detection-threshold=20000
```

I would monitor:
* Active connections
* Idle connections
* Pending connection requests
* Connection acquisition time
* Connection timeout errors

> **Best Practice:** I would *not* immediately increase the pool size without understanding the root cause.

---

### 5. Database Performance and Locks
I would check whether:
* Database CPU or memory is overloaded.
* Other queries are blocking transactions.
* Database locks or deadlocks are causing waiting.
* Maximum database connections on the DB server itself are reached.

---

## 3. What Tools Would I Use?

| Tool | What I Investigate |
| :--- | :--- |
| **Spring Boot Actuator** | Application health and metrics |
| **HikariCP Metrics** | Active, idle, and pending connections |
| **Grafana** | Connection usage trends over time |
| **Prometheus** | Connection pool metrics scraping |
| **Kibana / ELK** | Errors and slow application logs |
| **Database Monitoring** | Slow queries, execution plans, and locks |

---

## 4. How Would I Explain This in an Interview?

### Interview-Ready Answer
> "I would first investigate database connection pool exhaustion rather than CPU usage because the application is likely waiting for database connections.
> 
> I would check HikariCP metrics, especially active connections, idle connections, and pending threads. Then I would investigate possible connection leaks, slow SQL queries, long-running transactions, and database locks.
> 
> For example, if an API makes an external service call inside a `@Transactional` method, the database connection might remain occupied while waiting for the external service.
> 
> I would use Spring Boot Actuator, Prometheus, and Grafana to identify the bottleneck, and I would fix the root cause first instead of blindly increasing the connection pool size."