package com.example.tesaxrail

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CalculatorTest {

    // --- Addition ---

    @Test
    fun should_return_sum_when_adding_two_positive_numbers() {
        // Arrange
        val a = 3
        val b = 7

        // Act
        val result = Calculator.add(a, b)

        // Assert
        assertEquals(10, result)
    }

    @Test
    fun should_return_correct_sum_when_adding_negative_numbers() {
        // Arrange
        val a = -5
        val b = -3

        // Act
        val result = Calculator.add(a, b)

        // Assert
        assertEquals(-8, result)
    }

    // --- Subtraction ---

    @Test
    fun should_return_difference_when_subtracting() {
        // Arrange
        val a = 10
        val b = 4

        // Act
        val result = Calculator.subtract(a, b)

        // Assert
        assertEquals(6, result)
    }

    // --- Multiplication ---

    @Test
    fun should_return_product_when_multiplying() {
        // Arrange
        val a = 6
        val b = 7

        // Act
        val result = Calculator.multiply(a, b)

        // Assert
        assertEquals(42, result)
    }

    @Test
    fun should_return_zero_when_multiplying_by_zero() {
        // Arrange
        val a = 99
        val b = 0

        // Act
        val result = Calculator.multiply(a, b)

        // Assert
        assertEquals(0, result)
    }

    // --- Division ---

    @Test
    fun should_return_quotient_when_dividing() {
        // Arrange
        val a = 10
        val b = 4

        // Act
        val result = Calculator.divide(a, b)

        // Assert
        assertEquals(2.5, result, 0.0001)
    }

    @Test(expected = IllegalArgumentException::class)
    fun should_throw_exception_when_dividing_by_zero() {
        // Arrange
        val a = 10
        val b = 0

        // Act
        Calculator.divide(a, b)
    }

    // --- isEven ---

    @Test
    fun should_return_true_when_number_is_even() {
        // Arrange
        val number = 4

        // Act
        val result = Calculator.isEven(number)

        // Assert
        assertTrue(result)
    }

    @Test
    fun should_return_false_when_number_is_odd() {
        // Arrange
        val number = 7

        // Act
        val result = Calculator.isEven(number)

        // Assert
        assertFalse(result)
    }

    // --- Factorial ---

    @Test
    fun should_return_1_when_factorial_of_zero() {
        // Arrange
        val n = 0

        // Act
        val result = Calculator.factorial(n)

        // Assert
        assertEquals(1L, result)
    }

    @Test
    fun should_return_120_when_factorial_of_5() {
        // Arrange
        val n = 5

        // Act
        val result = Calculator.factorial(n)

        // Assert
        assertEquals(120L, result)
    }

    @Test(expected = IllegalArgumentException::class)
    fun should_throw_exception_when_factorial_of_negative() {
        // Arrange
        val n = -1

        // Act
        Calculator.factorial(n)
    }

    // --- Fibonacci ---

    @Test
    fun should_return_0_when_fibonacci_of_0() {
        // Arrange
        val n = 0

        // Act
        val result = Calculator.fibonacci(n)

        // Assert
        assertEquals(0L, result)
    }

    @Test
    fun should_return_8_when_fibonacci_of_6() {
        // Arrange
        val n = 6

        // Act
        val result = Calculator.fibonacci(n)

        // Assert
        assertEquals(8L, result)
    }

    @Test(expected = IllegalArgumentException::class)
    fun should_throw_exception_when_fibonacci_of_negative() {
        // Arrange
        val n = -3

        // Act
        Calculator.fibonacci(n)
    }
}
