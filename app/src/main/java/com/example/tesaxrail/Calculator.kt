package com.example.tesaxrail

/**
 * Simple calculator with basic arithmetic and validation logic.
 * Designed to be easily unit-testable with no Android dependencies.
 */
object Calculator {

    fun add(a: Int, b: Int): Int = a + b

    fun subtract(a: Int, b: Int): Int = a - b

    fun multiply(a: Int, b: Int): Int = a * b

    /**
     * Divides a by b.
     * @throws IllegalArgumentException if b is zero.
     */
    fun divide(a: Int, b: Int): Double {
        require(b != 0) { "Cannot divide by zero" }
        return a.toDouble() / b.toDouble()
    }

    /**
     * Checks if a number is even.
     */
    fun isEven(number: Int): Boolean = number % 2 == 0

    /**
     * Returns the factorial of n.
     * @throws IllegalArgumentException if n is negative.
     */
    fun factorial(n: Int): Long {
        require(n >= 0) { "Factorial is not defined for negative numbers" }
        return if (n <= 1) 1L else n * factorial(n - 1)
    }

    /**
     * Returns the nth Fibonacci number (0-indexed).
     * @throws IllegalArgumentException if n is negative.
     */
    fun fibonacci(n: Int): Long {
        require(n >= 0) { "Fibonacci is not defined for negative indices" }
        if (n <= 1) return n.toLong()
        var a = 0L
        var b = 1L
        for (i in 2..n) {
            val temp = a + b
            a = b
            b = temp
        }
        return b
    }
}
