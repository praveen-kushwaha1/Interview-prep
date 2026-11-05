
# Java Exception Handling

Understand exception handling from basic to advanced concepts.

!!! info "Topic"
    Core Java | Exception Handling | Interview Preparation

---

## Q1. What is an exception in Java?

<badge color="success">Basic</badge>

An exception is an unexpected event that occurs during program execution and interrupts the normal flow of instructions.

### Example

```java
public class ExceptionExample {

    public static void main(String[] args) {

        int result = 10 / 0;

        System.out.println(result);
    }
}
```

### Explanation

The above program throws ArithmeticException because integer division by zero is not allowed.

### Interview Tip

Explain that exceptions represent abnormal conditions that an application can handle.

---

## Q2. What is exception handling?

<badge color="success">Basic</badge>

Exception handling is the mechanism used to detect and handle runtime problems so that an application can respond appropriately.

### Example

```java
public class ExceptionHandlingExample {

    public static void main(String[] args) {

        try {
            int result = 10 / 0;
            System.out.println(result);
        } catch (ArithmeticException exception) {
            System.out.println("Cannot divide by zero");
        }
    }
}
```

### Interview Tip

Explain try, catch, finally, throw and throws.

---

## Q3. Why do we need exception handling?

<badge color="success">Basic</badge>

Exception handling helps applications:

1. Prevent unexpected termination where recovery is possible.
2. Maintain application stability.
3. Separate business logic from error-handling logic.
4. Provide meaningful error messages.
5. Support proper logging and debugging.

---

## Q4. What is the difference between Exception and Error?

<badge color="warning">Intermediate</badge>

| Exception | Error |
|---|---|
| Usually represents conditions an application may handle. | Usually represents serious system or JVM problems. |
| Can be checked or unchecked. | Generally unchecked. |
| Examples: IOException, SQLException. | Examples: OutOfMemoryError, StackOverflowError. |

---

## Q5. Checked vs Unchecked Exceptions

<badge color="warning">Intermediate</badge>

| Checked | Unchecked |
|---|---|
| Checked at compile time. | Not checked at compile time. |
| Must be caught or declared. | No mandatory catch or declaration. |
| IOException | NullPointerException |
| SQLException | ArithmeticException |

---

## Q6. Java Exception Hierarchy

<badge color="danger">Advanced</badge>

```text
Object
  |
Throwable
  |
  +--- Error
  |
  +--- Exception
         |
         +--- RuntimeException
         |
         +--- IOException
         |
         +--- SQLException
```

!!! tip "Advanced Interview Tip"
    Explain Throwable, Exception, RuntimeException and Error with practical examples.
