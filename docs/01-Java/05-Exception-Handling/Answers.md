# Exception Handling Interview Answers

## Q1. What is an exception in Java?

An exception is an event that interrupts the normal
flow of program execution.

Example:

\```java
int result = 10 / 0;
\```

This causes ArithmeticException.

[⬆ Back to Questions](Questions.md)

---

## Q2. What is exception handling?

Exception handling is a mechanism used to handle
runtime problems without abruptly terminating
the application.

[⬆ Back to Questions](Questions.md)

---

## Q3. What is the exception hierarchy?

The root class of Java exceptions and errors is
`Throwable`.

It has two main subclasses:

- Exception
- Error

[⬆ Back to Questions](Questions.md)

---

## Q4. Difference between checked and unchecked exceptions?

Checked exceptions are checked by the compiler.

Unchecked exceptions occur at runtime.

[⬆ Back to Questions](Questions.md)

---

## Q5. Difference between throw and throws?

`throw` explicitly throws an exception.

`throws` declares possible exceptions in a method signature.

[⬆ Back to Questions](Questions.md)

---

## Q6. How does exception propagation work?

An exception propagates up the call stack until
a matching catch block handles it.

[⬆ Back to Questions](Questions.md)

---

## Q7. What is try-with-resources?

It automatically closes resources that implement
AutoCloseable.

[⬆ Back to Questions](Questions.md)

---

## Q8. How do you handle exceptions in Spring Boot REST APIs?

Use `@RestControllerAdvice` and `@ExceptionHandler`
to handle exceptions centrally and return appropriate
HTTP status codes and error responses.

[⬆ Back to Questions](Questions.md)