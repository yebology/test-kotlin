package com.example.tesaxrail

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import com.example.tesaxrail.ui.theme.TesAxrailTheme
import org.junit.Rule
import org.junit.Test

/**
 * Compose UI tests for the Greeting composable.
 * Runs on emulator/device via: ./gradlew connectedAndroidTest
 */
class GreetingTest {

    @get:Rule
    val composeTestRule = createComposeRule()

    @Test
    fun should_display_hello_android_when_name_is_android() {
        // Arrange & Act
        composeTestRule.setContent {
            TesAxrailTheme {
                Greeting(name = "Android")
            }
        }

        // Assert
        composeTestRule.onNodeWithText("Hello Android!").assertIsDisplayed()
    }

    @Test
    fun should_display_hello_world_when_name_is_world() {
        // Arrange & Act
        composeTestRule.setContent {
            TesAxrailTheme {
                Greeting(name = "World")
            }
        }

        // Assert
        composeTestRule.onNodeWithText("Hello World!").assertIsDisplayed()
    }

    @Test
    fun should_display_greeting_with_empty_name() {
        // Arrange & Act
        composeTestRule.setContent {
            TesAxrailTheme {
                Greeting(name = "")
            }
        }

        // Assert
        composeTestRule.onNodeWithText("Hello !").assertIsDisplayed()
    }
}
