package com.example.tesaxrail

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import org.junit.Rule
import org.junit.Test

/**
 * Integration test that launches the actual MainActivity.
 * Verifies the full activity renders correctly.
 * Runs on emulator/device via: ./gradlew connectedAndroidTest
 */
class MainActivityTest {

    @get:Rule
    val composeTestRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun should_display_greeting_when_activity_launches() {
        // Assert — activity launches with "Hello Android!" by default
        composeTestRule.onNodeWithText("Hello Android!").assertIsDisplayed()
    }
}
