package com.lingguang.catcher.wear

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.speech.RecognizerIntent
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast

class WearMainActivity : Activity() {

    private val SPEECH_REQUEST_CODE = 0
    private lateinit var tvStatus: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_wear_main)

        tvStatus = findViewById(R.id.tv_status)
        val btnMic: ImageView = findViewById(R.id.btn_mic)

        btnMic.setOnClickListener {
            startSpeechRecognition()
        }
    }

    private fun startSpeechRecognition() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        }
        try {
            startActivityForResult(intent, SPEECH_REQUEST_CODE)
        } catch (e: Exception) {
            Toast.makeText(this, "语音识别不可用", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == SPEECH_REQUEST_CODE && resultCode == RESULT_OK) {
            val results = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
            val spokenText = results?.get(0)
            if (spokenText != null) {
                tvStatus.text = "已采集:\n$spokenText"
                // Next step: send via Wearable DataLayer API MessageClient
                // Wearable.getMessageClient(this).sendMessage(...)
            }
        }
        super.onActivityResult(requestCode, resultCode, data)
    }
}
