package com.example.tesaxrail

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.tesaxrail.ui.theme.TesAxrailTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            TesAxrailTheme {
                Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                    MainScreen(modifier = Modifier.padding(innerPadding))
                }
            }
        }
    }
}

@Composable
fun MainScreen(modifier: Modifier = Modifier) {
    var nameInput by remember { mutableStateOf("") }
    var greetingResult by remember { mutableStateOf("") }
    var counter by remember { mutableIntStateOf(0) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Top
    ) {
        Text(
            text = "Axrail Test App",
            style = MaterialTheme.typography.headlineMedium
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Name input section
        OutlinedTextField(
            value = nameInput,
            onValueChange = { nameInput = it },
            label = { Text("Enter your name") },
            modifier = Modifier
                .fillMaxWidth()
                .semantics { contentDescription = "Name Input" }
        )

        Spacer(modifier = Modifier.height(12.dp))

        Button(
            onClick = { greetingResult = "Hello, $nameInput!" },
            modifier = Modifier.semantics { contentDescription = "Greet Button" }
        ) {
            Text("Say Hello")
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Greeting result
        if (greetingResult.isNotEmpty()) {
            Text(
                text = greetingResult,
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.semantics { contentDescription = "Greeting Result" }
            )
        }

        Spacer(modifier = Modifier.height(32.dp))

        // Counter section
        Text(
            text = "Counter: $counter",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { contentDescription = "Counter Display" }
        )

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Button(
                onClick = { counter++ },
                modifier = Modifier.semantics { contentDescription = "Increment Button" }
            ) {
                Text("+1")
            }

            Button(
                onClick = { counter-- },
                modifier = Modifier.semantics { contentDescription = "Decrement Button" }
            ) {
                Text("-1")
            }

            Button(
                onClick = { counter = 0 },
                modifier = Modifier.semantics { contentDescription = "Reset Button" }
            ) {
                Text("Reset")
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
fun MainScreenPreview() {
    TesAxrailTheme {
        MainScreen()
    }
}
